/**
 * @vitest-environment node
 *
 * Fix login UNAUTHENTICATED : le select "Année scolaire" du LoginView appelle
 * yearRepartition:getAll → year:list → year:getAll AVANT connexion (actor null).
 * Ces 3 canaux + les 2 getCurrent doivent être en lecture publique pré-login
 * (`auth: 'optional'`), tandis que create/update/delete/setCurrent/close/reopen/
 * clone (+ alias switch/close/reopen/clone) restent admin-only (fail-closed).
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
  app: { getPath: vi.fn(() => '/tmp/e-school-year-prelogin') },
}));

import { protectedHandle, rolesForChannel } from '../security';

beforeEach(() => {
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
});

const PUBLIC_READS = [
  'yearRepartition:getAll',
  'yearRepartition:getCurrent',
  'year:list',
  'year:getAll',
  'year:getCurrent',
];

const ADMIN_MUTATIONS = [
  'yearRepartition:create',
  'yearRepartition:update',
  'yearRepartition:delete',
  'yearRepartition:setCurrent',
  'yearRepartition:close',
  'yearRepartition:reopen',
  'yearRepartition:clone',
  'year:switch',
  'year:close',
  'year:reopen',
  'year:clone',
];

describe('year list pré-login OK sans auth', () => {
  it('1. lectures publiques : actor null autorisé (auth optional, pas de UNAUTHENTICATED)', async () => {
    for (const ch of PUBLIC_READS) {
      protectedHandle(
        `prelogin:${ch}`,
        { roles: ['admin', 'professor', 'student', 'comptable'], auth: 'optional' },
        vi.fn().mockResolvedValue({ success: true, data: [{ id: 1, schoolYear: '2025-2026' }] }),
      );
      const wrapped = handlerRegistry.get(`prelogin:${ch}`)!;
      (global as any).authService.getCurrentUser.mockResolvedValue(null);
      await expect(wrapped(null)).resolves.toEqual(
        expect.objectContaining({ success: true }),
      );
    }
  });

  it('2. mutations : actor null → UNAUTHENTICATED (fail-closed, admin-only préservé)', async () => {
    for (const ch of ADMIN_MUTATIONS) {
      expect(rolesForChannel(ch), ch).toEqual(['admin']);
      protectedHandle(
        `prelogin-mut:${ch}`,
        { roles: rolesForChannel(ch) },
        vi.fn().mockResolvedValue({ success: true }),
      );
      const wrapped = handlerRegistry.get(`prelogin-mut:${ch}`)!;
      (global as any).authService.getCurrentUser.mockResolvedValue(null);
      await expect(wrapped(null, {})).rejects.toThrow('UNAUTHENTICATED');
    }
  });

  it('3. events.ts : les 5 lectures portent auth optional, les mutations non', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'electron', 'events.ts'), 'utf8');
    for (const ch of PUBLIC_READS) {
      const idx = src.indexOf(`protectedHandle("${ch}"`);
      expect(idx, `${ch} enregistré via protectedHandle`).toBeGreaterThan(-1);
      expect(src.slice(idx, idx + 600)).toMatch(/auth:\s*['"]optional['"]/);
    }
    for (const ch of ADMIN_MUTATIONS) {
      const idx = src.indexOf(`protectedHandle("${ch}"`);
      expect(idx, `${ch} enregistré`).toBeGreaterThan(-1);
      // Aucun assouplissement pré-login sur les écritures.
      expect(src.slice(idx, idx + 600)).not.toMatch(/auth:\s*['"]optional['"]/);
    }
  });

  it('4. rôle authentifié non-admin (comptable) : lecture OK, écriture FORBIDDEN', async () => {
    protectedHandle(
      'prelogin:read:role',
      { roles: ['admin', 'professor', 'student', 'comptable'], auth: 'optional' },
      vi.fn().mockResolvedValue({ success: true, data: [] }),
    );
    protectedHandle(
      'prelogin:write:role',
      { roles: ['admin'] },
      vi.fn().mockResolvedValue({ success: true }),
    );
    (global as any).authService.getCurrentUser.mockResolvedValue({
      id: 3, username: 'compta1', role: 'comptable', displayName: null,
    });
    await expect(handlerRegistry.get('prelogin:read:role')!(null)).resolves.toEqual(
      expect.objectContaining({ success: true }),
    );
    await expect(handlerRegistry.get('prelogin:write:role')!(null, {})).rejects.toThrow(/FORBIDDEN/);
  });
});
