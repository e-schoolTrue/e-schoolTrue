// =============================================================================
// professorService.spec.ts - Comprehensive unit tests for ProfessorService
// =============================================================================
// Mock strategy: In-memory Map stores simulate TypeORM repositories.
// transactionalEntityManager pattern mirrors production: dataSource.manager.transaction
// provides a manager with findOne/find/save/count/createQueryBuilder.
// Style follows licenseService.spec.ts (InMemory, vi.fn, Map, vi.hoisted).
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ---------------------------------------------------------------------------
// Hoisted shared state - survives mock hoisting (like licenseService.spec.ts)
// ---------------------------------------------------------------------------
const professorStore = vi.hoisted(() => new Map<number, any>())
const diplomaStore = vi.hoisted(() => new Map<number, any>())
const qualificationStore = vi.hoisted(() => new Map<number, any>())
const teachingStore = vi.hoisted(() => new Map<number, any>())
const gradeStore = vi.hoisted(() => new Map<number, any>([
  [1, { id: 1, name: 'CP', code: 'CP', type: 'PRIMARY' }],
  [2, { id: 2, name: 'CE1', code: 'CE1', type: 'PRIMARY' }],
  [3, { id: 3, name: 'CE2', code: 'CE2', type: 'SECONDARY' }],
  [4, { id: 4, name: 'CM1', code: 'CM1', type: 'SECONDARY' }],
  [5, { id: 5, name: '6eme', code: '6E', type: 'SECONDARY' }],
]))
const courseStore = vi.hoisted(() => new Map<number, any>([
  [1, { id: 1, name: 'Mathematiques', code: 'MATH', coefficient: 4 }],
  [2, { id: 2, name: 'Francais', code: 'FR', coefficient: 3 }],
  [5, { id: 5, name: 'Histoire', code: 'HIST', coefficient: 2 }],
]))

// Counters for auto-increment IDs
const idCounters = vi.hoisted(() => ({ professor: 100, diploma: 200, qualification: 300, teaching: 400, file: 500 }))
// Track delete calls for assertion
const deleteSpy = vi.hoisted(() => ({ called: false, lastWhere: null as any }))
// Spy for file saves
const fileSaveCalls = vi.hoisted(() => [] as any[])

// ---------------------------------------------------------------------------
// Helpers - Entity name detection
// ---------------------------------------------------------------------------
function entityName(entity: any): string {
  if (!entity || !entity.name) return 'unknown'
  return entity.name
}
function isProfessorEntity(e: any) { return e && (e.name === 'ProfessorEntity' || e === 'ProfessorEntity') }
function isDiplomaEntity(e: any) { return e && e.name === 'DiplomaEntity' }
function isQualificationEntity(e: any) { return e && e.name === 'QualificationEntity' }
function isGradeEntity(e: any) { return e && e.name === 'GradeEntity' }
function isCourseEntity(e: any) { return e && e.name === 'CourseEntity' }
function isTeachingEntity(e: any) { return e && e.name === 'TeachingAssignmentEntity' }
function isFileEntity(e: any) { return e && e.name === 'FileEntity' }

// Helper to unwrap In() values (real TypeORM returns FindOperator, our mock returns array)
function unwrapIn(value: any): any {
  if (Array.isArray(value)) return value
  if (value && typeof value === 'object') {
    if ('_value' in value) return (value as any)._value
    if ('value' in value) return (value as any).value
  }
  return value
}

// ---------------------------------------------------------------------------
// Mock: typeorm In() -> identity (returns array itself)
// Keep other exports real
// ---------------------------------------------------------------------------
vi.mock('typeorm', async () => {
  const actual: any = await vi.importActual('typeorm')
  return {
    ...actual,
    In: (ids: any[]) => ids,
  }
})

// ---------------------------------------------------------------------------
// Mock: session
// ---------------------------------------------------------------------------
vi.mock('#electron/backend/lib/session', () => ({
  getCurrentSupabaseUserId: vi.fn(() => 'user-test-123'),
  setCurrentSupabaseUserId: vi.fn(),
  getCurrentSchemaName: vi.fn(() => null),
  setCurrentSchemaName: vi.fn(),
}))

// ---------------------------------------------------------------------------
// Mock: FileService - returns synthetic FileEntity
// ---------------------------------------------------------------------------
vi.mock('#electron/backend/services/fileService', () => {
  return {
    FileService: vi.fn().mockImplementation(() => ({
      saveFile: vi.fn(async (data: any) => {
        const id = idCounters.file++
        const file = { id, name: data.name, type: data.type, path: '/uploads/' + data.name }
        fileSaveCalls.push(data)
        return file
      }),
      getFileById: vi.fn(async () => null),
      getFileUrl: vi.fn(async () => 'data:...'),
    })),
  }
})

// ---------------------------------------------------------------------------
// Mock: DashboardService
// ---------------------------------------------------------------------------
vi.mock('#electron/backend/services/dashboardService', () => ({
  DashboardService: vi.fn().mockImplementation(() => ({
    getStats: vi.fn(async () => ({ success: true, data: {} })),
    getTotalProfessors: vi.fn(async () => ({ success: true, data: 5 })),
    getTotalStudents: vi.fn(async () => ({ success: true, data: 10 })),
    getTotalClasses: vi.fn(async () => ({ success: true, data: 3 })),
    getRecentPayments: vi.fn(async () => ({ success: true, data: [] })),
    getRecentAbsences: vi.fn(async () => ({ success: true, data: [] })),
  })),
}))

// ---------------------------------------------------------------------------
// Mock: SchoolService
// ---------------------------------------------------------------------------
vi.mock('#electron/backend/services/schoolService', () => ({
  SchoolService: vi.fn().mockImplementation(() => ({
    getSchool: vi.fn(async () => ({ success: true, data: { name: 'Ecole Test', id: 1 } })),
    saveOrUpdateSchool: vi.fn(async () => ({ success: true })),
    getSettings: vi.fn(async () => ({ success: true, data: null })),
    saveOrUpdateSettings: vi.fn(async () => ({ success: true })),
  })),
}))

