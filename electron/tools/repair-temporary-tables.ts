/**
 * repair-temporary-tables — fix 1.1.31 (outil froid, hors Electron).
 *
 * Purge les fantômes `temporary_*` laissés par un copy-swap TypeORM
 * (synchronize) interrompu, qui faisaient boucler "already exists" au boot.
 *
 * Sécurité :
 * - --dry-run PAR DÉFAUT : liste + integrity_check, aucune mutation.
 * - --apply : backup `.pre-repair-<stamp>-<pid>.db` (trio WAL + fsync,
 *   CHECKPOINT best-effort) + prune keep=5, DROP TABLE IF EXISTS
 *   uniquement si la table réelle existe (garde hasReal via sqlite_master,
 *   skip+warn sinon), puis re-check.
 * - Ne touche JAMAIS aux tables réelles (garde LIKE temporary_% + regex).
 *
 * Usage :
 *   npm run repair:db -- --db /chemin/database.db            # dry-run (défaut)
 *   npm run repair:db -- --db /chemin/database.db --apply    # purge réelle
 */
import * as fs from "node:fs";
import {
  stamp,
  isSafeGhost,
  logName,
  realTableForGhost,
  prunePreRepairBackups,
  checkpointTruncate,
  coldCopyWithWal,
} from "../preboot";

function parseArgs(argv: string[]): { db?: string; apply: boolean } {
  const dbIdx = argv.indexOf("--db");
  const db = dbIdx >= 0 ? argv[dbIdx + 1] : undefined;
  const apply = argv.includes("--apply");
  return { db, apply };
}

function hasTable(cold: any, name: string): boolean {
  try {
    const rows = cold
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .all([name]) as unknown[];
    if (Array.isArray(rows)) return rows.length > 0;
  } catch {
    /* repli forme variadique */
  }
  try {
    const rows = cold
      .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`)
      .all(name) as unknown[];
    return Array.isArray(rows) && rows.length > 0;
  } catch {
    return false;
  }
}

async function main(): Promise<void> {
  const { db: dbPath, apply } = parseArgs(process.argv);
  const dryRun = !apply;
  if (!dbPath) {
    console.error("Usage: repair:db -- --db /chemin/database.db [--apply]");
    console.error("  sans --apply : --dry-run (défaut, aucune mutation).");
    process.exit(2);
  }
  if (!fs.existsSync(dbPath)) {
    // Anti-PII : basename en console ; le chemin complet reste pour l'opérateur via --db.
    console.error(`[repair] DB introuvable : ${logName(dbPath)}`);
    process.exit(1);
  }

  // Ouverture froide : better-sqlite3 prioritaire (même driver que la prod).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  let cold: any;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BetterSqlite3 = require("better-sqlite3");
    cold = new BetterSqlite3(dbPath);
  } catch (e) {
    console.error(`[repair] better-sqlite3 indisponible : ${(e as Error)?.message ?? e}`);
    console.error("[repair] Relancez `npm run rebuild:db-driver` puis réessayez.");
    process.exit(1);
  }

  try {
    const integ = (await cold.prepare("PRAGMA integrity_check").all()) as Array<Record<string, unknown>>;
    const first = integ?.[0] ? String(Object.values(integ[0])[0]) : "";
    console.log(`[repair] integrity_check (avant) : ${first.slice(0, 120)}`);

    const ghosts = (
      cold
        .prepare(`SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'temporary_%' ORDER BY name`)
        .all() as Array<{ name: string }>
    )
      .map((r) => String(r.name))
      .filter(isSafeGhost);
    console.log(`[repair] Fantômes temporary_* : ${ghosts.length ? ghosts.join(", ") : "(aucun)"}`);

    if (dryRun) {
      console.log("[repair] --dry-run (défaut) : aucune mutation. Relancez avec --apply pour purger.");
      if (first.toLowerCase() !== "ok") process.exitCode = 1;
      return;
    }

    // --apply : CHECKPOINT + backup trio WAL avant toute mutation (SEV-2.3).
    checkpointTruncate(dbPath);
    const backupPath = `${dbPath}.pre-repair-${stamp()}.db`;
    await coldCopyWithWal(dbPath, backupPath);
    prunePreRepairBackups(dbPath, 5);
    console.log(`[repair] Backup pré-repair : ${logName(backupPath)}`);

    let dropped = 0;
    let skipped = 0;
    for (const g of ghosts) {
      // SEV-2.2 : garde hasReal — purge uniquement si la table réelle
      // existe (aligné migration 174). Sinon skip+warn (le fantôme est
      // peut-être la seule copie d'un rename interrompu).
      const real = realTableForGhost(g);
      if (!hasTable(cold, real)) {
        console.warn(`[repair] SKIP "${g}" : table réelle "${real}" absente — purge refusée (backup : ${logName(backupPath)}).`);
        skipped++;
        continue;
      }
      // Re-vérifie l'existence du fantôme juste avant le DROP (TOCTOU-safe).
      if (!hasTable(cold, g)) continue;
      cold.exec(`DROP TABLE IF EXISTS "${g}"`);
      dropped++;
      console.log(`[repair] DROP TABLE IF EXISTS "${g}" OK`);
    }
    if (skipped > 0) {
      console.warn(`[repair] ${skipped} fantôme(s) sans réelle ignoré(s) — vérifiez le backup avant purge manuelle.`);
    }

    const after = (await cold.prepare("PRAGMA integrity_check").all()) as Array<Record<string, unknown>>;
    const afterFirst = after?.[0] ? String(Object.values(after[0])[0]) : "";
    console.log(`[repair] Purge : ${dropped} table(s). integrity_check (après) : ${afterFirst.slice(0, 120)}`);
    if (afterFirst.toLowerCase() !== "ok") {
      console.error(`[repair] integrity_check après purge != ok — backup conservé : ${logName(backupPath)}`);
      process.exitCode = 1;
    }
  } finally {
    try {
      cold?.close?.();
    } catch { /* best-effort */ }
  }
}

main().catch((e) => {
  console.error("[repair] FAILED:", e?.message ?? e);
  process.exit(1);
});
