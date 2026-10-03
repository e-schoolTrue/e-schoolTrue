/**
 * migration-runner — exécution sécurisée des migrations au boot (fix 1.1.31 : synchronize OFF).
 *
 * Ordre imposé par main.ts:startApplication :
 *   [1.5/4] preBootRepair à froid (backup + DROP temporary_* + integrity_check)
 *   → AppDataSource.initialize() (synchronize=false sauf E_SCHOOL_SYNC=1)
 *   → runMigrationsSafely(ds, dbPath) AVANT initializeServices()
 *   → initializeServices() uniquement si migrations OK.
 *
 * Garanties :
 *  1. backup pré-migration via VACUUM INTO `<db>.pre-migration-<stamp>.db`
 *     (snapshot cohérent, hors transaction, retry SQLITE_BUSY 3x backoff+jitter).
 *  2. pré-vérifs : PRAGMA integrity_check=ok + PRAGMA foreign_key_check vide.
 *  3. ensureBaseline : si pas de table `migrations` MAIS tables legacy
 *     (`user`/`T_student`) présentes → CREATE TABLE migrations + INSERT
 *     baseline mark-applied (1700000000000/Baseline1700000000000).
 *     Si ni `migrations` ni tables legacy → fresh install, on laisse vide
 *     (runMigrations jouera la baseline via up()).
 *  4. runMigrations({ transaction: "each" }) avec timeout 60s par migration
 *     (Promise.race + message explicite ; better-sqlite3 est synchrone donc
 *     le timeout est un garde-fou de détection, pas d'annulation).
 *  5. post-vérifs : PRAGMA integrity_check + PRAGMA table_info sur tables
 *     cœur (user, T_student, payments) + foreign_key_check.
 *  6. échec → restore auto depuis le backup VACUUM INTO (copy back à froid
 *     après ds.destroy(), puis ré-initialisation laissée à l'appelant qui
 *     doit relancer ou quitter proprement). Le backup est conservé pour audit.
 *
 * Perf : VACUUM INTO en O(n) pages, verrou SHARED bref (p50 < 200 ms sur
 * DB < 500 Mo). integrity_check en O(n). Le tout au boot reste < 2s typique.
 */
import "reflect-metadata";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import {
  stamp,
  prunePreMigrationBackups,
  logName,
  cleanupWalSidecars,
} from "./preboot";
import type { DataSource } from "typeorm";

export const BASELINE_TIMESTAMP = 1700000000000;
export const BASELINE_NAME = "Baseline1700000000000";
/** Liste code des migrations attendues (miroir data-source.ts, sans import cycle). */
export const KNOWN_MIGRATIONS: ReadonlyArray<{ timestamp: number; name: string }> = [
  { timestamp: 1700000000000, name: "Baseline1700000000000" },
  { timestamp: 1710000000000, name: "DriftCatchup1710000000000" },
  { timestamp: 1720000000000, name: "BackfillCounters1720000000000" },
  { timestamp: 1730000000000, name: "YearStatusSchoolYear1730000000000" },
  { timestamp: 1740000000000, name: "TranchConfigPrecision1740000000000" },
  { timestamp: 1750000000000, name: "DriftCatchup2175000000000" },
  { timestamp: 1760000000000, name: "RoleLegacyFix1760000000000" },
  { timestamp: 1770000000000, name: "DriftCatchup3177000000000" },
];
const MIGRATION_TIMEOUT_MS = 60_000;
const VACUUM_MAX_ATTEMPTS = 3;
/**
 * Allowlist des tables cœur vérifiées en postVerify (vérif seule, jamais de
 * CREATE/ALTER ici — identifiants sûrs, pas d'input user). 13 tables :
 * socle (user, T_student, payments, year_repartition, tranch_config) +
 * drift-175 (payment_annual_config, grading_config, grade_entry,
 * calculated_grade, audit_log, document_content, schedules) +
 * filet-177 (accounting_vault).
 */