// ---------------------------------------------------------------------------
// In-memory repository factory
// ---------------------------------------------------------------------------
function makeInMemoryRepo(entityClass: any) {
  const eName = entityClass?.name || 'unknown'
  return {
    create: vi.fn((data: any) => {
      // mimic TypeORM create: shallow copy, assign temporary id if missing
      const copy: any = { ...data }
      if (!copy.id) copy.id = undefined
      return copy
    }),
    save: vi.fn(async (entity: any) => {
      // This repo save is NOT used for professors/teachings inside transaction
      // but keep for completeness (diploma/qualification creation outside tx uses repo)
      if (isDiplomaEntity(entityClass)) {
        if (!entity.id) entity.id = idCounters.diploma++
        diplomaStore.set(entity.id, entity)
        return entity
      }
      if (isQualificationEntity(entityClass)) {
        if (!entity.id) entity.id = idCounters.qualification++
        qualificationStore.set(entity.id, entity)
        return entity
      }
      return entity
    }),
    findOne: vi.fn(async (opts: any) => {
      const where = opts?.where || {}
      if (isGradeEntity(entityClass) && where.id) {
        return gradeStore.get(Number(where.id)) || null
      }
      if (isCourseEntity(entityClass) && where.id) {
        return courseStore.get(Number(where.id)) || null
      }
      if (isDiplomaEntity(entityClass) && where.name) {
        for (const v of diplomaStore.values()) if (v.name === where.name) return v
        return null
      }
      if (isQualificationEntity(entityClass) && where.name) {
        for (const v of qualificationStore.values()) if (v.name === where.name) return v
        return null
      }
      if (entityClass?.name === 'ProfessorEntity' && where.id) {
        return professorStore.get(Number(where.id)) || null
      }
      return null
    }),
    find: vi.fn(async (opts: any) => {
      const where = opts?.where || {}
      if (isGradeEntity(entityClass) && where?.id) {
        const ids = unwrapIn(where.id)
        if (Array.isArray(ids)) {
          return ids.map((id: number) => gradeStore.get(Number(id))).filter(Boolean)
        }
        return gradeStore.get(Number(where.id)) ? [gradeStore.get(Number(where.id))] : []
      }
      return []
    }),
    remove: vi.fn(async (entity: any) => {
      if (entity?.id) professorStore.delete(entity.id)
      return entity
    }),
    count: vi.fn(async () => professorStore.size),
    createQueryBuilder: vi.fn((alias: string) => createQueryBuilderMock(alias, entityClass)),
  }
}

// Shared QueryBuilder mock for professor & teaching
function createQueryBuilderMock(alias: string, entityClass: any) {
  const qb: any = {
    _alias: alias,
    _entity: entityClass,
    _where: [] as any[],
    _relations: [] as string[],
    leftJoinAndSelect: vi.fn(function(this: any, rel: string, alias2: string) {
      this._relations.push(rel)
      return this
    }),
    where: vi.fn(function(this: any, clause: string, params: any) {
      this._where.push({ clause, params })
      return this
    }),
    andWhere: vi.fn(function(this: any, clause: string, params: any) {
      this._where.push({ clause, params })
      return this
    }),
    delete: vi.fn(function(this: any) { return this }),
    from: vi.fn(function(this: any) { return this }),
    execute: vi.fn(async function(this: any) {
      // used only for delete teaching assignments in updateProfessor
      if (this._where.some((w: any) => w.clause?.includes('professorId'))) {
        deleteSpy.called = true
        deleteSpy.lastWhere = this._where
        // remove teachings for that professor
        const pid = this._where.find((w: any) => w.params?.id)?.params?.id
        if (pid) {
          for (const [k, v] of Array.from(teachingStore.entries())) {
            if (v.professor?.id === pid || v.professorId === pid) teachingStore.delete(k)
          }
        }
      }
      return { affected: 1 }
    }),
    getMany: vi.fn(async function(this: any) {
      const eName = entityClass?.name
      // Professor getAll / search
      if (eName === 'ProfessorEntity') {
        // searchProfessors uses where firstname LIKE :query
        const whereClause = this._where.find((w: any) => w.clause?.includes('LIKE'))
        if (whereClause) {
          const q = (whereClause.params?.query || '').replace(/%/g, '').toLowerCase()
          if (!q || q.trim() === '') {
            // empty query gracefully returns all (simulates LIKE '%%')
            return Array.from(professorStore.values())
          }
          return Array.from(professorStore.values()).filter((p: any) =>
            (p.firstname || '').toLowerCase().includes(q) || (p.lastname || '').toLowerCase().includes(q)
          )
        }
        return Array.from(professorStore.values())
      }
      // TeachingAssignment getProfessorByCourseAndGrade
      if (eName === 'TeachingAssignmentEntity') {
        return Array.from(teachingStore.values())
      }
      return []
    }),
    getCount: vi.fn(async function(this: any) {
      if (entityClass?.name === 'ProfessorEntity') return professorStore.size
      return 0
    }),
  }
  return qb
}

