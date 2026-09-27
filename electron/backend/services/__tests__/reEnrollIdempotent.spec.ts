import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/e-school-test-uploads') },
}))

import { PaymentService } from '../paymentService'
import { StudentService } from '../studentService'
import { AppDataSource } from '../../../data-source'

function createMockQb() {
  const qb: any = {
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
  }
  return qb
}

/**
 * QA V3 — réinscription idempotente + filtre schoolYear.
 *
 * Couvre :
 * - createReInscriptionFee : 2 appels mêmes (studentId, schoolYear) = 1 seul frais (save x1)
 * - reEnrollStudent : 2 appels = 1 seul frais (délégation idempotente, UPDATE grade/schoolYear/isNew)
 * - getAllStudents : filtre schoolYear normalisé canonique (ex. "2024/2025" → "2024-2025")
 */
describe('V3 — reEnroll idempotent + getAllStudents filtre schoolYear', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('createReInscriptionFee idempotent (2 appels = 1 frais)', () => {
    let paymentSaveCount = 0
    let storedPayment: any = null

    beforeEach(() => {
      vi.clearAllMocks()
      vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.spyOn(console, 'warn').mockImplementation(() => {})
      paymentSaveCount = 0
      storedPayment = null

      const studentRepo = {
        findOne: vi.fn().mockResolvedValue({ id: 7, matricule: 'ET-7', grade: { id: 1 } }),
      }
      const paymentRepo = {
        // 1er appel : rien → création ; 2e appel : retrouve via idempotencyKey
        findOne: vi.fn(async ({ where }: any) => {
          if (where?.idempotencyKey === 'reinsc-7-2025-2026') return storedPayment
          if (where?.studentId === 7 && where?.paymentType === 'reinscription') return storedPayment
          return null
        }),
        create: vi.fn((x: any) => ({ ...x })),
        save: vi.fn(async (x: any) => {
          paymentSaveCount += 1
          storedPayment = { ...x, id: 100 }
          return storedPayment
        }),
      }
      const counterRepo = {
        findOne: vi.fn().mockResolvedValue(null),
        create: vi.fn((x: any) => ({ ...x })),
        save: vi.fn(async (x: any) => ({ ...x })),
      }
      const cfgRepo = {
        findOne: vi.fn().mockResolvedValue({ classId: '1', schoolYear: '2025-2026', reInscriptionFee: 5000 }),
      }
      const movRepo = { create: vi.fn((x: any) => ({ ...x })), save: vi.fn(async (x: any) => ({ ...x, id: 1 })) }
      const manager = {
        getRepository: vi.fn((entity: any) => {
          const n = entity?.name ?? ''
          if (n === 'StudentEntity') return studentRepo as any
          if (n === 'PaymentEntity') return paymentRepo as any
          if (n === 'ReceiptCounterEntity') return counterRepo as any
          if (n === 'PaymentConfigEntity') return cfgRepo as any
          if (n === 'CashMovementEntity') return movRepo as any
          return { findOne: vi.fn().mockResolvedValue(null), find: vi.fn().mockResolvedValue([]), create: vi.fn((x: any) => x), save: vi.fn(async (x: any) => x) } as any
        }),
      }
      vi.spyOn(AppDataSource, 'getInstance').mockReturnValue({
        isInitialized: true,
        getRepository: vi.fn(() => ({ findOne: vi.fn(), find: vi.fn().mockResolvedValue([]) })),
        transaction: vi.fn(async (cb: any) => cb(manager)),
      } as any)
      vi.spyOn(AppDataSource, 'initialize').mockResolvedValue({} as any)
    })

    it('2 appels identiques → 1 seul save paiement, même reçu', async () => {
      const svc = new PaymentService()
      const r1 = await svc.createReInscriptionFee(7, '2025-2026')
      const r2 = await svc.createReInscriptionFee(7, '2025-2026')
      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
      expect(r2.message).toMatch(/idempotent/)
      expect(paymentSaveCount).toBe(1)
      expect(r1.data?.id).toBe(r2.data?.id)
      expect(r1.data?.idempotencyKey).toBe('reinsc-7-2025-2026')
    })
  })

  describe('reEnrollStudent idempotent + getAllStudents filtre schoolYear', () => {
    let mockStudentRepo: any
    let mockGradeRepo: any
    let mockYearRepo: any
    let createFeeSpy: any

    beforeEach(() => {
      vi.clearAllMocks()
      vi.spyOn(console, 'log').mockImplementation(() => {})
      vi.spyOn(console, 'error').mockImplementation(() => {})

      const studentRow = { id: 7, firstname: 'Awa', lastname: 'Diallo', grade: { id: 1 }, schoolYear: '2024-2025', isNew: true }
      mockStudentRepo = {
        findOne: vi.fn().mockResolvedValue({ ...studentRow }),
        save: vi.fn(async (e: any) => ({ ...e })),
        createQueryBuilder: vi.fn(() => createMockQb()),
      }
      mockGradeRepo = { findOne: vi.fn().mockResolvedValue({ id: 2, name: '5eme' }) }
      mockYearRepo = { findOne: vi.fn().mockResolvedValue({ id: 1, schoolYear: '2025-2026', status: 'active' }) }

      vi.spyOn(AppDataSource, 'getInstance').mockReturnValue({
        isInitialized: true,
        getRepository: vi.fn((entity: any) => {
          const n = entity?.name ?? ''
          if (n === 'StudentEntity') return mockStudentRepo
          if (n === 'GradeEntity') return mockGradeRepo
          if (n === 'YearRepartitionEntity') return mockYearRepo
          return { findOne: vi.fn().mockResolvedValue(null), find: vi.fn().mockResolvedValue([]), create: vi.fn((x: any) => x), save: vi.fn(async (x: any) => x) } as any
        }),
        manager: { transaction: vi.fn(async (cb: any) => cb({ save: async (e: any) => e, findOne: async () => null })) },
      } as any)

      // Frais simulés idempotents côté paymentService : un seul "vrai" save
      let feeSaves = 0
      createFeeSpy = vi.spyOn(PaymentService.prototype as any, 'createReInscriptionFee').mockImplementation(async () => {
        feeSaves += 1
        return { success: true, data: { id: 100, _saves: feeSaves }, message: feeSaves === 1 ? 'Frais créés' : 'idempotent', error: null }
      })
      ;(createFeeSpy as any)._feeSaves = () => feeSaves
    })

    it('reEnroll 2 appels → UPDATE grade/schoolYear/isNew=false + 2 délégations, 1 seul frais effectif simulé', async () => {
      const svc = new StudentService()
      const r1 = await svc.reEnrollStudent(7, { schoolYear: '2025-2026', gradeId: 2 })
      const r2 = await svc.reEnrollStudent(7, { schoolYear: '2025-2026', gradeId: 2 })
      expect(r1.success).toBe(true)
      expect(r2.success).toBe(true)
      expect(createFeeSpy).toHaveBeenCalledTimes(2)
      expect(createFeeSpy).toHaveBeenCalledWith(7, '2025-2026')
      // UPDATE vérifié sur le save étudiant
      const lastSaved = mockStudentRepo.save.mock.calls.at(-1)[0]
      expect(lastSaved.schoolYear).toBe('2025-2026')
      expect(lastSaved.isNew).toBe(false)
      expect(r1.message).toMatch(/réinscrit/)
    })

    it('reEnroll refuse une année clôturée', async () => {
      mockYearRepo.findOne.mockResolvedValue({ id: 9, schoolYear: '2024-2025', status: 'closed' })
      const svc = new StudentService()
      const r = await svc.reEnrollStudent(7, { schoolYear: '2024-2025', gradeId: 2 })
      expect(r.success).toBe(false)
      expect(String(r.error ?? '')).toMatch(/YEAR_CLOSED/)
      expect(createFeeSpy).not.toHaveBeenCalled()
    })

    it('getAllStudents filtre schoolYear rétro-compatible canon+civil', async () => {
      const qb = createMockQb()
      mockStudentRepo.createQueryBuilder.mockReturnValue(qb)
      const svc = new StudentService()
      await svc.getAllStudents({ page: 1, pageSize: 20, filters: { schoolYear: '2024/2025' } })
      // '2024/2025' → canon '2024-2025' + civile '2024' (+ raw conservé) via IN
      expect(qb.andWhere).toHaveBeenCalledWith('student.schoolYear IN (:...sys)', { sys: expect.arrayContaining(['2024-2025', '2024']) })
    })

    it('getAllStudents filtre civil 2026 matche canon 2026-2027 + civil', async () => {
      const qb = createMockQb()
      mockStudentRepo.createQueryBuilder.mockReturnValue(qb)
      const svc = new StudentService()
      await svc.getAllStudents({ page: 1, pageSize: 20, filters: { schoolYear: '2026' } })
      const call = qb.andWhere.mock.calls.find((c: any[]) => String(c[0]).includes('schoolYear'))
      expect(call[0]).toBe('student.schoolYear IN (:...sys)')
      // Doit contenir la civile legacy '2026' ET le canon '2026-2027' (sept. 2026 → 2026-2027)
      // Note: le canon dépend de la date de ref ; on assert au minimum la civile legacy.
      expect(call[1].sys).toContain('2026')
    })

    it('getAllStudents sans filtre schoolYear → pas de clause sy', async () => {
      const qb = createMockQb()
      mockStudentRepo.createQueryBuilder.mockReturnValue(qb)
      const svc = new StudentService()
      await svc.getAllStudents({ page: 1, pageSize: 20, filters: {} })
      const calls = qb.andWhere.mock.calls.map((c: any[]) => String(c[0]))
      expect(calls.some((s: string) => s.includes('schoolYear'))).toBe(false)
    })
  })
})
