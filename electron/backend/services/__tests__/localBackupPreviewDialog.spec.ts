/**
 * @vitest-environment node
 *
 * Onboarding import .zip : previewImport() doit ouvrir explicitement le sélecteur
 * (dialog.showOpenDialog filtres zip/db/sqlite, properties openFile), même sans
 * fenêtre parente focalisée (getFocusedWindow() null au premier tick du wizard),
 * puis retourner fileName + sourcePath (chemin choisi) + stagingPath + preview.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const showOpenDialogMock = vi.fn();
const getFocusedWindowMock = vi.fn();
const getAllWindowsMock = vi.fn();

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/e-school-preview-dialog-test'), getVersion: vi.fn(() => '0.0.0-test') },
  dialog: { showOpenDialog: (...args: any[]) => showOpenDialogMock(...args) },
  shell: { showItemInFolder: vi.fn() },
  BrowserWindow: {
    getFocusedWindow: (...args: any[]) => getFocusedWindowMock(...args),
    getAllWindows: (...args: any[]) => getAllWindowsMock(...args),
  },
}));

import { LocalBackupService } from '../localBackupService';

describe('localBackupService.previewImport — sélecteur .zip onboarding', () => {
  let svc: LocalBackupService;

  beforeEach(() => {
    vi.clearAllMocks();
    showOpenDialogMock.mockReset();
    getFocusedWindowMock.mockReturnValue(null);
    getAllWindowsMock.mockReturnValue([]);
    svc = new LocalBackupService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('ouvre le sélecteur avec filtres zip/db/sqlite + properties openFile (sans fenêtre parente)', async () => {
    showOpenDialogMock.mockResolvedValue({ canceled: true, filePaths: [] });
    const res = await svc.previewImport();
    expect(res.success).toBe(true);
    expect(res.data?.canceled).toBe(true);
    expect(showOpenDialogMock).toHaveBeenCalledTimes(1);
    // Sans parent : appel à 1 arg (options seules)
    const args = showOpenDialogMock.mock.calls[0];
    const options = args.length === 2 ? args[1] : args[0];
    expect(options.properties).toContain('openFile');
    const allExts = (options.filters as Array<{ extensions: string[] }>)
      .flatMap((f) => f.extensions.map((e) => e.toLowerCase()));
    for (const ext of ['zip', 'db', 'sqlite']) {
      expect(allExts).toContain(ext);
    }
  });

  it('utilise la fenêtre parente quand elle existe (dialog modal onboarding)', async () => {
    const fakeWin = { isDestroyed: () => false };
    getFocusedWindowMock.mockReturnValue(fakeWin);
    showOpenDialogMock.mockResolvedValue({ canceled: true, filePaths: [] });
    await svc.previewImport();
    expect(showOpenDialogMock).toHaveBeenCalledTimes(1);
    const args = showOpenDialogMock.mock.calls[0];
    // Avec parent : appel à 2 args (parent, options)
    expect(args.length).toBe(2);
    expect(args[0]).toBe(fakeWin);
    expect(args[1].properties).toContain('openFile');
  });

  it('fichier choisi → validateCandidate → retourne fileName + sourcePath + stagingPath + preview', async () => {
    const picked = '/home/user/sauvegardes/backup-20240101.zip';
    showOpenDialogMock.mockResolvedValue({ canceled: false, filePaths: [picked] });
    const preview = {
      kind: 'zip' as const,
      dbSize: 98765,
      tableCount: 32,
      userVersion: 5,
      hasUploads: true,
      sha256: 'sha256:deadbeef',
      warnings: [] as string[],
    };
    const validateSpy = vi
      .spyOn(svc as any, 'validateCandidate')
      .mockResolvedValue({ success: true, data: { stagingDb: '/tmp/staging/validate-1/database.db', stagingUploads: null, preview }, error: null });
    const res = await svc.previewImport();
    expect(validateSpy).toHaveBeenCalledWith(picked);
    expect(res.success).toBe(true);
    expect(res.data?.canceled).toBe(false);
    expect(res.data?.fileName).toBe('backup-20240101.zip');
    expect(res.data?.sourcePath).toBe(picked);
    expect(res.data?.stagingPath).toBe('/tmp/staging/validate-1/database.db');
    expect(res.data?.preview).toMatchObject({ tableCount: 32, userVersion: 5 });
  });

  it('candidat invalide → fail (pas de staging exposé)', async () => {
    showOpenDialogMock.mockResolvedValue({ canceled: false, filePaths: ['/home/user/corrompu.zip'] });
    vi.spyOn(svc as any, 'validateCandidate').mockResolvedValue({
      success: false, data: null, error: 'MISSING_TABLES', message: 'Tables requises absentes.',
    });
    const res = await svc.previewImport();
    expect(res.success).toBe(false);
    expect(res.error).toBe('MISSING_TABLES');
    expect(res.data).toBeNull();
  });
});