// ---------------------------------------------------------------------------
// Transactional manager mock
// ---------------------------------------------------------------------------
const transactionalEntityManager: any = {
  findOne: vi.fn(async (entityClass: any, opts: any) => {
    const where = opts?.where || {}
    const eName = entityClass?.name
    if (eName === 'ProfessorEntity') {
      const id = Number(where.id)
      const prof = professorStore.get(id) || null
      if (!prof) return null
      // attach teaching for relations fetch
      if (opts?.relations?.includes('teaching')) {
        const teachings = Array.from(teachingStore.values()).filter((t: any) => t.professor?.id === id || t.professorId === id)
        return { ...prof, teaching: teachings, photo: prof.photo, documents: prof.documents, diploma: prof.diploma, qualification: prof.qualification }
      }
      return prof
    }
    if (eName === 'DiplomaEntity') {
      for (const v of diplomaStore.values()) if (v.name === where.name) return v
      return null
    }
    if (eName === 'QualificationEntity') {
      for (const v of qualificationStore.values()) if (v.name === where.name) return v
      return null
    }
    if (eName === 'GradeEntity') {
      return gradeStore.get(Number(where.id)) || null
    }
    if (eName === 'CourseEntity') {
      return courseStore.get(Number(where.id)) || null
    }
    return null
  }),
  find: vi.fn(async (entityClass: any, opts: any) => {
    const where = opts?.where || {}
    const eName = entityClass?.name
    if (eName === 'GradeEntity' && where?.id !== undefined) {
      const ids = unwrapIn(where.id)
      if (Array.isArray(ids)) {
        return ids.map((id: number) => gradeStore.get(Number(id))).filter(Boolean)
      }
      const single = gradeStore.get(Number(where.id))
      return single ? [single] : []
    }
    return []
  }),
  save: vi.fn(async (entity: any) => {
    // Detect entity type by shape
    // TeachingAssignment has schoolType
    if (entity && typeof entity.schoolType === 'string') {
      if (!entity.id) entity.id = idCounters.teaching++
      // ensure professor link
      if (entity.professor && entity.professor.id) entity.professorId = entity.professor.id
      teachingStore.set(entity.id, entity)
      // Also mutate professor's teaching array if professor exists in store
      if (entity.professor?.id) {
        const prof = professorStore.get(entity.professor.id)
        if (prof) {
          if (!prof.teaching) prof.teaching = []
          // avoid duplicates
          if (!prof.teaching.find((t: any) => t.id === entity.id)) prof.teaching.push(entity)
        }
      }
      return entity
    }
    // Diploma
    if (entity && entity.name && !entity.code && !entity.coefficient && !entity.firstname && !entity.schoolType) {
      // ambiguous between diploma/qualification - check if already in qualificationStore vs diploma
      // Heuristic: if entity has been created via diploma path, we store in diplomaStore
      // But both have same shape {name}. We use id range: diploma 200, qualification 300
      // For simplicity, check if name already in diplomaStore -> diploma, else check caller context
      // We'll store in diplomaStore if not already in qualificationStore
      // Actually we can check if entity.id exists in qualificationStore
      if (entity.id && qualificationStore.has(entity.id)) {
        qualificationStore.set(entity.id, entity)
        return entity
      }
      // Default to diploma unless we know it's qualification via separate save path
      // Workaround: look at recent save caller - but for test we allow either
      // Try to infer: if we have qualificationStore with same name, treat as qualification
      const qualExists = Array.from(qualificationStore.values()).some((q: any) => q.name === entity.name)
      const diplExists = Array.from(diplomaStore.values()).some((d: any) => d.name === entity.name)
      if (!entity.id) {
        if (diplExists || !qualExists) {
          entity.id = idCounters.diploma++
          diplomaStore.set(entity.id, entity)
        } else {
          entity.id = idCounters.qualification++
          qualificationStore.set(entity.id, entity)
        }
        return entity
      }
      // with id, try to set both? just return
      return entity
    }
    // Professor has firstname
    if (entity && entity.firstname) {
      if (!entity.id) entity.id = idCounters.professor++
      if (!entity.matricule) entity.matricule = 'PRF-P26' + String(entity.id).padStart(4, '0')
      professorStore.set(entity.id, entity)
      return entity
    }
    // File
    if (entity && entity.path) {
      return entity
    }
    // Fallback: if has id, assign and store in professorStore
    if (!entity.id) entity.id = Math.floor(Math.random() * 10000) + 1000
    return entity
  }),
  count: vi.fn(async (entityClass: any) => {
    if (entityClass?.name === 'ProfessorEntity') return professorStore.size
    return 0
  }),
  createQueryBuilder: vi.fn((entityClass: any, alias: string) => {
    // transactional delete uses .createQueryBuilder().delete().from(...).where().execute()
    const qb: any = {
      delete: vi.fn(function(this: any) { return this }),
      from: vi.fn(function(this: any) { return this }),
      where: vi.fn(function(this: any, clause: string, params: any) {
        this._where = this._where || []
        this._where.push({ clause, params })
        return this
      }),
      execute: vi.fn(async function(this: any) {
        deleteSpy.called = true
        deleteSpy.lastWhere = this._where
        const pid = this._where?.find((w: any) => w.params?.id)?.params?.id
        if (pid) {
          for (const [k, v] of Array.from(teachingStore.entries())) {
            if (v.professor?.id === pid || v.professorId === pid) teachingStore.delete(k)
          }
        }
        return { affected: 1 }
      }),
    }
    return qb
  }),
}

// ---------------------------------------------------------------------------
// Mock: AppDataSource
// ---------------------------------------------------------------------------
const mockDataSourceInstance: any = {
  isInitialized: true,
  getRepository: vi.fn((entityClass: any) => makeInMemoryRepo(entityClass)),
  manager: {
    transaction: vi.fn(async (cb: any) => {
      return await cb(transactionalEntityManager)
    }),
  },
  initialize: vi.fn(async () => mockDataSourceInstance),
  createQueryRunner: vi.fn(),
}

vi.mock('#electron/data-source', () => ({
  AppDataSource: {
    getInstance: vi.fn(() => mockDataSourceInstance),
    initialize: vi.fn(async () => mockDataSourceInstance),
  },
}))

// Also mock relative path used inside professorService: '../../data-source' is same
vi.mock('../../data-source', () => ({
  AppDataSource: {
    getInstance: vi.fn(() => mockDataSourceInstance),
    initialize: vi.fn(async () => mockDataSourceInstance),
  },
}))

// ---------------------------------------------------------------------------
// Import service AFTER mocks (hoisted mocks must be defined before)
// ---------------------------------------------------------------------------
import { ProfessorService } from '../professorService'
import { TEACHING_TYPE } from '#electron/command'