const CORE_TABLES = [
  "user",
  "T_student",
  "payments",
  "year_repartition",
  "tranch_config",
  "payment_annual_config",
  "grading_config",
  "grade_entry",
  "calculated_grade",
  "audit_log",
  "document_content",
  "schedules",
  "accounting_vault",
];

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function quoteLiteral(p: string): string {
  if (p.includes("\0")) throw new Error("INVALID_PATH");
  return `'${p.replace(/'/g, "''")}'`;
}

/**
 * isUpToDate — SEV-2.1 : évite un backup VACUUM INTO systématique à chaque
 * boot quand la base est déjà à jour (table `migrations` contient toutes
 * les KNOWN_MIGRATIONS). Best-effort : en doute (table absente, lecture
 * impossible) on retourne false → backup conservé.
 */
export async function isUpToDate(ds: DataSource): Promise<boolean> {
  try {
    const has = (
      (await ds.query(
        "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
        ["migrations"]
      )) as Array<{ name: string }>
    ).length > 0;
    if (!has) return false;
    const rows = (await ds.query(`SELECT "timestamp", "name" FROM "migrations"`)) as Array<{
      timestamp: number;
      name: string;
    }>;
    const seen = new Set(
      (rows ?? []).map((r) => `${Number(r.timestamp)}:${String(r.name)}`)
    );
    return KNOWN_MIGRATIONS.every((m) => seen.has(`${m.timestamp}:${m.name}`));
  } catch {
    return false;
  }
}

async function vacuumIntoBackup(ds: DataSource, dbPath: string): Promise<string> {
  const backupPath = `${dbPath}.pre-migration-${stamp()}.db`;
  const literal = quoteLiteral(backupPath);
  let lastError: unknown = null;
  for (let attempt = 0; attempt < VACUUM_MAX_ATTEMPTS; attempt++) {
    try {
      await ds.query(`VACUUM INTO ${literal}`);
      return backupPath;
    } catch (e) {
      lastError = e;
      const msg = e instanceof Error ? e.message : String(e);
      const busy = /SQLITE_BUSY|database is locked/i.test(msg);
      if (!busy || attempt === VACUUM_MAX_ATTEMPTS - 1) throw e;
      await sleep(150 * 2 ** attempt + Math.floor(Math.random() * 100));
    }
  }
  throw lastError;
}

async function assertHealthy(ds: DataSource, stage: string): Promise<void> {
  const integ = (await ds.query("PRAGMA integrity_check")) as Array<Record<string, unknown>>;
  const first = integ?.[0] ? String(Object.values(integ[0])[0]) : "";
  if (first.toLowerCase() !== "ok") {
    throw new Error(`INTEGRITY_CHECK_FAILED (${stage}): ${first.slice(0, 200)}`);
  }
  const fk = (await ds.query("PRAGMA foreign_key_check")) as unknown[];
  if (Array.isArray(fk) && fk.length > 0) {
    throw new Error(`FOREIGN_KEY_CHECK_FAILED (${stage}): ${fk.length} violation(s)`);
  }
}

async function tableExists(ds: DataSource, name: string): Promise<boolean> {
  // Fix 1.1.31 : les fantômes temporary_* (copy-swap TypeORM interrompu)
  // ne sont jamais des tables réelles — les ignorer évite de fausser
  // ensureBaseline / postVerify et les boucles "already exists".
  if (name.startsWith("temporary_")) return false;
  const rows = (await ds.query(
    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?",
    [name]
  )) as Array<{ name: string }>;
  return rows.length > 0;
}

/**
 * ensureBaseline — marque la baseline applied sur les bases legacy
 * (créées par synchronize, sans table `migrations`).
 * Retourne true si marquage effectué, false sinon (fresh ou déjà migré).
 */
