/**
 * migration-dryrun — simule les migrations sur une copie /tmp SANS toucher la vraie DB.
 *
 * Procédé :
 *  1. VACUUM INTO (ou copyFile si DS fermée) de la DB prod vers /tmp/e-school-dryrun-<pid>.db
 *  2. ouvre un DataSource CLI sur la copie (synchronize:false)
 *  3. BEGIN → ensureBaseline + runMigrations(transaction each) → collecte sqlite_master
 *     avant/après (diff tables/index) → ROLLBACK (aucune mutation persistée sur la copie,
 *     la copie reste un artefact jetable)
 *  4. affiche le diff + PRAGMA integrity_check, supprime la copie (sauf --keep).
 *
 * Usage : npm run migration:dryrun -- [--db /chemin/database.db] [--keep]
 * En dev, --db défaut : <userData>/database.db n'est pas accessible hors Electron ;
 * passez explicitement le chemin d'une copie de test.
 */
import "reflect-metadata";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { DataSource } from "typeorm";
import { createCliDataSource } from "./cli-datasource";
import { ensureBaseline } from "../migration-runner";

async function snapshotSchema(ds: DataSource): Promise<Map<string, string>> {
  const rows = (await ds.query(
    `SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL AND name NOT LIKE 'sqlite_%' ORDER BY type, name`
  )) as Array<{ type: string; name: string; sql: string }>;
  return new Map(rows.map((r) => [`${r.type}:${r.name}`, r.sql]));
}

function diffSnapshots(before: Map<string, string>, after: Map<string, string>): string[] {
  const out: string[] = [];
  for (const [k, sql] of after) {
    if (!before.has(k)) out.push(`+ ${k}\n    ${String(sql).slice(0, 300)}`);
    else if (before.get(k) !== sql) out.push(`~ ${k} (définition modifiée)`);
  }
  for (const k of before.keys()) {
    if (!after.has(k)) out.push(`- ${k} (supprimé — inattendu en additif)`);
  }
  return out;
}

async function main(): Promise<void> {
  const dbIdx = process.argv.indexOf("--db");
  const dbPath = dbIdx >= 0 ? process.argv[dbIdx + 1] : undefined;
  const keep = process.argv.includes("--keep");
  if (!dbPath) {
    console.error("Usage: migration:dryrun -- --db /chemin/database.db [--keep]");
    process.exit(2);
  }
  if (!fs.existsSync(dbPath)) {
    console.error(`[dryrun] DB introuvable : ${dbPath}`);
    process.exit(1);
  }
  const copyPath = path.join(os.tmpdir(), `e-school-dryrun-${process.pid}.db`);
  await fsp.copyFile(dbPath, copyPath);
  console.log(`[dryrun] Copie isolée : ${copyPath}`);

  const ds = createCliDataSource(copyPath);
  // Fix 1.1.31 : garde-fou — le dryrun ne doit jamais synchroniser.
  if ((ds.options as unknown as { synchronize?: boolean }).synchronize) {
    throw new Error("DRYRUN_GUARD: synchronize doit être false (fix 1.1.31).");
  }
  console.log("[dryrun] synchronize=false (fix 1.1.31) — simulation migrations seules.");
  await ds.initialize();
  try {
    const before = await snapshotSchema(ds);
    await ds.query("BEGIN");
    try {
      const marked = await ensureBaseline(ds);
      console.log(`[dryrun] ensureBaseline : ${marked ? "baseline marquée (legacy)" : " inchangée (fresh ou déjà migré)"}`);
      const ran = await ds.runMigrations({ transaction: "each" });
      console.log(`[dryrun] Migrations simulées : ${ran.length ? ran.map((m) => m.name).join(", ") : "(aucune)"}`);
      const after = await snapshotSchema(ds);
      const diff = diffSnapshots(before, after);
      console.log(`[dryrun] Diff schéma (${diff.length} changement(s)) :`);
      for (const d of diff.slice(0, 100)) console.log(`  ${d}`);
      const integ = (await ds.query("PRAGMA integrity_check")) as Array<Record<string, unknown>>;
      console.log(`[dryrun] integrity_check : ${String(Object.values(integ[0])[0]).slice(0, 80)}`);
    } finally {
      await ds.query("ROLLBACK").catch(() => undefined);
      console.log("[dryrun] ROLLBACK effectué — copie non mutée par le run (artefact jetable).");
    }
  } finally {
    await ds.destroy().catch(() => undefined);
    if (!keep) await fsp.rm(copyPath, { force: true });
    else console.log(`[dryrun] Copie conservée (--keep) : ${copyPath}`);
  }
}

main().catch((e) => {
  console.error("[dryrun] FAILED:", e?.message ?? e);
  process.exit(1);
});
