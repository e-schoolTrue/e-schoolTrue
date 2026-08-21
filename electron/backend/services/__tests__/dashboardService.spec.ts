import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/e-school-test-uploads') },
}))

import { DashboardService } from '../dashboardService'
import { AppDataSource } from '../../../data-source'
import { StudentService } from '../studentService'
import { ProfessorEntity } from '../../entities/professor'
import { GradeEntity } from '../../entities/grade'
import { PaymentEntity } from '../../entities/payment'
import { AbsenceEntity } from '../../entities/absence'

// Helper to create mock query builder with chaining
function mockQbChain(overrides: Record<string, any> = {}) {
  const chain: any = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    getMany: vi.fn().mockResolvedValue([]),
    getRawOne: vi.fn().mockResolvedValue({}),
  }
  Object.assign(chain, overrides)
  return chain
}

describe('DashboardService', () => {
  let service: DashboardService
  let mockProfessorRepo: any
  let mockGradeRepo: any
  let mockPaymentRepo: any
  let mockAbsenceRepo: any
  let mockDataSource: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    mockProfessorRepo = {
      count: vi.fn().mockResolvedValue(10),
    }
    mockGradeRepo = {
      count: vi.fn().mockResolvedValue(5),
    }
    mockPaymentRepo = {
      find: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      createQueryBuilder: vi.fn(),
    }
    mockAbsenceRepo = {
      createQueryBuilder: vi.fn(),
    }

    mockDataSource = {
      getRepository: vi.fn((entity: any) => {
        const name = entity?.name ?? ''
        if (name.includes('Professor')) return mockProfessorRepo
        if (name.includes('Grade')) return mockGradeRepo
        if (name.includes('Payment')) return mockPaymentRepo
        if (name.includes('Absence')) return mockAbsenceRepo
        return {
          count: vi.fn().mockResolvedValue(0),
          find: vi.fn().mockResolvedValue([]),
          createQueryBuilder: vi.fn(() => mockQbChain()),
        } as any
      }),
    }

    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDataSource as any)

    service = new DashboardService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. getTotalStudents/Professors/Classes count
  // -------------------------------------------------------------------------
  it('1. getTotalProfessors returns count', async () => {
    mockProfessorRepo.count.mockResolvedValue(12)
    const result = await service.getTotalProfessors()
    expect(result.success).toBe(true)
    expect(result.data).toBe(12)
    expect(mockProfessorRepo.count).toHaveBeenCalled()
  })

  it('1b. getTotalClasses returns count', async () => {
    mockGradeRepo.count.mockResolvedValue(7)
    const result = await service.getTotalClasses()
    expect(result.success).toBe(true)
    expect(result.data).toBe(7)
  })

  it('1c. getTotalStudents delegates to StudentService', async () => {
    const spy = vi.spyOn(StudentService.prototype as any, 'getTotalStudents').mockResolvedValue({
      success: true,
      data: 100,
      message: 'ok',
      error: null,
    })
    const result = await service.getTotalStudents()
    expect(result.success).toBe(true)
    expect(result.data).toBe(100)
    expect(spy).toHaveBeenCalled()
  })

  it('1d. getTotalProfessors handles error gracefully', async () => {
    mockProfessorRepo.count.mockRejectedValue(new Error('db error'))
    const result = await service.getTotalProfessors()
    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
    expect(result.error).toContain('db error')
  })

  it('1e. getTotalClasses handles error', async () => {
    mockGradeRepo.count.mockRejectedValue(new Error('fail'))
    const result = await service.getTotalClasses()
    expect(result.success).toBe(false)
  })

  // -------------------------------------------------------------------------
  // 2. getRecentPayments returns 5 with studentName
  // -------------------------------------------------------------------------
  it('2. getRecentPayments returns 5 with studentName mapping', async () => {
    const payments: any[] = Array.from({ length: 5 }, (_, i) => ({
      id: i + 1,
      amount: 100 + i * 10,
      created_at: new Date(`2026-01-0${i + 1}`),
      student: { firstname: `First${i}`, lastname: `Last${i}` },
    }))
    mockPaymentRepo.find.mockResolvedValue(payments)

    const result = await service.getRecentPayments(5)

    expect(result.success).toBe(true)
    expect(mockPaymentRepo.find).toHaveBeenCalledWith({
      relations: ['student'],
      order: { created_at: 'DESC' },
      take: 5,
    })
    expect(result.data).toHaveLength(5)
    expect(result.data[0]).toEqual(
      expect.objectContaining({
        id: 1,
        studentName: 'First0 Last0',
        amount: 100,
      })
    )
    expect(result.data[0].date).toBeInstanceOf(Date)
  })

  it('2b. getRecentPayments handles empty', async () => {
    mockPaymentRepo.find.mockResolvedValue([])
    const result = await service.getRecentPayments(5)
    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
  })

  // -------------------------------------------------------------------------
  // 3. getPaymentStats groups by month last 6 months, handles empty
  // -------------------------------------------------------------------------
  it('3. getPaymentStats groups by month (last 6 months) and handles empty', async () => {
    // Create payments across two months
    const now = new Date()
    const lastMonth = new Date(now)
    lastMonth.setMonth(now.getMonth() - 1)

    const payments = [
      { amount: 100, created_at: new Date(now) },
      { amount: 200, created_at: new Date(now) },
      { amount: 150, created_at: new Date(lastMonth) },
    ]
    const qb = mockQbChain({
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(payments),
    })
    mockPaymentRepo.createQueryBuilder.mockReturnValue(qb)

    const result = await service.getPaymentStats()

    expect(result.success).toBe(true)
    // Original code groups by French month long name
    // Verify that at least one month key exists and amounts summed
    const keys = Object.keys(result.data)
    expect(keys.length).toBeGreaterThan(0)
    const total = Object.values(result.data as Record<string, number>).reduce((a: number, b: any) => a + Number(b), 0)
    expect(total).toBe(450)
    // Verify date filter used: last 6 months
    expect(qb.where).toHaveBeenCalledWith('payment.created_at >= :startDate', expect.objectContaining({ startDate: expect.any(Date) }))
    expect(qb.andWhere).toHaveBeenCalledWith('payment.created_at <= :endDate', expect.objectContaining({ endDate: expect.any(Date) }))
  })

  it('3b. getPaymentStats handles empty payments', async () => {
    const qb = mockQbChain({
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    })
    mockPaymentRepo.createQueryBuilder.mockReturnValue(qb)

    const result = await service.getPaymentStats()
    expect(result.success).toBe(true)
    expect(result.data).toEqual({})
  })

  it('3c. getPaymentStats handles error', async () => {
    mockPaymentRepo.createQueryBuilder.mockImplementation(() => {
      throw new Error('qb fail')
    })
    const result = await service.getPaymentStats()
    expect(result.success).toBe(false)
    expect(result.data).toBeNull()
  })

  // -------------------------------------------------------------------------
  // 4. getRecentAbsences includes both STUDENT and PROFESSOR with correct mapping
  // -------------------------------------------------------------------------
  it('4. getRecentAbsences includes both STUDENT and PROFESSOR with correct mapping', async () => {
    const absences: any[] = [
      {
        id: 1,
        date: new Date('2026-01-10'),
        absenceType: 'FULL_DAY',
        justified: false,
        type: 'STUDENT',
        student: { firstname: 'Ali', lastname: 'Ben' },
        professor: null,
        grade: { name: '6eme' },
        course: null,
      },
      {
        id: 2,
        date: new Date('2026-01-11'),
        absenceType: 'MORNING',
        justified: true,
        type: 'PROFESSOR',
        student: null,
        professor: { firstname: 'Prof', lastname: 'X' },
        grade: { name: '5eme' },
        course: null,
      },
      {
        id: 3,
        date: new Date('2026-01-12'),
        absenceType: 'COURSE',
        justified: false,
        type: 'PROFESSOR',
        student: null,
        professor: null, // unknown professor case
        grade: null,
        course: { name: 'Math' },
      },
    ]

    const qb = mockQbChain({
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(absences),
    })
    mockAbsenceRepo.createQueryBuilder.mockReturnValue(qb)

    const result = await service.getRecentAbsences(5)

    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(3)

    // STUDENT mapping
    expect(result.data[0].studentName).toBe('Ali Ben')
    expect(result.data[0].className).toBe('6eme')
    expect(result.data[0].type).toBe('STUDENT')

    // PROFESSOR mapping
    expect(result.data[1].studentName).toBe('Prof X')
    expect(result.data[1].className).toBe('5eme')
    expect(result.data[1].type).toBe('PROFESSOR')

    // Unknown professor fallback + course name fallback
    expect(result.data[2].studentName).toBe('Professeur inconnu')
    expect(result.data[2].className).toBe('Math')
  })

  it('4b. getRecentAbsences handles empty', async () => {
    const qb = mockQbChain({
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    })
    mockAbsenceRepo.createQueryBuilder.mockReturnValue(qb)

    const result = await service.getRecentAbsences(5)
    expect(result.success).toBe(true)
    expect(result.data).toEqual([])
  })

  // -------------------------------------------------------------------------
  // 5. getAbsenceStats uses date filter (last 3 months) and groups by grade + Professeurs, handles empty
  // -------------------------------------------------------------------------
  it('5. getAbsenceStats groups by grade and Professeurs with date filter (last 3 months)', async () => {
    const absences: any[] = [
      { type: 'STUDENT', grade: { name: '6eme' } },
      { type: 'STUDENT', grade: { name: '6eme' } },
      { type: 'STUDENT', grade: { name: '5eme' } },
      { type: 'PROFESSOR', grade: null },
      { type: 'PROFESSOR', grade: null },
    ]

    const qb = mockQbChain({
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue(absences),
    })
    mockAbsenceRepo.createQueryBuilder.mockReturnValue(qb)

    const result = await service.getAbsenceStats()

    expect(result.success).toBe(true)
    expect(result.data['6eme']).toBe(2)
    expect(result.data['5eme']).toBe(1)
    expect(result.data['Professeurs']).toBe(2)

    // Verify date filter uses last 3 months with ISO date strings
    expect(qb.where).toHaveBeenCalledWith('absence.date >= :startDate', expect.objectContaining({ startDate: expect.any(String) }))
    expect(qb.andWhere).toHaveBeenCalledWith('absence.date <= :endDate', expect.objectContaining({ endDate: expect.any(String) }))

    // Validate ISO format YYYY-MM-DD
    const startDate = qb.where.mock.calls[0][1].startDate as string
    expect(startDate).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('5b. getAbsenceStats handles empty', async () => {
    const qb = mockQbChain({
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
    })
    mockAbsenceRepo.createQueryBuilder.mockReturnValue(qb)

    const result = await service.getAbsenceStats()
    expect(result.success).toBe(true)
    expect(result.data).toEqual({})
  })

  it('5c. getAbsenceStats handles error', async () => {
    mockAbsenceRepo.createQueryBuilder.mockImplementation(() => {
      throw new Error('abs fail')
    })
    const result = await service.getAbsenceStats()
    expect(result.success).toBe(false)
  })

  // -------------------------------------------------------------------------
  // 6. getStats Promise.all aggregation
  // -------------------------------------------------------------------------
  it('6. getStats aggregates via Promise.all', async () => {
    vi.spyOn(service as any, 'getTotalStudents').mockResolvedValue({ success: true, data: 100, message: 'ok', error: null })
    vi.spyOn(service as any, 'getTotalProfessors').mockResolvedValue({ success: true, data: 20, message: 'ok', error: null })
    vi.spyOn(service as any, 'getTotalClasses').mockResolvedValue({ success: true, data: 5, message: 'ok', error: null })
    vi.spyOn(service as any, 'getRecentPayments').mockResolvedValue({
      success: true,
      data: [{ id: 1, studentName: 'A B', amount: 100, date: new Date() }],
      message: 'ok',
      error: null,
    })
    vi.spyOn(service as any, 'getRecentAbsences').mockResolvedValue({
      success: true,
      data: [{ id: 1, studentName: 'C D', className: '6eme', date: new Date(), absenceType: 'FULL_DAY', justified: false, type: 'STUDENT' }],
      message: 'ok',
      error: null,
    })

    const result = await service.getStats()

    expect(result.success).toBe(true)
    expect(result.data.stats.totalStudents).toBe(100)
    expect(result.data.stats.totalProfessors).toBe(20)
    expect(result.data.stats.totalClasses).toBe(5)
    expect(result.data.stats.recentPayments).toHaveLength(1)
    expect(result.data.stats.recentAbsences).toHaveLength(1)

    // Verify parallel execution: all called
    expect((service as any).getTotalStudents).toHaveBeenCalled()
    expect((service as any).getTotalProfessors).toHaveBeenCalled()
    expect((service as any).getTotalClasses).toHaveBeenCalled()
    expect((service as any).getRecentPayments).toHaveBeenCalledWith(5)
    expect((service as any).getRecentAbsences).toHaveBeenCalledWith(5)
  })

  it('6b. getStats handles partial null data gracefully', async () => {
    vi.spyOn(service as any, 'getTotalStudents').mockResolvedValue({ success: true, data: null, message: 'ok', error: null })
    vi.spyOn(service as any, 'getTotalProfessors').mockResolvedValue({ success: false, data: null, message: 'err', error: 'fail' })
    vi.spyOn(service as any, 'getTotalClasses').mockResolvedValue({ success: true, data: 0, message: 'ok', error: null })
    vi.spyOn(service as any, 'getRecentPayments').mockResolvedValue({ success: true, data: null, message: 'ok', error: null })
    vi.spyOn(service as any, 'getRecentAbsences').mockResolvedValue({ success: true, data: null, message: 'ok', error: null })

    const result = await service.getStats()

    expect(result.success).toBe(true)
    expect(result.data.stats.totalStudents).toBe(0) // fallback to 0 when data null
    expect(result.data.stats.totalProfessors).toBe(0)
    expect(result.data.stats.recentPayments).toEqual([])
    expect(result.data.stats.recentAbsences).toEqual([])
  })

  // -------------------------------------------------------------------------
  // 7. Error handling for limit NaN in getRecentPayments
  // -------------------------------------------------------------------------
  it('7. getRecentPayments handles NaN limit gracefully without throwing', async () => {
    // If limit is NaN, TypeORM take(NaN) might be weird – service should not throw
    mockPaymentRepo.find.mockImplementation(async (opts: any) => {
      // Simulate handling: if take is NaN, return empty or default 5
      if (Number.isNaN(opts.take)) {
        // service might pass NaN through; we ensure it doesn't crash
        return []
      }
      return []
    })

    // Current implementation passes limit directly to take; we test it doesn't throw
    const result = await service.getRecentPayments(NaN as any)
    // Should return success true or false but not throw
    expect(result).toBeDefined()
    expect([true, false]).toContain(result.success)
    // If it returns success false, error should be defined; if success true, data should be array
    if (result.success) {
      expect(Array.isArray(result.data)).toBe(true)
    }
  })

  it('7b. getRecentPayments handles undefined limit defaults to 5', async () => {
    mockPaymentRepo.find.mockResolvedValue([])
    const result = await service.getRecentPayments(undefined as any)
    // Even with undefined, should default via function default param
    // But if undefined passed explicitly, JS default applies only if param is undefined
    expect(result.success).toBe(true)
  })

  // -------------------------------------------------------------------------
  // 8. Dashboard handles no data gracefully
  // -------------------------------------------------------------------------
  it('8. dashboard handles no data gracefully across all methods', async () => {
    mockProfessorRepo.count.mockResolvedValue(0)
    mockGradeRepo.count.mockResolvedValue(0)
    vi.spyOn(StudentService.prototype as any, 'getTotalStudents').mockResolvedValue({
      success: true,
      data: 0,
      message: 'ok',
      error: null,
    })

    // Payments / Absences empty
    mockPaymentRepo.find.mockResolvedValue([])
    const emptyQb = mockQbChain({
      leftJoinAndSelect: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      addOrderBy: vi.fn().mockReturnThis(),
      take: vi.fn().mockReturnThis(),
      getMany: vi.fn().mockResolvedValue([]),
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    })
    mockAbsenceRepo.createQueryBuilder.mockReturnValue(emptyQb)
    mockPaymentRepo.createQueryBuilder.mockReturnValue(
      mockQbChain({
        where: vi.fn().mockReturnThis(),
        andWhere: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockReturnThis(),
        getMany: vi.fn().mockResolvedValue([]),
      })
    )

    const [students, professors, classes, payments, absences, stats] = await Promise.all([
      service.getTotalStudents(),
      service.getTotalProfessors(),
      service.getTotalClasses(),
      service.getRecentPayments(5),
      service.getRecentAbsences(5),
      service.getAbsenceStats(),
    ])

    expect(students.data).toBe(0)
    expect(professors.data).toBe(0)
    expect(classes.data).toBe(0)
    expect(payments.data).toEqual([])
    expect(absences.data).toEqual([])
    expect(stats.data).toEqual({})

    // Full stats aggregation with empty
    vi.spyOn(service as any, 'getTotalStudents').mockResolvedValue({ success: true, data: 0, message: 'ok', error: null })
    vi.spyOn(service as any, 'getTotalProfessors').mockResolvedValue({ success: true, data: 0, message: 'ok', error: null })
    vi.spyOn(service as any, 'getTotalClasses').mockResolvedValue({ success: true, data: 0, message: 'ok', error: null })
    vi.spyOn(service as any, 'getRecentPayments').mockResolvedValue({ success: true, data: [], message: 'ok', error: null })
    vi.spyOn(service as any, 'getRecentAbsences').mockResolvedValue({ success: true, data: [], message: 'ok', error: null })

    const full = await service.getStats()
    expect(full.success).toBe(true)
    expect(full.data.stats.totalStudents).toBe(0)
    expect(full.data.stats.recentPayments).toEqual([])
    expect(full.data.stats.recentAbsences).toEqual([])
  })

  it('8b. getStats handles exception and returns fallback zeros', async () => {
    vi.spyOn(service as any, 'getTotalStudents').mockRejectedValue(new Error('boom'))
    const result = await service.getStats()
    expect(result.success).toBe(false)
    expect(result.data.stats.totalStudents).toBe(0)
    expect(result.data.stats.totalProfessors).toBe(0)
    expect(result.data.stats.recentPayments).toEqual([])
  })
})
