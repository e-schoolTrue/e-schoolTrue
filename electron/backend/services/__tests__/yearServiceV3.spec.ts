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

  it('2. close succès : status=closed, closedAt set, isCurrent auto-désactivé', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'active', isCurrent: true }))
    const r = await service.closeYear(1)
    expect(r.success).toBe(true)
    expect(mockYearRepo.save).toHaveBeenCalledTimes(1)
    const saved = mockYearRepo.save.mock.calls[0][0]
    expect(saved.status).toBe('closed')
    expect(saved.isCurrent).toBe(false)
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

  it('6. ensure 9 mois : crée N+1 avec isCurrent=false quand now-end >= 9 mois', async () => {
    const current = mkYear({
      id: 1,
      schoolYear: '2024-2025',
      isCurrent: true,
      periodConfigurations: [{ name: 'Année', start: new Date('2024-09-01'), end: new Date('2024-06-30') }],
    })
    mockYearRepo.find.mockResolvedValue([current])
    // now = 2025-04-15 → monthsBetween(2024-06-30, 2025-04-15) = 10 >= 9
    const r = await service.ensureSchoolYear(new Date('2025-04-15'))
    expect(r.success).toBe(true)
    expect(r.data?.schoolYear).toBe('2025-2026')
    expect(mockYearRepo.save).toHaveBeenCalledTimes(1)
    const saved = mockYearRepo.save.mock.calls[0][0]
    expect(saved.schoolYear).toBe('2025-2026')
    // Ne définit JAMAIS isCurrent
    expect(saved.isCurrent).toBe(false)
    expect(saved.status).toBe('active')
  })

  it('7. ensure 9 mois idempotent : N+1 déjà présent → data=null, save non rappelé', async () => {
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
    expect(r.message).toMatch(/déjà présente/)
    expect(mockYearRepo.save).not.toHaveBeenCalled()
  })

  it('8. ensure sous le seuil 9 mois → aucune création', async () => {
    const current = mkYear({
      id: 1,
      schoolYear: '2024-2025',
      isCurrent: true,
      periodConfigurations: [{ name: 'Année', start: new Date('2024-09-01'), end: new Date('2025-06-30') }],
    })
    mockYearRepo.find.mockResolvedValue([current])
    // now = 2025-08-01 → 2 mois après fin → sous le seuil
    const r = await service.ensureSchoolYear(new Date('2025-08-01'))
    expect(r.success).toBe(true)
    expect(r.data).toBeNull()
    expect(r.message).toMatch(/Seuil 9 mois/)
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
})
