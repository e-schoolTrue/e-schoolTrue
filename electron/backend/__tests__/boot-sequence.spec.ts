/**
 * @vitest-environment node
 *
 * Boot sequence [1.5/4] — pre-boot froid AVANT initialize (fix 1.1.31).
 *
 * Bug réel : synchronize:true AVANT runMigrations créait temporary_tranch_config
 * SANS IF NOT EXISTS ; après interruption, initialize() bouclait "already exists"
 * AVANT tout backup. Le fix : étape [1.5/4] preBootRepair froid avant initialize
 * (backup .pre-boot-<stamp>.db + fsync + rétention 5 + DROP temporary_* +
 * integrity_check), puis initialize(synchronize:false) -> runMigrationsSafely.
 *
 * Ce spec vérifie sans Electron (main.ts non importable en jsdom) :
 * 1. Ordre source : preBootRepair() appelé AVANT AppDataSource.initialize()
 *    dans startApplication(), backup .pre-boot-, prune à 5, integrity_check,
 *    DROP TABLE IF EXISTS + garde temporary_%.
 * 2. Comportement : mock initialize qui FAIL si temporary_% présent ;
 *    le cleanup froid tourne AVANT, crée le backup, purge, puis initialize OK.
 * 3. Rétention : 7 backups .pre-boot-*.db -> prune -> 5 restants.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';

const requireNode = createRequire(import.meta.url);

type MiniDb = {
  exec: (sql: string) => void;
  prepare: (sql: string) => { get: (p?: unknown) => unknown; all: (p?: unknown) => unknown[] };
  close: () => void;
};

async function openDb(dbPath: string): Promise<MiniDb> {
  try {
    const { default: BetterDatabase } = await import('better-sqlite3');
    const db = new BetterDatabase(dbPath) as unknown as {
      exec: (s: string) => unknown;
      prepare: (s: string) => { get: (...a: unknown[]) => unknown; all: (...a: unknown[]) => unknown[] };
      close: () => void;
    };
    return {
      exec: (sql) => void db.exec(sql),
      prepare: (sql) => {
        const s = db.prepare(sql);
        return {
          get: (p) => (Array.isArray(p) ? s.get(...p) : p !== undefined ? s.get(p) : s.get()),
          all: (p) => (Array.isArray(p) ? s.all(...p) : p !== undefined ? s.all(p) : s.all()) as unknown[],
        };
      },
      close: () => db.close(),
    };
  } catch (e) {
    if ((e as { code?: string }).code !== 'ERR_DLOPEN_FAILED') throw e;
  }
  const { DatabaseSync } = requireNode('node:sqlite') as unknown as {
    DatabaseSync: new (p: string) => {
      exec: (s: string) => void;
      prepare: (s: string) => { get: (...a: unknown[]) => unknown; all: (...a: unknown[]) => unknown[]; run: (...a: unknown[]) => unknown };
      close: () => void;
    };
  };
  const db = new DatabaseSync(dbPath);
  return {
    exec: (sql) => db.exec(sql),
    prepare: (sql) => {
      const s = db.prepare(sql);
      return {
        get: (p) => (Array.isArray(p) ? s.get(...p) : p !== undefined ? s.get(p) : s.get()),
        all: (p) => (Array.isArray(p) ? s.all(...p) : p !== undefined ? s.all(p) : s.all()) as unknown[],
      };
    },
    close: () => db.close(),
  };
}

function listGhostsSync(db: MiniDb): string[] {
  const rows = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'temporary_%'`).all() as Array<{ name: string }>;
  return rows.map((r) => String(r.name));
}

/** Implémentation réelle partagée (dédupliquée main/runner/repair). */
import {
  preBootRepair as preBootRepairReal,
  prunePreBootBackups,
  stamp as preBootStamp,
  dropGhosts as dropGhostsReal,
  listGhosts as listGhostsReal,
} from '../../preboot';

async function preBootRepairLocal(dbPath: string): Promise<string | null> {
  return preBootRepairReal(dbPath);
}

