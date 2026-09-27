import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/e-school-audit-test'),
  },
}))

import { AuditLogService } from '../auditLogService'
import { AppDataSource } from '../../../data-source'
import { AuditLogEntity } from '../../entities/audit-log'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function createMockQb(overrides: any = {}) {
  const qb: any = {
    andWhere: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    addOrderBy: vi.fn().mockReturnThis(),
    skip: vi.fn().mockReturnThis(),
    take: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue(undefined),
    getManyAndCount: vi.fn().mockResolvedValue([[], 0]),
    getMany: vi.fn().mockResolvedValue([]),
    ...overrides,
  }
  return qb
}

describe('AuditLogService', () => {
  let service: AuditLogService
  let mockRepo: any
  let mockDataSource: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mockRepo = {
      create: vi.fn((data: any) => ({ id: 1, ...data })),
      save: vi.fn(async (e: any) => e),
      count: vi.fn().mockResolvedValue(0),
      remove: vi.fn().mockResolvedValue(undefined),
      createQueryBuilder: vi.fn(),
    }

    mockDataSource = {
      getRepository: vi.fn((entity: any) => {
        const name = entity?.name ?? ''
        if (name === 'AuditLogEntity') return mockRepo
        return mockRepo
      }),
    }

    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDataSource as any)

    service = new AuditLogService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // record()
  // -------------------------------------------------------------------------
  it('1. record persists actor fields, stringified targetId, diff and metadata', async () => {
    mockRepo.create.mockImplementation((data: any) => data)
    mockRepo.save.mockImplementation(async (e: any) => ({ ...e, id: 42 }))

    await service.record({
      action: 'update',
      targetEntity: 'Student',
      targetId: 99,
      summary: "Mise à jour de l'élève Jean Dupont",
      diff: { before: { firstname: 'Jean' }, after: { firstname: 'John' } },
      metadata: { source: 'test' },
      actor: { id: 5, username: 'admin1', role: 'admin', displayName: 'Admin Principal' },
    })

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: 5,
        actorUsername: 'admin1',
        actorRole: 'admin',
        action: 'update',
        targetEntity: 'Student',
        targetId: '99',
        summary: "Mise à jour de l'élève Jean Dupont",
        diff: { before: { firstname: 'Jean' }, after: { firstname: 'John' } },
        metadata: { source: 'test' },
      })
    )
    expect(mockRepo.save).toHaveBeenCalledTimes(1)
  })

  it('2. record with null actor uses "système" and null actorId', async () => {
    mockRepo.create.mockImplementation((data: any) => data)

    await service.record({
      action: 'login',
      targetEntity: 'User',
      targetId: null,
      summary: 'Échec : Mot de passe incorrect',
      actor: null,
    })

    expect(mockRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorId: null,
        actorUsername: 'système',
        actorRole: null,
        targetId: null,
      })
    )
  })

  // -------------------------------------------------------------------------
  // list()
  // -------------------------------------------------------------------------
  it('3. list applies actorUserId/action/targetEntity/from/to filters with pagination', async () => {
    const items = [
      { id: 2, actorUsername: 'admin1', action: 'login', targetEntity: 'User', createdAt: new Date() },
      { id: 1, actorUsername: 'admin1', action: 'login', targetEntity: 'User', createdAt: new Date() },
    ] as any
    const qb = createMockQb({ getManyAndCount: vi.fn().mockResolvedValue([items, 7]) })
    mockRepo.createQueryBuilder.mockReturnValue(qb)

    const result = await service.list({
      page: 2,
      pageSize: 10,
      filters: {
        actorUserId: 5,
        action: 'login',
        targetEntity: 'User',
        from: '2026-01-01',
        to: '2026-01-31',
      },
    })

    expect(mockRepo.createQueryBuilder).toHaveBeenCalledWith('audit_log')
    expect(qb.andWhere).toHaveBeenCalledWith('audit_log.actorId = :actorId', { actorId: 5 })
    expect(qb.andWhere).toHaveBeenCalledWith('audit_log.action = :action', { action: 'login' })
    expect(qb.andWhere).toHaveBeenCalledWith('audit_log.targetEntity = :targetEntity', { targetEntity: 'User' })
    expect(qb.andWhere).toHaveBeenCalledWith('audit_log.createdAt >= :from', { from: '2026-01-01' })
    expect(qb.andWhere).toHaveBeenCalledWith('audit_log.createdAt <= :to', { to: '2026-01-31' })
    expect(qb.orderBy).toHaveBeenCalledWith('audit_log.createdAt', 'DESC')
    expect(qb.addOrderBy).toHaveBeenCalledWith('audit_log.id', 'DESC')
    expect(qb.skip).toHaveBeenCalledWith(10) // (2-1)*10
    expect(qb.take).toHaveBeenCalledWith(10)
    expect(result.items).toEqual(items)
    expect(result.total).toBe(7)
  })

  it('4. list converts Date from/to into sqlite local format', async () => {
    const qb = createMockQb()
    mockRepo.createQueryBuilder.mockReturnValue(qb)

    await service.list({
      page: 1,
      pageSize: 20,
      filters: {
        from: new Date(2026, 0, 15, 8, 5, 9),
        to: new Date(2026, 1, 2, 23, 59, 59),
      },
    })

    expect(qb.andWhere).toHaveBeenCalledWith('audit_log.createdAt >= :from', { from: '2026-01-15 08:05:09' })
    expect(qb.andWhere).toHaveBeenCalledWith('audit_log.createdAt <= :to', { to: '2026-02-02 23:59:59' })
  })

  it('5. list without filters skips where clauses and uses default page/pageSize', async () => {
    const qb = createMockQb()
    mockRepo.createQueryBuilder.mockReturnValue(qb)

    const result = await service.list({})

    expect(qb.andWhere).not.toHaveBeenCalled()
    expect(qb.skip).toHaveBeenCalledWith(0)
    expect(qb.take).toHaveBeenCalledWith(20)
    expect(result.total).toBe(0)
  })

  // -------------------------------------------------------------------------
  // init() – retention + max rows
  // -------------------------------------------------------------------------
  it('6. init deletes entries older than the retention window (365 days)', async () => {
    const deleteQb = createMockQb()
    mockRepo.count.mockResolvedValue(100)
    mockRepo.createQueryBuilder.mockReturnValue(deleteQb)

    await service.init()

    expect(deleteQb.delete).toHaveBeenCalled()
    expect(deleteQb.where).toHaveBeenCalledWith(
      'createdAt < :cutoff',
      expect.objectContaining({ cutoff: expect.any(String) })
    )
    const cutoff = deleteQb.where.mock.calls[0][1].cutoff as string
    expect(cutoff).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
    const parsed = new Date(cutoff.replace(' ', 'T'))
    const diffDays = (Date.now() - parsed.getTime()) / 86400000
    expect(diffDays).toBeGreaterThan(364)
    expect(diffDays).toBeLessThan(366.1)
    expect(deleteQb.execute).toHaveBeenCalled()
    expect(mockRepo.remove).not.toHaveBeenCalled()
  })

  it('7. init culls oldest rows when count exceeds the max (100 000)', async () => {
    const deleteQb = createMockQb()
    const cullQb = createMockQb({ getMany: vi.fn().mockResolvedValue([{ id: 1 }]) })
    mockRepo.count.mockResolvedValue(100_001)
    mockRepo.createQueryBuilder.mockReturnValueOnce(deleteQb).mockReturnValueOnce(cullQb)

    await service.init()

    expect(cullQb.orderBy).toHaveBeenCalledWith('id', 'ASC')
    expect(cullQb.limit).toHaveBeenCalledWith(1) // 100_001 - 100_000
    expect(mockRepo.remove).toHaveBeenCalledWith([{ id: 1 }])
  })

  it('8. init does not cull when count is within the max', async () => {
    const deleteQb = createMockQb()
    mockRepo.count.mockResolvedValue(100_000)
    mockRepo.createQueryBuilder.mockReturnValue(deleteQb)

    await service.init()

    expect(mockRepo.remove).not.toHaveBeenCalled()
  })

  it('9. init swallows repository errors without throwing', async () => {
    const deleteQb = createMockQb({ execute: vi.fn().mockRejectedValue(new Error('db down')) })
    mockRepo.createQueryBuilder.mockReturnValue(deleteQb)

    await expect(service.init()).resolves.toBeUndefined()
  })
})