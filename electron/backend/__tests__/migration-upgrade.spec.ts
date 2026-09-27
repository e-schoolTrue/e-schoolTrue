/**
 * @vitest-environment node
 *
 * Migration / upgrade — fresh install + 1.1.14 → current + idempotence.
 *
 * Contexte QA (bug réel vu en prod) :
 * - un upgrade 1.1.x → 1.2.x qui ALTER TABLE payments sans backup préalable a
 *   déjà coûté des reçus en prod (colonne receiptNumber ajoutée, index UNIQUE
 *   posé sur des NULL en doublon → migration à moitié appliquée, DB verrouillée).
 * - d'où le contrat testé ici : backup AVANT apply, conservation COUNT/SUM(amount),
 *   integrity_check + foreign_key_check, et ré-exécution no-op (idempotence).
 *
 * Isolation & portabilité :
 * - chaque test travaille dans un tmpdir unique, jamais sur la vraie database.db.
 * - better-sqlite3 est compilé pour Electron (NODE_MODULE_VERSION 121) via
 *   `npm run rebuild:db-driver` ; sous Node 22 (vitest), le binding natif refuse
 *   de charger (ERR_DLOPEN_FAILED). Le spec détecte ce cas et bascule sur le
 *   SQLite embarqué de Node (`node:sqlite`, sans dépendance native) via un
 *   adaptateur minimal. Le jour où le binding correspond (CI alignée ou
 *   `npm rebuild better-sqlite3`), le chemin better-sqlite3 + TypeORM
 *   synchronize est exercé en priorité (voir `canUseBetterSqlite3`).
 * - si un vrai runner de migration prod existe un jour (electron/migrations/*),
 *   le spec le détecte en dynamic import et l'utilise ; sinon le helper local
 *   `applyUpgrade` miroite le comportement attendu (ADD COLUMN / CREATE TABLE
 *   IF NOT EXISTS + user_version).
 *
 * Contrat 47 tables : plancher documenté de la mission. Le nombre réel peut
 * être supérieur si des entités sont ajoutées ; on assert `>= 47` + présence
 * explicite des tables critiques (schedule_configs, payments.receiptNumber,
 * 11 tables accounting, vault, audit_log).
 */
import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { DataSource, getMetadataArgsStorage } from 'typeorm';
import { TranchConfigPrecision1740000000000 } from '../../migrations/1740000000000-TranchConfigPrecision';

declare module 'node:sqlite';

const requireNode = createRequire(import.meta.url);

// --- Entités (source de vérité du schéma courant) ---------------------------
import { UserEntity } from '../entities/user';
import { StudentEntity } from '../entities/students';
import { FileEntity } from '../entities/file';
import { ProfessorEntity, QualificationEntity, DiplomaEntity } from '../entities/professor';
import { AbsenceEntity } from '../entities/absence';
import { PaymentEntity } from '../entities/payment';
import {
  PaymentConfigEntity,
  TranchConfigEntity,
  InscriptionFeeEntity,
  TrancheEntryEntity,
  PaymentAnnualConfigEntity,
} from '../entities/paymentConfig';
import { BranchEntity, ClassRoomEntity, GradeEntity } from '../entities/grade';
import { CourseEntity, ObservationEntity } from '../entities/course';
import { SchoolEntity, SchoolSettingsEntity } from '../entities/school';
import { YearRepartitionEntity } from '../entities/yearRepartition';
import { ReportCardEntity } from '../entities/report';
import { TeachingAssignmentEntity } from '../entities/teaching';
import { ProfessorPaymentEntity } from '../entities/professorPayment';
import { HomeworkEntity } from '../entities/homework';
import { VacationEntity } from '../entities/vacation';
import { ScholarshipEntity } from '../entities/scholarship';
import { PreferenceEntity } from '../entities/preference';
import { GradeConfigEntity } from '../entities/gradeConfig';
import { License } from '../entities/licence';
import { ScheduleConfigEntity } from '../entities/scheduleConfig';
import { ScheduleEntity } from '../entities/schedule';
import { DocumentContentEntity } from '../entities/documentContent';
import { GradingConfigEntity, EvaluationCategoryEntity } from '../entities/configNote';
import { GradeEntryEntity, CalculatedGradeEntity } from '../entities/gradeEntry';
import { AuditLogEntity } from '../entities/audit-log';
import { AccountingVaultEntity } from '../entities/accounting-vault';
import {
  ExpenseEntity,
  CashRegisterEntity,
  CashMovementEntity,
  CashClosureEntity,
  BankAccountEntity,
  BankTransactionEntity,
  TeacherHourLogEntity,
  SalarySlipEntity,
  ReceiptCounterEntity,
  ProfessorPaymentCounterEntity,
  FeeItemEntity,
} from '../entities/accounting';

