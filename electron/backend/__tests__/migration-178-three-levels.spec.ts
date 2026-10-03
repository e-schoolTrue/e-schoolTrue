/**
 * @vitest-environment node
 * migration-178 — 3 niveaux : PRESCOLAIRE | PRIMAIRE | SECONDAIRE.
 * Legacy 2025-2026 : id=1 Semestres isCurrent=1 → SECONDAIRE courante,
 * id=2 Trimestres isCurrent=0 → PRIMAIRE, PRESCOLAIRE copie dates primaire.
 * Idempotence : 2e run → fingerprint + COUNTs identiques, AUCUN delete source.
 */
import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { ThreeLevels1780000000000 } from '../../migrations/1780000000000-ThreeLevels';

const requireNode = createRequire(import.meta.url);

type Db = {
  exec: (sql: string) => void;
  all: (sql: string, params?: unknown[]) => Array<Record<string, unknown>>;
  get: (sql: string, params?: unknown[]) => Record<string, unknown> | undefined;
  close: () => void;
};

function openDb(dbPath: string): Db {
  const { DatabaseSync } = requireNode('node:sqlite') as unknown as {
    DatabaseSync: new (p: string) => {
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

function bindParams(sql: string, params: unknown[]): string {
  let i = 0;
  return sql.replace(/\?/g, () => {
    const v = params[i++];
    if (v === null || v === undefined) return 'NULL';
    if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
    return `'${String(v).replace(/'/g, "''")}'`;
  });
}

function makeRunner(db: Db) {
  return {
    hasTable: async (t: string) =>
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [t]) != null,
    hasColumn: async (t: string, c: string) => {
      if (db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [t]) == null) return false;
      return db.all(`PRAGMA table_info("${t}")`).some((r) => String(r.name) === c);
    },
    query: async (sql: string, params?: unknown[]) => {
      const head = sql.trim().slice(0, 6).toUpperCase();
      if (head.startsWith('SELECT') || head.startsWith('PRAGMA')) return db.all(sql, params);
      db.exec(params?.length ? bindParams(sql, params) : sql);
      return [];
    },
  };
}

function createLegacy178(dbPath: string): void {
  const db = openDb(dbPath);
  try {
    db.exec(`
      CREATE TABLE "year_repartition" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "schoolYear" TEXT NOT NULL, "periodConfigurations" TEXT NOT NULL, "isCurrent" BOOLEAN DEFAULT 0, "status" VARCHAR(10) DEFAULT ('active'), "closedAt" DATETIME NULL);
      INSERT INTO "year_repartition" ("id","schoolYear","periodConfigurations","isCurrent","status") VALUES
        (1,'2025-2026','[{"name":"Semestre 1"},{"name":"Semestre 2"}]',1,'active'),
        (2,'2025-2026','[{"name":"Trimestre 1"},{"name":"Trimestre 2"},{"name":"Trimestre 3"}]',0,'active');
      CREATE TABLE "grade" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "name" TEXT, "code" TEXT, "type" VARCHAR DEFAULT ('PRIMARY'), "order" INTEGER NULL, "nextGradeId" INTEGER NULL);
      INSERT INTO "grade" ("id","name","code","type") VALUES
        (1,'CI','CI','PRIMARY'),(2,'CP','CP','PRIMARY'),(3,'CE1','CE1','PRIMARY'),
        (4,'CM2','CM2','PRIMARY'),(5,'6eme','6E','SECONDARY'),(6,'Terminale','TLE','SECONDARY');
      CREATE TABLE "grading_config" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "schoolId" INTEGER, "classId" INTEGER NULL, "period" VARCHAR(100) NULL, "schoolYear" VARCHAR NULL);
      INSERT INTO "grading_config" ("schoolId","classId","period","schoolYear") VALUES (1,5,'AVRIL',NULL),(1,NULL,'Trimestre 1',NULL);
      CREATE TABLE "payment_configs" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "classId" VARCHAR, "className" VARCHAR NULL, "annualAmount" DECIMAL(14,2) DEFAULT 0, "schoolYear" VARCHAR NULL);
      INSERT INTO "payment_configs" ("id","classId","className","annualAmount","schoolYear") VALUES
        (10,'5',NULL,150000,NULL),
        (11,'1',NULL,100000,NULL),
        (99,'999',NULL,50000,NULL);
    `);
  } finally {
    db.close();
  }
}

let tmpDir: string;
beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e-school-178-')); });
afterEach(() => { try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* noop */ } });

function fingerprint(db: Db): string {
  return db.all(`SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name`)
    .map((r) => `${String(r.type)}:${String(r.name)}:${String(r.sql)}`).join('\n');
}

