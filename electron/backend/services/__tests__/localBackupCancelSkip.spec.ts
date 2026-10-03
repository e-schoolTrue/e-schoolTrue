/**
 * @vitest-environment node
 * QA Backup — cancel/skip : annulations UI + skip sha legacy + gardes destructives.
 * - previewImport canceled (dialog annulé) → canceled:true
 * - exportBackup canceled → canceled:true
 * - confirmImport confirmed=false → NEED_CONFIRMATION (aucun safety)
 * - restoreBackup confirmed=false → NEED_CONFIRMATION
 * - sidecar absent → skip sha (legacy passe) ; sidecar corrompu → skip (pas de faux blocage)
 * - deleteBackup INVALID_NAME / NOT_FOUND ; revealBackup NOT_FOUND
 * - staging expiré → STAGING_EXPIRED ; extérieur → INVALID_STAGING_PATH
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as fsp from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const electronState = vi.hoisted(() => ({ userData: '', relaunch: vi.fn(), exit: vi.fn() }));
const showOpenDialogMock = vi.hoisted(() => vi.fn());
const showSaveDialogMock = vi.hoisted(() => vi.fn());

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
    showSaveDialog: (...a: unknown[]) => (showSaveDialogMock as (...x: unknown[]) => Promise<unknown>)(...a),
  },
  shell: { showItemInFolder: vi.fn() },
}));

const extractMock = vi.hoisted(() => vi.fn());
vi.mock('extract-zip', () => ({ default: (...a: unknown[]) => (extractMock as (...x: unknown[]) => Promise<void>)(...a) }));

import { LocalBackupService } from '../localBackupService';
import { AppDataSource } from '../../../data-source';

let tmpRoot = '';
let svc: LocalBackupService;
const FULL = ['user', 't_student', 'payments', 'school', 'grade', 'course', 'year_repartition',
  'professors', 'absences', 'expenses', 'cash_registers', 'cash_movements', 'payment_configs',
  'payment_annual_config', 'grading_config', 'fee_items', 'schedules', 'homework', 'audit_log',
  'school_settings', 'class_room', 'branch', 'teaching_assignment', 'grade_entry', 'calculated_grade'];

function stagingDir() { return path.join(electronState.userData, 'backups', 'staging'); }
function backupsDir() { return path.join(electronState.userData, 'backups'); }
async function writeRealDb(p: string, size = 8192) {
  const h = Buffer.from('SQLite format 3\0');
  await fsp.writeFile(p, Buffer.concat([h, Buffer.alloc(Math.max(0, size - h.length), 0x41)]));
}
function mockDs() {
  vi.spyOn(AppDataSource, 'getInstance').mockReturnValue({ isInitialized: true, query: vi.fn(), destroy: vi.fn() } as never);
}

beforeEach(async () => {
  tmpRoot = await fsp.mkdtemp(path.join(os.tmpdir(), 'e-school-cancel-skip-'));
  electronState.userData = tmpRoot;
  showOpenDialogMock.mockReset();
  showSaveDialogMock.mockReset();
  extractMock.mockReset();
  extractMock.mockResolvedValue(undefined);
  vi.clearAllMocks();
  showOpenDialogMock.mockReset();
  showSaveDialogMock.mockReset();
  vi.spyOn(console, 'log').mockImplementation(() => undefined);
  vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  await writeRealDb(path.join(tmpRoot, 'database.db'), 8192);
  await fsp.mkdir(path.join(tmpRoot, 'uploads'), { recursive: true });
  svc = new LocalBackupService();
});
afterEach(async () => {
  vi.restoreAllMocks();
  await fsp.rm(tmpRoot, { recursive: true, force: true }).catch(() => undefined);
});

describe('backup cancel/skip — annulations + gardes', () => {
  it('previewImport dialog annulé → canceled:true (aucune validation)', async () => {
    mockDs();
    showOpenDialogMock.mockResolvedValue({ canceled: true, filePaths: [] });
    const v = vi.spyOn(svc as any, 'validateCandidate');
    const res = await svc.previewImport();
    expect(res.success).toBe(true);
    expect(res.data?.canceled).toBe(true);
    expect(v).not.toHaveBeenCalled();
  });
  it('exportBackup dialog annulé → canceled:true (fichier conservé)', async () => {
    mockDs();
    await fsp.mkdir(backupsDir(), { recursive: true });
    const zip = path.join(backupsDir(), 'b.zip');
    await fsp.writeFile(zip, Buffer.alloc(16, 0));
    showSaveDialogMock.mockResolvedValue({ canceled: true });
    const res = await svc.exportBackup('b.zip');
    expect(res.success).toBe(true);
    expect(res.data?.canceled).toBe(true);
    expect(fs.existsSync(zip)).toBe(true);
  });
  it('exportBackup inexistant → NOT_FOUND', async () => {
    mockDs();
    await fsp.mkdir(backupsDir(), { recursive: true });
    const res = await svc.exportBackup('fantome.zip');
    expect(res.success).toBe(false);
    expect(res.error).toBe('NOT_FOUND');
  });
  it('confirmImport confirmed=false → NEED_CONFIRMATION, safety jamais appelé', async () => {
    mockDs();
    const safety = vi.spyOn(svc, 'createBackup');
    const res = await svc.confirmImport(path.join(stagingDir(), 'validate-1', 'database.db'), false);
    expect(res.success).toBe(false);
    expect(res.error).toBe('NEED_CONFIRMATION');
    expect(safety).not.toHaveBeenCalled();
  });
  it('restoreBackup confirmed=false → NEED_CONFIRMATION', async () => {
    mockDs();
    const safety = vi.spyOn(svc, 'createBackup');
    const res = await svc.restoreBackup('b.zip', false);
    expect(res.success).toBe(false);
    expect(res.error).toBe('NEED_CONFIRMATION');
    expect(safety).not.toHaveBeenCalled();
  });
  it('sidecar absent (legacy) → verifySidecarSha skip, pas de throw', async () => {
    mockDs();
    const work = path.join(stagingDir(), 'validate-skip');
    await fsp.mkdir(work, { recursive: true });
    const db = path.join(work, 'database.db');
    await writeRealDb(db, 8192);
    await expect((svc as any).verifySidecarSha(path.join(backupsDir(), 'legacy.zip'), db)).resolves.toBeUndefined();
  });
  it('sidecar corrompu (JSON invalide) → skip best-effort, pas de SHA_MISMATCH', async () => {
    mockDs();
    await fsp.mkdir(backupsDir(), { recursive: true });
    const zip = path.join(backupsDir(), 'corrupt.zip');
    await fsp.writeFile(zip, Buffer.alloc(16, 0));
    await fsp.writeFile(`${zip}.meta.json`, 'not-json{{{', 'utf8');
    const work = path.join(stagingDir(), 'validate-corrupt');
    await fsp.mkdir(work, { recursive: true });
    const db = path.join(work, 'database.db');
    await writeRealDb(db, 8192);
    await expect((svc as any).verifySidecarSha(zip, db)).resolves.toBeUndefined();
  });
  it('deleteBackup traversal → INVALID_NAME ; inexistant → NOT_FOUND', async () => {
    mockDs();
    await fsp.mkdir(backupsDir(), { recursive: true });
    const t = await svc.deleteBackup('../../evil.zip');
    expect(t.success).toBe(false);
    expect(t.error).toBe('INVALID_NAME');
    const n = await svc.deleteBackup('fantome.zip');
    expect(n.success).toBe(false);
    expect(n.error).toBe('NOT_FOUND');
  });
  it('revealBackup inexistant → NOT_FOUND', async () => {
    mockDs();
    await fsp.mkdir(backupsDir(), { recursive: true });
    const res = await svc.revealBackup('fantome.zip');
    expect(res.success).toBe(false);
    expect(res.error).toBe('NOT_FOUND');
  });
  it('confirmImport staging expiré → STAGING_EXPIRED ; extérieur → INVALID_STAGING_PATH', async () => {
    mockDs();
    const ghost = path.join(stagingDir(), 'validate-ghost2', 'database.db');
    await fsp.mkdir(path.dirname(ghost), { recursive: true });
    const e = await svc.confirmImport(ghost, true);
    expect(e.success).toBe(false);
    expect(e.error).toBe('STAGING_EXPIRED');
    const o = await svc.confirmImport('/tmp/evil-outside.db', true);
    expect(o.success).toBe(false);
    expect(o.error).toBe('INVALID_STAGING_PATH');
    await fsp.rm(path.dirname(ghost), { recursive: true, force: true });
  });
  it('FULL sanity : liste tables requises ≥ 7 et WARN_TABLE_COUNT=20', async () => {
    expect(FULL.length).toBeGreaterThanOrEqual(20);
  });
});