// Silence console for cleaner output
beforeEach(() => {
  // Reinstall transactionalEntityManager mocks after clear
  // @ts-ignore
  transactionalEntityManager.findOne = vi.fn(async (entityClass: any, opts: any) => {
    const where = opts?.where || {}
    const eName = entityClass?.name
    if (eName === 'ProfessorEntity') {
      const id = Number(where.id)
      const prof = professorStore.get(id) || null
      if (!prof) return null
      if (opts?.relations?.includes('teaching')) {
        const teachings = Array.from(teachingStore.values()).filter((t: any) => t.professor?.id === id || t.professorId === id)
        return { ...prof, teaching: teachings, photo: prof.photo, documents: prof.documents, diploma: prof.diploma, qualification: prof.qualification }
      }
      return prof
    }
    if (eName === 'DiplomaEntity') {
      for (const v of diplomaStore.values()) if (v.name === where.name) return v
      return null
    }
    if (eName === 'QualificationEntity') {
      for (const v of qualificationStore.values()) if (v.name === where.name) return v
      return null
    }
    if (eName === 'GradeEntity') return gradeStore.get(Number(where.id)) || null
    if (eName === 'CourseEntity') return courseStore.get(Number(where.id)) || null
    return null
  })
  transactionalEntityManager.find = vi.fn(async (entityClass: any, opts: any) => {
    const where = opts?.where || {}
    const eName = entityClass?.name
    if (eName === 'GradeEntity' && where?.id !== undefined) {
      const ids = unwrapIn(where.id)
      if (Array.isArray(ids)) return ids.map((id: number) => gradeStore.get(Number(id))).filter(Boolean)
      const single = gradeStore.get(Number(where.id))
      return single ? [single] : []
    }
    return []
  })
  transactionalEntityManager.save = vi.fn(async (entity: any) => {
    if (entity && typeof entity.schoolType === 'string') {
      if (!entity.id) entity.id = idCounters.teaching++
      if (entity.professor && entity.professor.id) entity.professorId = entity.professor.id
      teachingStore.set(entity.id, entity)
      if (entity.professor?.id) {
        const prof = professorStore.get(entity.professor.id)
        if (prof) {
          if (!prof.teaching) prof.teaching = []
          if (!prof.teaching.find((t: any) => t.id === entity.id)) prof.teaching.push(entity)
        }
      }
      return entity
    }
    if (entity && entity.name && !entity.code && !entity.coefficient && !entity.firstname && !entity.schoolType) {
      if (entity.id && qualificationStore.has(entity.id)) { qualificationStore.set(entity.id, entity); return entity }
      const qualExists = Array.from(qualificationStore.values()).some((q: any) => q.name === entity.name)
      const diplExists = Array.from(diplomaStore.values()).some((d: any) => d.name === entity.name)
      if (!entity.id) {
        if (diplExists || !qualExists) { entity.id = idCounters.diploma++; diplomaStore.set(entity.id, entity) } else { entity.id = idCounters.qualification++; qualificationStore.set(entity.id, entity) }
        return entity
      }
      return entity
    }
    if (entity && entity.firstname) {
      if (!entity.id) entity.id = idCounters.professor++
      if (!entity.matricule) entity.matricule = 'PRF-P26' + String(entity.id).padStart(4, '0')
      professorStore.set(entity.id, entity)
      return entity
    }
    if (entity && entity.path) return entity
    if (!entity.id) entity.id = Math.floor(Math.random() * 10000) + 1000
    return entity
  })
  transactionalEntityManager.count = vi.fn(async (entityClass: any) => {
    if (entityClass?.name === 'ProfessorEntity') return professorStore.size
    return 0
  })
  transactionalEntityManager.createQueryBuilder = vi.fn((entityClass: any, alias: string) => {
    const qb: any = {
      delete: vi.fn(function(this: any) { return this }),
      from: vi.fn(function(this: any) { return this }),
      where: vi.fn(function(this: any, clause: string, params: any) {
        this._where = this._where || []
        this._where.push({ clause, params })
        return this
      }),
      execute: vi.fn(async function(this: any) {
        deleteSpy.called = true
        deleteSpy.lastWhere = this._where
        const pid = this._where?.find((w: any) => w.params?.id)?.params?.id
        if (pid) for (const [k, v] of Array.from(teachingStore.entries())) if (v.professor?.id === pid || v.professorId === pid) teachingStore.delete(k)
        return { affected: 1 }
      }),
    }
    return qb
  })
  vi.clearAllMocks()
  // reset spy tracking but keep vi.fn mocks
  professorStore.clear()
  diplomaStore.clear()
  qualificationStore.clear()
  teachingStore.clear()
  fileSaveCalls.length = 0
  deleteSpy.called = false
  deleteSpy.lastWhere = null
  idCounters.professor = 100
  idCounters.diploma = 200
  idCounters.qualification = 300
  idCounters.teaching = 400
  idCounters.file = 500
  // ensure manager.transaction still mocked after clearAllMocks
  mockDataSourceInstance.manager.transaction = vi.fn(async (cb: any) => await cb(transactionalEntityManager))
  mockDataSourceInstance.getRepository = vi.fn((entityClass: any) => makeInMemoryRepo(entityClass))
  mockDataSourceInstance.isInitialized = true
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  vi.spyOn(console, 'warn').mockImplementation(() => {})
})