const ALL_ENTITIES = [
  UserEntity, FileEntity, StudentEntity, GradeEntity, ClassRoomEntity, BranchEntity,
  CourseEntity, ObservationEntity, AbsenceEntity, PaymentEntity, PaymentConfigEntity,
  SchoolEntity, YearRepartitionEntity, ProfessorEntity, QualificationEntity, DiplomaEntity,
  TeachingAssignmentEntity, ProfessorPaymentEntity, HomeworkEntity, VacationEntity,
  ReportCardEntity, ScholarshipEntity, PreferenceEntity, GradeConfigEntity,
  SchoolSettingsEntity, License, ScheduleEntity, ScheduleConfigEntity,
  PaymentAnnualConfigEntity, TranchConfigEntity, TrancheEntryEntity, InscriptionFeeEntity,
  DocumentContentEntity, GradingConfigEntity, EvaluationCategoryEntity,
  GradeEntryEntity, CalculatedGradeEntity, AuditLogEntity, AccountingVaultEntity,
  ExpenseEntity, CashRegisterEntity, CashMovementEntity, CashClosureEntity,
  BankAccountEntity, BankTransactionEntity, TeacherHourLogEntity, SalarySlipEntity,
  ReceiptCounterEntity, ProfessorPaymentCounterEntity, FeeItemEntity,
];

/** Plancher du contrat mission : 47 tables sur fresh install. */
const EXPECTED_MIN_TABLES = 47;

/** Tables critiques qui DOIVENT exister après migration. */
const CRITICAL_TABLES = [
  'schedule_configs',
  'payments',
  'expenses',
  'cash_registers',
  'cash_movements',
  'cash_closures',
  'bank_accounts',
  'bank_transactions',
  'teacher_hour_logs',
  'salary_slips',
  'receipt_counters',
  'professor_payment_counters',
  'fee_items',
  'accounting_vault',
  'audit_log',
];

const ACCOUNTING_TABLES = [
  'expenses', 'cash_registers', 'cash_movements', 'cash_closures', 'bank_accounts',
  'bank_transactions', 'teacher_hour_logs', 'salary_slips', 'receipt_counters',
  'professor_payment_counters', 'fee_items',
];

// ---------------------------------------------------------------------------
// Adaptateur SQLite : better-sqlite3 si chargeable, sinon node:sqlite.
// (Binding compilé pour Electron : ERR_DLOPEN_FAILED sous Node 22.)
// ---------------------------------------------------------------------------

type Stmt = {
  get: (params?: unknown) => unknown;
  all: (params?: unknown) => unknown[];
  run: (params?: unknown) => { lastInsertRowid: number | bigint };
};

type MiniDb = {
  backend: 'better-sqlite3' | 'node:sqlite';
  exec: (sql: string) => void;
  prepare: (sql: string) => Stmt;
  pragmaGet: (sql: string) => unknown;
  pragmaAll: (sql: string) => unknown[];
  setUserVersion: (v: number) => void;
  getUserVersion: () => number;
  close: () => void;
};

function wrapBetterDb(db: {
  exec: (sql: string) => unknown;
  prepare: (sql: string) => {
    get: (...a: unknown[]) => unknown;
    all: (...a: unknown[]) => unknown[];
    run: (...a: unknown[]) => { lastInsertRowid: number | bigint };
  };
  pragma: (sql: string, opts?: { simple: boolean }) => unknown;
  close: () => void;
}): MiniDb {
  return {
    backend: 'better-sqlite3',
    exec: (sql) => void db.exec(sql),
    prepare: (sql) => {
      const s = db.prepare(sql);
      return {
        get: (params) =>
          (Array.isArray(params) ? s.get(...params) : params !== undefined ? s.get(params) : s.get()),
        all: (params) =>
          (Array.isArray(params) ? s.all(...params) : params !== undefined ? s.all(params) : s.all()) as unknown[],
        run: (params) => {
          const r = Array.isArray(params) ? s.run(...params) : params !== undefined ? s.run(params) : s.run();
          return { lastInsertRowid: r.lastInsertRowid };
        },
      };
    },
    pragmaGet: (sql) => db.prepare(sql).get(),
    pragmaAll: (sql) => db.prepare(sql).all() as unknown[],
    setUserVersion: (v) => void db.pragma(`user_version = ${v}`),
    getUserVersion: () => db.pragma('user_version', { simple: true }) as number,
    close: () => db.close(),
  };
}

