import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Capture ipcMain.handle registrations so we can invoke wrapped handlers directly.
const handlerRegistry = vi.hoisted(() => new Map<string, (...args: any[]) => any>())

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      handlerRegistry.set(channel, handler)
    }),
  },
}))

import { protectedHandle } from '../security'

describe('protectedHandle', () => {
  let authServiceMock: any
  let auditLogServiceMock: any

  const adminActor = { id: 5, username: 'admin1', role: 'admin', displayName: 'Admin Principal' }

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

  it('1. denies the call with no authenticated actor (auth required) — fail-closed UNAUTHENTICATED', async () => {
    authServiceMock.getCurrentUser.mockResolvedValue(null)
    const handler = vi.fn().mockResolvedValue({ success: true })

    protectedHandle('test:permitted-noactor', {
      roles: ['admin'],
      audit: {
        action: 'update',
        entity: 'User',
        summarize: (args, result) => ({ targetId: null, summary: 'Mise à jour' }),
      },
    }, handler)
    const wrapped = handlerRegistry.get('test:permitted-noactor')!

    await expect(wrapped(null, { data: 1 })).rejects.toThrow('UNAUTHENTICATED')

    expect(handler).not.toHaveBeenCalled()
    expect(auditLogServiceMock.record).not.toHaveBeenCalled()
  })

  it('2. denies the call when the actor role is not in opts.roles — fail-closed FORBIDDEN', async () => {
    authServiceMock.getCurrentUser.mockResolvedValue({
      id: 2,
      username: 'prof1',
      role: 'professor',
      displayName: null,
    })
    const handler = vi.fn().mockResolvedValue({ success: true })

    protectedHandle('test:permitted-role', {
      roles: ['admin'],
      audit: {
        action: 'update',
        entity: 'User',
        summarize: (args, result) => ({ targetId: null, summary: 'Mise à jour' }),
      },
    }, handler)
    const wrapped = handlerRegistry.get('test:permitted-role')!

    await expect(wrapped(null, {})).rejects.toThrow(/FORBIDDEN/)

    expect(handler).not.toHaveBeenCalled()
    expect(auditLogServiceMock.record).not.toHaveBeenCalled()
  })

  it('3. records audit on success with the actor snapshot', async () => {
    authServiceMock.getCurrentUser.mockResolvedValue(adminActor)
    const handler = vi.fn().mockResolvedValue({ success: true, data: { id: 10 } })

    protectedHandle('test:audit', {
      roles: ['admin'],
      audit: {
        action: 'update',
        entity: 'User',
        summarize: (args, result) => ({
          targetId: result?.data?.id ?? null,
          summary: `Mise à jour de ${args[0]?.username ?? 'utilisateur'}`,
        }),
      },
    }, handler)
    const wrapped = handlerRegistry.get('test:audit')!

    const result = await wrapped(null, { username: 'admin1' })

    expect(result).toEqual({ success: true, data: { id: 10 } })
    expect(auditLogServiceMock.record).toHaveBeenCalledTimes(1)
    expect(auditLogServiceMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        targetEntity: 'User',
        targetId: 10,
        summary: 'Mise à jour de admin1',
        actor: { id: 5, username: 'admin1', role: 'admin', displayName: 'Admin Principal' },
      })
    )
  })

  it('4. records a failure audit {status: error} then rethrows the original error', async () => {
    authServiceMock.getCurrentUser.mockResolvedValue(adminActor)
    const handler = vi.fn().mockRejectedValue(new Error('Database exploded'))

    protectedHandle('test:fail', {
      roles: ['admin'],
      audit: {
        action: 'update',
        entity: 'User',
        summarize: () => ({ targetId: null, summary: 'Mise à jour' }),
      },
    }, handler)
    const wrapped = handlerRegistry.get('test:fail')!

    await expect(wrapped(null, {})).rejects.toThrow('Database exploded')

    expect(auditLogServiceMock.record).toHaveBeenCalledTimes(1)
    expect(auditLogServiceMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        targetEntity: 'User',
        summary: 'Échec : Database exploded',
        metadata: { status: 'error' },
        actor: { id: 5, username: 'admin1', role: 'admin', displayName: 'Admin Principal' },
      })
    )
  })

  it('5. records an envelope-failure audit {status:error} summary "Échec : X" and returns the result unchanged', async () => {
    authServiceMock.getCurrentUser.mockResolvedValue(adminActor)
    const handler = vi.fn().mockResolvedValue({ success: false, error: 'INVALID_DATA', message: 'Données invalides' })

    protectedHandle('test:envelope', {
      roles: ['admin'],
      audit: {
        action: 'update',
        entity: 'User',
        summarize: (args, result) => ({ targetId: null, summary: 'Mise à jour' }),
      },
    }, handler)
    const wrapped = handlerRegistry.get('test:envelope')!

    const result = await wrapped(null, {})

    expect(result).toEqual({ success: false, error: 'INVALID_DATA', message: 'Données invalides' })
    expect(auditLogServiceMock.record).toHaveBeenCalledTimes(1)
    expect(auditLogServiceMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'update',
        targetEntity: 'User',
        summary: 'Échec : INVALID_DATA',
        metadata: { status: 'error' },
        actor: { id: 5, username: 'admin1', role: 'admin', displayName: 'Admin Principal' },
      })
    )
  })

  it('6. auth optional allows a null actor and records it as actor null', async () => {
    authServiceMock.getCurrentUser.mockResolvedValue(null)
    const handler = vi.fn().mockResolvedValue('ok')

    protectedHandle('test:optional', {
      roles: ['admin'],
      auth: 'optional',
      audit: {
        action: 'system',
        entity: 'User',
        summarize: () => ({ targetId: null, summary: 'Validation' }),
      },
    }, handler)
    const wrapped = handlerRegistry.get('test:optional')!

    const result = await wrapped(null, { username: 'u1' })

    expect(result).toBe('ok')
    expect(handler).toHaveBeenCalledTimes(1)
    expect(auditLogServiceMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'system',
        targetEntity: 'User',
        summary: 'Validation',
        actor: null,
      })
    )
  })

  it('7. before hook result is passed to summarize via ctx.before (no shared-state corruption)', async () => {
    authServiceMock.getCurrentUser.mockResolvedValue(adminActor)
    const beforeMock = vi.fn().mockResolvedValue({ id: 42, username: 'target' })
    const handler = vi.fn().mockResolvedValue({ success: true, data: { id: 42, username: 'TARGET' } })

    protectedHandle('test:beforectx', {
      roles: ['admin'],
      audit: {
        action: 'update',
        entity: 'User',
        before: beforeMock,
        summarize: (args, result, ctx) => ({
          targetId: (ctx.before as any)?.id ?? null,
          summary: `Mise à jour de ${(ctx.before as any)?.username ?? 'utilisateur'}`,
          diff: { before: ctx.before, after: result?.data },
        }),
      },
    }, handler)
    const wrapped = handlerRegistry.get('test:beforectx')!

    const result = await wrapped(null, { id: 42 })

    expect(result).toEqual({ success: true, data: { id: 42, username: 'TARGET' } })
    expect(beforeMock).toHaveBeenCalledWith([{ id: 42 }])
    expect(handler).toHaveBeenCalledTimes(1)
    expect(auditLogServiceMock.record).toHaveBeenCalledTimes(1)
    expect(auditLogServiceMock.record).toHaveBeenCalledWith(
      expect.objectContaining({
        targetId: 42,
        summary: 'Mise à jour de target',
        diff: { before: { id: 42, username: 'target' }, after: { id: 42, username: 'TARGET' } },
      })
    )
  })

  it('8. omits audit entirely when no audit option is provided', async () => {
    authServiceMock.getCurrentUser.mockResolvedValue(adminActor)
    const handler = vi.fn().mockResolvedValue({ success: true })

    protectedHandle('test:noaudit', { roles: ['admin'] }, handler)
    const wrapped = handlerRegistry.get('test:noaudit')!

    const result = await wrapped(null, {})

    expect(result).toEqual({ success: true })
    expect(auditLogServiceMock.record).not.toHaveBeenCalled()
  })

  it('9. record failure does not mask a success result (audit errors are swallowed)', async () => {
    authServiceMock.getCurrentUser.mockResolvedValue(adminActor)
    auditLogServiceMock.record.mockRejectedValue(new Error('audit db down'))
    const handler = vi.fn().mockResolvedValue('done')

    protectedHandle('test:auditerror', {
      roles: ['admin'],
      audit: {
        action: 'create',
        entity: 'Student',
        summarize: () => ({ targetId: 1, summary: 'Création' }),
      },
    }, handler)
    const wrapped = handlerRegistry.get('test:auditerror')!

    await expect(wrapped(null, {})).resolves.toBe('done')
  })
})