/**
 * @vitest-environment node
 *
 * Régression onboarding "Erreur IPC backup:confirmImport : refus temporaire" :
 * l'ancien frontend appelait `set-first-launch-complete` AVANT
 * `backup:confirmImport`, ce qui coupait `isFirstLaunchBypassActive()` et faisait
 * retomber le confirm en FORBIDDEN/UNAUTHENTICATED (masqué en "refus temporaire").
 *
 * Fix backend (filet) : un preview valide pendant first-launch arme une grâce
 * wizard de 30 min pour `backup:confirmImport` (security.ts), même si le flag
 * first-launch a déjà basculé. Le frontend fixe l'ordre (confirm d'abord, puis
 * mark après succès uniquement).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const handlerRegistry = vi.hoisted(() => new Map<string, (...args: any[]) => any>());

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((ch: string, h: (...a: any[]) => any) => {
      handlerRegistry.set(ch, h);
    }),
  },
  app: { getPath: vi.fn(() => '/tmp/e-school-backup-wizard-grace') },
}));

import {
  protectedHandle,
  rolesForChannel,
  isFirstLaunchBypassActive,
  armWizardImportBypass,
  isWizardImportBypassArmed,
  resetWizardImportBypassForTests,
  WIZARD_IMPORT_GRACE_MS,
} from '../security';
import { ConfigService } from '../services/configService';

let isFirstLaunchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  handlerRegistry.clear();
  resetWizardImportBypassForTests();
  (global as any).authService = { getCurrentUser: vi.fn().mockResolvedValue(null) };
  (global as any).auditLogService = { record: vi.fn().mockResolvedValue(undefined) };
  isFirstLaunchSpy = vi.spyOn(ConfigService.prototype, 'isFirstLaunch');
});

afterEach(() => {
  delete (global as any).authService;
  delete (global as any).auditLogService;
  vi.restoreAllMocks();
});

function registerConfirm(name = 'grace:confirm') {
  protectedHandle(
    name,
    { roles: rolesForChannel('backup:confirmImport'), allowDuringFirstLaunch: true },
    vi.fn().mockResolvedValue({ success: true, data: { relaunching: true } }),
  );
  return handlerRegistry.get(name)!;
}

describe('backup wizard grace — preview arme le confirm après set-first-launch', () => {
  it('1. preview first-launch arme la grâce (isWizardImportBypassArmed true)', async () => {
    isFirstLaunchSpy.mockReturnValue(true);
    protectedHandle(
      'backup:previewImport',
      { roles: rolesForChannel('backup:previewImport'), allowDuringFirstLaunch: true },
      vi.fn().mockResolvedValue({ success: true, data: { canceled: false, stagingPath: '/tmp/x/database.db' } }),
    );
    const preview = handlerRegistry.get('backup:previewImport')!;
    await expect(preview(null)).resolves.toMatchObject({ success: true });
    expect(isWizardImportBypassArmed()).toBe(true);
  });

  it('2. preview échec (success:false) → pas de grâce', async () => {
    isFirstLaunchSpy.mockReturnValue(true);
    protectedHandle(
      'backup:previewImport',
      { roles: rolesForChannel('backup:previewImport'), allowDuringFirstLaunch: true },
      vi.fn().mockResolvedValue({ success: false, error: 'NOT_SQLITE' }),
    );
    const preview = handlerRegistry.get('backup:previewImport')!;
    await expect(preview(null)).resolves.toMatchObject({ success: false });
    expect(isWizardImportBypassArmed()).toBe(false);
  });

  it('3. confirm après set-first-launch (ancien ordre) passe grâce à la grâce armée', async () => {
    // Étape 1 : preview pendant first-launch → arme.
    isFirstLaunchSpy.mockReturnValue(true);
    expect(await isFirstLaunchBypassActive()).toBe(true);
    protectedHandle(
      'backup:previewImport',
      { roles: rolesForChannel('backup:previewImport'), allowDuringFirstLaunch: true },
      vi.fn().mockResolvedValue({ success: true, data: { stagingPath: '/tmp/x/database.db' } }),
    );
    await handlerRegistry.get('backup:previewImport')!(null);
    expect(isWizardImportBypassArmed()).toBe(true);

    // Étape 2 : ancien frontend a marqué complete AVANT confirm → isFirstLaunch false.
    isFirstLaunchSpy.mockReturnValue(false);
    expect(await isFirstLaunchBypassActive()).toBe(false);
    protectedHandle(
      'backup:confirmImport',
      { roles: rolesForChannel('backup:confirmImport'), allowDuringFirstLaunch: true },
      vi.fn().mockResolvedValue({ success: true, data: { relaunching: true } }),
    );
    const confirm = handlerRegistry.get('backup:confirmImport')!;
    (global as any).authService.getCurrentUser.mockResolvedValue(null);
    await expect(confirm(null, '/tmp/x/database.db', true)).resolves.toMatchObject({ success: true });
  });

  it('4. sans preview préalable, après setup sans user → UNAUTHENTICATED (fail-closed préservé)', async () => {
    isFirstLaunchSpy.mockReturnValue(false);
    expect(isWizardImportBypassArmed()).toBe(false);
    const confirm = registerConfirm();
    (global as any).authService.getCurrentUser.mockResolvedValue(null);
    await expect(confirm(null, '/tmp/x/database.db', true)).rejects.toThrow('UNAUTHENTICATED');
  });

  it('5. après setup avec comptable → FORBIDDEN même si un autre canal a été armé pour preview', async () => {
    // Grâce armée manuellement (simule un preview antérieur).
    armWizardImportBypass();
    isFirstLaunchSpy.mockReturnValue(false);
    // La grâce ne bénéficie qu'à backup:confirmImport, pas aux autres canaux.
    protectedHandle(
      'backup:create',
      { roles: rolesForChannel('backup:create') },
      vi.fn().mockResolvedValue({ success: true }),
    );
    const create = handlerRegistry.get('backup:create')!;
    (global as any).authService.getCurrentUser.mockResolvedValue({
      id: 3, username: 'c1', role: 'comptable', displayName: null,
    });
    await expect(create(null)).rejects.toThrow(/FORBIDDEN/);
  });

  it('6. grâce expirée (>30 min) → confirm de nouveau refusé', async () => {
    armWizardImportBypass(Date.now() - WIZARD_IMPORT_GRACE_MS - 1000);
    expect(isWizardImportBypassArmed()).toBe(false);
    isFirstLaunchSpy.mockReturnValue(false);
    const confirm = registerConfirm('grace:confirm:expired');
    (global as any).authService.getCurrentUser.mockResolvedValue(null);
    await expect(confirm(null, '/tmp/x/database.db', true)).rejects.toThrow('UNAUTHENTICATED');
  });
});
