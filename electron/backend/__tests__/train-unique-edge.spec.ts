/**
 * @vitest-environment node
 *
 * Train unique — edge gaps T9/T10/schoolyear/175-idempotence/12-tables.
 *
 * Ne réimplémente rien : vérifie le contrat déjà en place
 * (security.ts, SyncView, toolRoutes, yearService, migrations 175/176,
 * migration-runner CORE_TABLES 12, ADR-002).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireNode = createRequire(import.meta.url);

const handlerRegistry = vi.hoisted(() => new Map<string, (...args: any[]) => any>());
vi.mock('electron', () => ({
  ipcMain: { handle: vi.fn((ch: string, h: (...a: any[]) => any) => { handlerRegistry.set(ch, h); }) },
  app: { getPath: vi.fn(() => '/tmp/e-school-train-edge') },
}));

import { protectedHandle, rolesForChannel } from '../security';
import { DriftCatchup2175000000000 } from '../../migrations/1750000000000-DriftCatchup2';
import { RoleLegacyFix1760000000000 } from '../../migrations/1760000000000-RoleLegacyFix';

// ---------------------------------------------------------------------------
// Mini SQLite adapter (better-sqlite3 si dispo, sinon node:sqlite)
// ---------------------------------------------------------------------------
type MiniDb = {
  exec: (sql: string) => void;
  prepare: (sql: string) => { get: (p?: unknown) => any; all: (p?: unknown) => any[]; run: (p?: unknown) => { lastInsertRowid: number | bigint } };
  pragmaAll: (sql: string) => any[];
  close: () => void;
};

async function openDb(dbPath: string): Promise<MiniDb> {
  try {
    const { default: BetterDatabase } = await import('better-sqlite3');
    const db = new BetterDatabase(dbPath) as any;
    return {
      exec: (sql) => void db.exec(sql),
      prepare: (sql) => {
        const s = db.prepare(sql);
        return {
          get: (p) => (Array.isArray(p) ? s.get(...p) : p !== undefined ? s.get(p) : s.get()),
          all: (p) => (Array.isArray(p) ? s.all(...p) : p !== undefined ? s.all(p) : s.all()),
          run: (p) => { const r = Array.isArray(p) ? s.run(...p) : p !== undefined ? s.run(p) : s.run(); return { lastInsertRowid: r.lastInsertRowid }; },
        };
      },
      pragmaAll: (sql) => db.prepare(sql).all(),
      close: () => db.close(),
    };
  } catch (e: any) {
    if (e?.code !== 'ERR_DLOPEN_FAILED') throw e;
  }
  const { DatabaseSync } = requireNode('node:sqlite') as any;
  const db = new DatabaseSync(dbPath);
  return {
    exec: (sql) => db.exec(sql),
    prepare: (sql) => {
      const s = db.prepare(sql);
      return {
        get: (p) => (Array.isArray(p) ? s.get(...p) : p !== undefined ? s.get(p) : s.get()),
        all: (p) => (Array.isArray(p) ? s.all(...p) : p !== undefined ? s.all(p) : s.all()),
        run: (p) => { const r = Array.isArray(p) ? s.run(...p) : p !== undefined ? s.run(p) : s.run(); return { lastInsertRowid: r.lastInsertRowid }; },
      };
    },
    pragmaAll: (sql) => db.prepare(sql).all(),
    close: () => db.close(),
  };
}

function tableExistsSync(db: MiniDb, name: string): boolean {
  return db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).get([name]) != null;
}
function fingerprintSync(db: MiniDb): string {
  return (db.pragmaAll(`SELECT type, name, sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type, name`) as any[])
    .map((r) => `${r.type}:${r.name}:${r.sql}`).join('\n');
}
function makeFakeRunner(db: MiniDb): any {
  return {
    hasTable: async (t: string) => tableExistsSync(db, t),
    hasColumn: async (t: string, c: string) =>
      (db.pragmaAll(`PRAGMA table_info("${t}")`) as Array<{ name: string }>).some((x) => x.name === c),
    query: async (sql: string, params?: unknown[]) => {
      if (/^\s*SELECT/i.test(sql) || /^\s*PRAGMA\s+table_info/i.test(sql)) {
        return Array.isArray(params) ? db.prepare(sql).all(params) : db.prepare(sql).all();
      }
      if (/^\s*PRAGMA/i.test(sql)) { try { db.exec(sql); return []; } catch { return db.prepare(sql).all(); } }
      db.exec(sql);
      return [];
    },
  };
}

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e-school-train-edge-'));
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  handlerRegistry.clear();
  (global as any).authService = { getCurrentUser: vi.fn().mockResolvedValue(null) };
  (global as any).auditLogService = { record: vi.fn().mockResolvedValue(undefined) };
});
afterEach(() => {
  delete (global as any).authService;
  delete (global as any).auditLogService;
  vi.restoreAllMocks();
  try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* best-effort */ }
});

