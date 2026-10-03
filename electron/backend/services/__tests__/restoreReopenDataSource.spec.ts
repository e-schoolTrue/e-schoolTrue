/**
 * @vitest-environment node
 *
 * Non-régression log post-import :
 * `getSchool database connection is not open` après "[LocalBackup] import externe — dev : reload fenêtre".
 *
 * Cause : `replaceDbAndUploads()` faisait `ds.destroy()` (SQLite interdit le swap d'un
 * fichier ouvert) puis rendait la main sans réouvrir. En prod le `app.relaunch()+exit`
 * masquait le bug (boot → `initialize()`), mais en dev le backend ne fait qu'un reload
 * fenêtre → la DataSource restait détruite et `school:get` échouait.
 *
 * Fix vérifié ici : après `replaceDbAndUploads` (via `confirmImport` / `restoreBackup`
 * avec le VRAI replace, pas de mock), la DataSource est réouverte (`reinitialize()`)
 * AVANT le retour success — `getSchool` (simulé par `getInstance()` + `query()`)
 * passe SANS reopen manuel, et `isRestoring` est retombé à false.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const electronState = vi.hoisted(() => ({
  userData: '',
  relaunch: vi.fn(),
  exit: vi.fn(),
  windows: [] as Array<{ isDestroyed: () => boolean; reload: (...a: unknown[]) => void; loadURL: (...a: unknown[]) => void }>,
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => electronState.userData),
    getVersion: vi.fn(() => '9.9.9-test'),
    get isPackaged() { return undefined; },
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

const FULL = ['user', 't_student', 'payments', 'school', 'grade', 'course', 'year_repartition',
  'professors', 'absences', 'expenses', 'cash_registers', 'cash_movements', 'payment_configs',
  'payment_annual_config', 'grading_config', 'fee_items', 'schedules', 'homework', 'audit_log',
  'school_settings', 'class_room', 'branch', 'teaching_assignment', 'grade_entry', 'calculated_grade'];

/** État simulé de la connexion : destroy() → false, reinitialize()/initialize() → true. */
const dsState = { open: true };

function mockDsLifecycle() {
  const fakeDs = {
    get isInitialized() { return dsState.open; },
    destroy: vi.fn(async () => { dsState.open = false; }),
    query: vi.fn(async () => [{ id: 'ecole-1', name: 'Ecole Test' }]),
  };
  vi.spyOn(AppDataSource, 'getInstance').mockImplementation(() => {
    if (!dsState.open) throw new Error('database connection is not open');
    return fakeDs as never;
  });
  vi.spyOn(AppDataSource, 'initialize').mockImplementation(async () => {
    dsState.open = true;
    return fakeDs as never;
  });
  vi.spyOn(AppDataSource, 'reinitialize').mockImplementation(async () => {
    dsState.open = true;
    return fakeDs as never;
  });
  return fakeDs;
}

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

let tmpRoot = '';
let svc: LocalBackupService;

beforeEach(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'e-school-reopen-'));
  electronState.userData = tmpRoot;
  electronState.windows = [];
  dsState.open = true;
  extractMock.mockReset();
  extractMock.mockResolvedValue(undefined);
  delete process.env.VITE_DEV_SERVER_URL;
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await writeRealDb(path.join(tmpRoot, 'database.db'), 8192);
  await fsp.mkdir(path.join(tmpRoot, 'uploads'), { recursive: true });
  svc = new LocalBackupService();
  mockDsLifecycle();
  // Validation OK, safety backup OK — seul replaceDbAndUploads tourne en VRAI.
  vi.spyOn(svc as unknown as { attachInspect: () => Promise<unknown> }, 'attachInspect')
    .mockResolvedValue({ tables: FULL, userVersion: 7 });
  vi.spyOn(svc as unknown as { liveUserVersion: () => Promise<number | null> }, 'liveUserVersion')
    .mockResolvedValue(7);
  vi.spyOn(svc, 'createBackup').mockResolvedValue({
    success: true,
    data: { id: 'pre-import.zip', name: 'pre-import.zip', createdAt: new Date().toISOString(), size: 1, reason: 'pre-import', meta: null },
    error: null,
  });
  vi.spyOn(svc as unknown as { invalidateSyncCursors: () => Promise<void> }, 'invalidateSyncCursors')
    .mockResolvedValue(undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.VITE_DEV_SERVER_URL;
  await fsp.rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined);
});

describe('post-import : DataSource réouverte avant success (getSchool OK sans reopen manuel)', () => {
  it('confirmImport (VRAI replaceDbAndUploads) → reinitialize appelée, getInstance()+query OK, isRestoring=false', async () => {
    const stagingDb = await seedStaging(true);
    const res = await svc.confirmImport(stagingDb, true, { acknowledgeMissingUploads: true, acknowledgeDowngrade: true });
    expect(res.success).toBe(true);

    // Le fix : réouverture AVANT le retour success.
    expect(AppDataSource.reinitialize).toHaveBeenCalledTimes(1);

    // getSchool-like : getInstance() ne throw plus `database connection is not open`,
    // et une requête passe sans reopen manuel supplémentaire.
    let getSchoolError: unknown = null;
    try {
      const ds = AppDataSource.getInstance();
      await ds.query('SELECT id, name FROM school LIMIT 1');
    } catch (e) { getSchoolError = e; }
    expect(getSchoolError).toBeNull();

    // Le flag ne doit pas survivre au success (sinon RESTORE_IN_PROGRESS permanent en dev).
    expect(svc.isRestoringActive).toBe(false);
  });

  it('restoreBackup (VRAI replaceDbAndUploads) → même garantie de réouverture', async () => {
    // restoreBackup lit le zip via extract mock : on simule l'extraction du staging.
    const stagingDb = await seedStaging(true);
    const workDir = path.dirname(stagingDb);
    extractMock.mockImplementation(async (_zip: unknown, opts: { dir: string }) => {
      await fsp.copyFile(stagingDb, path.join(opts.dir, 'database.db'));
      await fsp.mkdir(path.join(opts.dir, 'uploads'), { recursive: true });
      await fsp.writeFile(path.join(opts.dir, 'uploads', 'p.pdf'), 'x');
    });
    // Crée un faux zip de backup pour resolveBackupFile.
    const zipName = 'backup-20240101-000000.zip';
    await fsp.writeFile(path.join(tmpRoot, 'backups', zipName), Buffer.alloc(8192));
    void workDir;

    const res = await svc.restoreBackup(zipName, true, { acknowledgeMissingUploads: true, acknowledgeDowngrade: true });
    expect(res.success).toBe(true);
    expect(AppDataSource.reinitialize).toHaveBeenCalled();
    expect(() => AppDataSource.getInstance()).not.toThrow();
    expect(svc.isRestoringActive).toBe(false);
  });
});
