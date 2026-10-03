/**
 * @vitest-environment node
 *
 * Bug onboarding : l'étape "Restaurer une sauvegarde existante"
 * (ConfigurationWizard → ImportBackupView → BackupImportCard) appelait
 * backup:previewImport / backup:confirmImport sans aucun user loggé
 * (is-first-launch), alors que security.ts (ADMIN_ONLY += backup:*)
 * + protectedHandle (roles admin) refusaient en UNAUTHENTICATED/FORBIDDEN
 * → frontend affichait "Réservé administrateur" et bloquait l'import.
 *
 * Fix : `allowDuringFirstLaunch` sur backup:import (alias legacy),
 * backup:previewImport, backup:confirmImport — bypass RBAC uniquement si
 * ConfigService.getInstance().isFirstLaunch() === true. Après setup,
 * le bypass est inactif → admin-only (fail-closed).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const handlerRegistry = vi.hoisted(() => new Map<string, (...args: any[]) => any>());

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((ch: string, h: (...a: any[]) => any) => {
      handlerRegistry.set(ch, h);
    }),
  },
  app: { getPath: vi.fn(() => '/tmp/e-school-backup-onboarding-bypass') },
}));

import { protectedHandle, rolesForChannel, isFirstLaunchBypassActive } from '../security';
import { ConfigService } from '../services/configService';

let isFirstLaunchSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  handlerRegistry.clear();
  (global as any).authService = { getCurrentUser: vi.fn().mockResolvedValue(null) };
  (global as any).auditLogService = { record: vi.fn().mockResolvedValue(undefined) };
  isFirstLaunchSpy = vi.spyOn(ConfigService.prototype, 'isFirstLaunch');
});

afterEach(() => {
  delete (global as any).authService;
  delete (global as any).auditLogService;
  vi.restoreAllMocks();
});

describe('backup onboarding bypass — isFirstLaunch', () => {
  it('1. isFirstLaunch=true sans user → preview/confirm autorisés (bypass actif)', async () => {
    isFirstLaunchSpy.mockReturnValue(true);
    expect(await isFirstLaunchBypassActive()).toBe(true);

    for (const ch of ['backup:previewImport', 'backup:confirmImport', 'backup:import']) {
      // rolesForChannel inchangé : toujours admin-only (le bypass est opt-in, pas un élargissement).
      expect(rolesForChannel(ch)).toEqual(['admin']);
      protectedHandle(
        `onboarding:${ch}`,
        { roles: rolesForChannel(ch), allowDuringFirstLaunch: true },
        vi.fn().mockResolvedValue({ success: true, data: { relaunching: true } }),
      );
      const wrapped = handlerRegistry.get(`onboarding:${ch}`)!;
      (global as any).authService.getCurrentUser.mockResolvedValue(null);
      await expect(wrapped(null, {})).resolves.toEqual({ success: true, data: { relaunching: true } });
    }
  });

  it('2. bypass audité avec actor null (pas de crash audit sans user)', async () => {
    isFirstLaunchSpy.mockReturnValue(true);
    (global as any).authService.getCurrentUser.mockResolvedValue(null);
    protectedHandle(
      'onboarding:preview:audit',
      {
        roles: ['admin'],
        allowDuringFirstLaunch: true,
        audit: {
          action: 'create',
          entity: 'Backup',
          summarize: () => ({ targetId: null, summary: 'Aperçu import (onboarding)' }),
        },
      },
      vi.fn().mockResolvedValue({ success: true, data: { canceled: false } }),
    );
    const wrapped = handlerRegistry.get('onboarding:preview:audit')!;
    await expect(wrapped(null, {})).resolves.toEqual({ success: true, data: { canceled: false } });
    expect((global as any).auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ actor: null }),
    );
  });

  it('3. après setup (isFirstLaunch=false) sans user → UNAUTHENTICATED (fail-closed)', async () => {
    isFirstLaunchSpy.mockReturnValue(false);
    expect(await isFirstLaunchBypassActive()).toBe(false);

    protectedHandle(
      'onboarding:preview:nosetup',
      { roles: ['admin'], allowDuringFirstLaunch: true },
      vi.fn().mockResolvedValue({ success: true }),
    );
    const wrapped = handlerRegistry.get('onboarding:preview:nosetup')!;
    (global as any).authService.getCurrentUser.mockResolvedValue(null);
    await expect(wrapped(null, {})).rejects.toThrow('UNAUTHENTICATED');
  });

  it('4. après setup sans admin (comptable/professor) → FORBIDDEN', async () => {
    isFirstLaunchSpy.mockReturnValue(false);
    protectedHandle(
      'onboarding:confirm:roles',
      { roles: rolesForChannel('backup:confirmImport'), allowDuringFirstLaunch: true },
      vi.fn().mockResolvedValue({ success: true }),
    );
    const wrapped = handlerRegistry.get('onboarding:confirm:roles')!;
    for (const role of ['comptable', 'professor', 'student']) {
      (global as any).authService.getCurrentUser.mockResolvedValue({
        id: 9,
        username: `${role}1`,
        role,
        displayName: null,
      });
      await expect(wrapped(null, {})).rejects.toThrow(/FORBIDDEN/);
    }
  });

  it('5. après setup admin → OK (non-régression)', async () => {
    isFirstLaunchSpy.mockReturnValue(false);
    protectedHandle(
      'onboarding:confirm:admin',
      { roles: rolesForChannel('backup:confirmImport'), allowDuringFirstLaunch: true },
      vi.fn().mockResolvedValue({ success: true, data: { relaunching: true } }),
    );
    const wrapped = handlerRegistry.get('onboarding:confirm:admin')!;
    (global as any).authService.getCurrentUser.mockResolvedValue({
      id: 1,
      username: 'admin1',
      role: 'admin',
      displayName: null,
    });
    await expect(wrapped(null, {})).resolves.toEqual({ success: true, data: { relaunching: true } });
  });

  it('6. scope étroit : backup:create (sans flag) reste bloqué même pendant first-launch', async () => {
    isFirstLaunchSpy.mockReturnValue(true);
    protectedHandle(
      'onboarding:create:strict',
      { roles: rolesForChannel('backup:create') },
      vi.fn().mockResolvedValue({ success: true }),
    );
    const wrapped = handlerRegistry.get('onboarding:create:strict')!;
    (global as any).authService.getCurrentUser.mockResolvedValue(null);
    await expect(wrapped(null, {})).rejects.toThrow('UNAUTHENTICATED');
  });

  it('7. events.ts : preview/import/confirm enregistrés avec allowDuringFirstLaunch + safety pre-import + relaunch', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'electron', 'events.ts'), 'utf8');
    for (const ch of ['backup:import', 'backup:previewImport', 'backup:confirmImport']) {
      const idx = src.indexOf(`protectedHandle("${ch}"`);
      expect(idx, `${ch} enregistré via protectedHandle`).toBeGreaterThan(-1);
      expect(src.slice(idx, idx + 600)).toMatch(/allowDuringFirstLaunch:\s*true/);
    }
    // Les autres canaux backup restent strictement admin-only (pas de flag).
    for (const ch of ['backup:create', 'backup:list', 'backup:restore', 'backup:delete']) {
      const idx = src.indexOf(`protectedHandle("${ch}"`);
      expect(idx, `${ch} enregistré`).toBeGreaterThan(-1);
      expect(src.slice(idx, idx + 600)).not.toMatch(/allowDuringFirstLaunch/);
    }
    // Safety backup pre-import + relaunch conservés côté service.
    const svc = fs.readFileSync(
      path.join(process.cwd(), 'electron', 'backend', 'services', 'localBackupService.ts'),
      'utf8',
    );
    expect(svc).toMatch(/createBackup\('pre-import'\)/);
    expect(svc).toMatch(/app\.relaunch\(\)/);
  });
});