let tmpDir: string;
beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e-school-boot-'));
});
afterEach(() => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch {
    /* best-effort */
  }
});

describe('boot-sequence : ordre source [1.5/4] avant initialize', () => {
  it('main.ts appelle preBootRepair AVANT AppDataSource.initialize', () => {
    const mainSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'main.ts'), 'utf8');
    expect(mainSrc).toContain('preBootRepair');
    expect(mainSrc).toContain('[1.5/4]');
    // Note : `AppDataSource` apparaît dès l'import ligne 7 — on cherche l'appel
    // réel `await AppDataSource.initialize(...)` dans startApplication().
    const idxRepair = mainSrc.indexOf('preBootRepair(coldDbPath)');
    const idxInit = mainSrc.indexOf('await AppDataSource.initialize');
    expect(idxRepair, 'preBootRepair appel présent').toBeGreaterThanOrEqual(0);
    expect(idxInit, 'initialize appel présent').toBeGreaterThanOrEqual(0);
    expect(idxRepair, 'pre-boot AVANT initialize').toBeLessThan(idxInit);
    // Implémentation dédupliquée dans electron/preboot.ts (importée par main).
    expect(mainSrc).toMatch(/from\s+['"]\.\/preboot['"]/);
    const prebootSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'preboot.ts'), 'utf8');
    // Backup froid + rétention 5 + integrity + DROP fantômes.
    expect(prebootSrc).toMatch(/\.pre-boot-/);
    expect(prebootSrc).toMatch(/prunePreBootBackups/);
    expect(prebootSrc).toMatch(/integrity_check/);
    expect(prebootSrc).toMatch(/DROP TABLE IF EXISTS/);
    expect(prebootSrc).toMatch(/temporary_/);
    // synchronize OFF par défaut (fix 1.1.31) : vérifié côté data-source.
    const dsSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'data-source.ts'), 'utf8');
    const dsCodeOnly = dsSrc
      .split('\n')
      .filter((l) => !l.trim().startsWith('*') && !l.trim().startsWith('//'))
      .join('\n');
    expect(dsCodeOnly).toMatch(/synchronize/);
    expect(dsCodeOnly).not.toMatch(/synchronize\s*:\s*true/);
    expect(dsCodeOnly).toMatch(/syncEnv === "1"/);
  });
});

