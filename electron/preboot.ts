/**
 * preboot — helpers froids partagés (fix 1.1.31, clean SEV-2/SEV-3).
 *
 * Déduplication de :
 * - electron/main.ts [1.5/4] preBootRepair / prunePreBootBackups / stamp
 * - electron/migration-runner.ts stamp / vacuumIntoBackup helpers
 * - electron/tools/repair-temporary-tables.ts stamp / isSafeGhost
 * - specs miroirs (boot-sequence.spec.ts, migration-upgrade.spec.ts)
 *
 * Règles :
 * - Aucun import Electron ici (importable en vitest node + tsx CLI).
 * - Toutes les copies froides passent par checkpoint TRUNCATE best-effort
 *   + copie du trio .db/.wal/.shm/.journal (SEV-2.3 : copies froides
 *   ignoraient WAL → backup/restore partiels).
 * - stamp() inclut le pid (`YYYYMMDD-HHMMSS-<pid>`) pour éviter les
 *   collisions à la seconde (SEV-3).
 * - prune* keep=5 symétrique pre-boot / pre-migration / pre-repair.
 * - DROP fantôme uniquement si la table réelle existe (garde hasReal via
 *   sqlite_master, aligné migration 174:54-61). Sinon skip+warn (SEV-2.2).
 * - Logs : basename uniquement (pas de PII chemin absolu en console) ;
 *   le chemin complet reste pour errorBox côté appelant (SEV-3).
 */
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";

export const GHOST_PREFIX = "temporary_";
export const GHOST_RE = /^temporary_[A-Za-z0-9_]+$/;

export function isSafeGhost(name: string): boolean {
  return GHOST_RE.test(name);
}

/** Table réelle correspondant à un fantôme `temporary_X` → `X`. */
export function realTableForGhost(ghost: string): string {
  return ghost.replace(/^temporary_/, "");
}

/**
 * stamp — `YYYYMMDD-HHMMSS-<pid>`.
 * Le suffixe pid évite les collisions quand deux boots/outils tournent
 * dans la même seconde (SEV-3). Format triable lexicalement par date,
 * puis pid (ordre stable, prune garde les plus récents).
 */
