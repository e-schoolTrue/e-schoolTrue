/**
 * @vitest-environment node
 *
 * Import bout-en-bout (diagnostic backup-20260928 : 56 tables, 2 années,
 * 634 élèves, 100 payments → login « Aucune année ouverte »).
 *
 * Cause : `database.db` sur disque contenait bien l'import (swap OK) mais les
 * services gardaient les repositories capturés au boot (connexion détruite /
 * ancienne DB vide) — `yearRepartition:getAll` pré-login revenait vide et
 * `getCurrent` null. Le dev-reload ne rebootant pas le backend, aucun
 * `initialize()` ne réparait cela.
 *
 * Ce test rejoue le cycle de vie réel (VRAI `replaceDbAndUploads` : copie
 * fichier + `destroy()` + `reinitialize()`, sans mock du swap) avec une
 * fixture contenant 2 années ouvertes sans courante : après `confirmImport`,
 * `getAll` (lecture pré-login, sans auth) voit les années et `getCurrent`
 * est non null (la plus récente ouverte devient courante). Vérifie aussi le
 * log explicite « Import OK : X années, Y élèves ».
 *
 * Note runtime : better-sqlite3 est compilé pour Electron (NODE_MODULE 121),
 * pas pour le Node système de vitest (127) — donc pas de vraie SQLite ici :
 * le cycle de vie DataSource est simulé (ancien DS vide → nouveau DS avec les
 * années du zip), tandis que le swap fichier + destroy/reinitialize + refresh
 * des services + activation sont réels.
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

import { LocalBackupService } from '../localBackupService';
import { YearRepartitionService } from '../yearService';
import { AppDataSource } from '../../../data-source';

const FULL = ['user', 't_student', 'payments', 'school', 'grade', 'course', 'year_repartition',
  'professors', 'absences', 'expenses', 'cash_registers', 'cash_movements', 'payment_configs',
  'payment_annual_config', 'grading_config', 'fee_items', 'schedules', 'homework', 'audit_log',
  'school_settings', 'class_room', 'branch', 'teaching_assignment', 'grade_entry', 'calculated_grade'];

const mkYear = (over: Record<string, unknown> = {}) => ({
  id: 1,
  schoolYear: '2024-2025',
  periodConfigurations: [{ name: 'Année', start: new Date('2024-09-01'), end: new Date('2025-06-30') }],
  isCurrent: false,
  status: 'active',
  closedAt: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...over,
});

const FIXTURE_YEARS = [
  mkYear({ id: 1, schoolYear: '2024-2025', isCurrent: false, status: 'active' }),
  mkYear({ id: 2, schoolYear: '2025-2026', isCurrent: false, status: 'active' }),
];

/** Cycle de vie simulé : avant reinitialize → DS vide (live pré-import) ; après → DS du zip. */
const lifecycle = { replaced: false };

function repoFor(rows: unknown[]) {
  return {
    find: vi.fn(async () => rows.map((r) => ({ ...(r as object) }))),
    findOne: vi.fn(async (opts: { where?: { id?: number } }) => {
      const id = opts?.where?.id;
      return rows.find((r) => (r as { id: number }).id === id) ?? null;
    }),
    save: vi.fn(async (e: unknown) => ({ ...(e as object) })),
    delete: vi.fn(async () => ({ affected: 1 })),
    createQueryBuilder: vi.fn(() => ({ update: () => ({ set: () => ({ execute: async () => undefined }) }) })),
  };
}

function queryFor(rows: unknown[]) {
  return vi.fn(async (sql: string) => {
    const s = String(sql);
    if (/COUNT\(\*\).*T_student/i.test(s)) return [{ n: 634 }];
    if (/COUNT\(\*\).*payments/i.test(s)) return [{ n: 100 }];
    if (/FROM year_repartition/i.test(s)) {
      return rows.map((r) => ({
        schoolYear: (r as { schoolYear: string }).schoolYear,
        isCurrent: (r as { isCurrent: boolean }).isCurrent ? 1 : 0,
        status: (r as { status: string }).status,
      }));
    }
    if (/PRAGMA|ATTACH|DETACH|VACUUM/i.test(s)) return [];
    if (/SELECT id, name FROM school/i.test(s)) return [{ id: 'ecole-1', name: 'Ecole Test' }];
    return [];
  });
}

function mockLifecycle() {
  const emptyRepo = repoFor([]);
  const fixtureRepo = repoFor(FIXTURE_YEARS);
  const emptyDs = {
    get isInitialized() { return !lifecycle.replaced; },
    destroy: vi.fn(async () => undefined),
    query: queryFor([]),
    getRepository: vi.fn(() => emptyRepo),
  };
  const fixtureDs = {
    get isInitialized() { return true; },
    destroy: vi.fn(async () => undefined),
    query: queryFor(FIXTURE_YEARS),
    getRepository: vi.fn(() => fixtureRepo),
  };
  vi.spyOn(AppDataSource, 'getInstance').mockImplementation(() => (lifecycle.replaced ? fixtureDs : emptyDs) as never);
  vi.spyOn(AppDataSource, 'reinitialize').mockImplementation(async () => {
    lifecycle.replaced = true;
    return fixtureDs as never;
  });
  return { emptyRepo, fixtureRepo, emptyDs, fixtureDs };
}

