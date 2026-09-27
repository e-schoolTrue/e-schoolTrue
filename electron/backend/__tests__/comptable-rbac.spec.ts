import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

// Capture ipcMain.handle registrations so we can invoke wrapped handlers directly.
const handlerRegistry = vi.hoisted(() => new Map<string, (...args: any[]) => any>())

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      handlerRegistry.set(channel, handler)
    }),
  },
}))

import { protectedHandle, rolesForChannel, COMPTABLE_ALLOW, PROFESSOR_WRITE_EXACT } from '../security'

/**
 * Suite RBAC rôle comptable (backend).
 *
 * `electron/events.ts` mappe chaque canal IPC vers une allow-list via
 * `rolesForChannel()` :
 * - canaux compta (payment:/expense:/cash:/comptabilite:/bank:/teacher:/receipt:)
 *   → ['admin', 'comptable']
 * - professor:payment:create/update (cas explicite AVANT PROFESSOR_WRITE)
 *   → ['admin', 'professor', 'comptable']
 * - canaux admin (users, school, grade, classRoom via ADMIN_ONLY)
 *   → ['admin']
 * - auth:validateSecurityAnswer → ['admin','professor','student','comptable']
 *
 * `rolesForChannel` n'étant pas exportée (importer events.ts tirerait tout le
 * main process), cette suite vérifie :
 *  1. que `protectedHandle` (le mécanisme d'enforcement réel) applique
 *     correctement ces allow-lists (accept/reject par rôle),
 *  2. par inspection de source, que le mapping déclaré dans events.ts est
 *     conforme (COMPTABLE_ALLOW avant ADMIN_ONLY, cas professor:payment, etc.).
 */

describe('comptable RBAC – protectedHandle enforcement', () => {
  let authServiceMock: any
  let auditLogServiceMock: any

  const actorFor = (role: string) => ({
    id: role === 'admin' ? 1 : role === 'comptable' ? 3 : role === 'professor' ? 2 : 4,
    username: `${role}1`,
    role,
    displayName: null,
  })

  /** Enregistre un canal avec les rôles donnés et retourne son handler wrappé. */
  const register = (channel: string, roles: any[]) => {
    protectedHandle(channel, { roles }, vi.fn().mockResolvedValue({ success: true }))
    return handlerRegistry.get(channel)!
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    handlerRegistry.clear()

    authServiceMock = { getCurrentUser: vi.fn().mockResolvedValue(null) }
    auditLogServiceMock = { record: vi.fn().mockResolvedValue(undefined) }
    ;(globalThis as any).authService = authServiceMock
    ;(globalThis as any).auditLogService = auditLogServiceMock
    ;(global as any).authService = authServiceMock
    ;(global as any).auditLogService = auditLogServiceMock
  })

  afterEach(() => {
    delete (globalThis as any).authService
    delete (globalThis as any).auditLogService
    delete (global as any).authService
    delete (global as any).auditLogService
    vi.restoreAllMocks()
  })

  // --- Canaux compta : ['admin', 'comptable'] ---
  it.each([
    ['payment:create'],
    ['payment:saveConfig'],
    ['expense:create'],
    ['expense:update'],
    ['expense:delete'],
    ['cash:append'],
    ['cash:closure:create'],
    ['comptabilite:validate'],
    ['bank:create'],
    ['bank:transaction:create'],
    ['receipt:generate'],
    ['teacher:hourlog:create'],
  ])('canal compta %s : comptable + admin acceptés, professor/student rejetés', async (channel) => {
    const wrapped = register(`rbac:compta:${channel}`, ['admin', 'comptable'])

    for (const role of ['admin', 'comptable']) {
      authServiceMock.getCurrentUser.mockResolvedValue(actorFor(role))
      await expect(wrapped(null, {})).resolves.toEqual({ success: true })
    }
    for (const role of ['professor', 'student']) {
      authServiceMock.getCurrentUser.mockResolvedValue(actorFor(role))
      await expect(wrapped(null, {})).rejects.toThrow(/FORBIDDEN/)
    }
  })

  // --- professor:payment:create/update : ['admin', 'professor', 'comptable'] ---
  it.each([['professor:payment:create'], ['professor:payment:update']])(
    '%s : admin/professor/comptable acceptés, student rejeté (non-régression professor)',
    async (channel) => {
      const wrapped = register(`rbac:${channel}`, ['admin', 'professor', 'comptable'])

      for (const role of ['admin', 'professor', 'comptable']) {
        authServiceMock.getCurrentUser.mockResolvedValue(actorFor(role))
        await expect(wrapped(null, {})).resolves.toEqual({ success: true })
      }
      authServiceMock.getCurrentUser.mockResolvedValue(actorFor('student'))
      await expect(wrapped(null, {})).rejects.toThrow(/FORBIDDEN/)
    },
  )

  // --- Canaux admin-only : ['admin'] ---
  it.each([['users:create'], ['grade:new'], ['classRoom:new'], ['school:save']])(
    'canal admin %s : comptable/professor/student rejetés, admin accepté',
    async (channel) => {
      const wrapped = register(`rbac:admin:${channel}`, ['admin'])

      authServiceMock.getCurrentUser.mockResolvedValue(actorFor('admin'))
      await expect(wrapped(null, {})).resolves.toEqual({ success: true })

      for (const role of ['comptable', 'professor', 'student']) {
        authServiceMock.getCurrentUser.mockResolvedValue(actorFor(role))
        await expect(wrapped(null, {})).rejects.toThrow(/FORBIDDEN/)
      }
    },
  )

  // --- auth:validateSecurityAnswer : 4 rôles ---
  it('auth:validateSecurityAnswer : les 4 rôles sont acceptés', async () => {
    const wrapped = register('rbac:auth:validateSecurityAnswer', [
      'admin',
      'professor',
      'student',
      'comptable',
    ])
    for (const role of ['admin', 'professor', 'student', 'comptable']) {
      authServiceMock.getCurrentUser.mockResolvedValue(actorFor(role))
      await expect(wrapped(null, {})).resolves.toEqual({ success: true })
    }
  })

  it('sans acteur authentifié : UNAUTHENTICATED sur canal compta (fail-closed)', async () => {
    const wrapped = register('rbac:compta:noactor', ['admin', 'comptable'])
    authServiceMock.getCurrentUser.mockResolvedValue(null)
    await expect(wrapped(null, {})).rejects.toThrow('UNAUTHENTICATED')
  })
})