// ---------------------------------------------------------------------------
// T9 — backup réservé admin : RBAC FORBIDDEN + onglet masqué
// ---------------------------------------------------------------------------
describe('T9 backup réservé admin — comptable FORBIDDEN + onglet masqué', () => {
  const BACKUP_CHANNELS = ['backup:create', 'backup:list', 'backup:restore', 'backup:import', 'backup:previewImport', 'backup:confirmImport', 'backup:delete', 'backup:reveal', 'backup:exportTo'];

  it('T9a rolesForChannel(backup:*) → ["admin"] seul (comptable exclu)', () => {
    for (const ch of BACKUP_CHANNELS) {
      expect(rolesForChannel(ch), ch).toEqual(['admin']);
    }
  });

  it('T9b protectedHandle backup:create : comptable → FORBIDDEN, admin → OK', async () => {
    protectedHandle('edge:backup:create', { roles: rolesForChannel('backup:create') }, vi.fn().mockResolvedValue({ success: true }));
    const wrapped = handlerRegistry.get('edge:backup:create')!;
    (global as any).authService.getCurrentUser.mockResolvedValue({ id: 3, username: 'c1', role: 'comptable', displayName: null });
    await expect(wrapped(null, {})).rejects.toThrow(/FORBIDDEN: role comptable not allowed for/);
    (global as any).authService.getCurrentUser.mockResolvedValue({ id: 1, username: 'a1', role: 'admin', displayName: null });
    await expect(wrapped(null, {})).resolves.toEqual({ success: true });
  });

  it('T9c onglet masqué : SyncView v-if isAdmin + empty Réservé administrateur + route /tools/sync roles=[admin]', () => {
    const syncSrc = fs.readFileSync(path.join(process.cwd(), 'src/views/tools/SyncView.vue'), 'utf8');
    expect(syncSrc).toMatch(/v-if="isAdmin".*Fichier local/s);
    expect(syncSrc).toContain('Réservé administrateur');
    expect(syncSrc).toMatch(/userStore\.isAdmin|isAdmin.*userStore/);
    const toolSrc = fs.readFileSync(path.join(process.cwd(), 'src/routes/tool.ts'), 'utf8');
    const idx = toolSrc.indexOf('/tools/sync');
    expect(idx).toBeGreaterThan(-1);
    expect(toolSrc.slice(idx, idx + 600)).toMatch(/roles:\s*\['admin'\]/);
    const tabSrc = fs.readFileSync(path.join(process.cwd(), 'src/components/sync/LocalBackupTab.vue'), 'utf8');
    expect(tabSrc).toMatch(/Réservé administrateur/);
    expect(tabSrc).toMatch(/isForbidden/);
  });
});

