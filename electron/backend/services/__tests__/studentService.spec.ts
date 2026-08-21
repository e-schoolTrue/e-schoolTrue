import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/e-school-test-uploads'),
  },
}))

import { StudentService } from '../studentService'
import { AppDataSource } from '../../../data-source'
import { StudentEntity } from '../../entities/students'
import { GradeEntity } from '../../entities/grade'
import { FileService } from '../fileService'
import { SchoolService } from '../schoolService'
import { PaymentService } from '../paymentService'
import { DashboardService } from '../dashboardService'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createMockQb(students: any[], total: number) {
  const qb: any = {
    leftJoinAndSelect: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    orWhere: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    getManyAndCount: vi.fn().mockResolvedValue([students, total]),
    getMany: vi.fn().mockResolvedValue(students),
  }
  return qb
}

describe('StudentService', () => {
  let service: StudentService
  let mockStudentRepo: any
  let mockGradeRepo: any
  let mockPhotoFile: any
  let mockDocFile: any
  let mockCompleteStudent: any
  let mockDataSource: any
  let saveFileSpy: any
  let getSchoolSpy: any
  let createFeeSpy: any
  let getStatsSpy: any
  let generateMatriculeSpy: any

  const baseStudentData: any = {
    firstname: 'John',
    lastname: 'Doe',
    fatherFirstname: 'Jack',
    fatherLastname: 'Doe',
    birthDay: new Date('2010-01-15'),
    birthPlace: 'Paris',
    gradeId: 1,
    isNew: true,
    photo: { name: 'photo.jpg', type: 'image/jpeg', content: 'data:image/jpeg;base64,abc' },
    documents: [{ name: 'doc.pdf', type: 'application/pdf', content: 'data:application/pdf;base64,xyz' }],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'log').mockImplementation(() => {})

    mockPhotoFile = { id: 10, name: 'photo.jpg', type: 'image/jpeg', path: 'photo.jpg' }
    mockDocFile = { id: 11, name: 'doc.pdf', type: 'application/pdf', path: 'doc.pdf' }
    mockCompleteStudent = {
      id: 1,
      firstname: 'John',
      lastname: 'Doe',
      matricule: 'ET-S260001',
      birthDay: new Date('2010-01-15'),
      photo: mockPhotoFile,
      documents: [mockDocFile],
      grade: { id: 1, name: '6eme', code: '6E' },
      isNew: true,
    }

    mockStudentRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      create: vi.fn((data: any) => ({ ...data })),
      save: vi.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
      count: vi.fn().mockResolvedValue(42),
      createQueryBuilder: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      remove: vi.fn().mockResolvedValue(undefined),
    }

    mockGradeRepo = {
      findOne: vi.fn().mockResolvedValue({ id: 1, name: '6eme', code: '6E' }),
    }

    const mockTransactionalManager: any = {
      save: vi.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
      findOne: vi.fn(async () => mockCompleteStudent),
    }

    mockDataSource = {
      getRepository: vi.fn((entity: any) => {
        const name = entity?.name ?? ''
        if (name === 'StudentEntity') return mockStudentRepo
        if (name === 'GradeEntity') return mockGradeRepo
        if (name === 'FileEntity') {
          return {
            create: vi.fn((x: any) => x),
            save: vi.fn(async (x: any) => ({ ...x, id: Math.floor(Math.random() * 1000) + 1 })),
            findOne: vi.fn(),
          } as any
        }
        // generic for PaymentService / SchoolService etc
        return {
          findOne: vi.fn().mockResolvedValue(null),
          find: vi.fn().mockResolvedValue([]),
          create: vi.fn((x: any) => x),
          save: vi.fn(async (x: any) => ({ ...x, id: 1 })),
          count: vi.fn().mockResolvedValue(0),
          update: vi.fn().mockResolvedValue(undefined),
        } as any
      }),
      manager: {
        transaction: vi.fn(async (cb: any) => cb(mockTransactionalManager)),
        save: vi.fn(async (e: any) => ({ ...e, id: 1 })),
        findOne: vi.fn(async () => mockCompleteStudent),
      },
    }

    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDataSource as any)

    // Spy prototypes after mocking AppDataSource
    saveFileSpy = vi.spyOn(FileService.prototype as any, 'saveFile').mockImplementation(async (data: any) => {
      if (data.name === 'photo.jpg') return mockPhotoFile
      return mockDocFile
    })
    getSchoolSpy = vi.spyOn(SchoolService.prototype as any, 'getSchool').mockResolvedValue({
      success: true,
      data: { name: 'Ecole Test' },
      message: 'ok',
      error: null,
    })
    createFeeSpy = vi.spyOn(PaymentService.prototype as any, 'createInitialInscriptionFee').mockResolvedValue(undefined)
    getStatsSpy = vi.spyOn(DashboardService.prototype as any, 'getStats').mockResolvedValue({
      success: true,
      data: { stats: {} },
      message: 'ok',
      error: null,
    } as any)

    generateMatriculeSpy = vi.spyOn(StudentEntity as any, 'generateMatricule').mockReturnValue('ET-S260001')

    service = new StudentService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // 1. createStudent success with gradeId, generates matricule, saves photo/docs
  // -------------------------------------------------------------------------
  it('1. createStudent success with gradeId, generates matricule, saves photo/docs via fileService', async () => {
    mockGradeRepo.findOne.mockResolvedValue({ id: 1, name: '6eme', code: '6E' })
    mockStudentRepo.findOne.mockResolvedValue(null) // no duplicate

    const result = await service.createStudent(baseStudentData as any)

    expect(result.success).toBe(true)
    expect(result.data?.matricule).toBe('ET-S260001')
    expect(generateMatriculeSpy).toHaveBeenCalledWith('Ecole Test')
    expect(mockGradeRepo.findOne).toHaveBeenCalledWith({ where: { id: 1 } })
    expect(saveFileSpy).toHaveBeenCalledTimes(2) // photo + doc
    expect(saveFileSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'photo.jpg' }))
    expect(saveFileSpy).toHaveBeenCalledWith(expect.objectContaining({ name: 'doc.pdf' }))
    expect(mockDataSource.manager.transaction).toHaveBeenCalledTimes(1)
    expect(createFeeSpy).toHaveBeenCalledWith(mockCompleteStudent)
    expect(getStatsSpy).toHaveBeenCalled()
    expect(result.message).toContain('succès')
  })

  // -------------------------------------------------------------------------
  // 2. duplicate check firstname+lastname+birthDay -> error
  // -------------------------------------------------------------------------
  it('2. createStudent duplicate check firstname+lastname+birthDay -> DUPLICATE_STUDENT', async () => {
    mockStudentRepo.findOne.mockResolvedValue({ id: 99, firstname: 'John', lastname: 'Doe' } as any)

    const result = await service.createStudent(baseStudentData as any)

    expect(result.success).toBe(false)
    expect(result.error).toBe('DUPLICATE_STUDENT')
    expect(result.message).toContain('existe déjà')
    expect(saveFileSpy).not.toHaveBeenCalled()
    expect(mockDataSource.manager.transaction).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 3. missing required fields -> success:false
  // -------------------------------------------------------------------------
  it('3. createStudent missing required fields -> success:false', async () => {
    const missingFirstname = { ...baseStudentData, firstname: '' }
    const r1 = await service.createStudent(missingFirstname as any)
    expect(r1.success).toBe(false)
    expect(r1.error).toContain('Champs obligatoires')

    const missingLastname = { ...baseStudentData, lastname: undefined }
    const r2 = await service.createStudent(missingLastname as any)
    expect(r2.success).toBe(false)
    expect(r2.message).toContain('obligatoires')
  })

  // -------------------------------------------------------------------------
  // 4. getAllStudents pagination and LOWER search filter
  // -------------------------------------------------------------------------
  it('4. getAllStudents pagination and LOWER search filter', async () => {
    const students = [{ id: 1, firstname: 'John' }, { id: 2, firstname: 'Jane' }] as any
    const qb = createMockQb(students, 2)
    mockStudentRepo.createQueryBuilder.mockReturnValue(qb)

    const result = await service.getAllStudents({
      page: 2,
      pageSize: 10,
      filters: { studentFullName: 'John', grade: 5 },
    })

    expect(mockStudentRepo.createQueryBuilder).toHaveBeenCalledWith('student')
    expect(qb.where).toHaveBeenCalledWith(
      "LOWER(student.firstname || ' ' || student.lastname) LIKE :searchName",
      { searchName: '%john%' } // lowercased
    )
    expect(qb.andWhere).toHaveBeenCalledWith('student.grade.id = :gradeId', { gradeId: 5 })
    expect(qb.skip).toHaveBeenCalledWith(10) // (2-1)*10
    expect(qb.take).toHaveBeenCalledWith(10)
    expect(result.students).toEqual(students)
    expect(result.total).toBe(2)
  })

  it('4b. getAllStudents without filters skips where clauses', async () => {
    const qb = createMockQb([], 0)
    mockStudentRepo.createQueryBuilder.mockReturnValue(qb)

    const result = await service.getAllStudents({ page: 1, pageSize: 20, filters: {} })
    expect(qb.where).not.toHaveBeenCalled()
    expect(qb.andWhere).not.toHaveBeenCalled()
    expect(qb.skip).toHaveBeenCalledWith(0)
    expect(qb.take).toHaveBeenCalledWith(20)
    expect(result.total).toBe(0)
  })

  // -------------------------------------------------------------------------
  // 5. updateStudent re-enrollment isNew=false logic
  // -------------------------------------------------------------------------
  it('5. updateStudent re-enrollment isNew=false when grade changes', async () => {
    const existing = {
      id: 1,
      firstname: 'John',
      lastname: 'Doe',
      grade: { id: 1, name: '6eme' },
      isNew: true,
      photo: null,
      documents: [{ id: 1, name: 'old.pdf', type: 'application/pdf' }],
    } as any
    mockStudentRepo.findOne.mockResolvedValue(existing)
    mockGradeRepo.findOne.mockResolvedValue({ id: 2, name: '5eme', code: '5E' })
    mockStudentRepo.save.mockImplementation(async (e: any) => e)
    // saveFile for new photo/doc
    saveFileSpy.mockResolvedValue({ id: 99, name: 'new.jpg', type: 'image/jpeg' })

    const result = await service.updateStudent(1, {
      firstname: 'John',
      gradeId: 2,
      photo: { name: 'new.jpg', type: 'image/jpeg', content: 'data:xxx' },
      documents: [{ name: 'newdoc.pdf', type: 'application/pdf', content: 'data:yyy' }],
    } as any)

    expect(result.success).toBe(true)
    expect(existing.isNew).toBe(false) // re-enrollment flips to false
    expect(existing.grade).toEqual({ id: 2, name: '5eme', code: '5E' })
    expect(saveFileSpy).toHaveBeenCalled()
    expect(createFeeSpy).toHaveBeenCalledWith(existing) // inscription fee on re-enrollment
    expect(result.data?.isNew).toBe(false)
  })

  it('5b. updateStudent without grade change keeps isNew true', async () => {
    const existing = {
      id: 1,
      firstname: 'John',
      grade: { id: 1, name: '6eme' },
      isNew: true,
      documents: [],
    } as any
    mockStudentRepo.findOne.mockResolvedValue(existing)
    mockStudentRepo.save.mockImplementation(async (e: any) => e)

    const result = await service.updateStudent(1, { firstname: 'Johnny' } as any)
    expect(result.success).toBe(true)
    expect(existing.isNew).toBe(true)
    expect(createFeeSpy).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 6. deleteStudent
  // -------------------------------------------------------------------------
  it('6. deleteStudent success and not found', async () => {
    const student = { id: 5, firstname: 'ToDelete' } as any
    mockStudentRepo.findOne.mockResolvedValue(student)

    const ok = await service.deleteStudent(5)
    expect(ok.success).toBe(true)
    expect(ok.message).toContain('supprimé')
    expect(mockStudentRepo.remove).toHaveBeenCalledWith(student)
    expect(getStatsSpy).toHaveBeenCalled()

    // not found
    mockStudentRepo.findOne.mockResolvedValue(null)
    const notFound = await service.deleteStudent(999)
    expect(notFound.success).toBe(false)
    expect(notFound.error).toContain('introuvable')
    expect(mockStudentRepo.remove).toHaveBeenCalledTimes(1) // not called again
  })

  // -------------------------------------------------------------------------
  // 7. searchStudents with empty term -> no error, returns empty
  // -------------------------------------------------------------------------
  it('7. searchStudents with empty term -> no error, returns empty', async () => {
    const qb = createMockQb([], 0)
    // searchStudents uses createQueryBuilder with orWhere chain
    mockStudentRepo.createQueryBuilder.mockReturnValue(qb)
    // qb.getMany resolves [] by default
    const r1 = await service.searchStudents('')
    expect(r1.success).toBe(true)
    expect(r1.data).toEqual([])
    expect(r1.error).toBeNull()

    const r2 = await service.searchStudents('   ')
    // still should not throw, even with whitespace
    expect(r2.success).toBe(true)
  })

  it('7b. searchStudents with term returns mapped details', async () => {
    const students = [
      { id: 1, firstname: 'Ali', lastname: 'Ben', photo: null, documents: [], grade: { id: 1, name: '6eme', code: '6E' } },
    ] as any
    const qb = createMockQb(students, 1)
    qb.getMany.mockResolvedValue(students)
    mockStudentRepo.createQueryBuilder.mockReturnValue(qb)

    const result = await service.searchStudents('Ali')
    expect(result.success).toBe(true)
    expect((result.data as any).length).toBe(1)
    expect(qb.where).toHaveBeenCalled()
    expect(qb.orWhere).toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // 8. getTotalStudents count
  // -------------------------------------------------------------------------
  it('8. getTotalStudents count', async () => {
    mockStudentRepo.count.mockResolvedValue(123)
    const result = await service.getTotalStudents()
    expect(result.success).toBe(true)
    expect(result.data).toBe(123)
    expect(mockStudentRepo.count).toHaveBeenCalled()

    // error path
    mockStudentRepo.count.mockRejectedValue(new Error('db down'))
    const err = await service.getTotalStudents()
    expect(err.success).toBe(false)
    expect(err.data).toBeNull()
    expect(err.error).toContain('db down')
  })

  // -------------------------------------------------------------------------
  // 9. NaN guard for gradeId
  // -------------------------------------------------------------------------
  it('9. NaN guard for gradeId does not query grade and succeeds', async () => {
    mockStudentRepo.findOne.mockResolvedValue(null) // no duplicate
    // gradeId is NaN – service does `if (studentData.gradeId && !grade)` and `studentData.gradeId ? findOne ... : null`
    // NaN is falsy, so gradeRepository.findOne should NOT be called
    mockGradeRepo.findOne.mockClear()

    const result = await service.createStudent({
      ...baseStudentData,
      gradeId: NaN,
    } as any)

    expect(mockGradeRepo.findOne).not.toHaveBeenCalled()
    expect(result.success).toBe(true)
    // matricule still generated
    expect(generateMatriculeSpy).toHaveBeenCalled()
  })

  it('9b. gradeId valid but grade not found returns error', async () => {
    mockStudentRepo.findOne.mockResolvedValue(null)
    mockGradeRepo.findOne.mockResolvedValue(null)

    const result = await service.createStudent({
      ...baseStudentData,
      gradeId: 999,
    } as any)

    expect(result.success).toBe(false)
    expect(result.error).toContain('Classe non trouvée')
  })

  // -------------------------------------------------------------------------
  // 10. orphan file handling on rollback
  // -------------------------------------------------------------------------
  it('10. orphan file handling on rollback - transaction throws after saveFile', async () => {
    mockStudentRepo.findOne.mockResolvedValue(null)
    mockGradeRepo.findOne.mockResolvedValue({ id: 1, name: '6eme', code: '6E' })
    // fileService succeeds initially, but DB save inside transaction fails -> orphan file
    saveFileSpy.mockResolvedValue(mockPhotoFile)
    mockDataSource.manager.transaction.mockImplementation(async (cb: any) => {
      // Execute callback: it will call saveFile (succeeds) then try to save entity and fail
      const failingManager: any = {
        save: vi.fn().mockRejectedValue(new Error('DB transaction failed')),
        findOne: vi.fn(),
      }
      return cb(failingManager)
    })

    const result = await service.createStudent(baseStudentData as any)

    expect(result.success).toBe(false)
    expect(result.error).toContain('DB transaction failed')
    expect(saveFileSpy).toHaveBeenCalled() // files were saved before failure -> orphan risk
    expect(createFeeSpy).not.toHaveBeenCalled()
    // In real code orphan cleanup would be needed – test documents that failure is handled gracefully
  })

  it('10b. fileService failure propagates as createStudent error', async () => {
    mockStudentRepo.findOne.mockResolvedValue(null)
    mockGradeRepo.findOne.mockResolvedValue({ id: 1, name: '6eme', code: '6E' })
    saveFileSpy.mockRejectedValue(new Error('disk full'))
    mockDataSource.manager.transaction.mockImplementation(async (cb: any) => {
      // transaction will call saveFile inside, which throws
      return cb({
        save: vi.fn(),
        findOne: vi.fn(),
      })
    })

    const result = await service.createStudent(baseStudentData as any)
    expect(result.success).toBe(false)
    expect(result.message).toContain('Erreur lors de la création')
  })
})
