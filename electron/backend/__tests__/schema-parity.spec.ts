/**
 * @vitest-environment node
 *
 * schema-parity — garde post-install "zéro colonne manquante".
 *
 * Contrat : après installation (toutes migrations jouées), le schéma SQLite
 * live DOIT contenir chaque table et chaque colonne DB des entités TypeORM
 * enregistrées. Toute divergence → FAIL avec la liste explicite.
 *
 * Stratégie (sans binding natif) :
 * - SQLite embarqué de Node (`node:sqlite`, require natif — cf.
 *   migration-upgrade.spec.ts : better-sqlite3 est compilé pour Electron et
 *   refuse de charger sous Node vitest).
 * - VRAIES classes de migration 171→177 exécutées dans l'ordre via un
 *   FakeQueryRunner minimal (hasTable/hasColumn/query).
 * - Schéma attendu dérivé des métadonnées TypeORM (getMetadataArgsStorage) :
 *   noms DB réels (`name:` inclus) + colonnes FK relationnelles (JoinColumn).
 * - Deux chemins : legacy-minimal (vieilles tables partelles + données) et
 *   stubs (toutes tables réduites à leur PK — quasi-DB-vide).
 * - Idempotence : 2e run → fingerprint sqlite_master + COUNTs identiques.
 * - Garde-fous prod : synchronize OFF par défaut, pas de `user_version`
 *   artisanal (la table `migrations` TypeORM est la source de version),
 *   parité entités data-source.ts ↔ cli-datasource.ts.
 *
 * Hors périmètre volontaire : la baseline 170 (SchemaBuilder dynamique,
 * exige un vrai driver) — sur fresh install elle crée le schéma exact des
 * entités par construction ; le chemin stub prouve que 171→177 convergent
 * seules vers la parité complète.
 */
import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';
import { getMetadataArgsStorage } from 'typeorm';

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

import { DriftCatchup1710000000000 } from '../../migrations/1710000000000-DriftCatchup';
import { BackfillCounters1720000000000 } from '../../migrations/1720000000000-BackfillCounters';
import { YearStatusSchoolYear1730000000000 } from '../../migrations/1730000000000-YearStatusSchoolYear';
import { TranchConfigPrecision1740000000000 } from '../../migrations/1740000000000-TranchConfigPrecision';
import { DriftCatchup2175000000000 } from '../../migrations/1750000000000-DriftCatchup2';
import { RoleLegacyFix1760000000000 } from '../../migrations/1760000000000-RoleLegacyFix';
import { DriftCatchup3177000000000 } from '../../migrations/1770000000000-DriftCatchup3';

const requireNode = createRequire(import.meta.url);

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

const MIGRATIONS_IN_ORDER = [
  new DriftCatchup1710000000000(),
  new BackfillCounters1720000000000(),
  new YearStatusSchoolYear1730000000000(),
  new TranchConfigPrecision1740000000000(),
  new DriftCatchup2175000000000(),
  new RoleLegacyFix1760000000000(),
  new DriftCatchup3177000000000(),
];

// ---------------------------------------------------------------------------
// SQLite embarqué (aucun binaire natif)
// ---------------------------------------------------------------------------

type Db = {
  exec: (sql: string) => void;
  all: (sql: string, params?: unknown[]) => Array<Record<string, unknown>>;
  get: (sql: string, params?: unknown[]) => Record<string, unknown> | undefined;
  close: () => void;
};

function openDb(dbPath: string): Db {
  const { DatabaseSync } = requireNode('node:sqlite') as unknown as {
    DatabaseSync: new (
      p: string,
    ) => {
      exec: (sql: string) => void;
      prepare: (sql: string) => {
        all: (...a: unknown[]) => Array<Record<string, unknown>>;
        get: (...a: unknown[]) => Record<string, unknown> | undefined;
        run: (...a: unknown[]) => unknown;
      };
      close: () => void;
    };
  };
  const db = new DatabaseSync(dbPath);
  return {
    exec: (sql) => db.exec(sql),
    all: (sql, params) => db.prepare(sql).all(...(params ?? [])),
    get: (sql, params) => db.prepare(sql).get(...(params ?? [])),
    close: () => db.close(),
  };
}

function makeRunner(db: Db): {
  hasTable: (t: string) => Promise<boolean>;
  hasColumn: (t: string, c: string) => Promise<boolean>;
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
} {
  return {
    hasTable: async (t: string) =>
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [t]) != null,
    hasColumn: async (t: string, c: string) => {
      const exists =
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [t]) != null;
      if (!exists) return false;
      // eslint-disable-next-line no-await-in-loop
      const cols = db.all(`PRAGMA table_info("${t}")`);
      return cols.some((r) => String(r.name) === c);
    },
    query: async (sql: string, params?: unknown[]) => {
      const head = sql.trim().slice(0, 6).toUpperCase();
      if (head.startsWith('SELECT') || head.startsWith('PRAGMA')) {
        // PRAGMA d'écriture (defer_foreign_keys=...) via prepare().all() :
        // node:sqlite les exécute ; le retour est ignoré par les migrations.
        return db.all(sql, params);
      }
      db.exec(
        params && params.length
          ? bindParams(sql, params)
          : sql,
      );
      return [];
    },
  };
}