export async function ensureBaseline(ds: DataSource): Promise<boolean> {
  if (await tableExists(ds, "migrations")) return false;
  const hasUser = await tableExists(ds, "user");
  const hasStudent = await tableExists(ds, "T_student");
  if (!hasUser && !hasStudent) return false; // fresh install → runMigrations jouera up()
  await ds.query(
    `CREATE TABLE IF NOT EXISTS "migrations" ("id" integer PRIMARY KEY AUTOINCREMENT NOT NULL, "timestamp" bigint NOT NULL, "name" varchar NOT NULL)`
  );
  await ds.query(`INSERT INTO "migrations" ("timestamp", "name") VALUES (?, ?)`, [
    BASELINE_TIMESTAMP,
    BASELINE_NAME,
  ]);
  console.log(`[migration-runner] Baseline ${BASELINE_NAME} marquée applied (base legacy).`);
  return true;
}

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: NodeJS.Timeout | null = null;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`MIGRATION_TIMEOUT (${label} > ${ms}ms)`)), ms);
    timer.unref?.();
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function postVerify(ds: DataSource): Promise<void> {
  await assertHealthy(ds, "post");
  for (const t of CORE_TABLES) {
    // eslint-disable-next-line no-await-in-loop
    // t vient de CORE_TABLES (allowlist interne, jamais d'input user) :
    // interpolation sûre, PRAGMA table_info ne supporte pas les placeholders.
    const cols = (await ds.query(`PRAGMA table_info("${t}")`)) as unknown[];
    // PRAGMA table_info ne supporte pas les placeholders sur certains drivers → requête directe ci-dessus.
    if (!Array.isArray(cols) || cols.length === 0) {
      throw new Error(`POST_VERIFY_FAILED: table cœur "${t}" introuvable ou sans colonnes`);
    }
  }
  // year_repartition : colonnes gouvernance V3 (status/closedAt, migration 173,
  // filet 177). payments.receiptNumber : migration 171, filet 177.
  const yearCols = (await ds.query(`PRAGMA table_info("year_repartition")`)) as Array<{ name?: string }>;
  const names = new Set((yearCols ?? []).map((c) => String(c?.name ?? "")));
  for (const required of ["status", "closedAt"]) {
    if (!names.has(required)) {
      throw new Error(`POST_VERIFY_FAILED: year_repartition.${required} manquante (migration 173 non jouée ?)`);
    }
  }
  const payCols = (await ds.query(`PRAGMA table_info("payments")`)) as Array<{ name?: string }>;
  const payNames = new Set((payCols ?? []).map((c) => String(c?.name ?? "")));
  for (const required of ["receiptNumber", "scholarshipId", "baseAmount"]) {
    if (!payNames.has(required)) {
      throw new Error(`POST_VERIFY_FAILED: payments.${required} manquante (migrations 171/177 non jouées ?)`);
    }
  }
  const userCols = (await ds.query(`PRAGMA table_info("user")`)) as Array<{ name?: string }>;
  const userNames = new Set((userCols ?? []).map((c) => String(c?.name ?? "")));
  if (!userNames.has("role")) {
    throw new Error(`POST_VERIFY_FAILED: user.role manquante (migrations 176/177 non jouées ?)`);
  }
}

export interface SafeMigrationResult {
  ran: string[];
  backupPath: string;
  baselineMarked: boolean;
}

async function restoreFromBackup(ds: DataSource, dbPath: string, backupPath: string): Promise<void> {
  // À froid : libère le handle better-sqlite3 (interdit le swap d'un fichier ouvert),
  // copie le backup sur database.db via .tmp + rename (jamais d'écrasement tronqué).
  // SEV-2.3 : après rename, unlink des sidecars WAL (.db-wal/-shm/-journal,
  // .wal/.shm/.journal) pour ne pas rejouer un WAL stale sur le fichier restauré.
  if (ds.isInitialized) await ds.destroy();
  const tmp = `${dbPath}.restore-tmp-${process.pid}`;
  await fsp.copyFile(backupPath, tmp);
  const fh = await fsp.open(tmp, "r+");
  try {
    await fh.sync();
  } finally {
    await fh.close().catch(() => undefined);
  }
  await fsp.rename(tmp, dbPath);
  await cleanupWalSidecars(dbPath);
}