// ---------------------------------------------------------------------------
// T10 — role NULL → admin (176) + backup OK après fix
// ---------------------------------------------------------------------------
describe('T10 role legacy NULL → admin (176) + backup OK', () => {
  async function seedUserDb(dbPath: string) {
    const db = await openDb(dbPath);
    try {
      db.exec(`CREATE TABLE "user" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "username" VARCHAR NOT NULL, "role" VARCHAR NULL);`);
      const ins = db.prepare(`INSERT INTO "user" ("username", "role") VALUES (?, ?)`);
      ins.run(['legacy-null', null]);
      ins.run(['legacy-empty', '']);
      ins.run(['legacy-bad', 'superuser']);
      ins.run(['ok-admin', 'admin']);
      ins.run(['ok-comptable', 'comptable']);
    } finally { db.close(); }
  }
  async function roles(dbPath: string): Promise<Array<{ username: string; role: string | null }>> {
    const db = await openDb(dbPath);
    try {
      return db.prepare(`SELECT username, role FROM "user" ORDER BY username`).all() as any[];
    } finally { db.close(); }
  }

  it('T10 migration 176 force NULL/empty/hors-enum → admin, préserve valides, 2e run no-op', async () => {
    const dbPath = path.join(tmpDir, 'role176.db');
    await seedUserDb(dbPath);
    const run176 = async () => {
      const db = await openDb(dbPath);
      try { await new RoleLegacyFix1760000000000().up(makeFakeRunner(db)); }
      finally { db.close(); }
    };
    await run176();
    const after = await roles(dbPath);
    const byName = new Map(after.map((r) => [r.username, r.role]));
    expect(byName.get('legacy-null')).toBe('admin');
    expect(byName.get('legacy-empty')).toBe('admin');
    expect(byName.get('legacy-bad')).toBe('admin');
    expect(byName.get('ok-admin')).toBe('admin');
    expect(byName.get('ok-comptable')).toBe('comptable');
    // 2e run : idempotent — rôles inchangés
    const db1 = await openDb(dbPath);
    const fp1 = fingerprintSync(db1);
    const count1 = Number((db1.prepare(`SELECT COUNT(*) AS c FROM "user" WHERE "role"='admin'`).get() as any).c);
    db1.close();
    await run176();
    const after2 = await roles(dbPath);
    expect(after2).toEqual(after);
    const db2 = await openDb(dbPath);
    try {
      const count2 = Number((db2.prepare(`SELECT COUNT(*) AS c FROM "user" WHERE "role"='admin'`).get() as any).c);
      expect(count2).toBe(count1);
    } finally { db2.close(); }
    expect(fp1).toBeTruthy();
  });

  it('T10b après fix, admin legacy réparé passe le guard backup (backup OK)', async () => {
    protectedHandle('edge:backup:after176', { roles: rolesForChannel('backup:list') }, vi.fn().mockResolvedValue({ success: true, data: [] }));
    const wrapped = handlerRegistry.get('edge:backup:after176')!;
    // Rôle réparé = admin → autorisé (simulate getCurrentUser post-176)
    (global as any).authService.getCurrentUser.mockResolvedValue({ id: 1, username: 'legacy-null', role: 'admin', displayName: null });
    await expect(wrapped(null, {})).resolves.toEqual({ success: true, data: [] });
  });
});

// ---------------------------------------------------------------------------
// schoolYear data:null → empty-state sans toast
// ---------------------------------------------------------------------------
describe('schoolYear getCurrent data:null → empty-state sans toast', () => {
  it('contrat yearService : ambigu (>1 isCurrent) et vide → success:true data:null, jamais de throw', async () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'electron/backend/services/yearService.ts'), 'utf8');
    expect(src).toMatch(/flagged\.length > 1/);
    expect(src).toMatch(/data: null/);
    expect(src).toMatch(/Jamais de toast|empty-state UI/);
    // yearStore ne toast que sur YEAR_CLOSED (setActiveYear), jamais sur fetchCurrent/init
    const storeSrc = fs.readFileSync(path.join(process.cwd(), 'src/stores/yearStore.ts'), 'utf8');
    const fetchIdx = storeSrc.indexOf('async function fetchCurrent');
    expect(fetchIdx).toBeGreaterThan(-1);
    expect(storeSrc.slice(fetchIdx, fetchIdx + 800)).not.toMatch(/ElMessage/);
    const initIdx = storeSrc.indexOf('async function init');
    expect(storeSrc.slice(initIdx, initIdx + 2500)).not.toMatch(/ElMessage\.error/);
  });
});