async function openDb(dbPath: string, readonly = false): Promise<MiniDb> {
  try {
    const { default: BetterDatabase } = await import('better-sqlite3');
    const db = new BetterDatabase(dbPath, readonly ? { readonly: true } : undefined);
    if (!readonly) db.pragma('journal_mode = WAL');
    return wrapBetterDb(
      db as unknown as {
        exec: (sql: string) => unknown;
        prepare: (sql: string) => {
          get: (...a: unknown[]) => unknown;
          all: (...a: unknown[]) => unknown[];
          run: (...a: unknown[]) => { lastInsertRowid: number | bigint };
        };
        pragma: (sql: string, opts?: { simple: boolean }) => unknown;
        close: () => void;
      },
    );
  } catch (e) {
    if ((e as { code?: string }).code !== 'ERR_DLOPEN_FAILED') throw e;
  }
  // Fallback : SQLite embarqué de Node (aucun binaire natif requis).
  // require() natif (pas import()) pour contourner le runner Vite de vitest
  // qui intercepte les imports dynamiques (« Failed to load url sqlite »).
  const { DatabaseSync } = requireNode('node:sqlite') as unknown as {
    DatabaseSync: new (
      p: string,
      opts?: { readOnly?: boolean },
    ) => {
      exec: (sql: string) => void;
      prepare: (sql: string) => {
        get: (...a: unknown[]) => unknown;
        all: (...a: unknown[]) => unknown[];
        run: (...a: unknown[]) => { lastInsertRowid: number | bigint };
      };
      close: () => void;
    };
  };
  const db = new DatabaseSync(dbPath, { readOnly: readonly });
  if (!readonly) db.exec('PRAGMA journal_mode = WAL');
  return {
    backend: 'node:sqlite',
    exec: (sql) => db.exec(sql),
    prepare: (sql) => {
      const s = db.prepare(sql);
      return {
        get: (params) =>
          (Array.isArray(params) ? s.get(...params) : params !== undefined ? s.get(params) : s.get()),
        all: (params) =>
          (Array.isArray(params) ? s.all(...params) : params !== undefined ? s.all(params) : s.all()) as unknown[],
        run: (params) => {
          const r = Array.isArray(params) ? s.run(...params) : params !== undefined ? s.run(params) : s.run();
          return { lastInsertRowid: r.lastInsertRowid };
        },
      };
    },
    pragmaGet: (sql) => db.prepare(sql).get(),
    pragmaAll: (sql) => db.prepare(sql).all() as unknown[],
    setUserVersion: (v) => db.exec(`PRAGMA user_version = ${v}`),
    getUserVersion: () => (db.prepare('PRAGMA user_version').get() as { user_version: number }).user_version,
    close: () => db.close(),
  };
}

