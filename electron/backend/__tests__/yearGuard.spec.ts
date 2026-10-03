import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const handlerRegistry = vi.hoisted(() => new Map<string, (...args: any[]) => any>())

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      handlerRegistry.set(channel, handler)
    }),
  },
}))

import { protectedHandle } from '../security'
import { requireYearWritable, extractYearFromPayload } from '../lib/yearGuard'
import { AppDataSource } from '../../data-source'

/**
 * QA V3 — garde YEAR_CLOSED.
 *
 * Couvre :
 * - YEAR_CLOSED bloque payment:create / expense:create / cash:append sans force
 * - admin + force passe (forced=true, audit best-effort)
 * - non-admin + force refusé, admin sans force refusé
 * - année active / absente = écriture autorisée
 * - close/reopen audités status_change (inspection events.ts)
 */
describe('yearGuard — YEAR_CLOSED', () => {
  let mockYearRepo: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    handlerRegistry.clear()

    mockYearRepo = { findOne: vi.fn().mockResolvedValue(null) }
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue({
      isInitialized: true,
      getRepository: vi.fn(() => mockYearRepo),
    } as any)

    const auditMock = { record: vi.fn().mockResolvedValue(undefined) }
    const authMock = { getCurrentUser: vi.fn().mockResolvedValue({ id: 1, username: 'admin1', role: 'admin', displayName: null }) }
    ;(global as any).auditLogService = auditMock
    ;(global as any).authService = authMock
  })

  afterEach(() => {
    delete (global as any).auditLogService
    delete (global as any).authService
    vi.restoreAllMocks()
  })

  it('1. année active → écriture autorisée (forced=false)', async () => {
    mockYearRepo.findOne.mockResolvedValue({ id: 1, schoolYear: '2024-2025', status: 'active' })
    const r = await requireYearWritable({ schoolYear: '2024-2025' })
    expect(r).toEqual({ schoolYear: '2024-2025', forced: false })
  })

  it('2. année absente (non gérée) + année ouverte → écriture autorisée', async () => {
    mockYearRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where?.isCurrent === true) return { id: 1, schoolYear: '2024-2025', status: 'active', isCurrent: true }
      return null
    })
    const r = await requireYearWritable({ schoolYear: '2030-2031' })
    expect(r.forced).toBe(false)
    expect(r.schoolYear).toBe('2030-2031')
  })

  it('2bis. verrou global : aucune année ouverte → écriture refusée même année active/absente', async () => {
    mockYearRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where?.isCurrent === true) return null
      if (where?.schoolYear) return { id: 2, schoolYear: where.schoolYear, status: 'active' }
      return null
    })
    await expect(requireYearWritable({ schoolYear: '2025-2026', actorRole: 'comptable' })).rejects.toThrow(/YEAR_CLOSED/)
    await expect(requireYearWritable({ schoolYear: '2030-2031', actorRole: 'admin' })).rejects.toThrow(/YEAR_CLOSED/)
  })

  it('3. YEAR_CLOSED bloque sans force (comptable, sans _forceYearWrite)', async () => {
    mockYearRepo.findOne.mockResolvedValue({ id: 7, schoolYear: '2024-2025', status: 'closed' })
    await expect(requireYearWritable({ schoolYear: '2024-2025', actorRole: 'comptable' })).rejects.toThrow(/YEAR_CLOSED/)
  })

  it('4. admin sans force → refusé', async () => {
    mockYearRepo.findOne.mockResolvedValue({ id: 7, schoolYear: '2024-2025', status: 'closed' })
    await expect(requireYearWritable({ schoolYear: '2024-2025', actorRole: 'admin' })).rejects.toThrow(/YEAR_CLOSED/)
  })

  it('5. non-admin + force → refusé (force ignorée hors admin)', async () => {
    mockYearRepo.findOne.mockResolvedValue({ id: 7, schoolYear: '2024-2025', status: 'closed' })
    await expect(
      requireYearWritable({ schoolYear: '2024-2025', actorRole: 'comptable', force: true }),
    ).rejects.toThrow(/YEAR_CLOSED/)
  })

  it('6. admin + force → passe (forced=true) + audit best-effort', async () => {
    mockYearRepo.findOne.mockResolvedValue({ id: 7, schoolYear: '2024-2025', status: 'closed' })
    const r = await requireYearWritable({ schoolYear: '2024-2025', actorRole: 'admin', force: true })
    expect(r).toEqual({ schoolYear: '2024-2025', forced: true })
    expect((global as any).auditLogService.record).toHaveBeenCalledWith(
      expect.objectContaining({ targetEntity: 'YearRepartition' }),
    )
  })

  it('7. extractYearFromPayload mappe schoolYear + _forceYearWrite', () => {
    expect(extractYearFromPayload({ schoolYear: '2024-2025', _forceYearWrite: true })).toEqual({
      schoolYear: '2024-2025',
      force: true,
    })
    expect(extractYearFromPayload({ school_year: '2025-2026' }).schoolYear).toBe('2025-2026')
    expect(extractYearFromPayload(null)).toEqual({})
  })

  it('8. protectedHandle bloque payment:create sur année closed sans force (handler non appelé)', async () => {
    mockYearRepo.findOne.mockResolvedValue({ id: 7, schoolYear: '2024-2025', status: 'closed' })
    ;(global as any).authService.getCurrentUser.mockResolvedValue({ id: 3, username: 'compta1', role: 'comptable', displayName: null })
    const handler = vi.fn().mockResolvedValue({ success: true })
    protectedHandle('payment:create', { roles: ['admin', 'comptable'], requireYearWrite: true }, handler)
    const wrapped = handlerRegistry.get('payment:create')!
    await expect(wrapped(null, { amount: 1000, schoolYear: '2024-2025' })).rejects.toThrow(/YEAR_CLOSED/)
    expect(handler).not.toHaveBeenCalled()
  })

  it('9. protectedHandle bloque expense:create + cash:append sur année closed sans force', async () => {
    mockYearRepo.findOne.mockResolvedValue({ id: 7, schoolYear: '2024-2025', status: 'closed' })
    ;(global as any).authService.getCurrentUser.mockResolvedValue({ id: 3, username: 'compta1', role: 'comptable', displayName: null })
    for (const ch of ['expense:create', 'cash:append']) {
      const handler = vi.fn().mockResolvedValue({ success: true })
      protectedHandle(ch, { roles: ['admin', 'comptable'], requireYearWrite: true }, handler)
      const wrapped = handlerRegistry.get(ch)!
      await expect(wrapped(null, { amount: 50, schoolYear: '2024-2025' })).rejects.toThrow(/YEAR_CLOSED/)
      expect(handler).not.toHaveBeenCalled()
    }
  })

  it('10. protectedHandle laisse passer admin + _forceYearWrite (forced, handler appelé)', async () => {
    mockYearRepo.findOne.mockResolvedValue({ id: 7, schoolYear: '2024-2025', status: 'closed' })
    ;(global as any).authService.getCurrentUser.mockResolvedValue({ id: 1, username: 'admin1', role: 'admin', displayName: null })
    const handler = vi.fn().mockResolvedValue({ success: true })
    protectedHandle('expense:create', { roles: ['admin', 'comptable'], requireYearWrite: true }, handler)
    const wrapped = handlerRegistry.get('expense:create')!
    await expect(wrapped(null, { amount: 50, schoolYear: '2024-2025', _forceYearWrite: true })).resolves.toEqual({ success: true })
    expect(handler).toHaveBeenCalledTimes(1)
  })

  it('11b. niveau demandé → retour inclut level (sinon clé absente, compat)', async () => {
    mockYearRepo.findOne.mockResolvedValue({ id: 1, schoolYear: '2024-2025', status: 'active', level: 'PRIMAIRE' })
    mockYearRepo.find = vi.fn().mockResolvedValue([{ id: 1, schoolYear: '2024-2025', status: 'active', level: 'PRIMAIRE', isCurrent: true }])
    const r = await requireYearWritable({ schoolYear: '2024-2025', level: 'PRIMAIRE' })
    expect(r).toEqual({ schoolYear: '2024-2025', forced: false, level: 'PRIMAIRE' })
  })

  it('11. close/reopen sont audités status_change (events.ts)', () => {
    const src = readFileSync(join(__dirname, '..', '..', 'events.ts'), 'utf8')
    const closeIdx = src.indexOf('"yearRepartition:close"')
    const reopenIdx = src.indexOf('"yearRepartition:reopen"')
    expect(closeIdx).toBeGreaterThan(-1)
    expect(reopenIdx).toBeGreaterThan(-1)
    expect(src.slice(closeIdx, closeIdx + 600)).toMatch(/status_change/)
    expect(src.slice(reopenIdx, reopenIdx + 600)).toMatch(/status_change/)
  })
})