// ---------------------------------------------------------------------------
// 175 — idempotence 2e run no-op + 12 tables créées depuis DB sans elles
// ---------------------------------------------------------------------------
describe('migration 175 — idempotence 2e run no-op + tables créées depuis DB sans elles', () => {
  const EXPECTED_175_TABLES = [
    'payment_annual_config', 'mensuality_tranch', 'inscription_fee', 'grading_config',
    'evaluation_category', 'grade_entry', 'calculated_grade', 'audit_log',
    'document_content', 'schedules', 'teaching_grades',
  ];

  it('crée les 11 tables depuis une DB sans elles, 2e run no-op (fingerprint identique)', async () => {
    const dbPath = path.join(tmpDir, 'drift175.db');
    // DB quasi-vide (socle minimal, sans les 11 tables drift)
    {
      const db = await openDb(dbPath);
      try {
        db.exec(`CREATE TABLE "user" ("id" INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL, "username" VARCHAR, "role" VARCHAR);`);
        db.exec(`INSERT INTO "user" ("username","role") VALUES ('a1','admin');`);
      } finally { db.close(); }
    }
    const run175 = async () => {
      const db = await openDb(dbPath);
      try { await new DriftCatchup2175000000000().up(makeFakeRunner(db)); }
      finally { db.close(); }
    };
    for (const t of EXPECTED_175_TABLES) {
      const db = await openDb(dbPath);
      try { expect(tableExistsSync(db, t), `${t} absente avant 175`).toBe(false); }
      finally { db.close(); }
    }
    await run175();
    {
      const db = await openDb(dbPath);
      try {
        for (const t of EXPECTED_175_TABLES) expect(tableExistsSync(db, t), `${t} créée par 175`).toBe(true);
        // Données socle conservées
        expect(Number((db.prepare(`SELECT COUNT(*) AS c FROM "user"`).get() as any).c)).toBe(1);
      } finally { db.close(); }
    }
    const snapDb = await openDb(dbPath);
    const fp1 = fingerprintSync(snapDb);
    const cnt1 = EXPECTED_175_TABLES.map((t) => Number((snapDb.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get() as any).c));
    snapDb.close();
    await run175(); // 2e run
    const verifyDb = await openDb(dbPath);
    try {
      expect(fingerprintSync(verifyDb)).toBe(fp1);
      EXPECTED_175_TABLES.forEach((t, i) => {
        expect(Number((verifyDb.prepare(`SELECT COUNT(*) AS c FROM "${t}"`).get() as any).c)).toBe(cnt1[i]);
      });
    } finally { verifyDb.close(); }
  });

  it('CORE_TABLES 13 vérifiées en postVerify (socle 5 + drift 7 + filet 177) + year_repartition(status, closedAt)', () => {
    const runnerSrc = fs.readFileSync(path.join(process.cwd(), 'electron/migration-runner.ts'), 'utf8');
    for (const t of ['"user"', '"T_student"', '"payments"', '"year_repartition"', '"tranch_config"',
      '"payment_annual_config"', '"grading_config"', '"grade_entry"', '"calculated_grade"',
      '"audit_log"', '"document_content"', '"schedules"', '"accounting_vault"']) {
      expect(runnerSrc).toContain(t);
    }
    const arr = runnerSrc.match(/const CORE_TABLES = \[(.*?)\]/s)?.[1] ?? '';
    const entries = arr.split(',').map((s) => s.trim()).filter((s) => s.startsWith('"'));
    expect(entries).toHaveLength(13);
    expect(runnerSrc).toMatch(/"status", "closedAt"|status.*closedAt/);
  });

  it('TranchConfig schoolYear nullable (ADR-002, pas de NOT NULL sans DEFAULT)', () => {
    const entSrc = fs.readFileSync(path.join(process.cwd(), 'electron/backend/entities/paymentConfig.ts'), 'utf8');
    expect(entSrc).toMatch(/schoolYear\?: string \| null/);
    expect(entSrc).toMatch(/nullable: true/);
  });
});