export function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  const base =
    `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-` +
    `${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
  return `${base}-${process.pid}`;
}

/** basename pour logs (anti-PII chemin absolu, SEV-3). */
export function logName(p: string): string {
  try {
    return path.basename(p);
  } catch {
    return String(p).slice(-60);
  }
}

/** Prune générique : garde les `keep` plus récents (tri lexical). */
export function pruneBackups(dbPath: string, infix: string, keep = 5): void {
  try {
    const dir = path.dirname(dbPath);
    const base = path.basename(dbPath);
    const prefix = `${base}.${infix}-`;
    const files = fs
      .readdirSync(dir)
      .filter((f) => f.startsWith(prefix) && f.endsWith(".db"))
      .map((f) => path.join(dir, f))
      .sort();
    while (files.length > keep) {
      const oldest = files.shift()!;
      try {
        fs.rmSync(oldest, { force: true });
      } catch {
        /* best-effort */
      }
    }
  } catch {
    /* best-effort */
  }
}

export function prunePreBootBackups(dbPath: string, keep = 5): void {
  pruneBackups(dbPath, "pre-boot", keep);
}

export function prunePreMigrationBackups(dbPath: string, keep = 5): void {
  pruneBackups(dbPath, "pre-migration", keep);
}

export function prunePreRepairBackups(dbPath: string, keep = 5): void {
  pruneBackups(dbPath, "pre-repair", keep);
}

/**
 * checkpointTruncate — force l'intégration du WAL dans le .db avant
 * toute copie froide (SEV-2.3). Best-effort : ne bloque jamais le boot.
 */
export function checkpointTruncate(dbPath: string): void {
  let cold: any = null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BetterSqlite3 = require("better-sqlite3");
    cold = new BetterSqlite3(dbPath);
    try {
      cold.exec("PRAGMA wal_checkpoint(TRUNCATE)");
    } catch {
      /* best-effort */
    }
  } catch {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DatabaseSync } = require("node:sqlite");
      cold = new DatabaseSync(dbPath);
      try {
        cold.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      } catch {
        /* best-effort */
      }
    } catch {
      /* ni driver dispo : on copie quand même le trio */
    }
  } finally {
    try {
      cold?.close?.();
    } catch {
      /* best-effort */
    }
  }
}

/** Sidecars WAL à copier avec le .db (si présents). */
const SIDECAR_SUFFIXES = [".wal", ".shm", ".journal", "-wal", "-shm", "-journal"];

function sidecarCandidates(dbPath: string): string[] {
  // SQLite classique : database.db-wal / -shm / -journal.
  // Certains toolings écrivent .db.wal ; on couvre les deux formes.
  return SIDECAR_SUFFIXES.map((s) => `${dbPath}${s}`);
}

/**
 * coldCopyWithWal — copie froide cohérente (SEV-2.3) :
 * 1. CHECKPOINT(TRUNCATE) best-effort,
 * 2. copyFile du .db + fsync,
 * 3. copie des sidecars présents (best-effort).
 */
export async function coldCopyWithWal(src: string, dest: string): Promise<void> {
  checkpointTruncate(src);
  await fsp.copyFile(src, dest);
  try {
    const fh = await fsp.open(dest, "r+");
    try {
      await fh.sync();
    } finally {
      await fh.close().catch(() => undefined);
    }
  } catch {
    /* best-effort */
  }
  for (const sidecar of sidecarCandidates(src)) {
    try {
      if (!fs.existsSync(sidecar)) continue;
      const suffix = sidecar.slice(src.length);
      await fsp.copyFile(sidecar, `${dest}${suffix}`);
    } catch {
      /* best-effort */
    }
  }
}

export function coldCopyWithWalSync(src: string, dest: string): void {
  checkpointTruncate(src);
  fs.copyFileSync(src, dest);
  try {
    const fd = fs.openSync(dest, "r+");
    try {
      fs.fsyncSync(fd);
    } finally {
      fs.closeSync(fd);
    }
  } catch {
    /* best-effort */
  }
  for (const sidecar of sidecarCandidates(src)) {
    try {
      if (!fs.existsSync(sidecar)) continue;
      const suffix = sidecar.slice(src.length);
      fs.copyFileSync(sidecar, `${dest}${suffix}`);
    } catch {
      /* best-effort */
    }
  }
}

/** Supprime les sidecars WAL après un restore par rename (SEV-2.3). */
export async function cleanupWalSidecars(dbPath: string): Promise<void> {
  for (const sidecar of sidecarCandidates(dbPath)) {
    try {
      if (fs.existsSync(sidecar)) await fsp.unlink(sidecar);
    } catch {
      /* best-effort */
    }
  }
}

export function cleanupWalSidecarsSync(dbPath: string): void {
  for (const sidecar of sidecarCandidates(dbPath)) {
    try {
      if (fs.existsSync(sidecar)) fs.rmSync(sidecar, { force: true });
    } catch {
      /* best-effort */
    }
  }
}

// --- Helpers froids génériques (better-sqlite3 | node:sqlite) ---------------

export type ColdKind = "better-sqlite3" | "node:sqlite";

/** Liste les fantômes `temporary_*` sûrs (regex allowlist). */
export function listGhosts(cold: any): string[] {
  const rows = (cold.prepare(
    `SELECT name FROM sqlite_master WHERE type = 'table' AND name LIKE 'temporary_%'`
  ).all() as Array<{ name: string }>)
    .map((r) => String(r.name))
    .filter(isSafeGhost);
  return rows;
}

/** Vérifie l'existence d'une table réelle via sqlite_master. */
export function hasRealTable(cold: any, name: string): boolean {
  try {
    const rows = (cold.prepare(
      `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`
    ).all(name) as unknown[]) as unknown[];
    // node:sqlite: .all(param) traite param comme 1er bind ; better-sqlite3
    // attend .all(...params). On replie si le 1er appel échoue par forme.
    void rows;
    return (rows?.length ?? 0) > 0;
  } catch {
    try {
      const rows2 = (cold.prepare(
        `SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?`
      ).all([name]) as unknown[]) as unknown[];
      return (rows2?.length ?? 0) > 0;
    } catch {
      return false;
    }
  }
}

/** Première ligne de PRAGMA integrity_check ("" si illisible). */
export function integrityFirst(cold: any): string {
  try {
    const rows = cold.prepare(`PRAGMA integrity_check`).all() as Array<Record<string, unknown>>;
    return rows?.[0] ? String(Object.values(rows[0])[0]) : "";
  } catch {
    return "";
  }
}

/**
 * dropGhosts — DROP TABLE IF EXISTS uniquement si la table réelle existe
 * (garde hasReal, SEV-2.2). Retourne { dropped, skipped }.
 */
export function dropGhosts(
  cold: any,
  ghosts: string[]
): { dropped: string[]; skipped: string[] } {
  const dropped: string[] = [];
  const skipped: string[] = [];
  for (const g of ghosts) {
    if (!isSafeGhost(g)) {
      skipped.push(g);
      continue;
    }
    const real = realTableForGhost(g);
    let realExists = false;
    try {
      realExists = hasRealTable(cold, real);
    } catch {
      realExists = false;
    }
    if (!realExists) {
      console.warn(
        `[preboot] Fantôme ${g} sans table réelle ${real} — skip (pas de purge).`
      );
      skipped.push(g);
      continue;
    }
    cold.exec(`DROP TABLE IF EXISTS "${g}"`);
    dropped.push(g);
  }
  return { dropped, skipped };
}

function openCold(dbPath: string): { cold: any; kind: ColdKind } | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const BetterSqlite3 = require("better-sqlite3");
    return { cold: new BetterSqlite3(dbPath), kind: "better-sqlite3" };
  } catch {
    /* repli node:sqlite */
  }
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { DatabaseSync } = require("node:sqlite");
    return { cold: new DatabaseSync(dbPath), kind: "node:sqlite" };
  } catch {
    return null;
  }
}

/**
 * preBootRepair — étape [1.5/4] froide AVANT initialize (fix 1.1.31).
 * 1. copie froide .pre-boot-<stamp>-<pid>.db (trio WAL) + prune keep=5,
 * 2. ouverture froide, DROP fantômes (garde hasReal), integrity_check,
 * 3. close. Retourne le backup path ou null (fresh).
 */
export function preBootRepair(dbPath: string): string | null {
  if (!dbPath || !fs.existsSync(dbPath)) {
    console.log("[1.5/4] Pas de DB pré-existante (fresh) — pre-boot repair ignoré.");
    return null;
  }
  const backupPath = `${dbPath}.pre-boot-${stamp()}.db`;
  coldCopyWithWalSync(dbPath, backupPath);
  prunePreBootBackups(dbPath, 5);
  console.log(`[1.5/4] Backup froid pré-boot : ${logName(backupPath)}`);

  const opened = openCold(dbPath);
  if (!opened) {
    console.warn(
      "[1.5/4] Ouverture froide impossible (ni better-sqlite3 ni node:sqlite) — poursuite sans repair froid."
    );
    return backupPath;
  }
  const { cold } = opened;
  try {
    const ghosts = listGhosts(cold);
    if (ghosts.length > 0) {
      console.log(`[1.5/4] Fantômes détectés (${ghosts.length}) : ${ghosts.join(", ")} → DROP...`);
    } else {
      console.log("[1.5/4] Aucun fantôme temporary_*.");
    }
    const { dropped, skipped } = dropGhosts(cold, ghosts);
    if (skipped.length > 0) {
      console.warn(`[1.5/4] Fantômes sans réelle ignorés (${skipped.length}) : ${skipped.join(", ")}`);
    }
    if (dropped.length > 0) {
      console.log(`[1.5/4] Fantômes purgés (${dropped.length}) : ${dropped.join(", ")}`);
    }
    const integFirst = integrityFirst(cold);
    if (integFirst.toLowerCase() !== "ok") {
      // Log basename (anti-PII) ; le chemin complet reste pour errorBox appelant.
      throw new Error(
        `INTEGRITY_CHECK_FAILED (pre-boot froid) : ${integFirst.slice(0, 200)} — backup froid : ${logName(backupPath)}`
      );
    }
    console.log("[1.5/4] Pre-boot repair OK (fantômes purgés, integrity_check=ok).");
  } finally {
    try {
      cold?.close?.();
    } catch {
      /* best-effort */
    }
  }
  return backupPath;
}
