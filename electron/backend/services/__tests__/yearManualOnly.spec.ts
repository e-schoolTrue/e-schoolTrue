import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/e-school-test-uploads') },
}))

import { YearRepartitionService } from '../yearService'
import { AppDataSource } from '../../../data-source'

/**
 * Demande 1 — année scolaire uniquement manuelle.
 * - Boot DB vide : AUCUNE création (ensure no-op, save jamais appelé).
 * - Login : AUCUNE création (ensure no-op même avec année existante).
 * - Création manuelle OK (createYearRepartition + setCurrent via IPC existants).
 */
describe('Demande 1 — année manuelle uniquement (pas d\'auto-création)', () => {
  let service: YearRepartitionService
  let mockYearRepo: any
  let mockDS: any

  const mkYear = (over: any = {}) => ({
    id: 1,
    schoolYear: '2024-2025',
    periodConfigurations: [
      { name: 'T1', start: new Date('2024-09-01'), end: new Date('2025-06-30') },
    ],
    isCurrent: false,
    status: 'active',
    closedAt: null,
    ...over,
  })

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    mockYearRepo = {
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      save: vi.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    }
    mockDS = { isInitialized: true, getRepository: vi.fn(() => mockYearRepo) }
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDS as any)
    service = new YearRepartitionService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('1. boot DB vide → pas de création (ensure no-op, getCurrent null)', async () => {
    // Boot : DB vide.
    mockYearRepo.find.mockResolvedValue([])
    const ensured = await service.ensureSchoolYear(new Date())
    expect(ensured.success).toBe(true)
    expect(ensured.data).toBeNull()
    expect(ensured.message).toMatch(/MANUAL_ONLY/)
    expect(mockYearRepo.save).not.toHaveBeenCalled()

    // getCurrent sur DB vide → data null → guard router redirect /school-repartition + banner.
    const cur = await service.getCurrentYearRepartition(new Date())
    expect(cur.success).toBe(true)
    expect(cur.data).toBeNull()
    expect(mockYearRepo.save).not.toHaveBeenCalled()
  })

  it('2. login → pas de création (ensure no-op même avec année existante, seuil 9 mois dépassé)', async () => {
    const current = mkYear({
      id: 1,
      schoolYear: '2024-2025',
      isCurrent: true,
      periodConfigurations: [{ name: 'Année', start: new Date('2024-09-01'), end: new Date('2024-06-30') }],
    })
    mockYearRepo.find.mockResolvedValue([current])
    // Login appelait ensureSchoolYear(new Date()) — désormais supprimé de events.ts,
    // et même si appelé (compat), c'est un no-op.
    const r = await service.ensureSchoolYear(new Date('2025-04-15'))
    expect(r.success).toBe(true)
    expect(r.data).toBeNull()
    expect(r.message).toMatch(/MANUAL_ONLY/)
    expect(mockYearRepo.save).not.toHaveBeenCalled()
  })

  it('4. clôture courante sans N+1 OK → getCurrent null + writeLocked (hasOpenYear false, écritures refusées)', async () => {
    const { hasOpenYear, requireYearWritable } = await import('../../lib/yearGuard')
    // closeYear sur courante : isCurrent=false, status=closed, message lecture seule.
    const current = mkYear({ id: 1, schoolYear: '2024-2025', isCurrent: true, status: 'active' })
    mockYearRepo.findOne.mockResolvedValue(current)
    mockYearRepo.save.mockImplementation(async (e: any) => ({ ...e }))
    const closed = await service.closeYear(1)
    expect(closed.success).toBe(true)
    expect(closed.message).toMatch(/lecture seule/)
    const saved = mockYearRepo.save.mock.calls[0][0]
    expect(saved.isCurrent).toBe(false)
    expect(saved.status).toBe('closed')

    // Après clôture : plus d'année ouverte → getCurrent null + garde refuse.
    mockYearRepo.find.mockResolvedValue([{ ...current, isCurrent: false, status: 'closed' }])
    mockYearRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where?.isCurrent === true) return null
      if (where?.schoolYear) return { ...current, isCurrent: false, status: 'closed' }
      return { ...current, isCurrent: false, status: 'closed' }
    })
    const cur = await service.getCurrentYearRepartition(new Date())
    expect(cur.success).toBe(true)
    expect(cur.data).toBeNull()
    expect(await hasOpenYear()).toBe(false)
    await expect(requireYearWritable({ schoolYear: '2024-2025', actorRole: 'comptable' })).rejects.toThrow(/YEAR_CLOSED/)
  })

  it('3. création manuelle OK (createYearRepartition + setCurrent)', async () => {
    mockYearRepo.findOne.mockResolvedValue(null) // pas de doublon
    mockYearRepo.save.mockImplementation(async (e: any) => ({ ...e, id: 7 }))
    const created = await service.createYearRepartition({
      schoolYear: '2025-2026',
      periodConfigurations: [
        { name: 'T1', start: new Date('2025-09-01'), end: new Date('2026-06-30') },
      ],
    } as any)
    expect(created.success).toBe(true)
    expect(created.data?.schoolYear).toBe('2025-2026')
    expect(mockYearRepo.save).toHaveBeenCalledTimes(1)

    // setCurrent manuel (IPC yearRepartition:setCurrent conservé).
    const target = mkYear({ id: 7, schoolYear: '2025-2026', isCurrent: false })
    mockYearRepo.findOne.mockResolvedValue(target)
    mockYearRepo.createQueryBuilder.mockReturnValue({
      update: () => ({ set: () => ({ execute: vi.fn().mockResolvedValue(undefined) }) }),
    })
    const sw = await service.setCurrentYearRepartition(7)
    expect(sw.success).toBe(true)
    expect(sw.data?.id).toBe(7)
  })
})
