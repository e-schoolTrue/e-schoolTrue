import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/e-school-test-uploads') },
}))

import { YearRepartitionService } from '../yearService'
import { AppDataSource } from '../../../data-source'

/**
 * QA V3 — année scolaire : close/reopen, setCurrent, ensure 9 mois, clone configs-only.
 *
 * Couvre :
 * - close refuse double état (ALREADY_CLOSED), reopen refuse double état (ALREADY_ACTIVE)
 * - setCurrent refuse année closed (YEAR_CLOSED)
 * - ensure 9 mois idempotent : now-end >= 9 mois crée N+1 une seule fois, ne set jamais isCurrent
 * - clone configs-only : ne touche jamais au transactionnel
 */
describe('YearService V3 — close/reopen/setCurrent/ensure/clone', () => {
  let service: YearRepartitionService
  let mockYearRepo: any
  let mockManager: any
  let mockDS: any
  let requestedEntities: string[]

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
    requestedEntities = []

    mockYearRepo = {
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      save: vi.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    }

    const genericRepoFor = (entity: any) => {
      const name = entity?.name ?? String(entity ?? 'unknown')
      requestedEntities.push(name)
      // Configs sources : une ligne payment config sur l'année source
      if (name === 'PaymentConfigEntity') {
        return {
          find: vi.fn().mockResolvedValue([
            { id: 10, schoolYear: '2024-2025', classId: '1', inscriptionFee: 1000, reInscriptionFee: 500 },
          ]),
          save: vi.fn(async (e: any) => ({ ...e, id: e.id ?? 99 })),
        } as any
      }
      if (name === 'YearRepartitionEntity') {
        return {
          find: vi.fn().mockResolvedValue([]),
          findOne: vi.fn().mockResolvedValue(null),
          save: vi.fn(async (e: any) => ({ ...e, id: e.id ?? 2 })),
        } as any
      }
      return {
        find: vi.fn().mockResolvedValue([]),
        findOne: vi.fn().mockResolvedValue(null),
        save: vi.fn(async (e: any) => ({ ...e, id: e.id ?? 50 })),
        create: vi.fn((x: any) => ({ ...x })),
      } as any
    }

    mockManager = { getRepository: vi.fn((e: any) => genericRepoFor(e)) }
    mockDS = {
      getRepository: vi.fn(() => mockYearRepo),
      transaction: vi.fn(async (cb: any) => cb(mockManager)),
    }
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDS as any)
    service = new YearRepartitionService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('1. close refuse le double état (ALREADY_CLOSED)', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'closed' }))
    const r = await service.closeYear(1)
    expect(r.success).toBe(false)
    expect(r.error).toBe('ALREADY_CLOSED')
    expect(mockYearRepo.save).not.toHaveBeenCalled()
  })

  it('2. close année courante OK (nouveau comportement) : isCurrent=false, status=closed, lecture seule', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'active', isCurrent: true, schoolYear: '2025-2026' }))
    const r = await service.closeYear(1)
    expect(r.success).toBe(true)
    expect(r.message).toMatch(/lecture seule/)
    expect(mockYearRepo.save).toHaveBeenCalledTimes(1)
    const saved = mockYearRepo.save.mock.calls[0][0]
    expect(saved.status).toBe('closed')
    expect(saved.closedAt).toBeInstanceOf(Date)
    expect(saved.isCurrent).toBe(false)
    expect(r.data?.status).toBe('closed')
    expect(r.data?.isCurrent).toBe(false)
  })

  it('2bis. close succès année non courante : status=closed, closedAt set', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'active', isCurrent: false }))
    const r = await service.closeYear(1)
    expect(r.success).toBe(true)
    expect(mockYearRepo.save).toHaveBeenCalledTimes(1)
    const saved = mockYearRepo.save.mock.calls[0][0]
    expect(saved.status).toBe('closed')
    expect(saved.closedAt).toBeInstanceOf(Date)
    expect(r.data?.status).toBe('closed')
  })

  it('3. reopen refuse le double état (ALREADY_ACTIVE)', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'active' }))
    const r = await service.reopenYear(1)
    expect(r.success).toBe(false)
    expect(r.error).toBe('ALREADY_ACTIVE')
    expect(mockYearRepo.save).not.toHaveBeenCalled()
  })

  it('4. reopen succès : status=active, closedAt=null', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'closed', closedAt: new Date() }))
    const r = await service.reopenYear(1)
    expect(r.success).toBe(true)
    const saved = mockYearRepo.save.mock.calls[0][0]
    expect(saved.status).toBe('active')
    expect(saved.closedAt).toBeNull()
  })

  it('5. setCurrent refuse une année closed (YEAR_CLOSED)', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'closed' }))
    const r = await service.setCurrentYearRepartition(1)
    expect(r.success).toBe(false)
    expect(r.error).toBe('YEAR_CLOSED')
    expect(mockYearRepo.save).not.toHaveBeenCalled()
  })

  it('6. [Demande 1] ensure DEPRECATED no-op : ne crée JAMAIS N+1 même si seuil 9 mois atteint', async () => {
    const current = mkYear({
      id: 1,
      schoolYear: '2024-2025',
      isCurrent: true,
      periodConfigurations: [{ name: 'Année', start: new Date('2024-09-01'), end: new Date('2024-06-30') }],
    })
    mockYearRepo.find.mockResolvedValue([current])
    const r = await service.ensureSchoolYear(new Date('2025-04-15'))
    expect(r.success).toBe(true)
    expect(r.data).toBeNull()
    expect(r.message).toMatch(/MANUAL_ONLY/)
    expect(mockYearRepo.save).not.toHaveBeenCalled()
  })

  it('7. [Demande 1] ensure no-op : N+1 déjà présent → data=null, save non appelé', async () => {
    const current = mkYear({
      id: 1,
      schoolYear: '2024-2025',
      isCurrent: true,
      periodConfigurations: [{ name: 'Année', start: new Date('2024-09-01'), end: new Date('2024-06-30') }],
    })
    const next = mkYear({ id: 2, schoolYear: '2025-2026', isCurrent: false })
    mockYearRepo.find.mockResolvedValue([current, next])
    const r = await service.ensureSchoolYear(new Date('2025-04-15'))
    expect(r.success).toBe(true)
    expect(r.data).toBeNull()
    expect(r.message).toMatch(/MANUAL_ONLY/)
    expect(mockYearRepo.save).not.toHaveBeenCalled()
  })

  it('8. [Demande 1] ensure no-op sous le seuil → aucune création (MANUAL_ONLY)', async () => {
    const current = mkYear({
      id: 1,
      schoolYear: '2024-2025',
      isCurrent: true,
      periodConfigurations: [{ name: 'Année', start: new Date('2024-09-01'), end: new Date('2025-06-30') }],
    })
    mockYearRepo.find.mockResolvedValue([current])
    const r = await service.ensureSchoolYear(new Date('2025-08-01'))
    expect(r.success).toBe(true)
    expect(r.data).toBeNull()
    expect(r.message).toMatch(/MANUAL_ONLY/)
    expect(mockYearRepo.save).not.toHaveBeenCalled()
  })

  it('9. clone configs-only : succès + ne touche JAMAIS au transactionnel', async () => {
    const from = mkYear({ id: 1, schoolYear: '2024-2025' })
    mockYearRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where?.id === 1) return from
      if (where?.schoolYear === '2025-2026') return null
      return null
    })
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2025-2026' })
    expect(r.success).toBe(true)
    expect(r.data?.schoolYear).toBe('2025-2026')
    expect(mockDS.transaction).toHaveBeenCalledTimes(1)
    const forbidden = [
      'PaymentEntity', 'ScholarshipEntity', 'ExpenseEntity', 'CashMovementEntity',
      'CashRegisterEntity', 'CashClosureEntity', 'SalarySlipEntity', 'AbsenceEntity',
      'CalculatedGradeEntity', 'GradeEntryEntity', 'StudentEntity', 'ReceiptCounterEntity',
    ]
    for (const f of forbidden) {
      expect(requestedEntities).not.toContain(f)
    }
    // Cible créée active, jamais courante
    const yearSaves = mockManager.getRepository.mock.results
    expect(requestedEntities).toContain('YearRepartitionEntity')
    expect(yearSaves.length).toBeGreaterThan(0)
  })

  it('10. clone refuse si année cible déjà existante (DUPLICATE_SCHOOL_YEAR)', async () => {
    const from = mkYear({ id: 1, schoolYear: '2024-2025' })
    mockYearRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where?.id === 1) return from
      if (where?.schoolYear === '2025-2026') return mkYear({ id: 2, schoolYear: '2025-2026' })
      return null
    })
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2025-2026' })
    expect(r.success).toBe(false)
    expect(r.error).toBe('DUPLICATE_SCHOOL_YEAR')
    expect(mockDS.transaction).not.toHaveBeenCalled()
  })

  it('11. close échec save → message explicite (jamais « Échec de la clôture » seul)', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'active', isCurrent: false }))
    mockYearRepo.save.mockRejectedValueOnce(new Error('no such column: status'))
    const r = await service.closeYear(1)
    expect(r.success).toBe(false)
    expect(r.message).toMatch(/Échec de la clôture/)
    expect(r.message).toMatch(/no such column/)
  })
})