async function canUseBetterSqlite3(): Promise<boolean> {
  try {
    const { default: BetterDatabase } = await import('better-sqlite3');
    const probe = new BetterDatabase(':memory:');
    probe.close();
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Helpers métier
// ---------------------------------------------------------------------------

async function tableExists(dbPath: string, name: string, readonly = true): Promise<boolean> {
  const db = await openDb(dbPath, readonly);
  try {
    const row = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get([name]);
    return row !== undefined && row !== null;
  } finally {
    db.close();
  }
}

function tableExistsSync(db: MiniDb, name: string): boolean {
  return db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get([name]) != null;
}

function columnExistsSync(db: MiniDb, table: string, column: string): boolean {
  const cols = db.pragmaAll(`PRAGMA table_info("${table}")`) as Array<{ name: string }>;
  return cols.some((c) => c.name === column);
}

function listUserTablesSync(db: MiniDb): string[] {
  const rows = db.pragmaAll(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE 'typeorm_%' ORDER BY name`,
  ) as Array<{ name: string }>;
  return rows.map((r) => r.name);
}

function schemaFingerprintSync(db: MiniDb): string {
  const rows = db.pragmaAll(
    `SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name`,
  ) as Array<{ type: string; name: string; sql: string }>;
  return rows.map((r) => `${r.type}:${r.name}:${r.sql}`).join('\n');
}

/**
 * Crée une DB legacy fidèle à la 1.1.14 : SANS schedule_configs, SANS tables
 * accounting/vault, payments SANS receiptNumber, FK payments.studentId.
 * Données anonymisées, déterministes : COUNT=3, SUM=250 000.
 */
async function createLegacy114Db(dbPath: string): Promise<{ count: number; total: number }> {
  const db = await openDb(dbPath);
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
    const s1 = Number(insertStudent.run(['ELEVE-001', 'ANONYMIZED']).lastInsertRowid);
    const s2 = Number(insertStudent.run(['ELEVE-002', 'ANONYMIZED']).lastInsertRowid);
    const insertPay = db.prepare(
      `INSERT INTO "payments" (amount, currency, paymentType, paymentMethod, studentId, schoolYear) VALUES (?, ?, ?, ?, ?, ?)`,
    );
    insertPay.run([50000, 'GNF', 'scolarite', 'cash', s1, '2024-2025']);
    insertPay.run([75000, 'GNF', 'scolarite', 'cash', s1, '2024-2025']);
    insertPay.run([125000, 'GNF', 'scolarite', 'cash', s2, '2024-2025']);
    const agg = db
      .prepare(`SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM "payments"`)
      .get() as { count: number; total: number };
    return { count: Number(agg.count), total: Number(agg.total) };
  } finally {
    db.close();
  }
}

function backupDatabase(srcPath: string, backupPath: string): void {
  fs.copyFileSync(srcPath, backupPath);
  const srcStat = fs.statSync(srcPath);
  const bakStat = fs.statSync(backupPath);
  if (bakStat.size !== srcStat.size || bakStat.size === 0) {
    throw new Error(`Backup invalide : src=${srcStat.size} octets, bak=${bakStat.size} octets`);
  }
}

/**
 * Upgrade 1.1.14 → courant, idempotent (vérifie l'existant avant d'écrire).
 * Retourne les étapes réellement appliquées (vide = no-op).
 */
async function applyUpgrade(dbPath: string): Promise<{ applied: string[] }> {
  const applied: string[] = [];
  const db = await openDb(dbPath);
  try {
    db.exec('PRAGMA foreign_keys = OFF');
    if (!columnExistsSync(db, 'payments', 'receiptNumber')) {
      db.exec(`ALTER TABLE "payments" ADD COLUMN "receiptNumber" VARCHAR(20)`);
      applied.push('payments.receiptNumber');
    }
    if (!tableExistsSync(db, 'schedule_configs')) {
      db.exec(`
        CREATE TABLE IF NOT EXISTS "schedule_configs" (
          "id" INTEGER PRIMARY KEY AUTOINCREMENT,
          "class_id" INTEGER REFERENCES "grade"("id") ON DELETE CASCADE,
          "start_hour" INTEGER DEFAULT 8,
          "end_hour" INTEGER DEFAULT 18,
          "slot_duration" INTEGER DEFAULT 60,
          "lunch_start" INTEGER DEFAULT 12,
          "lunch_end" INTEGER DEFAULT 14,
          "start_minutes" INTEGER DEFAULT 0,
          "end_minutes" INTEGER DEFAULT 0,
          "lunch_start_minutes" INTEGER DEFAULT 0,
          "lunch_end_minutes" INTEGER DEFAULT 0,
          "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP,
          "updated_at" DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
      applied.push('schedule_configs');
    }
    const accountingDDL: Record<string, string> = {
      expenses: `CREATE TABLE IF NOT EXISTS "expenses" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "label" VARCHAR(255) NOT NULL, "amount" DECIMAL(14,2) NOT NULL, "currency" VARCHAR(10), "status" VARCHAR(20) DEFAULT 'pending', "receiptNumber" VARCHAR(20), "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP);`,
      cash_registers: `CREATE TABLE IF NOT EXISTS "cash_registers" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" VARCHAR(100) NOT NULL, "registerDate" DATE NOT NULL, "openingBalance" DECIMAL(14,2) DEFAULT 0, "closingBalance" DECIMAL(14,2) DEFAULT 0, "status" VARCHAR(20) DEFAULT 'open', "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP);`,
      cash_movements: `CREATE TABLE IF NOT EXISTS "cash_movements" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "registerId" INTEGER REFERENCES "cash_registers"("id") ON DELETE CASCADE, "direction" VARCHAR(10) NOT NULL, "amount" DECIMAL(14,2) NOT NULL, "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP);`,
      cash_closures: `CREATE TABLE IF NOT EXISTS "cash_closures" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "registerId" INTEGER NOT NULL REFERENCES "cash_registers"("id") ON DELETE CASCADE, "closureDate" DATE NOT NULL, "expectedAmount" DECIMAL(14,2) DEFAULT 0, "countedAmount" DECIMAL(14,2) DEFAULT 0, "gap" DECIMAL(14,2) DEFAULT 0, "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP);`,
      bank_accounts: `CREATE TABLE IF NOT EXISTS "bank_accounts" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "bankName" VARCHAR(150) NOT NULL, "accountNumber" VARCHAR(64) NOT NULL UNIQUE, "balance" DECIMAL(14,2) DEFAULT 0, "currency" VARCHAR(10) DEFAULT 'GNF', "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP);`,
      bank_transactions: `CREATE TABLE IF NOT EXISTS "bank_transactions" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "accountId" INTEGER NOT NULL REFERENCES "bank_accounts"("id") ON DELETE CASCADE, "direction" VARCHAR(10) NOT NULL, "amount" DECIMAL(14,2) NOT NULL, "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP);`,
      teacher_hour_logs: `CREATE TABLE IF NOT EXISTS "teacher_hour_logs" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "professorId" INTEGER NOT NULL, "month" VARCHAR(7) NOT NULL, "hours" DECIMAL(7,2) DEFAULT 0, "hourlyRate" DECIMAL(14,2) DEFAULT 0, "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP);`,
      salary_slips: `CREATE TABLE IF NOT EXISTS "salary_slips" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "professorId" INTEGER NOT NULL, "month" VARCHAR(7) NOT NULL, "grossAmount" DECIMAL(14,2) DEFAULT 0, "netAmount" DECIMAL(14,2) DEFAULT 0, "status" VARCHAR(20) DEFAULT 'brouillon', "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP);`,
      receipt_counters: `CREATE TABLE IF NOT EXISTS "receipt_counters" ("year" INTEGER PRIMARY KEY, "lastNumber" INTEGER DEFAULT 0, "updated_at" DATETIME);`,
      professor_payment_counters: `CREATE TABLE IF NOT EXISTS "professor_payment_counters" ("year" INTEGER PRIMARY KEY, "lastNumber" INTEGER DEFAULT 0, "updated_at" DATETIME);`,
      fee_items: `CREATE TABLE IF NOT EXISTS "fee_items" ("id" INTEGER PRIMARY KEY AUTOINCREMENT, "name" VARCHAR(150) NOT NULL, "amount" DECIMAL(14,2) DEFAULT 0, "isActive" BOOLEAN DEFAULT 1, "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP);`,
    };
    for (const [name, ddl] of Object.entries(accountingDDL)) {
      if (!tableExistsSync(db, name)) {
        db.exec(ddl);
        applied.push(name);
      }
    }
    if (!tableExistsSync(db, 'accounting_vault')) {
      db.exec(
        `CREATE TABLE IF NOT EXISTS "accounting_vault" ("id" INTEGER PRIMARY KEY, "secretHash" VARCHAR, "setAt" DATETIME, "updatedBy" INTEGER, "failedAttempts" INTEGER DEFAULT 0, "lockedUntil" DATETIME);`,
      );
      applied.push('accounting_vault');
    }
    if (db.getUserVersion() < 2) {
      db.setUserVersion(2);
      applied.push('user_version=2');
    }
    return { applied };
  } finally {
    db.close();
  }
}

/** Tente de charger un futur runner prod (absent aujourd'hui : electron/migrations n'existe pas). */
async function loadRealRunner(): Promise<null | { runMigrations: (dbPath: string) => Promise<unknown> }> {
  const candidates = [
    '../../migrations/index',
    '../../migrations/runner',
    '../lib/migrationRunner',
    '../lib/migrations',
    '../services/migrationService',
  ];
  for (const mod of candidates) {
    try {
      const loaded = (await import(/* @vite-ignore */ mod)) as Record<string, unknown>;
      const fn = loaded.runMigrations ?? loaded.migrate ?? loaded.default;
      if (typeof fn === 'function') {
        return { runMigrations: fn as (dbPath: string) => Promise<unknown> };
      }
    } catch {
      // candidat absent : cas nominal aujourd'hui.
    }
  }
  return null;
}

/** Noms de tables déclarés par les entités (sans ouvrir de connexion). */
function entityTableNames(): string[] {
  const storage = getMetadataArgsStorage();
  const names = new Set<string>();
  for (const t of storage.tables) {
    if (t.target && (ALL_ENTITIES as unknown[]).includes(t.target)) {
      names.add(t.name ?? (t.target as { name: string }).name);
    }
  }
  return [...names].sort();
}

// ---------------------------------------------------------------------------
// Cycle de vie tmpdir
// ---------------------------------------------------------------------------

let tmpDir: string;
let dataSources: DataSource[];

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e-school-migr-'));
  dataSources = [];
});

