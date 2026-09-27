/**
 * Générateur de fixture legacy 1.1.14 ANONYMISÉE.
 *
 * Usage :
 *   npx tsx electron/backend/__tests__/fixtures/generate-1.1.14-fixture.ts [outPath]
 *
 * Sortie par défaut : electron/backend/__tests__/fixtures/anonymized-1.1.14.db
 *
 * Garanties d'anonymisation (données 100 % synthétiques, déterministes) :
 * - prénoms/noms = ELEVE-001… / ANONYMIZED, jamais de vraies identités ;
 * - montants fixes (50 000 / 75 000 / 125 000 GNF, total 250 000, COUNT = 3) ;
 * - aucun email, téléphone, adresse, hash, secret ou token.
 *
 * Schéma legacy fidèle à la 1.1.14 :
 * - SANS table schedule_configs, SANS tables accounting / accounting_vault,
 * - table payments SANS colonne receiptNumber (ajoutée par l'upgrade testé
 *   dans ../migration-upgrade.spec.ts).
 *
 * Le spec n'a PAS besoin de ce fichier .db commité : il reconstruit le même
 * legacy en mémoire/tmp via createLegacy114Db(). Ce script sert aux devs qui
 * veulent une fixture physique pour debug manuel (sqlite3, DB Browser).
 */
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const requireNode = createRequire(import.meta.url);
const DEFAULT_OUT = path.join(__dirname, 'anonymized-1.1.14.db');

type RunResult = { lastInsertRowid: number | bigint };
type MiniDb = {
  exec: (sql: string) => void;
  prepare: (sql: string) => {
    get: (...a: unknown[]) => unknown;
    run: (...a: unknown[]) => RunResult;
  };
  close: () => void;
};

function openPortableDb(dbPath: string): MiniDb {
  try {
    const BetterDatabase = requireNode('better-sqlite3') as new (p: string) => MiniDb;
    const db = new BetterDatabase(dbPath);
    db.exec('PRAGMA journal_mode = WAL');
    return db;
  } catch (e) {
    if ((e as { code?: string }).code !== 'ERR_DLOPEN_FAILED') throw e;
  }
  // Binding Electron incompatible avec ce Node → SQLite embarqué.
  const { DatabaseSync } = requireNode('node:sqlite') as {
    DatabaseSync: new (
      p: string,
      opts: { readOnly: boolean },
    ) => {
      exec: (sql: string) => void;
      prepare: (sql: string) => {
        get: (...a: unknown[]) => unknown;
        run: (...a: unknown[]) => RunResult;
      };
      close: () => void;
    };
  };
  const db = new DatabaseSync(dbPath, { readOnly: false });
  db.exec('PRAGMA journal_mode = WAL');
  return db;
}

function buildLegacyDb(dbPath: string): void {
  if (fs.existsSync(dbPath)) fs.rmSync(dbPath);
  const db = openPortableDb(dbPath);
  try {
    db.exec(`
      CREATE TABLE "grade" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "name" VARCHAR(255),
        "type" VARCHAR(50)
      );
      CREATE TABLE "T_student" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "firstname" VARCHAR(255),
        "lastname" VARCHAR(255)
      );
      CREATE TABLE "payments" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "remote_id" VARCHAR(36),
        "user_id" VARCHAR(36),
        "amount" DECIMAL(14,2) NOT NULL,
        "currency" VARCHAR(10),
        "idempotencyKey" VARCHAR(64) UNIQUE,
        "paymentType" VARCHAR NOT NULL,
        "paymentMethod" VARCHAR NOT NULL DEFAULT 'cash',
        "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
        "updated_at" DATETIME,
        "deleted_at" DATETIME,
        "studentId" INTEGER REFERENCES "T_student"("id") ON DELETE CASCADE,
        "installmentNumber" INTEGER DEFAULT 1,
        "schoolYear" VARCHAR DEFAULT '2024-2025',
        "comment" VARCHAR
      );
    `);
    const insertStudent = db.prepare(`INSERT INTO "T_student" (firstname, lastname) VALUES (?, ?)`);
    const s1 = Number(insertStudent.run('ELEVE-001', 'ANONYMIZED').lastInsertRowid);
    const s2 = Number(insertStudent.run('ELEVE-002', 'ANONYMIZED').lastInsertRowid);
    const insertPay = db.prepare(
      `INSERT INTO "payments" (amount, currency, paymentType, paymentMethod, studentId, schoolYear) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    insertPay.run(50000, 'GNF', 'scolarite', 'cash', s1, '2024-2025');
    insertPay.run(75000, 'GNF', 'scolarite', 'cash', s1, '2024-2025');
    insertPay.run(125000, 'GNF', 'scolarite', 'cash', s2, '2024-2025');
    const agg = db
      .prepare(`SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM "payments"`)
      .get() as { count: number; total: number };
    const integrity = (db.prepare('PRAGMA integrity_check').get() as { integrity_check: string })
      .integrity_check;
    if (integrity !== 'ok') throw new Error(`integrity_check inattendu: ${integrity}`);
    // eslint-disable-next-line no-console
    console.log(`[fixture-1.1.14] ${dbPath} COUNT=${agg.count} SUM=${agg.total} integrity=ok`);
  } finally {
    db.close();
  }
}

const outPath = process.argv[2] ?? DEFAULT_OUT;
buildLegacyDb(outPath);