describe('comptable RBAC – rolesForChannel canonique (electron/backend/security.ts, tests directs)', () => {
  it('COMPTABLE_ALLOW couvre payment:/expense:/cash:/comptabilite:/bank:/teacher:/receipt:', () => {
    for (const prefix of ['payment:', 'expense:', 'cash:', 'comptabilite:', 'bank:', 'teacher:', 'receipt:']) {
      expect(COMPTABLE_ALLOW).toContain(prefix)
    }
  })

  it('payment:create → ["admin","comptable"] (COMPTABLE_ALLOW gagne sur ADMIN_ONLY qui contient aussi payment:)', () => {
    expect(rolesForChannel('payment:create')).toEqual(['admin', 'comptable'])
    expect(rolesForChannel('payment:saveConfig')).toEqual(['admin', 'comptable'])
  })

  it('professor:payment:create/update → allow-list explicite admin/professor/comptable (non-régression professor)', () => {
    expect(rolesForChannel('professor:payment:create')).toEqual(['admin', 'professor', 'comptable'])
    expect(rolesForChannel('professor:payment:update')).toEqual(['admin', 'professor', 'comptable'])
    expect(PROFESSOR_WRITE_EXACT).toContain('professor:payment:create')
    expect(PROFESSOR_WRITE_EXACT).toContain('professor:payment:update')
  })

  it('SEV1 : professor:payments:list / stats → ["admin","professor","comptable"] (lectures salaires RBAC, pas de ipcMain.handle nu)', () => {
    expect(rolesForChannel('professor:payments:list')).toEqual(['admin', 'professor', 'comptable'])
    expect(rolesForChannel('professor:payments:stats')).toEqual(['admin', 'professor', 'comptable'])
  })

  it('ne pas élargir professor:* globalement : professor:create reste admin+professor (sans comptable)', () => {
    expect(rolesForChannel('professor:create')).toEqual(['admin', 'professor'])
    expect(rolesForChannel('professor:create')).not.toContain('comptable')
    expect(rolesForChannel('professor:update')).toEqual(['admin', 'professor'])
  })

  it('events.ts enregistre les lectures salaires via protectedHandle (fail-closed, deny-by-default)', () => {
    const src = readFileSync(join(process.cwd(), 'electron', 'events.ts'), 'utf-8')
    expect(src).toContain('protectedHandle("professor:payments:list"')
    expect(src).toContain('protectedHandle("professor:payments:stats"')
    expect(src).not.toContain('ipcMain.handle("professor:payments:list"')
    expect(src).not.toContain('ipcMain.handle("professor:payments:stats"')
  })

  it("auth:validateSecurityAnswer est ouvert aux 4 rôles dont comptable", () => {
    const src = readFileSync(join(process.cwd(), 'electron', 'events.ts'), 'utf-8')
    expect(src).toContain('auth:validateSecurityAnswer')
    expect(src).toContain("'comptable'")
    expect(src).toMatch(/auth:validateSecurityAnswer[\s\S]{0,400}comptable/)
  })
})