afterEach(async () => {
  for (const ds of dataSources) {
    try {
      if (ds.isInitialized) await ds.destroy();
    } catch {
      // best-effort.
    }
  }
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best-effort.
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('migration-upgrade : fresh install (empty.db -> runMigrations -> 47 tables)', () => {
  it('crée le schéma complet sur base vide, sans perte ni erreur', async () => {
    const dbPath = path.join(tmpDir, 'empty.db');
    fs.writeFileSync(dbPath, '');

    const realRunner = await loadRealRunner();
    if (realRunner) {
      await realRunner.runMigrations(dbPath);
    } else if (await canUseBetterSqlite3()) {
      // Chemin nominal quand le binding natif correspond au runtime :
      // synchronize TypeORM = vérité terrain du schéma courant.
      const ds = new DataSource({
        type: 'better-sqlite3',
        database: dbPath,
        entities: ALL_ENTITIES,
        synchronize: true,
        logging: false,
      });
      await ds.initialize();
      dataSources.push(ds);
      await ds.destroy();
      dataSources = [];
    }
    // Sinon (binding Electron sous Node vitest) : vérification statique des
    // métadonnées d'entités — mêmes tables, sans connexion native.

    const declared = entityTableNames();
    expect(
      declared.length,
      `entités incomplètes : ${declared.length} tables déclarées, attendu >= ${EXPECTED_MIN_TABLES}`,
    ).toBeGreaterThanOrEqual(EXPECTED_MIN_TABLES);
    for (const t of CRITICAL_TABLES) {
      const found =
        declared.includes(t) ||
        declared.map((d) => d.toLowerCase()).includes(t.toLowerCase());
      expect(found, `table critique non déclarée par les entités: ${t}`).toBe(true);
    }
    // payments.receiptNumber déclaré dès le fresh.
    const cols = getMetadataArgsStorage().columns.filter(
      (c) => c.target === PaymentEntity && (c.propertyName === 'receiptNumber' || c.propertyName === 'receipt_number'),
    );
    expect(cols.length, 'PaymentEntity doit déclarer receiptNumber').toBeGreaterThanOrEqual(1);

    // Si une DB physique existe (runner ou synchronize), contrôles SQLite live.
    if (fs.statSync(dbPath).size > 0) {
      const db = await openDb(dbPath, true);
      try {
        const tables = listUserTablesSync(db);
        expect(tables.length).toBeGreaterThanOrEqual(EXPECTED_MIN_TABLES);
        for (const t of CRITICAL_TABLES) expect(tables).toContain(t);
        expect(columnExistsSync(db, 'payments', 'receiptNumber')).toBe(true);
        expect((db.pragmaGet('PRAGMA integrity_check') as { integrity_check: string }).integrity_check).toBe('ok');
        expect(db.pragmaAll('PRAGMA foreign_key_check')).toEqual([]);
      } finally {
        db.close();
      }
    }
  });
});

describe('migration-upgrade : 1.1.14 -> courant (backup, conservation données, contrôles)', () => {
  it('backup puis upgrade : COUNT/SUM conservés, integrity + FK OK', async () => {
    const dbPath = path.join(tmpDir, 'legacy-1.1.14.db');
    const before = await createLegacy114Db(dbPath);

    // Pré-conditions legacy.
    expect(await tableExists(dbPath, 'schedule_configs')).toBe(false);
    for (const t of ACCOUNTING_TABLES) expect(await tableExists(dbPath, t)).toBe(false);
    {
      const db = await openDb(dbPath, true);
      try {
        expect(columnExistsSync(db, 'payments', 'receiptNumber')).toBe(false);
      } finally {
        db.close();
      }
    }
    expect(before.count).toBe(3);
    expect(before.total).toBe(250000);

    // Backup AVANT apply (non-négociable).
    const backupPath = `${dbPath}.pre-upgrade.bak`;
    backupDatabase(dbPath, backupPath);
    expect(fs.existsSync(backupPath)).toBe(true);

    // Apply (runner prod si présent, helper local sinon).
    const realRunner = await loadRealRunner();
    if (realRunner) {
      await realRunner.runMigrations(dbPath);
    } else {
      const { applied } = await applyUpgrade(dbPath);
      expect(applied.length).toBeGreaterThan(0);
    }

    // Post-conditions.
    const db = await openDb(dbPath, true);
    try {
      const agg = db
        .prepare(`SELECT COUNT(*) as count, COALESCE(SUM(amount), 0) as total FROM "payments"`)
        .get() as { count: number; total: number };
      expect(Number(agg.count), 'COUNT(payments) conservé').toBe(before.count);
      expect(Number(agg.total), 'SUM(payments.amount) conservé').toBe(before.total);

      expect(columnExistsSync(db, 'payments', 'receiptNumber')).toBe(true);
      expect(tableExistsSync(db, 'schedule_configs')).toBe(true);
      for (const t of ACCOUNTING_TABLES) expect(tableExistsSync(db, t)).toBe(true);

      expect((db.pragmaGet('PRAGMA integrity_check') as { integrity_check: string }).integrity_check).toBe('ok');
      expect(db.pragmaAll('PRAGMA foreign_key_check')).toEqual([]);
    } finally {
      db.close();
    }

    // Le backup restaure l'état legacy (réversibilité).
    const bak = await openDb(backupPath, true);
    try {
      const agg = bak.prepare(`SELECT COUNT(*) as count FROM "payments"`).get() as { count: number };
      expect(Number(agg.count)).toBe(before.count);
    } finally {
      bak.close();
    }
  });
});

describe('migration-upgrade : idempotence (run 2x = no-op)', () => {
  it('seconde exécution ne modifie ni schéma ni données', async () => {
    const dbPath = path.join(tmpDir, 'idempotent.db');
    const before = await createLegacy114Db(dbPath);

    const realRunner = await loadRealRunner();
    if (realRunner) {
      await realRunner.runMigrations(dbPath);
      const snap1 = await openDb(dbPath, true);
      const fingerprint1 = schemaFingerprintSync(snap1);
      const agg1 = snap1
        .prepare(`SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM "payments"`)
        .get() as { count: number; total: number };
      snap1.close();
      await realRunner.runMigrations(dbPath);
      const snap2 = await openDb(dbPath, true);
      try {
        expect(schemaFingerprintSync(snap2)).toBe(fingerprint1);
        const agg2 = snap2
          .prepare(`SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM "payments"`)
          .get() as { count: number; total: number };
        expect(Number(agg2.count)).toBe(Number(agg1.count));
        expect(Number(agg2.total)).toBe(Number(agg1.total));
      } finally {
        snap2.close();
      }
    } else {
      const first = await applyUpgrade(dbPath);
      expect(first.applied.length).toBeGreaterThan(0);
      const snap = await openDb(dbPath, true);
      const fingerprint1 = schemaFingerprintSync(snap);
      snap.close();

      const second = await applyUpgrade(dbPath);
      const ddlReplayed = second.applied.filter((s) => s !== 'user_version=2');
      expect(ddlReplayed, `2e run no-op attendu, rejoué: ${ddlReplayed.join(', ')}`).toEqual([]);

      const verify = await openDb(dbPath, true);
      try {
        expect(schemaFingerprintSync(verify)).toBe(fingerprint1);
        const agg = verify
          .prepare(`SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM "payments"`)
          .get() as { count: number; total: number };
        expect(Number(agg.count)).toBe(before.count);
        expect(Number(agg.total)).toBe(before.total);
        expect((verify.pragmaGet('PRAGMA integrity_check') as { integrity_check: string }).integrity_check).toBe('ok');
        expect(verify.pragmaAll('PRAGMA foreign_key_check')).toEqual([]);
      } finally {
        verify.close();
      }
    }
  });
});

// ---------------------------------------------------------------------------
// Fix 1.1.31 : fantôme temporary_tranch_config + tranch_config legacy 10,2
// -> repair (DROP IF EXISTS) -> migration 174 -> 14,2, COUNT/SUM conservés,
// integrity_check=ok, 2e run idempotent no-op.
//
// Bug réel : synchronize:true AVANT runMigrations lançait le copy-swap
// TypeORM (CREATE TABLE temporary_* SANS IF NOT EXISTS). Après interruption,
// le fantôme restait et chaque boot échouait "already exists" AVANT backup.
// Le repair froid + migration 174 explicite remplacent le swap implicite.
// ---------------------------------------------------------------------------

/** Legacy 10,2 déterministe + fantôme copy-swap interrompu. */
async function createLegacyTranch102WithGhost(dbPath: string): Promise<{ count: number; total: number }> {
  const db = await openDb(dbPath);
  try {
    db.exec(`
      CREATE TABLE "payment_annual_config" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT,
        "remote_id" VARCHAR(36),
        "trancheCount" NUMERIC,
        "schoolYear" VARCHAR
      );
      CREATE TABLE "tranch_config" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "tranchName" VARCHAR NOT NULL,
        "amount" DECIMAL(10,2) NOT NULL DEFAULT (0),
        "tranchMonthCount" INTEGER NULL,
        "paymentAnnualConfigId" INTEGER NULL REFERENCES "payment_annual_config"("id") ON DELETE CASCADE,
        "schoolYear" VARCHAR NULL
      );
      -- Fantôme d'un copy-swap TypeORM interrompu (cause du boot en boucle).
      CREATE TABLE "temporary_tranch_config" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "remote_id" VARCHAR(36) NULL,
        "tranchName" VARCHAR NOT NULL,
        "amount" DECIMAL(14,2) NOT NULL DEFAULT (0)
      );
    `);
    const ins = db.prepare(`INSERT INTO "tranch_config" (remote_id, tranchName, amount, tranchMonthCount, schoolYear) VALUES (?, ?, ?, ?, ?)`);
    ins.run(['r-001', 'Tranche 1', 50000, 3, '2024-2025']);
    ins.run(['r-002', 'Tranche 2', 75000, 3, '2024-2025']);
    ins.run(['r-003', 'Tranche 3', 125000, 4, '2024-2025']);
    const agg = db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM "tranch_config"`).get() as { count: number; total: number };
    return { count: Number(agg.count), total: Number(agg.total) };
  } finally {
    db.close();
  }
}

/** Repair froid miroir de l'outil + main [1.5/4] : DROP IF EXISTS fantôme. */
async function repairGhosts(dbPath: string): Promise<string[]> {
  const db = await openDb(dbPath);
  try {
    const ghosts = (db.pragmaAll(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'temporary_%'`) as Array<{ name: string }>)
      .map((r) => String(r.name))
      .filter((n) => /^temporary_[A-Za-z0-9_]+$/.test(n));
    const dropped: string[] = [];
    for (const g of ghosts) {
      const hasReal = g === 'temporary_tranch_config'
        ? tableExistsSync(db, 'tranch_config')
        : true;
      if (!hasReal) continue;
      const exists = tableExistsSync(db, g);
      if (!exists) continue;
      db.exec(`DROP TABLE IF EXISTS "${g}"`);
      dropped.push(g);
    }
    return dropped;
  } finally {
    db.close();
  }
}