afterEach(() => {
  // Do NOT restore hoisted mocks - only clear call history. Restoring destroys transactionalEntityManager mocks.
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Helpers for test data
// ---------------------------------------------------------------------------
function baseProfessorData(overrides: any = {}) {
  return {
    firstname: 'Jean',
    lastname: 'Dupont',
    civility: 'MR',
    nbr_child: 2,
    family_situation: 'MARIÉ',
    birth_date: new Date('1985-03-15'),
    birth_town: 'Yaounde',
    address: '123 Rue Test',
    town: 'Douala',
    cni_number: '123456789',
    ...overrides,
  }
}

describe('ProfessorService (unit, transactionalEntityManager InMemory)', () => {
  // -------------------------------------------------------------
  // 1. CREATE PRIMARY with classId -> saves TeachingAssignment with class
  // -------------------------------------------------------------
  it('1. createProfessor PRIMARY with classId saves TeachingAssignment with class', async () => {
    const service = new ProfessorService()
    const data = baseProfessorData({
      teaching: { schoolType: 'PRIMARY', classId: 1 },
    })

    const result = await service.createProfessor(data)

    expect(result.success).toBe(true)
    expect(result.data).toBeDefined()
    // Validate teaching mapping
    const teaching = (result.data as any).teaching?.[0]
    expect(teaching).toBeDefined()
    expect(teaching.schoolType).toBe('PRIMARY')
    expect(teaching.class).toEqual({ id: 1, name: 'CP' })
    // Ensure store has TA
    expect(teachingStore.size).toBe(1)
    const savedTA: any = Array.from(teachingStore.values())[0]
    expect(savedTA.class?.id).toBe(1)
    expect(savedTA.teachingType).toBe(TEACHING_TYPE.CLASS_TEACHER)
  })

  // -------------------------------------------------------------
  // 2. CREATE SECONDARY with courseId + gradeIds array -> saves grades, CSV, names, course, class=grades[0]
  // -------------------------------------------------------------
  it('2. createProfessor SECONDARY with courseId + gradeIds array saves grades, CSV, names, course and class=grades[0]', async () => {
    const service = new ProfessorService()
    const data = baseProfessorData({
      teaching: { schoolType: 'SECONDARY', courseId: 1, gradeIds: [1, 2, 3] },
    })

    const result = await service.createProfessor(data)

    expect(result.success).toBe(true)
    const teaching: any = (result.data as any).teaching?.[0]
    expect(teaching.schoolType).toBe('SECONDARY')
    expect(teaching.course).toEqual({ id: 1, name: 'Mathematiques' })
    expect(teaching.grades).toHaveLength(3)
    expect(teaching.gradeIds).toBe('1,2,3')
    expect(teaching.gradeNames).toBe('CP, CE1, CE2')
    // fallback class = grades[0]
    expect(teaching.class).toEqual({ id: 1, name: 'CP' })
    const savedTA: any = Array.from(teachingStore.values())[0]
    expect(savedTA.gradeIds).toBe('1,2,3')
    expect(savedTA.gradeNames).toBe('CP, CE1, CE2')
  })

  // -------------------------------------------------------------
  // 3. SECONDARY with gradeIds string "1,2,3" parses correctly
  // -------------------------------------------------------------
  it('3. createProfessor SECONDARY with gradeIds string "1,2,3" parses correctly', async () => {
    const service = new ProfessorService()
    const data = baseProfessorData({
      teaching: { schoolType: 'SECONDARY', courseId: 2, gradeIds: '1,2,3' },
    })

    const result = await service.createProfessor(data)

    expect(result.success).toBe(true)
    const teaching: any = (result.data as any).teaching?.[0]
    expect(teaching.gradeIds).toBe('1,2,3')
    expect(teaching.grades).toHaveLength(3)
    expect(teaching.course?.id).toBe(2)
  })

  // -------------------------------------------------------------
  // 4. courseId string -> Number conversion
  // -------------------------------------------------------------
  it('4. createProfessor with courseId as string converts to Number', async () => {
    const service = new ProfessorService()
    const data = baseProfessorData({
      teaching: { schoolType: 'SECONDARY', courseId: '5' as any, gradeIds: [5] },
    })

    const result = await service.createProfessor(data)

    expect(result.success).toBe(true)
    const teaching: any = (result.data as any).teaching?.[0]
    expect(teaching.course).toEqual({ id: 5, name: 'Histoire' })
  })

  // -------------------------------------------------------------
  // 5. PRIMARY fallback: classId undefined but class.id provided
  // -------------------------------------------------------------
  it('5. createProfessor PRIMARY fallback: classId undefined but class.id provided still saves', async () => {
    const service = new ProfessorService()
    const data: any = baseProfessorData({
      teaching: { schoolType: 'PRIMARY', class: { id: 2 } },
    })

    const result = await service.createProfessor(data)

    expect(result.success).toBe(true)
    const teaching: any = (result.data as any).teaching?.[0]
    expect(teaching.class).toEqual({ id: 2, name: 'CE1' })
    expect(teachingStore.size).toBe(1)
  })

  // Also test selectedClasses[0] fallback for PRIMARY
  it('5b. createProfessor PRIMARY fallback via selectedClasses[0]', async () => {
    const service = new ProfessorService()
    const data: any = baseProfessorData({
      teaching: { schoolType: 'PRIMARY', selectedClasses: [3] },
    })
    const result = await service.createProfessor(data)
    expect(result.success).toBe(true)
    expect((result.data as any).teaching?.[0].class).toEqual({ id: 3, name: 'CE2' })
  })

  // -------------------------------------------------------------
  // 6. updateProfessor SECONDARY with only courseId and no gradeIds -> still saves course
  // -------------------------------------------------------------
  it('6. updateProfessor SECONDARY with only courseId and no gradeIds saves course (bug fix)', async () => {
    const service = new ProfessorService()
    // First create a professor
    const createRes = await service.createProfessor(baseProfessorData({
      teaching: { schoolType: 'SECONDARY', courseId: 1, gradeIds: [1,2] },
    }))
    const profId = (createRes.data as any).id

    // Update with only courseId
    const updateRes = await service.updateProfessor(profId, {
      firstname: 'Jean',
      lastname: 'Dupont',
      teaching: { schoolType: 'SECONDARY', courseId: 2 } as any,
    })

    expect(updateRes.success).toBe(true)
    const teaching: any = (updateRes.data as any).teaching?.[0]
    // Must have course even without gradeIds
    expect(teaching.course).toEqual({ id: 2, name: 'Francais' })
    // gradeIds may be undefined, but course persists
    expect(teachingStore.size).toBe(1)
  })

  // -------------------------------------------------------------
  // 7. updateProfessor deletes old teaching assignments before creating new
  // -------------------------------------------------------------
  it('7. updateProfessor deletes old teaching assignments before creating new', async () => {
    const service = new ProfessorService()
    const createRes = await service.createProfessor(baseProfessorData({
      teaching: { schoolType: 'PRIMARY', classId: 1 },
    }))
    const profId = (createRes.data as any).id
    expect(teachingStore.size).toBe(1)
    const oldTAId = Array.from(teachingStore.values())[0].id

    const updateRes = await service.updateProfessor(profId, {
      firstname: 'Jean',
      lastname: 'Updated',
      teaching: { schoolType: 'PRIMARY', classId: 2 } as any,
    })

    expect(updateRes.success).toBe(true)
    expect(deleteSpy.called).toBe(true)
    // old TA should be gone, new one exists with new class
    expect(teachingStore.size).toBe(1)
    const newTA: any = Array.from(teachingStore.values())[0]
    expect(newTA.id).not.toBe(oldTAId)
    expect(newTA.class?.id).toBe(2)
    expect((updateRes.data as any).teaching?.[0].class).toEqual({ id: 2, name: 'CE1' })
  })

  // -------------------------------------------------------------
  // 8. mapToProfessorDetails correctly maps gradeIds, gradeNames, grades, course, class (including fallback from grades)
  // -------------------------------------------------------------
  it('8. mapToProfessorDetails maps gradeIds, gradeNames, grades, course, class with SECONDARY fallback from grades', async () => {
    const service: any = new ProfessorService()
    const professor: any = {
      id: 999,
      firstname: 'Map',
      lastname: 'Test',
      civility: 'MR',
      nbr_child: 0,
      family_situation: 'CÉLIBATAIRE',
      birth_date: new Date(),
      birth_town: 'Test',
      address: 'Addr',
      town: 'Town',
      cni_number: '000',
      color: '#409EFF',
      photo: { id: 1, name: 'photo.jpg', type: 'image/jpeg' },
      documents: [{ id: 2, name: 'doc.pdf', type: 'application/pdf' }],
      diploma: { id: 1, name: 'Master' },
      qualification: { id: 1, name: 'Prof' },
      teaching: [
        {
          id: 10,
          schoolType: 'SECONDARY',
          class: undefined,
          course: { id: 1, name: 'Mathematiques' },
          grades: [{ id: 1, name: 'CP' }, { id: 2, name: 'CE1' }],
          gradeIds: '1,2',
          gradeNames: 'CP, CE1',
        } as any,
        {
          id: 11,
          schoolType: 'PRIMARY',
          class: { id: 5, name: '6eme' },
          grades: undefined,
          gradeIds: undefined,
        } as any,
      ],
    }
    const mapped = service.mapToProfessorDetails(professor)
    expect(mapped.teaching).toHaveLength(2)
    // SECONDARY with grades but no class => fallback class = grades[0]
    expect(mapped.teaching[0].class).toEqual({ id: 1, name: 'CP' })
    expect(mapped.teaching[0].gradeIds).toBe('1,2')
    expect(mapped.teaching[0].gradeNames).toBe('CP, CE1')
    expect(mapped.teaching[0].grades).toEqual([{ id: 1, name: 'CP' }, { id: 2, name: 'CE1' }])
    expect(mapped.teaching[0].course).toEqual({ id: 1, name: 'Mathematiques' })
    // PRIMARY keeps its class
    expect(mapped.teaching[1].class).toEqual({ id: 5, name: '6eme' })
    // also test fallback generation: when gradeIds missing but grades present, it should generate CSV
    const prof2: any = {
      ...professor,
      teaching: [{
        id: 12,
        schoolType: 'SECONDARY',
        grades: [{ id: 3, name: 'CE2' }, { id: 4, name: 'CM1' }],
        // no gradeIds / gradeNames => should be derived
      } as any]
    }
    const mapped2 = service.mapToProfessorDetails(prof2)
    expect(mapped2.teaching[0].gradeIds).toBe('3,4')
    expect(mapped2.teaching[0].gradeNames).toBe('CE2, CM1')
    expect(mapped2.teaching[0].class).toEqual({ id: 3, name: 'CE2' })
  })

  // -------------------------------------------------------------
  // 9. getProfessorByCourseAndGrade triple-check: finds by class.id, gradeIds CSV, grades M2M
  // -------------------------------------------------------------
  it('9a. getProfessorByCourseAndGrade finds by class.id (direct)', async () => {
    const service = new ProfessorService()
    // Create professor with SECONDARY that has class directly (grades[0] fallback)
    await service.createProfessor(baseProfessorData({
      teaching: { schoolType: 'SECONDARY', courseId: 1, gradeIds: [1] },
    }))
    // Also manually ensure TA has class.id = 1 (already via fallback)
    const res = await service.getProfessorByCourseAndGrade(1, 1)
    expect(res.success).toBe(true)
    expect((res.data as any).firstname).toBe('Jean')
  })

  it('9b. getProfessorByCourseAndGrade finds by gradeIds CSV', async () => {
    const service = new ProfessorService()
    // Create TA that will have gradeIds CSV "2,3" and course 2
    await service.createProfessor(baseProfessorData({
      firstname: 'Csv',
      lastname: 'Prof',
      civility: 'MME',
      birth_town: 'X',
      address: 'A',
      town: 'T',
      cni_number: '999',
      family_situation: 'CÉLIBATAIRE',
      teaching: { schoolType: 'SECONDARY', courseId: 2, gradeIds: '2,3' as any },
    }))
    const res = await service.getProfessorByCourseAndGrade(2, 3)
    expect(res.success).toBe(true)
    expect((res.data as any).firstname).toBe('Csv')
  })

  it('9c. getProfessorByCourseAndGrade finds by grades M2M relation', async () => {
    const service = new ProfessorService()
    await service.createProfessor(baseProfessorData({
      firstname: 'M2M',
      lastname: 'Prof',
      civility: 'MR',
      birth_town: 'X',
      address: 'A',
      town: 'T',
      cni_number: '888',
      family_situation: 'CÉLIBATAIRE',
      teaching: { schoolType: 'SECONDARY', courseId: 1, gradeIds: [4,5] },
    }))
    // TA has grades M2M containing 5
    const res = await service.getProfessorByCourseAndGrade(1, 5)
    expect(res.success).toBe(true)
    expect((res.data as any).firstname).toBe('M2M')
  })

  it('9d. getProfessorByCourseAndGrade fallback to CLASS_TEACHER when no SECONDARY match', async () => {
    const service = new ProfessorService()
    await service.createProfessor(baseProfessorData({
      firstname: 'Titulaire',
      lastname: 'Prof',
      civility: 'MR',
      birth_town: 'X',
      address: 'A',
      town: 'T',
      cni_number: '777',
      family_situation: 'CÉLIBATAIRE',
      teaching: { schoolType: 'PRIMARY', classId: 2 },
    }))
    // Search with non-existing course but same grade -> should find CLASS_TEACHER fallback
    // Our mock returns all TAs for SECONDARY first (none match course 999), then fallback queries for CLASS_TEACHER with gradeId
    // To simulate, we search with courseId 999 that doesn't exist, but gradeId 2 that matches PRIMARY
    // Implementation does two queries: first for SECONDARY with courseId, then for CLASS_TEACHER with gradeId
    // So we need to test the fallback logic: create PRIMARY only, search for course 1 + grade 2 should fallback to titular
    const res = await service.getProfessorByCourseAndGrade(1, 2)
    // Since we have no SECONDARY with course 1, it should fallback to PRIMARY with class 2
    expect(res.success).toBe(true)
    expect((res.data as any).firstname).toBe('Titulaire')
  })

  // -------------------------------------------------------------
  // 10. Error handling: invalid professorId NaN -> returns success:false
  // -------------------------------------------------------------
  it('10. getProfessorById with NaN returns success:false gracefully', async () => {
    const service = new ProfessorService()
    const res = await service.getProfessorById(NaN as any)
    expect(res.success).toBe(false)
    expect(res.error).toBeDefined()
  })

  it('10b. getProfessorById with non-existent id returns success:false', async () => {
    const service = new ProfessorService()
    const res = await service.getProfessorById(99999)
    expect(res.success).toBe(false)
    expect(res.message).toContain('Erreur')
  })

  it('10c. updateProfessor with invalid id returns NOT_FOUND', async () => {
    const service = new ProfessorService()
    const res = await service.updateProfessor(99999 as any, { firstname: 'X' } as any)
    expect(res.success).toBe(false)
    expect(res.error).toBe('NOT_FOUND')
  })

  // -------------------------------------------------------------
  // 11. SearchProfessors with empty query -> handles gracefully
  // -------------------------------------------------------------
  it('11. searchProfessors with empty query handles gracefully and returns all or empty without error', async () => {
    const service = new ProfessorService()
    await service.createProfessor(baseProfessorData({ firstname: 'Alice', lastname: 'Test' }))
    await service.createProfessor(baseProfessorData({ firstname: 'Bob', lastname: 'Test2' }))

    const resEmpty = await service.searchProfessors('')
    expect(resEmpty.success).toBe(true)
    expect(Array.isArray(resEmpty.data)).toBe(true)
    // empty query returns all (LIKE '%%')
    expect((resEmpty.data as any[]).length).toBe(2)

    const resSpaces = await service.searchProfessors('   ')
    expect(resSpaces.success).toBe(true)
  })

  it('11b. searchProfessors filters correctly', async () => {
    const service = new ProfessorService()
    await service.createProfessor(baseProfessorData({ firstname: 'Alice', lastname: 'Wonder' }))
    await service.createProfessor(baseProfessorData({ firstname: 'Bob', lastname: 'Builder' }))

    const res = await service.searchProfessors('Alice')
    expect(res.success).toBe(true)
    expect((res.data as any[]).length).toBe(1)
    expect((res.data as any[])[0].firstname).toBe('Alice')
  })

  // -------------------------------------------------------------
  // 12. Color handling: create with color, update with color, palette fallback
  // -------------------------------------------------------------
  it('12a. createProfessor with explicit color saves color', async () => {
    const service = new ProfessorService()
    const res = await service.createProfessor(baseProfessorData({ color: '#FF0000' }))
    expect(res.success).toBe(true)
    expect((res.data as any).color).toBe('#FF0000')
    const stored: any = professorStore.get((res.data as any).id)
    expect(stored.color).toBe('#FF0000')
  })

  it('12b. createProfessor without color assigns palette color', async () => {
    const service = new ProfessorService()
    const res1 = await service.createProfessor(baseProfessorData({ firstname: 'P1' }))
    const res2 = await service.createProfessor(baseProfessorData({ firstname: 'P2' }))
    expect((res1.data as any).color).toBeDefined()
    expect((res2.data as any).color).toBeDefined()
    // palette is deterministic based on count % palette.length
    const palette = ['#409EFF','#67C23A','#E6A23C','#F56C6C','#909399','#8B5CF6','#EC4899','#10B981','#F59E0B','#EF4444','#3B82F6','#14B8A6','#A855F7','#F97316','#06B6D4']
    expect(palette).toContain((res1.data as any).color)
    expect(palette).toContain((res2.data as any).color)
    // Ensure distinct for sequential counts (if not wrapping)
    if (professorStore.size < palette.length) {
      expect((res1.data as any).color).not.toBe((res2.data as any).color)
    }
  })

  it('12c. updateProfessor with color updates color', async () => {
    const service = new ProfessorService()
    const createRes = await service.createProfessor(baseProfessorData({ color: '#111111' }))
    const id = (createRes.data as any).id
    const updateRes = await service.updateProfessor(id, { firstname: 'Jean', lastname: 'Dupont', color: '#00FF00' } as any)
    expect(updateRes.success).toBe(true)
    expect((updateRes.data as any).color).toBe('#00FF00')
  })

  it('12d. palette logic wraps correctly (distinct palette logic works)', async () => {
    const service = new ProfessorService()
    // Fill up to palette length +1 to test wrapping
    const palette = ['#409EFF','#67C23A','#E6A23C','#F56C6C','#909399','#8B5CF6','#EC4899','#10B981','#F59E0B','#EF4444','#3B82F6','#14B8A6','#A855F7','#F97316','#06B6D4']
    for (let i = 0; i < palette.length + 2; i++) {
      await service.createProfessor(baseProfessorData({ firstname: `Pal${i}`, cni_number: `${i}000` }))
    }
    const lastProf: any = Array.from(professorStore.values()).pop()
    // last index = palette.length+1 -> color should be palette[(count-1)%len] where count before save = palette.length+1
    expect(palette).toContain(lastProf.color)
  })

  // -------------------------------------------------------------
  // 13. Validation: missing firstname -> error (graceful failure simulation)
  // -------------------------------------------------------------
  it('13. createProfessor with missing firstname triggers error handling', async () => {
    const service = new ProfessorService()
    // Simulate DB failure when firstname missing by making transactional save throw
    const originalSave = transactionalEntityManager.save
    transactionalEntityManager.save = vi.fn(async (entity: any) => {
      if (entity && 'firstname' in entity && !entity.firstname) {
        throw new Error('firstname required')
      }
      return originalSave(entity)
    })

    const res = await service.createProfessor(baseProfessorData({ firstname: '' } as any))
    // Service catches error and returns success:false (or may still succeed with empty string)
    // Our mock throws for empty firstname, so success should be false
    expect(res.success).toBe(false)
    expect(res.error).toContain('firstname')

    transactionalEntityManager.save = originalSave
  })

  // -------------------------------------------------------------
  // 14. GRADE-IDS edge: empty string, trailing comma, NaN filtering
  // -------------------------------------------------------------
  it('14a. GRADE-IDS edge: empty string yields no grades and no crash', async () => {
    const service = new ProfessorService()
    const res = await service.createProfessor(baseProfessorData({
      teaching: { schoolType: 'SECONDARY', courseId: 1, gradeIds: '' as any },
    }))
    expect(res.success).toBe(true)
    // Empty gradeIds should not create grades, but course alone should still save TA
    const ta: any = Array.from(teachingStore.values())[0]
    // Service logic: only saves TA if course||grades||class ; course exists so TA saved
    expect(ta.course?.id).toBe(1)
    expect(ta.gradeIds).toBeUndefined()
  })

  it('14b. GRADE-IDS edge: trailing comma and spaces filtered', async () => {
    const service = new ProfessorService()
    const res = await service.createProfessor(baseProfessorData({
      teaching: { schoolType: 'SECONDARY', courseId: 1, gradeIds: '1, 2, 3, ' as any },
    }))
    expect(res.success).toBe(true)
    const teaching: any = (res.data as any).teaching?.[0]
    expect(teaching.gradeIds).toBe('1,2,3')
    expect(teaching.grades).toHaveLength(3)
  })

  it('14c. GRADE-IDS edge: NaN filtering for string with invalid ids', async () => {
    const service = new ProfessorService()
    const res = await service.createProfessor(baseProfessorData({
      teaching: { schoolType: 'SECONDARY', courseId: 1, gradeIds: '1, abc, 2, NaN, 3' as any },
    }))
    expect(res.success).toBe(true)
    const teaching: any = (res.data as any).teaching?.[0]
    expect(teaching.gradeIds).toBe('1,2,3')
    expect(teaching.grades.map((g: any) => g.id)).toEqual([1,2,3])
  })

  it('14d. GRADE-IDS edge: array with NaN values filtered', async () => {
    const service = new ProfessorService()
    const res = await service.createProfessor(baseProfessorData({
      teaching: { schoolType: 'SECONDARY', courseId: 1, gradeIds: [1, 'oops' as any, 2, NaN as any, 3] },
    }))
    expect(res.success).toBe(true)
    const teaching: any = (res.data as any).teaching?.[0]
    expect(teaching.gradeIds).toBe('1,2,3')
  })

  // -------------------------------------------------------------
  // 15. Test that professor color distinct palette logic works (if applicable)
  // -------------------------------------------------------------
  it('15. color palette distinct logic assigns different colors sequentially', async () => {
    const service = new ProfessorService()
    const colors: string[] = []
    for (let i = 0; i < 5; i++) {
      const res = await service.createProfessor(baseProfessorData({ firstname: `Col${i}`, cni_number: `C${i}` }))
      colors.push((res.data as any).color)
    }
    // All colors should be defined and distinct for first 5 (palette has 15 unique)
    expect(colors.every(c => !!c)).toBe(true)
    const unique = new Set(colors)
    expect(unique.size).toBe(5)
  })

  // -------------------------------------------------------------
  // Extra: ensure createProfessor robust fallback for SECONDARY via class.id and selectedClasses
  // -------------------------------------------------------------
  it('16. SECONDARY fallback via course.id and selectedClasses', async () => {
    const service = new ProfessorService()
    const data: any = baseProfessorData({
      teaching: { schoolType: 'SECONDARY', course: { id: '2' }, selectedClasses: [1,2] },
    })
    const res = await service.createProfessor(data)
    expect(res.success).toBe(true)
    const t: any = (res.data as any).teaching?.[0]
    expect(t.course?.id).toBe(2)
    expect(t.grades).toHaveLength(2)
  })

  it('17. updateProfessor PRIMARY fallback via class.id', async () => {
    const service = new ProfessorService()
    const createRes = await service.createProfessor(baseProfessorData({ teaching: { schoolType: 'PRIMARY', classId: 1 } }))
    const id = (createRes.data as any).id
    const updateRes: any = await service.updateProfessor(id, {
      firstname: 'Jean',
      teaching: { schoolType: 'PRIMARY', class: { id: 4 } } as any,
    })
    expect(updateRes.success).toBe(true)
    expect(updateRes.data.teaching?.[0].class).toEqual({ id: 4, name: 'CM1' })
  })
})
