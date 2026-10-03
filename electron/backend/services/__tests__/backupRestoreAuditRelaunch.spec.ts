/**
 * @vitest-environment node
 *
 * Fix 3 erreurs post-import sauvegarde :
 * 1. Audit fail-soft pendant isRestoring (jamais de throw `database connection is not open`).
 * 2. Relaunch dev : ne quitte jamais (reload fenêtre au lieu de app.relaunch()+exit).
 * 3. Pas de `Buffer()` déprécié (DEP0005) dans electron/ + src/.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const electronState = vi.hoisted(() => ({
  userData: '',
  relaunch: vi.fn(),
  exit: vi.fn(),
  windows: [] as Array<{ isDestroyed: () => boolean; reload: (...a: unknown[]) => void; loadURL: (...a: unknown[]) => void }>,
  isPackaged: undefined as boolean | undefined,
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => electronState.userData),
    getVersion: vi.fn(() => '9.9.9-test'),
    get isPackaged() { return electronState.isPackaged; },
    relaunch: (...a: unknown[]) => (electronState.relaunch as (...x: unknown[]) => void)(...a),
    exit: (...a: unknown[]) => (electronState.exit as (...x: unknown[]) => void)(...a),
  },
  BrowserWindow: {
    getFocusedWindow: () => null,
    getAllWindows: () => electronState.windows,
  },
  dialog: {
    showOpenDialog: vi.fn().mockResolvedValue({ canceled: true, filePaths: [] }),
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: true }),
  },
  shell: { showItemInFolder: vi.fn() },
}));

const extractMock = vi.hoisted(() => vi.fn());
vi.mock('extract-zip', () => ({ default: (...a: unknown[]) => (extractMock as (...x: unknown[]) => Promise<void>)(...a) }));

import { LocalBackupService } from '../localBackupService';
import { AppDataSource } from '../../../data-source';
import {
  AuditLogService,
  clearPendingAuditsForTests,
  getPendingAuditCount,
} from '../auditLogService';

const FULL = ['user', 't_student', 'payments', 'school', 'grade', 'course', 'year_repartition',
  'professors', 'absences', 'expenses', 'cash_registers', 'cash_movements', 'payment_configs',
  'payment_annual_config', 'grading_config', 'fee_items', 'schedules', 'homework', 'audit_log',
  'school_settings', 'class_room', 'branch', 'teaching_assignment', 'grade_entry', 'calculated_grade'];

function stagingDir() { return path.join(electronState.userData, 'backups', 'staging'); }

async function writeRealDb(p: string, size = 8192) {
  const h = Buffer.from('SQLite format 3\0');
  await fsp.writeFile(p, Buffer.concat([h, Buffer.alloc(Math.max(0, size - h.length), 0x41)]));
}

async function seedStaging(withUploads: boolean): Promise<string> {
  const work = await fsp.mkdtemp(path.join(stagingDir(), 'validate-'));
  const db = path.join(work, 'database.db');
  await writeRealDb(db, 8192);
  if (withUploads) {
    await fsp.mkdir(path.join(work, 'uploads'), { recursive: true });
    await fsp.writeFile(path.join(work, 'uploads', 'p.pdf'), 'x');
  }
  return db;
}

async function flushImmediate() { await new Promise<void>((r) => setImmediate(r)); }

let tmpRoot = '';
let svc: LocalBackupService;

beforeEach(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'e-school-audit-relaunch-'));
  electronState.userData = tmpRoot;
  electronState.windows = [];
  electronState.isPackaged = undefined;
  extractMock.mockReset();
  extractMock.mockResolvedValue(undefined);
  vi.clearAllMocks();
  electronState.relaunch.mockClear();
  electronState.exit.mockClear();
  delete process.env.VITE_DEV_SERVER_URL;
  delete (global as Record<string, unknown>).localBackupService;
  clearPendingAuditsForTests();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await writeRealDb(path.join(tmpRoot, 'database.db'), 8192);
  await fsp.mkdir(path.join(tmpRoot, 'uploads'), { recursive: true });
  svc = new LocalBackupService();
  vi.spyOn(svc as unknown as { replaceDbAndUploads: (a: string, b: string | null) => Promise<void> }, 'replaceDbAndUploads')
    .mockResolvedValue(undefined);
  vi.spyOn(svc as unknown as { invalidateSyncCursors: () => Promise<void> }, 'invalidateSyncCursors')
    .mockResolvedValue(undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.VITE_DEV_SERVER_URL;
  delete (global as Record<string, unknown>).localBackupService;
  await fsp.rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined);
});

function mockDsOpen() {
  vi.spyOn(AppDataSource, 'getInstance').mockReturnValue({ isInitialized: true, query: vi.fn(), destroy: vi.fn() } as never);
}

describe('1. audit pendant restoring ne throw jamais', () => {
  it('record() avec connexion fermée (isInitialized=false) → resolve, file mémoire, jamais throw', async () => {
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue({ isInitialized: false } as never);
    const service = new AuditLogService();
    await expect(service.record({
      action: 'update', targetEntity: 'Backup', targetId: 'x.zip',
      summary: 'Base locale restaurée', actor: null,
    })).resolves.toBeUndefined();
    expect(getPendingAuditCount()).toBeGreaterThanOrEqual(1);
  });

  it('record() pendant isRestoring global → skip silencieux, jamais throw même si save explose', async () => {
    const save = vi.fn().mockRejectedValue(new TypeError('database connection is not open'));
    const repo = { create: vi.fn((d: unknown) => d), save };
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue({
      isInitialized: true,
      getRepository: vi.fn(() => repo),
    } as never);
    (global as Record<string, unknown>).localBackupService = { isRestoring: true };
    const service = new AuditLogService();
    await expect(service.record({
      action: 'update', targetEntity: 'Backup', targetId: 'y.zip',
      summary: 'Base locale restaurée', actor: null,
    })).resolves.toBeUndefined();
    // Skip : le save sur connexion fermée n'est même pas tenté.
    expect(save).not.toHaveBeenCalled();
    expect(getPendingAuditCount()).toBeGreaterThanOrEqual(1);
  });

  it('record() via isRestoreInProgress() méthode → skip silencieux aussi', async () => {
    const save = vi.fn().mockRejectedValue(new TypeError('database connection is not open'));
    const repo = { create: vi.fn((d: unknown) => d), save };
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue({
      isInitialized: true,
      getRepository: vi.fn(() => repo),
    } as never);
    (global as Record<string, unknown>).localBackupService = { isRestoreInProgress: () => true };
    const service = new AuditLogService();
    await expect(service.record({
      action: 'update', targetEntity: 'Backup', summary: 'restore', actor: null,
    })).resolves.toBeUndefined();
    expect(save).not.toHaveBeenCalled();
  });

  it('record() chemin nominal (DB ouverte, pas de restore) → save appelé, pas de file', async () => {
    const save = vi.fn().mockResolvedValue({ id: 1 });
    const create = vi.fn((d: unknown) => d);
    const repo = { create, save };
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue({
      isInitialized: true,
      getRepository: vi.fn(() => repo),
    } as never);
    const service = new AuditLogService();
    await expect(service.record({
      action: 'create', targetEntity: 'Backup', targetId: 7,
      summary: 'Sauvegarde locale créée',
      actor: { id: 1, username: 'admin', role: 'admin', displayName: null },
    })).resolves.toBeUndefined();
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('2. relaunch dev ne quitte jamais', () => {
  function stubConfirmOk() {
    mockDsOpen();
    vi.spyOn(svc as unknown as { attachInspect: () => Promise<unknown> }, 'attachInspect')
      .mockResolvedValue({ tables: FULL, userVersion: 7 });
    vi.spyOn(svc as unknown as { liveUserVersion: () => Promise<number | null> }, 'liveUserVersion')
      .mockResolvedValue(7);
    vi.spyOn(svc, 'createBackup').mockResolvedValue({
      success: true,
      data: { id: 'pre-import.zip', name: 'pre-import.zip', createdAt: new Date().toISOString(), size: 1, reason: 'pre-import', meta: null },
      error: null,
    });
  }

  it('dev (VITE_DEV_SERVER_URL) → devReload:true, aucun reload backend (renderer fait location.reload)', async () => {
    process.env.VITE_DEV_SERVER_URL = 'http://localhost:5173/';
    const loadURL = vi.fn().mockResolvedValue(undefined);
    const reload = vi.fn();
    electronState.windows = [{ isDestroyed: () => false, reload, loadURL }];
    stubConfirmOk();
    const stagingDb = await seedStaging(true);
    const res = await svc.confirmImport(stagingDb, true, { acknowledgeMissingUploads: true, acknowledgeDowngrade: true });
    expect(res.success).toBe(true);
    expect(res.data?.devReload).toBe(true);
    await flushImmediate();
    expect(electronState.relaunch).not.toHaveBeenCalled();
    expect(electronState.exit).not.toHaveBeenCalled();
    expect(loadURL).not.toHaveBeenCalled();
    expect(reload).not.toHaveBeenCalled();
  });

  it('prod (pas de VITE_DEV_SERVER_URL, NODE_ENV=test) → relaunch + exit conservés', async () => {
    delete process.env.VITE_DEV_SERVER_URL;
    electronState.windows = [];
    stubConfirmOk();
    const stagingDb = await seedStaging(true);
    const res = await svc.confirmImport(stagingDb, true, { acknowledgeMissingUploads: true, acknowledgeDowngrade: true });
    expect(res.success).toBe(true);
    expect(res.data?.devReload ?? false).toBe(false);
    await flushImmediate();
    expect(electronState.relaunch).toHaveBeenCalledTimes(1);
    expect(electronState.exit).toHaveBeenCalledWith(0);
  });
});

describe('3. pas de Buffer() déprécié (DEP0005) dans electron/ + src/', () => {
  it('aucun `new Buffer(` ni appel `Buffer(` sans alloc/from dans le code first-party', async () => {
    const roots = [
      path.join(process.cwd(), 'electron'),
      path.join(process.cwd(), 'src'),
    ];
    const selfFile = path.resolve(__filename);
    // `Buffer(` direct (constructeur déprécié) : `Buffer(` NON précédé de `.` ou d'un
    // caractère de mot. `Buffer.from/alloc/concat/isBuffer` (préfixés par `.`) sont OK.
    // Commentaires (//, /* */) et littéraux ('...', "...", `...`) ignorés pour éviter
    // les faux positifs de documentation.
    const deprecatedCall = /(?<![.\w])Buffer\s*\(/;
    const newBuffer = /new\s+Buffer\s*\(/;
    const offenders: string[] = [];
    let inBlock = false;

    function stripLine(raw: string): string {
      let line = raw;
      if (inBlock) {
        const end = line.indexOf('*/');
        if (end === -1) return '';
        line = line.slice(end + 2);
        inBlock = false;
      }
      // Retire les blocs /* ... */ (éventuellement multilignes).
      for (;;) {
        const start = line.indexOf('/*');
        if (start === -1) break;
        const end = line.indexOf('*/', start + 2);
        if (end === -1) { line = line.slice(0, start); inBlock = true; break; }
        line = line.slice(0, start) + line.slice(end + 2);
      }
      const slash = line.indexOf('//');
      if (slash !== -1) line = line.slice(0, slash);
      // Retire les littéraux string/backtick (la doc cite `Buffer()` entre backticks).
      line = line.replace(/`[^`]*`/g, '``').replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""');
      return line;
    }

    async function walk(dir: string): Promise<void> {
      let entries: fs.Dirent[] = [];
      try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        if (e.name === 'node_modules' || e.name === 'dist' || e.name === 'coverage') continue;
        const full = path.join(dir, e.name);
        if (path.resolve(full) === selfFile) continue;
        if (e.isDirectory()) { await walk(full); continue; }
        if (!/\.(ts|js|vue|mts|cts)$/.test(e.name)) continue;
        let content = '';
        try { content = await fsp.readFile(full, 'utf8'); } catch { continue; }
        inBlock = false; // reset par fichier (commentaire non fermé = EOF)
        const lines = content.split('\n');
        lines.forEach((line, idx) => {
          const code = stripLine(line);
          if (newBuffer.test(code) || deprecatedCall.test(code)) {
            offenders.push(`${path.relative(process.cwd(), full)}:${idx + 1}: ${line.trim().slice(0, 120)}`);
          }
        });
      }
    }
    for (const r of roots) await walk(r);
    expect(offenders, `Buffer() déprécié (DEP0005) — utilisez Buffer.from/alloc :\n${offenders.join('\n')}`).toEqual([]);
  });
});