/** Lie les `?` pour db.exec (migrations 172/173 : INSERT/UPDATE paramétrés). */
function bindParams(sql: string, params: unknown[]): string {
  let i = 0;
  return sql.replace(/\?/g, () => {
    const v = params[i++];
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
    return `'${String(v).replace(/'/g, "''")}'`;
  });
}

// ---------------------------------------------------------------------------
// Schéma attendu depuis les métadonnées TypeORM
// ---------------------------------------------------------------------------

function expectedSchema(): Map<string, Set<string>> {
  const storage = getMetadataArgsStorage();
  const wanted = new Map<string, Set<string>>();
  const targets = new Set(ALL_ENTITIES as unknown[]);
  for (const t of storage.tables) {
    if (!targets.has(t.target as unknown)) continue;
    const cols = new Set<string>();
    for (const c of storage.columns) {
      if (c.target !== t.target) continue;
      const o = c.options as { name?: string };
      cols.add(o.name ?? c.propertyName);
    }
    // Colonnes FK purement relationnelles (ManyToOne/OneToOne sans @Column).
    for (const j of storage.joinColumns) {
      if (j.target !== t.target) continue;
      const args = j as unknown as { name?: string; propertyName?: string };
      const rel = storage.relations.find(
        (r) => r.target === t.target && r.propertyName === args.propertyName,
      );
      const relName = (rel as unknown as { propertyName?: string } | undefined)?.propertyName;
      cols.add(args.name ?? (relName ? `${relName}Id` : undefined) ?? args.propertyName ?? '');
    }
    cols.delete('');
    wanted.set(t.name, cols);
  }
  // Jointures ManyToMany (pas d'entité, DDL connu des migrations 171/175/177).
  wanted.set('course_grades', new Set(['courseId', 'gradeId']));
  wanted.set('teaching_grades', new Set(['teaching_id', 'grade_id']));
  return wanted;
}

function liveColumns(db: Db, table: string): Set<string> {
  const rows = db.all(`PRAGMA table_info("${table}")`);
  return new Set(rows.map((r) => String(r.name)));
}

function collectDivergences(db: Db): string[] {
  const out: string[] = [];
  const wanted = expectedSchema();
  for (const [table, cols] of wanted) {
    const exists =
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [table]) != null;
    if (!exists) {
      out.push(`table manquante: ${table}`);
      continue;
    }
    const live = liveColumns(db, table);
    for (const c of cols) {
      if (!live.has(c)) out.push(`colonne manquante: ${table}.${c}`);
    }
  }
  return out.sort();
}

function fingerprint(db: Db): string {
  const rows = db.all(
    `SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name`,
  );
  return rows.map((r) => `${String(r.type)}:${String(r.name)}:${String(r.sql)}`).join('\n');
}