describe('migration 178 — backfill 3 niveaux', () => {
  it('id=1→SECONDAIRE courante, id=2→PRIMAIRE, PRESCOLAIRE créée, configs normalisées, orphelines en quarantaine sans delete', async () => {
    const dbPath = path.join(tmpDir, 'm178.db');
    createLegacy178(dbPath);
    const db = openDb(dbPath);
    try {
      const m = new ThreeLevels1780000000000();
      await m.up(makeRunner(db) as never);

      const years = db.all(`SELECT id, schoolYear, level, isCurrent, status FROM year_repartition ORDER BY id`);
      expect(years.map((r) => ({ id: Number(r.id), level: String(r.level), cur: Number(r.isCurrent) }))).toEqual([
        { id: 1, level: 'SECONDAIRE', cur: 1 },
        { id: 2, level: 'PRIMAIRE', cur: 0 },
        { id: 3, level: 'PRESCOLAIRE', cur: 0 },
      ]);
      expect(years.every((r) => String(r.schoolYear) === '2025-2026')).toBe(true);
      const s1 = db.get(`SELECT periodConfigurations FROM year_repartition WHERE id=1`) as { periodConfigurations: string };
      expect(JSON.parse(String(s1.periodConfigurations)).map((p: { name: string }) => p.name)).toEqual(['Semestre 1', 'Semestre 2']);
      const t2 = db.get(`SELECT periodConfigurations FROM year_repartition WHERE id=2`) as { periodConfigurations: string };
      expect(JSON.parse(String(t2.periodConfigurations)).length).toBe(3);
      const pre = db.get(`SELECT periodConfigurations FROM year_repartition WHERE level='PRESCOLAIRE'`) as { periodConfigurations: string };
      expect(String(pre.periodConfigurations)).toBe(String(t2.periodConfigurations));

      const grades = db.all(`SELECT id, level, "order", nextGradeId FROM grade ORDER BY "order"`);
      expect(grades.map((g) => String(g.level))).toEqual(['PRIMAIRE', 'PRIMAIRE', 'PRIMAIRE', 'PRIMAIRE', 'SECONDAIRE', 'SECONDAIRE']);
      expect(grades.map((g) => Number(g.order))).toEqual([1, 2, 3, 4, 5, 6]);
      expect(grades.slice(0, -1).every((g, i) => Number(g.nextGradeId) === Number(grades[i + 1].id))).toBe(true);

      const gc = db.all(`SELECT classId, schoolYear, level, period FROM grading_config ORDER BY id`);
      expect(gc.every((r) => String(r.schoolYear) === '2025-2026')).toBe(true);
      expect(gc.find((r) => Number(r.classId) === 5)).toMatchObject({ level: 'SECONDAIRE', period: 'AVR' });

      const pc = db.all(`SELECT id, classId, className, schoolYear, level FROM payment_configs ORDER BY id`);
      expect(pc.every((r) => String(r.schoolYear) === '2025-2026')).toBe(true);
      expect(pc.find((r) => Number(r.id) === 10)).toMatchObject({ level: 'SECONDAIRE', className: '6eme' });
      // Source conservée : AUCUN delete (3 lignes toujours présentes).
      expect(pc.length).toBe(3);
      const orph = db.all(`SELECT sourceId, classId, reason FROM payment_configs_orphans`);
      expect(orph.map((r) => Number(r.sourceId))).toContain(99);
      expect(orph.every((r) => String(r.reason) === 'ORPHAN_CLASS_ID')).toBe(true);

      const fp1 = fingerprint(db);
      const counts1 = db.all(`SELECT 'y' k, COUNT(*) c FROM year_repartition UNION ALL SELECT 'g', COUNT(*) FROM grade UNION ALL SELECT 'o', COUNT(*) FROM payment_configs_orphans`);
      await m.up(makeRunner(db) as never);
      expect(fingerprint(db)).toBe(fp1);
      const counts2 = db.all(`SELECT 'y' k, COUNT(*) c FROM year_repartition UNION ALL SELECT 'g', COUNT(*) FROM grade UNION ALL SELECT 'o', COUNT(*) FROM payment_configs_orphans`);
      expect(JSON.stringify(counts2)).toBe(JSON.stringify(counts1));
      // Unicité (schoolYear, level) : doublon refusé.
      expect(() => db.exec(`INSERT INTO year_repartition (schoolYear, periodConfigurations, isCurrent, status, level) VALUES ('2025-2026','[]',0,'active','PRIMAIRE')`)).toThrow();
    } finally {
      db.close();
    }
  });
});