/**
 * runMigrationsSafely — point d'entrée appelé par main.ts avant initializeServices().
 * Lance ensureBaseline + runMigrations(transaction each, timeout 60s) + post-vérifs.
 * En échec : restore auto depuis le backup, puis rethrow (l'appelant affiche
 * l'errorBox et quitte ; le backup est conservé à côté de database.db).
 */
export async function runMigrationsSafely(
  ds: DataSource,
  dbPath: string
): Promise<SafeMigrationResult> {
  if (!dbPath || !fs.existsSync(dbPath)) {
    // Fresh absolu (premier lancement, fichier pas encore créé par synchronize)
    // → pas de backup possible ; on joue quand même ensure+run sur la connexion ouverte.
    console.log("[migration-runner] Pas de fichier DB pré-existant (fresh) — migrations sans backup préalable.");
    const baselineMarked = await ensureBaseline(ds);
    const ran = await withTimeout(ds.runMigrations({ transaction: "each" }), MIGRATION_TIMEOUT_MS, "runMigrations");
    const names = ran.map((m) => m.name);
    await postVerify(ds);
    return { ran: names, backupPath: "", baselineMarked };
  }

  await assertHealthy(ds, "pre");
  // SEV-2.1 : skip-if-à-jour — si toutes les KNOWN_MIGRATIONS sont déjà
  // appliquées, pas de VACUUM INTO (backup systématique = I/O + accumulation).
  // On joue quand même runMigrations (no-op attendu) + postVerify.
  if (await isUpToDate(ds)) {
    console.log("[migration-runner] Base déjà à jour — backup pré-migration ignoré.");
    const baselineMarked = false;
    const ran = await withTimeout(
      ds.runMigrations({ transaction: "each" }),
      MIGRATION_TIMEOUT_MS,
      "runMigrations"
    );
    const names = ran.map((m) => m.name);
    console.log(`[migration-runner] Migrations jouées : ${names.length ? names.join(", ") : "(aucune — à jour)"}`);
    await postVerify(ds);
    return { ran: names, backupPath: "", baselineMarked };
  }
  const backupPath = await vacuumIntoBackup(ds, dbPath);
  // SEV-2.1 : prune symétrique au pre-boot (keep=5) contre l'accumulation.
  prunePreMigrationBackups(dbPath, 5);
  console.log(`[migration-runner] Backup pré-migration : ${logName(backupPath)}`);
  try {
    const baselineMarked = await ensureBaseline(ds);
    const ran = await withTimeout(
      ds.runMigrations({ transaction: "each" }),
      MIGRATION_TIMEOUT_MS,
      "runMigrations"
    );
    const names = ran.map((m) => m.name);
    console.log(`[migration-runner] Migrations jouées : ${names.length ? names.join(", ") : "(aucune — à jour)"}`);
    await postVerify(ds);
    return { ran: names, backupPath, baselineMarked };
  } catch (e) {
    console.error("[migration-runner] Échec migrations — restore auto depuis backup:", (e as Error)?.message ?? e);
    try {
      await restoreFromBackup(ds, dbPath, backupPath);
      console.error(`[migration-runner] Restore auto OK (${logName(backupPath)} conservé pour audit).`);
    } catch (rb) {
      console.error("[migration-runner] RESTORE AUTO ÉCHOUÉ :", (rb as Error)?.message ?? rb);
      // Chemin complet volontairement conservé ici : l'opérateur doit
      // retrouver le fichier de secours exact (pas seulement le basename).
      console.error(`[migration-runner] Fichier de secours : ${backupPath}`);
    }
    throw e;
  }
}