describe('boot-sequence : cleanup froid débloque initialize', () => {
  it('initialize mock fail si fantôme -> pre-boot AVANT -> backup + purge -> initialize OK', async () => {
    const dbPath = path.join(tmpDir, 'database.db');
    // DB avec fantôme copy-swap interrompu.
    {
      const db = await openDb(dbPath);
      try {
        db.exec(`CREATE TABLE "tranch_config" ("id" INTEGER PRIMARY KEY, "amount" DECIMAL(10,2));`);
        db.exec(`CREATE TABLE "temporary_tranch_config" ("id" INTEGER PRIMARY KEY, "amount" DECIMAL(14,2));`);
      } finally {
        db.close();
      }
    }

    const order: string[] = [];
    // Mock initialize : échoue comme TypeORM "already exists" si fantôme présent.
    async function mockInitialize(p: string): Promise<string> {
      order.push('initialize');
      const db = await openDb(p);
      try {
        const ghosts = listGhostsSync(db);
        if (ghosts.length > 0) throw new Error(`already exists: ${ghosts.join(',')}`);
        return 'ok';
      } finally {
        db.close();
      }
    }

    // Sans pre-boot : échec (reproduit le boot en boucle).
    await expect(mockInitialize(dbPath)).rejects.toThrow(/already exists/);
    order.length = 0;

    // Avec pre-boot AVANT : backup + purge puis initialize OK.
    order.push('preBootRepair');
    const backup = await preBootRepairLocal(dbPath);
    expect(backup, 'backup froid .pre-boot créé').not.toBeNull();
    expect(fs.existsSync(backup!)).toBe(true);
    expect(path.basename(backup!)).toMatch(/\.pre-boot-\d{8}-\d{6}(-\d+)?\.db$/);
    await expect(mockInitialize(dbPath)).resolves.toBe('ok');
    order.push('initialize-done');

    expect(order).toEqual(['preBootRepair', 'initialize', 'initialize-done']);
    // Fantôme purgé, réelle intacte.
    {
      const db = await openDb(dbPath);
      try {
        expect(listGhostsSync(db)).toEqual([]);
      } finally {
        db.close();
      }
    }
  });

  it('rétention : 7 backups .pre-boot -> prune -> 5 restants', async () => {
    const dbPath = path.join(tmpDir, 'database.db');
    fs.writeFileSync(dbPath, 'dummy');
    // 7 backups horodatés (tri lexical = ordre chrono avec ce format).
    for (const stamp of ['20260101-000001', '20260101-000002', '20260101-000003', '20260101-000004', '20260101-000005', '20260101-000006', '20260101-000007']) {
      fs.writeFileSync(`${dbPath}.pre-boot-${stamp}.db`, `bak-${stamp}`);
    }
    prunePreBootBackups(dbPath, 5);
    const rest = fs.readdirSync(tmpDir).filter((f) => f.includes('.pre-boot-')).sort();
    expect(rest).toHaveLength(5);
    expect(rest[0]).toContain('20260101-000003');
    expect(rest[4]).toContain('20260101-000007');
  });

  it('edge SEV-2.2 : fantôme SANS table réelle -> skip + warn, pas de DROP destructif', async () => {
    // Cas réel : rename interrompu où temporary_orphan est la SEULE copie.
    // Un DROP aveugle = perte de données. La garde hasReal doit skip + warn.
    const dbPath = path.join(tmpDir, 'ghost-orphan.db');
    {
      const db = await openDb(dbPath);
      try {
        db.exec(`CREATE TABLE "temporary_orphan" ("id" INTEGER PRIMARY KEY, "v" TEXT);`);
        db.exec(`INSERT INTO "temporary_orphan" ("v") VALUES ('precious');`);
        // Note : PAS de CREATE TABLE "orphan" volontairement.
      } finally {
        db.close();
      }
    }

    // 1. Unit : dropGhosts réel sur fantôme orphelin -> skipped, pas dropped.
    const warns: string[] = [];
    const origWarn = console.warn;
    console.warn = (...a: unknown[]) => {
      warns.push(a.map(String).join(' '));
    };
    try {
      const db = await openDb(dbPath);
      try {
        const ghosts = listGhostsReal(db as unknown as never);
        expect(ghosts).toContain('temporary_orphan');
        const { dropped, skipped } = dropGhostsReal(db as unknown as never, ghosts);
        expect(dropped).toEqual([]);
        expect(skipped).toContain('temporary_orphan');
      } finally {
        db.close();
      }
    } finally {
      console.warn = origWarn;
    }
    expect(warns.join('\n')).toMatch(/sans table réelle|skip/i);

    // 2. Le fantôme orphelin est intact (pas de DROP destructif).
    {
      const db = await openDb(dbPath);
      try {
        expect(listGhostsSync(db)).toContain('temporary_orphan');
        const row = db.prepare(`SELECT "v" FROM "temporary_orphan" LIMIT 1`).get() as { v: string };
        expect(String((row as unknown as Record<string, unknown>)['v'] ?? (row as unknown as { v: string }).v)).toBe('precious');
      } finally {
        db.close();
      }
    }

    // 3. E2E preBootRepair : backup créé, ghost orphelin conservé, integrity ok.
    const warns2: string[] = [];
    console.warn = (...a: unknown[]) => {
      warns2.push(a.map(String).join(' '));
    };
    try {
      const backup = await preBootRepairLocal(dbPath);
      expect(backup).not.toBeNull();
      expect(fs.existsSync(backup!)).toBe(true);
    } finally {
      console.warn = origWarn;
    }
    expect(warns2.join('\n')).toMatch(/sans réelle ignorés|sans table réelle/i);
    {
      const db = await openDb(dbPath);
      try {
        expect(listGhostsSync(db)).toContain('temporary_orphan');
      } finally {
        db.close();
      }
    }
  });
});