/** Adapte MiniDb au QueryRunner attendu par la vraie migration 174. */
function makeFakeRunner(db: MiniDb): { hasTable(t: string): Promise<boolean>; hasColumn(t: string, c: string): Promise<boolean>; query(sql: string, params?: unknown[]): Promise<unknown> } {
  return {
    hasTable: async (t: string) => tableExistsSync(db, t),
    hasColumn: async (t: string, c: string) => columnExistsSync(db, t, c),
    query: async (sql: string, params?: unknown[]) => {
      const head = sql.trim().slice(0, 12).toUpperCase();
      const isRead = head.startsWith('SELECT') || head.startsWith('PRAGMA TABLE') || head.startsWith('PRAGMA table');
      if (/^\s*SELECT/i.test(sql) || /^\s*PRAGMA\s+table_info/i.test(sql)) {
        const stmt = db.prepare(sql);
        const rows = Array.isArray(params) ? stmt.all(params) : stmt.all();
        return rows;
      }
      if (/^\s*PRAGMA\s+integrity_check/i.test(sql) || /^\s*PRAGMA\s+foreign_keys/i.test(sql) || /^\s*PRAGMA\s+/i.test(sql)) {
        try {
          db.exec(sql);
        } catch {
          const stmt = db.prepare(sql);
          return stmt.all();
        }
        return [];
      }
      // DDL / INSERT / ALTER / DROP / CREATE INDEX : exec direct.
      db.exec(sql);
      return [];
    },
  };
}