function stagingDir() { return path.join(electronState.userData, 'backups', 'staging'); }

async function writeRealDb(p: string, size = 8192) {
  const h = Buffer.from('SQLite format 3\0');
  await fsp.writeFile(p, Buffer.concat([h, Buffer.alloc(Math.max(0, size - h.length), 0x41)]));
}

async function seedStaging(): Promise<string> {
  const work = await fsp.mkdtemp(path.join(stagingDir(), 'validate-'));
  const db = path.join(work, 'database.db');
  await writeRealDb(db, 8192);
  return db;
}

let tmpRoot = '';
let svc: LocalBackupService;

beforeEach(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'e-school-import-e2e-'));
  electronState.userData = tmpRoot;
  electronState.windows = [];
  lifecycle.replaced = false;
  delete process.env.VITE_DEV_SERVER_URL;
  delete (global as unknown as { yearRepartitionService?: unknown }).yearRepartitionService;
  delete (global as unknown as { refreshServicesAfterDbReplace?: unknown }).refreshServicesAfterDbReplace;
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await writeRealDb(path.join(tmpRoot, 'database.db'), 8192);
  await fsp.mkdir(path.join(tmpRoot, 'uploads'), { recursive: true });
  svc = new LocalBackupService();
  mockLifecycle();
  // Re-validation OK au commit (vrai cycle de vie, contenu stubbé) ; safety OK.
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
  // Service pré-login créé AVANT l'import (comme au boot) + hook main.ts.
  (global as unknown as { yearRepartitionService: unknown }).yearRepartitionService = new YearRepartitionService();
  (global as unknown as { refreshServicesAfterDbReplace: unknown }).refreshServicesAfterDbReplace = () => {
    (global as unknown as { yearRepartitionService: unknown }).yearRepartitionService = new YearRepartitionService();
  };
});

afterEach(async () => {
  vi.restoreAllMocks();
  delete process.env.VITE_DEV_SERVER_URL;
  delete (global as unknown as { yearRepartitionService?: unknown }).yearRepartitionService;
  delete (global as unknown as { refreshServicesAfterDbReplace?: unknown }).refreshServicesAfterDbReplace;
  await fsp.rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined);
});

describe('import bout-en-bout : fixture avec années → getAll/getCurrent pré-login OK', () => {
  it('confirmImport → getAll voit les 2 années sans auth, getCurrent = plus récente ouverte', async () => {
    // Pré-import : live vide → login « Aucune année ouverte ».
    const bootSvc = (global as unknown as { yearRepartitionService: YearRepartitionService }).yearRepartitionService;
    const before = await bootSvc.getAllYearRepartitions();
    expect(before.success).toBe(true);
    expect(before.data ?? []).toHaveLength(0);

    // Import réel (VRAI replaceDbAndUploads : swap fichier + destroy + reinitialize).
    const stagingDb = await seedStaging();
    const res = await svc.confirmImport(stagingDb, true, {
      acknowledgeMissingUploads: true,
      acknowledgeDowngrade: true,
    });
    expect(res.success).toBe(true);
    expect(AppDataSource.reinitialize).toHaveBeenCalledTimes(1);
    expect(svc.isRestoringActive).toBe(false);

    // Le fichier actif sur disque est celui du zip (copie réelle vérifiée).
    const liveBytes = await fsp.readFile(path.join(tmpRoot, 'database.db'));
    const stagingBytes = await fsp.readFile(stagingDb);
    expect(liveBytes.equals(stagingBytes)).toBe(true);

    // L'instance créée AVANT l'import (boot) voit aussi les années : les
    // repositories sont résolus paresseusement, jamais capturés (sinon elle
    // lirait encore l'ancienne connexion vide malgré le swap fichier).
    const staleAfter = await bootSvc.getAllYearRepartitions();
    expect(staleAfter.success).toBe(true);
    expect((staleAfter.data ?? []).map((y) => y.schoolYear).sort()).toEqual(['2024-2025', '2025-2026']);

    // Lectures pré-login (sans auth) : getAll voit les années du zip…
    const g = (global as unknown as { yearRepartitionService: YearRepartitionService }).yearRepartitionService;
    const after = await g.getAllYearRepartitions();
    expect(after.success).toBe(true);
    expect((after.data ?? []).map((y) => y.schoolYear).sort()).toEqual(['2024-2025', '2025-2026']);

    // …et la plus récente OUVERTE est devenue courante.
    const current = await g.getCurrentYearRepartition();
    expect(current.success).toBe(true);
    expect(current.data).not.toBeNull();
    expect(current.data?.schoolYear).toBe('2025-2026');

    // Log explicite exigé « Import OK : X années, Y élèves ».
    const flat = (console.log as unknown as { mock: { calls: unknown[][] } }).mock.calls
      .map((c) => String(c[0] ?? '')).join('\n');
    expect(flat).toMatch(/Import OK : 2 années, 634 élèves/);
  });
});
