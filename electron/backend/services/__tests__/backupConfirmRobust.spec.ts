/**
 * @vitest-environment node
 *
 * Robustesse import sauvegarde — confirmImport au commit :
 * - preview OK (staging valide 13.2 Mo / 54 tables) → confirm OK (safety + relaunch)
 * - staging expiré → STAGING_EXPIRED ; extérieur → INVALID_STAGING_PATH (safety jamais appelé)
 * - safety-fail → SAFETY_BACKUP_FAILED (aucun replace, flag retombé, pas de relaunch)
 * - sha mismatch (sidecar altéré) → SHA_MISMATCH bloquant au restore
 * - missing uploads : sans ack → NEED_CONFIRM_MISSING_UPLOADS ; avec ack → passe
 * - downgrade : sans ack → NEED_CONFIRM_DOWNGRADE ; avec ack → passe
 * - confirmed=false → NEED_CONFIRMATION (safety jamais appelé)
 * - cancel : preview dialog annulé → canceled:true (aucune validation)
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const electronState = vi.hoisted(() => ({ userData: '', relaunch: vi.fn(), exit: vi.fn() }));
const showOpenDialogMock = vi.hoisted(() => vi.fn());

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => electronState.userData),
    getVersion: vi.fn(() => '9.9.9-test'),
    relaunch: (...a: unknown[]) => (electronState.relaunch as (...x: unknown[]) => void)(...a),
    exit: (...a: unknown[]) => (electronState.exit as (...x: unknown[]) => void)(...a),
  },
  BrowserWindow: { getFocusedWindow: () => null, getAllWindows: () => [] },
  dialog: {
    showOpenDialog: (...a: unknown[]) => (showOpenDialogMock as (...x: unknown[]) => Promise<unknown>)(...a),
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

function stagingDir() { return path.join(electronState.userData, 'backups', 'staging'); }
function backupsDir() { return path.join(electronState.userData, 'backups'); }

async function writeRealDb(p: string, size = 13_841_000) {
  const h = Buffer.from('SQLite format 3\0');
  await fsp.writeFile(p, Buffer.concat([h, Buffer.alloc(Math.max(0, size - h.length), 0x41)]));
}
function mockDs() {
  vi.spyOn(AppDataSource, 'getInstance').mockReturnValue({ isInitialized: true, query: vi.fn(), destroy: vi.fn() } as never);
}
function stubAttach(tables: string[], userVersion: number | null = 7) {
  return vi.spyOn(svc as any, 'attachInspect').mockResolvedValue({ tables, userVersion });
}
function stubLive(v: number | null) {
  return vi.spyOn(svc as any, 'liveUserVersion').mockResolvedValue(v);
}
function stubSafetyOk(id = 'pre-import.zip') {
  return vi.spyOn(svc, 'createBackup').mockResolvedValue({
    success: true, data: { id, name: id, createdAt: new Date().toISOString(), size: 1, reason: 'pre-import', meta: null }, error: null,
  });
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
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'e-school-confirm-robust-'));
  electronState.userData = tmpRoot;
  extractMock.mockReset();
  extractMock.mockResolvedValue(undefined);
  vi.clearAllMocks();
  electronState.relaunch.mockClear();
  electronState.exit.mockClear();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await writeRealDb(path.join(tmpRoot, 'database.db'), 8192);
  await fsp.mkdir(path.join(tmpRoot, 'uploads'), { recursive: true });
  svc = new LocalBackupService();
  // Neutralise le remplacement à froid + curseurs (effets de bord disque/process).
  vi.spyOn(svc as any, 'replaceDbAndUploads').mockResolvedValue(undefined);
  vi.spyOn(svc as any, 'invalidateSyncCursors').mockResolvedValue(undefined);
});

afterEach(async () => {
  vi.restoreAllMocks();
  await fsp.rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined);
});

describe('backup confirm robuste — staging 13.2 Mo / 54 tables', () => {
  it('preview OK → confirm OK (safety pre-import + relaunch, safetyBackup tracé)', async () => {
    mockDs();
    stubLive(7);
    stubAttach(FULL.slice(0, 54).concat(Array.from({ length: 54 - 25 }, (_, i) => `extra_${i}`)).slice(0, 54), 7);
    stubSafetyOk('pre-import-132.zip');
    const stagingDb = await seedStaging(true);
    const res = await svc.confirmImport(stagingDb, true, { acknowledgeMissingUploads: true, acknowledgeDowngrade: true });
    expect(res.success).toBe(true);
    expect(res.data?.safetyBackup).toBe('pre-import-132.zip');
    expect(res.data?.relaunching).toBe(true);
    await flushImmediate();
    expect(electronState.relaunch).toHaveBeenCalledTimes(1);
    expect(electronState.exit).toHaveBeenCalledWith(0);
  });

  it('staging expiré → STAGING_EXPIRED ; extérieur → INVALID_STAGING_PATH (safety jamais appelé)', async () => {
    mockDs();
    const safety = vi.spyOn(svc, 'createBackup');
    const ghost = path.join(stagingDir(), 'validate-ghost', 'database.db');
    await fsp.mkdir(path.dirname(ghost), { recursive: true });
    const e = await svc.confirmImport(ghost, true);
    expect(e.success).toBe(false);
    expect(e.error).toBe('STAGING_EXPIRED');
    const o = await svc.confirmImport('/tmp/evil-outside.db', true);
    expect(o.success).toBe(false);
    expect(o.error).toBe('INVALID_STAGING_PATH');
    expect(safety).not.toHaveBeenCalled();
    await fsp.rm(path.dirname(ghost), { recursive: true, force: true });
  });

  it('safety-fail → confirmImport annulé (SAFETY_BACKUP_FAILED, aucun replace, pas de relaunch)', async () => {
    mockDs();
    stubLive(7);
    stubAttach(FULL, 7);
    vi.spyOn(svc, 'createBackup').mockResolvedValue({ success: false, data: null, error: 'NO_SPACE' });
    const replace = vi.mocked((svc as any).replaceDbAndUploads);
    const stagingDb = await seedStaging(true);
    const res = await svc.confirmImport(stagingDb, true, { acknowledgeMissingUploads: true, acknowledgeDowngrade: true });
    expect(res.success).toBe(false);
    expect(res.error).toBe('SAFETY_BACKUP_FAILED');
    expect(replace).not.toHaveBeenCalled();
    expect((svc as any).isRestoring).toBe(false);
    await flushImmediate();
    expect(electronState.relaunch).not.toHaveBeenCalled();
  });

  it('sha sidecar altéré → SHA_MISMATCH bloquant (intégrité)', async () => {
    mockDs();
    await fsp.mkdir(backupsDir(), { recursive: true });
    const zip = path.join(backupsDir(), 'tampered.zip');
    await fsp.writeFile(zip, Buffer.alloc(32, 0x7));
    await fsp.writeFile(`${zip}.meta.json`, JSON.stringify({ integrity: 'sha256:' + '0'.repeat(64) }), 'utf8');
    const work = path.join(stagingDir(), 'validate-sha');
    await fsp.mkdir(work, { recursive: true });
    const db = path.join(work, 'database.db');
    await writeRealDb(db, 1024);
    await expect((svc as any).verifySidecarSha(zip, db)).rejects.toThrow(/SHA_MISMATCH/);
  });

  it('sidecar absent (legacy) → skip, pas de faux blocage', async () => {
    mockDs();
    const work = path.join(stagingDir(), 'validate-legacy');
    await fsp.mkdir(work, { recursive: true });
    const db = path.join(work, 'database.db');
    await writeRealDb(db, 1024);
    await expect((svc as any).verifySidecarSha(path.join(backupsDir(), 'legacy.zip'), db)).resolves.toBeUndefined();
  });

  it('missing uploads sans ack → NEED_CONFIRM_MISSING_UPLOADS ; avec ack → passe', async () => {
    mockDs();
    stubLive(7);
    stubAttach(FULL, 7);
    stubSafetyOk();
    const stagingDb = await seedStaging(false);
    const blocked = await svc.confirmImport(stagingDb, true);
    expect(blocked.success).toBe(false);
    expect(blocked.error).toBe('NEED_CONFIRM_MISSING_UPLOADS');
    (svc as any).isRestoring = false;
    const ok = await svc.confirmImport(stagingDb, true, { acknowledgeMissingUploads: true, acknowledgeDowngrade: true });
    expect(ok.success).toBe(true);
  });

  it('downgrade sans ack → NEED_CONFIRM_DOWNGRADE ; avec ack → passe', async () => {
    mockDs();
    stubLive(9);
    stubAttach(FULL, 5);
    stubSafetyOk();
    const stagingDb = await seedStaging(true);
    const blocked = await svc.confirmImport(stagingDb, true, { acknowledgeMissingUploads: true });
    expect(blocked.success).toBe(false);
    expect(blocked.error).toBe('NEED_CONFIRM_DOWNGRADE');
    (svc as any).isRestoring = false;
    const ok = await svc.confirmImport(stagingDb, true, { acknowledgeMissingUploads: true, acknowledgeDowngrade: true });
    expect(ok.success).toBe(true);
  });

  it('confirmed=false → NEED_CONFIRMATION, safety jamais appelé', async () => {
    mockDs();
    const safety = vi.spyOn(svc, 'createBackup');
    const stagingDb = await seedStaging(true);
    const res = await svc.confirmImport(stagingDb, false);
    expect(res.success).toBe(false);
    expect(res.error).toBe('NEED_CONFIRMATION');
    expect(safety).not.toHaveBeenCalled();
  });

  it('cancel : preview dialog annulé → canceled:true (aucune validation)', async () => {
    mockDs();
    showOpenDialogMock.mockResolvedValue({ canceled: true, filePaths: [] });
    const v = vi.spyOn(svc as any, 'validateCandidate');
    const res = await svc.previewImport();
    expect(res.success).toBe(true);
    expect(res.data?.canceled).toBe(true);
    expect(v).not.toHaveBeenCalled();
  });
});