async function runAllMigrations(db: Db): Promise<void> {
  const runner = makeRunner(db);
  for (const m of MIGRATIONS_IN_ORDER) {
    // eslint-disable-next-line no-await-in-loop
    await m.up(runner as never);
  }
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

/** Base legacy : vieilles tables partielles + données (COUNT/SUM témoins). */
function createLegacyDb(dbPath: string): { payments: number; total: number } {
  const db = openDb(dbPath);
  try {
    db.exec(`
      CREATE TABLE "user" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "username" VARCHAR NOT NULL, "password" VARCHAR NOT NULL, "role" VARCHAR NULL, "createdAt" DATETIME NULL);
      INSERT INTO "user" ("username","password","role") VALUES ('admin','',''), ('ghost','x',NULL);
      CREATE TABLE "T_student" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "firstname" TEXT, "lastname" TEXT);
      INSERT INTO "T_student" ("firstname","lastname") VALUES ('ELEVE-001','ANONYMIZED');
      CREATE TABLE "payments" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "amount" DECIMAL(14,2) NOT NULL, "paymentType" VARCHAR NOT NULL, "paymentMethod" VARCHAR NOT NULL DEFAULT 'cash', "studentId" INTEGER REFERENCES "T_student"("id") ON DELETE CASCADE, "schoolYear" VARCHAR DEFAULT '2024-2025', "created_at" DATETIME DEFAULT CURRENT_TIMESTAMP);
      INSERT INTO "payments" ("amount","paymentType","paymentMethod","studentId","schoolYear") VALUES (50000,'scolarite','cash',1,'2024-2025'), (75000,'scolarite','cash',1,'2024-2025');
      CREATE TABLE "year_repartition" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "schoolYear" TEXT NOT NULL, "periodConfigurations" TEXT NOT NULL, "isCurrent" BOOLEAN DEFAULT 0);
      INSERT INTO "year_repartition" ("schoolYear","periodConfigurations","isCurrent") VALUES ('2024-2025','[]',1);
      CREATE TABLE "grade" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "name" TEXT, "type" VARCHAR DEFAULT 'PRIMARY');
      CREATE TABLE "payment_configs" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "classId" VARCHAR, "annualAmount" DECIMAL(14,2) DEFAULT 0);
      CREATE TABLE "payment_annual_config" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "trancheCount" NUMERIC);
      CREATE TABLE "grading_config" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "schoolId" INTEGER);
      CREATE TABLE "professors" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "firstname" TEXT, "lastname" TEXT);
      CREATE TABLE "professor_payments" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "amount" DECIMAL(14,2), "type" VARCHAR NOT NULL, "professorId" INTEGER, "month" VARCHAR);
      CREATE TABLE "expenses" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "label" VARCHAR(255) NOT NULL, "amount" DECIMAL(14,2) NOT NULL);
      CREATE TABLE "cash_registers" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "name" VARCHAR(100) NOT NULL, "registerDate" DATE);
      CREATE TABLE "cash_movements" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "direction" VARCHAR(10) NOT NULL, "amount" DECIMAL(14,2) NOT NULL);
      CREATE TABLE "cash_closures" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "registerId" INTEGER NOT NULL, "closureDate" DATE NOT NULL);
      CREATE TABLE "bank_accounts" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "bankName" VARCHAR(150) NOT NULL, "accountNumber" VARCHAR(64) NOT NULL UNIQUE);
      CREATE TABLE "bank_transactions" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "accountId" INTEGER NOT NULL, "direction" VARCHAR(10) NOT NULL, "amount" DECIMAL(14,2) NOT NULL);
      CREATE TABLE "teacher_hour_logs" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "professorId" INTEGER NOT NULL, "month" VARCHAR(7) NOT NULL);
      CREATE TABLE "salary_slips" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "professorId" INTEGER NOT NULL, "month" VARCHAR(7) NOT NULL);
      CREATE TABLE "fee_items" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "name" VARCHAR(150) NOT NULL);
      CREATE TABLE "tranch_config" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "tranchName" VARCHAR NOT NULL, "amount" DECIMAL(10,2) NOT NULL DEFAULT (0));
      INSERT INTO "tranch_config" ("tranchName","amount") VALUES ('T1',50000), ('T2',75000);
    `);
    const agg = db.get(`SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM "payments"`) as {
      count: number;
      total: number;
    };
    return { payments: Number(agg.count), total: Number(agg.total) };
  } finally {
    db.close();
  }
}

/** Stubs quasi-vides : une PK par table (prouve la convergence 171→177 seule). */
function createStubDb(dbPath: string): void {
  const db = openDb(dbPath);
  try {
    const wanted = expectedSchema();
    for (const table of wanted.keys()) {
      if (table === 'course_grades') {
        db.exec(`CREATE TABLE "course_grades" ("courseId" INTEGER NOT NULL, "gradeId" INTEGER NOT NULL, PRIMARY KEY ("courseId","gradeId"))`);
      } else if (table === 'teaching_grades') {
        db.exec(`CREATE TABLE "teaching_grades" ("teaching_id" INTEGER NOT NULL, "grade_id" INTEGER NOT NULL, PRIMARY KEY ("teaching_id","grade_id"))`);
      } else if (table === 'receipt_counters' || table === 'professor_payment_counters') {
        db.exec(`CREATE TABLE "${table}" ("year" INTEGER PRIMARY KEY NOT NULL)`);
      } else {
        db.exec(`CREATE TABLE "${table}" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL)`);
      }
    }
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// Cycle de vie
// ---------------------------------------------------------------------------

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e-school-parity-'));
});

afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    // best-effort.
  }
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('schema-parity : legacy → parité totale, zéro colonne manquante', () => {
  it('converge les vieilles tables partielles vers le schéma entités, données conservées', async () => {
    const dbPath = path.join(tmpDir, 'legacy.db');
    const before = createLegacyDb(dbPath);
    expect(before.payments).toBe(2);
    expect(before.total).toBe(125000);

    // Pré-preuve de divergence (le bug "no such column: status" venait d'ici).
    {
      const db = openDb(dbPath);
      try {
        const div = collectDivergences(db);
        expect(div.length).toBeGreaterThan(0);
        expect(div).toContain('colonne manquante: year_repartition.status');
        expect(div).toContain('colonne manquante: year_repartition.closedAt');
      } finally {
        db.close();
      }
    }

    const db = openDb(dbPath);
    try {
      await runAllMigrations(db);
      const div = collectDivergences(db);
      expect(div, `divergences résiduelles:\n${div.join('\n')}`).toEqual([]);

      // Données conservées + backfills.
      const agg = db.get(`SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM "payments"`) as {
        count: number;
        total: number;
      };
      expect(Number(agg.count)).toBe(before.payments);
      expect(Number(agg.total)).toBe(before.total);
      const roles = db.all(`SELECT DISTINCT role FROM "user"`);
      expect(roles.map((r) => String(r.role)).sort()).toEqual(['admin']);
      const ys = db.get(`SELECT status FROM "year_repartition" LIMIT 1`) as { status: string };
      expect(String(ys.status)).toBe('active');
      expect(
        db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='accounting_vault'`),
      ).toBeDefined();

      expect((db.get(`PRAGMA integrity_check`) as { integrity_check: string }).integrity_check).toBe(
        'ok',
      );
      expect(db.all(`PRAGMA foreign_key_check`)).toEqual([]);
    } finally {
      db.close();
    }
  });
});

describe('schema-parity : stubs (quasi-DB-vide) → parité totale + idempotence', () => {
  it('171→177 convergent seules, 2e run no-op', async () => {
    const dbPath = path.join(tmpDir, 'stubs.db');
    createStubDb(dbPath);

    const db = openDb(dbPath);
    try {
      await runAllMigrations(db);
      const div = collectDivergences(db);
      expect(div, `divergences résiduelles:\n${div.join('\n')}`).toEqual([]);
      const fp1 = fingerprint(db);
      expect(fp1).toContain('accounting_vault');

      await runAllMigrations(db);
      expect(fingerprint(db)).toBe(fp1);
      const div2 = collectDivergences(db);
      expect(div2).toEqual([]);
      expect((db.get(`PRAGMA integrity_check`) as { integrity_check: string }).integrity_check).toBe(
        'ok',
      );
    } finally {
      db.close();
    }
  });
});

describe('schema-parity : garde-fous post-install (synchronize, version, entités)', () => {
  const root = path.join(__dirname, '..', '..');
  const read = (p: string) => fs.readFileSync(path.join(root, p), 'utf8');
  const codeOnly = (src: string) =>
    src
      .split('\n')
      .filter((l) => {
        const t = l.trim();
        return !t.startsWith('*') && !t.startsWith('//');
      })
      .join('\n');

  it('synchronize OFF par défaut (opt-in E_SCHOOL_SYNC=1, jamais en CLI)', () => {
    const ds = read('data-source.ts');
    expect(ds).toContain('E_SCHOOL_SYNC');
    expect(codeOnly(ds)).not.toMatch(/synchronize\s*:\s*true/);
    const cli = read('tools/cli-datasource.ts');
    expect(codeOnly(cli)).not.toMatch(/E_SCHOOL_SYNC/);
    expect(cli).toMatch(/const synchronize = false/);
  });

  it('aucun user_version artisanal en prod (la table `migrations` TypeORM fait foi)', () => {
    for (const f of ['data-source.ts', 'migration-runner.ts', 'tools/cli-datasource.ts']) {
      expect(codeOnly(read(f)), `${f} ne doit pas toucher user_version`).not.toMatch(/user_version/);
    }
    for (const m of fs.readdirSync(path.join(root, 'migrations')).filter((x) => x.endsWith('.ts'))) {
      expect(codeOnly(read(`migrations/${m}`)), `${m} ne doit pas toucher user_version`).not.toMatch(
        /user_version/,
      );
    }
  });

  it('PRAGMA de santé présents dans le runner (integrity + FK + table_info)', () => {
    const runner = read('migration-runner.ts');
    expect(runner).toContain('PRAGMA integrity_check');
    expect(runner).toContain('PRAGMA foreign_key_check');
    expect(runner).toContain('PRAGMA table_info');
  });

  it('entités data-source.ts ↔ cli-datasource.ts en phase', () => {
    const ds = read('data-source.ts');
    const cli = read('tools/cli-datasource.ts');
    const names = [
      'UserEntity', 'StudentEntity', 'PaymentEntity', 'YearRepartitionEntity',
      'AccountingVaultEntity', 'ReceiptCounterEntity', 'ProfessorPaymentCounterEntity',
      'FeeItemEntity', 'TranchConfigEntity', 'PaymentAnnualConfigEntity',
    ];
    for (const n of names) {
      expect(ds, `data-source.ts doit enregistrer ${n}`).toContain(n);
      expect(cli, `cli-datasource.ts doit enregistrer ${n}`).toContain(n);
    }
  });
});
