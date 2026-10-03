/**
 * @vitest-environment node
 *
 * Option B T_parent — migration 179 rejouable 2x sans doublon.
 *
 * - P1 tél partagé (formats variés → même E.164) → 1 parent.
 * - P2 quadruplet exact (casse/accents insensibles) → 1 parent ;
 *   recomposé partiel (mère différente) → parent distinct (sur-création).
 * - P3 no-key (aucune clé) → 1 foyer PAR ÉLÈVE, suspect='no-key', jamais fusionné.
 * - 2e run → fingerprint + COUNTs identiques, aucun doublon.
 * - Jamais de normalizedPhone = '' ; FK orphelines = 0 ; _migration_report SUCCESS.
 */
import 'reflect-metadata';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import os from 'node:os';
import path from 'node:path';

import { ParentTable1790000000000 } from '../../migrations/1790000000000-ParentTable';

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

function makeRunner(db: Db): {
  isTransactionActive: boolean;
  startTransaction: () => Promise<void>;
  commitTransaction: () => Promise<void>;
  rollbackTransaction: () => Promise<void>;
  hasTable: (t: string) => Promise<boolean>;
  hasColumn: (t: string, c: string) => Promise<boolean>;
  query: (sql: string, params?: unknown[]) => Promise<unknown>;
} {
  return {
    isTransactionActive: false,
    startTransaction: async () => {},
    commitTransaction: async () => {},
    rollbackTransaction: async () => {},
    hasTable: async (t: string) =>
      db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [t]) != null,
    hasColumn: async (t: string, c: string) => {
      const exists = db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`, [t]) != null;
      if (!exists) return false;
      const cols = db.all(`PRAGMA table_info("${t}")`);
      return cols.some((r) => String(r.name) === c);
    },
    query: async (sql: string, params?: unknown[]) => {
      const head = sql.trim().slice(0, 6).toUpperCase();
      if (head.startsWith('SELECT') || head.startsWith('PRAGMA')) return db.all(sql, params);
      db.exec(params && params.length ? bindParams(sql, params) : sql);
      return [];
    },
  };
}

function fingerprint(db: Db): string {
  const rows = db.all(`SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name`);
  return rows.map((r) => `${String(r.type)}:${String(r.name)}:${String(r.sql)}`).join('\n');
}

/** T_student volontairement SANS parentId (la migration doit l'ajouter). */
function seedStudents(dbPath: string): void {
  const db = openDb(dbPath);
  try {
    db.exec(`
      CREATE TABLE "T_student" (
        "id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
        "fatherFirstname" TEXT NULL, "fatherLastname" TEXT NULL,
        "motherFirstname" TEXT NULL, "motherLastname" TEXT NULL,
        "famillyPhone" TEXT NULL, "address" TEXT NULL
      );
      INSERT INTO "T_student" ("fatherFirstname","fatherLastname","motherFirstname","motherLastname","famillyPhone","address") VALUES
        -- P1 : même tél, formats variés → 1 foyer
        ('Moussa','Diallo','Aminata','Bah','76123456','Bamako'),
        ('Moussa','Diallo','Aminata','Bah','76 12 34 56','Bamako'),
        ('Moussa','Diallo','Aminata','Bah','+22376123456','Bamako'),
        -- P2 : quadruplet exact, casse/accents variés → 1 foyer
        ('Jean','Koné','Marie','Traoré',NULL,'Sikasso'),
        ('JEAN','KONE','marie','traore',NULL,'Sikasso'),
        -- P2 recomposé partiel (mère différente) → foyer DISTINCT
        ('Jean','Koné','Fatoumata','Cissé',NULL,'Sikasso'),
        -- P3 : aucune clé → 1 foyer PAR ÉLÈVE
        ('','','','',NULL,NULL),
        ('','','','','000000000',NULL);
    `);
  } finally {
    db.close();
  }
}

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e-school-parent179-'));
});
afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch { /* best-effort */ }
});

describe('migration 179 : rejouable 2x sans doublon (P1/P2/P3)', () => {
  it('P1→1 foyer, P2→1+1 distinct, P3→1/élève, 2e run no-op', async () => {
    const dbPath = path.join(tmpDir, 'p179.db');
    seedStudents(dbPath);
    const mig = new ParentTable1790000000000();

    // --- Run 1 ---
    {
      const db = openDb(dbPath);
      try {
        await mig.up(makeRunner(db) as never);
      } finally {
        db.close();
      }
    }

    const check = (label: string) => {
      const db = openDb(dbPath);
      try {
        const parents = db.all(`SELECT * FROM "T_parent" ORDER BY "id"`);
        const students = db.all(`SELECT "id","parentId" FROM "T_student" ORDER BY "id"`);
        const emptyNp = db.get(`SELECT COUNT(*) AS n FROM "T_parent" WHERE "normalizedPhone" = ''`) as { n: number };
        const orphans = db.all(
          `SELECT "s"."id" FROM "T_student" "s" LEFT JOIN "T_parent" "p" ON "p"."id"="s"."parentId" WHERE "s"."parentId" IS NOT NULL AND "p"."id" IS NULL`,
        );
        const unlinked = db.get(`SELECT COUNT(*) AS n FROM "T_student" WHERE "parentId" IS NULL`) as { n: number };
        const reports = db.all(`SELECT "status" FROM "_migration_report" WHERE "migration"='ParentTable1790000000000'`);
        return { parents, students, emptyNp: Number(emptyNp.n), orphans, unlinked: Number(unlinked.n), reports, fp: fingerprint(db) };
      } finally {
        db.close();
      }
    };

    const after1 = check('run1');
    // 8 élèves → P1(3→1) + P2(2→1) + P2-recomposé(1→1) + P3(2→2) = 5 foyers.
    expect(after1.parents.length, `parents run1: ${JSON.stringify(after1.parents)}`).toBe(5);
    expect(after1.unlinked).toBe(0);
    expect(after1.emptyNp).toBe(0);
    expect(after1.orphans).toEqual([]);
    expect(after1.reports.length).toBe(1);
    expect(after1.reports[0].status).toBe('SUCCESS');

    // P1 : les 3 premiers élèves partagent le même parentId.
    const p1Ids = after1.students.slice(0, 3).map((s) => s.parentId);
    expect(new Set(p1Ids.map(String)).size).toBe(1);
    // P2 : élèves 4+5 même foyer, élève 6 distinct.
    expect(String(after1.students[3].parentId)).toBe(String(after1.students[4].parentId));
    expect(String(after1.students[5].parentId)).not.toBe(String(after1.students[3].parentId));
    // P3 : élèves 7+8 foyers DISTINCTS, suspect='no-key'.
    expect(String(after1.students[6].parentId)).not.toBe(String(after1.students[7].parentId));
    {
      const db = openDb(dbPath);
      try {
        const p3 = db.all(`SELECT "suspect" FROM "T_parent" WHERE "suspect"='no-key'`);
        expect(p3.length).toBe(2);
        const p1 = db.get(`SELECT "normalizedPhone" AS np FROM "T_parent" WHERE "normalizedPhone"='+22376123456'`) as { np: string } | undefined;
        expect(p1?.np).toBe('+22376123456');
      } finally {
        db.close();
      }
    }

    // --- Run 2 (idempotence) ---
    {
      const db = openDb(dbPath);
      try {
        await mig.up(makeRunner(db) as never);
      } finally {
        db.close();
      }
    }
    const after2 = check('run2');
    expect(after2.parents.length).toBe(after1.parents.length);
    expect(after2.fp).toBe(after1.fp);
    expect(after2.unlinked).toBe(0);
    expect(after2.emptyNp).toBe(0);
    expect(after2.reports.length).toBe(2);
    // parentId stables entre les 2 runs.
    expect(after2.students.map((s) => String(s.parentId))).toEqual(after1.students.map((s) => String(s.parentId)));
  });

  it('down() détache sans DROP (append-only)', async () => {
    const dbPath = path.join(tmpDir, 'p179down.db');
    seedStudents(dbPath);
    const mig = new ParentTable1790000000000();
    {
      const db = openDb(dbPath);
      try {
        await mig.up(makeRunner(db) as never);
      } finally {
        db.close();
      }
    }
    {
      const db = openDb(dbPath);
      try {
        await mig.down(makeRunner(db) as never);
        const left = db.get(`SELECT COUNT(*) AS n FROM "T_student" WHERE "parentId" IS NOT NULL`) as { n: number };
        expect(Number(left.n)).toBe(0);
        const still = db.get(`SELECT name FROM sqlite_master WHERE type='table' AND name='T_parent'`);
        expect(still).toBeDefined();
      } finally {
        db.close();
      }
    }
  });
});