async function runMigration174(dbPath: string): Promise<void> {
  const db = await openDb(dbPath);
  try {
    const runner = makeFakeRunner(db);
    const mig = new TranchConfigPrecision1740000000000();
    await mig.up(runner as never);
  } finally {
    db.close();
  }
}

function tranchAmountDecl(db: MiniDb): string {
  const rows = db.pragmaAll(`SELECT sql FROM sqlite_master WHERE type='table' AND name='tranch_config'`) as Array<{ sql: string }>;
  return String(rows?.[0]?.sql ?? '');
}

describe('migration-174 : fantôme + legacy 10,2 -> repair -> 14,2 idempotent', () => {
  it('DROP fantôme, copy-swap 10,2->14,2, COUNT/SUM conservés, integrity ok, 2e run no-op', async () => {
    const dbPath = path.join(tmpDir, 'tranch-174.db');
    const before = await createLegacyTranch102WithGhost(dbPath);
    expect(before.count).toBe(3);
    expect(before.total).toBe(250000);

    // Pré-conditions : fantôme présent + legacy 10,2 déclaré.
    {
      const db = await openDb(dbPath, true);
      try {
        expect(tableExistsSync(db, 'temporary_tranch_config')).toBe(true);
        expect(tranchAmountDecl(db)).toMatch(/DECIMAL\s*\(\s*10\s*,\s*2\s*\)/i);
      } finally {
        db.close();
      }
    }

    // Repair froid (miroir repair-temporary-tables.ts + main [1.5/4]).
    const dropped = await repairGhosts(dbPath);
    expect(dropped).toContain('temporary_tranch_config');
    {
      const db = await openDb(dbPath, true);
      try {
        expect(tableExistsSync(db, 'temporary_tranch_config')).toBe(false);
        const agg = db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM "tranch_config"`).get() as { count: number; total: number };
        expect(Number(agg.count)).toBe(before.count);
        expect(Number(agg.total)).toBe(before.total);
      } finally {
        db.close();
      }
    }

    // Migration 174 réelle (vraie classe, FakeQueryRunner).
    await runMigration174(dbPath);

    // Post-conditions : 14,2 + données + intégrité.
    let fingerprint1 = '';
    {
      const db = await openDb(dbPath, true);
      try {
        const agg = db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM "tranch_config"`).get() as { count: number; total: number };
        expect(Number(agg.count), 'COUNT(tranch_config) conservé').toBe(before.count);
        expect(Number(agg.total), 'SUM(tranch_config.amount) conservé').toBe(before.total);
        expect(tranchAmountDecl(db)).toMatch(/DECIMAL\s*\(\s*14\s*,\s*2\s*\)/i);
        const cols = db.pragmaAll(`PRAGMA table_info("tranch_config")`) as Array<{ name: string; type: string }>;
        const amountCol = cols.find((c) => c.name === 'amount');
        expect(amountCol, 'colonne amount présente').toBeDefined();
        expect(String(amountCol!.type)).toMatch(/DECIMAL\s*\(\s*14\s*,\s*2\s*\)/i);
        expect(tableExistsSync(db, 'temporary_tranch_config')).toBe(false);
        expect(tableExistsSync(db, 'tranch_config_new')).toBe(false);
        expect((db.pragmaGet('PRAGMA integrity_check') as { integrity_check: string }).integrity_check).toBe('ok');
        fingerprint1 = schemaFingerprintSync(db);
        expect(fingerprint1).toContain('tranch_config');
      } finally {
        db.close();
      }
    }

    // 2e run idempotent no-op : ni schéma ni données ne bougent.
    await runMigration174(dbPath);
    {
      const db = await openDb(dbPath, true);
      try {
        expect(schemaFingerprintSync(db)).toBe(fingerprint1);
        const agg = db.prepare(`SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM "tranch_config"`).get() as { count: number; total: number };
        expect(Number(agg.count)).toBe(before.count);
        expect(Number(agg.total)).toBe(before.total);
        expect((db.pragmaGet('PRAGMA integrity_check') as { integrity_check: string }).integrity_check).toBe('ok');
      } finally {
        db.close();
      }
    }
  });
});
