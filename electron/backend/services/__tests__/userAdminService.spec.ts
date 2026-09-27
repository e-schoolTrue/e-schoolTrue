import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as bcrypt from 'bcryptjs'

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/e-school-user-admin-test'),
  },
}))

import { UserAdminService } from '../userAdminService'
import { AppDataSource } from '../../../data-source'
import { UserEntity } from '../../entities/user'

describe('UserAdminService', () => {
  let service: UserAdminService
  let mockUserRepo: any
  let mockDataSource: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    mockUserRepo = {
      findOne: vi.fn().mockResolvedValue(null),
      findAndCount: vi.fn().mockResolvedValue([[], 0]),
      count: vi.fn().mockResolvedValue(0),
      create: vi.fn((data: any) => data),
      save: vi.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
    }

    mockDataSource = {
      getRepository: vi.fn((entity: any) => {
        const name = entity?.name ?? ''
        if (name === 'UserEntity') return mockUserRepo
        return mockUserRepo
      }),
    }

    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDataSource as any)

    service = new UserAdminService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // create
  // -------------------------------------------------------------------------
  it('1. create hashes the password with bcrypt, saves isActive true and returns DTO without password', async () => {
    mockUserRepo.findOne.mockResolvedValue(null)

    const dto = await service.create({
      username: 'admin2',
      password: 'secret123',
      displayName: 'Admin Deux',
      role: 'admin',
    })

    expect(mockUserRepo.findOne).toHaveBeenCalledWith({ where: { username: 'admin2' } })
    expect(mockUserRepo.save).toHaveBeenCalledTimes(1)
    const saved = mockUserRepo.save.mock.calls[0][0]
    expect(bcrypt.compareSync('secret123', saved.password)).toBe(true)
    expect(saved.isActive).toBe(true)
    expect(saved.securityQuestion).toBe('')
    // securityAnswer is hashed (of '')
    expect(bcrypt.compareSync('', saved.securityAnswer)).toBe(true)

    expect(dto).toEqual(
      expect.objectContaining({
        id: 1,
        username: 'admin2',
        displayName: 'Admin Deux',
        role: 'admin',
        isActive: true,
      })
    )
    expect(dto).not.toHaveProperty('password')
    expect(dto).not.toHaveProperty('securityQuestion')
    expect(dto).not.toHaveProperty('securityAnswer')
  })

  it('2. create with existing username throws USERNAME_EXISTS and does not insert', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 9, username: 'admin2', role: 'admin' })

    await expect(
      service.create({ username: 'admin2', password: 'secret123', role: 'admin' })
    ).rejects.toMatchObject({ code: 'USERNAME_EXISTS' })
    await expect(
      service.create({ username: 'admin2', password: 'secret123', role: 'admin' })
    ).rejects.toThrow('existe déjà')
    expect(mockUserRepo.save).not.toHaveBeenCalled()
  })

  it('3. create professor/student without security question gets the default question', async () => {
    mockUserRepo.findOne.mockResolvedValue(null)

    await service.create({ username: 'profX', password: 'secret123', role: 'professor' })
    let saved = mockUserRepo.save.mock.calls[0][0]
    expect(saved.securityQuestion).toBe('Question par défaut')
    expect(saved.securityAnswer).toMatch(/^\$2[aby]\$/)

    await service.create({ username: 'studX', password: 'secret123', role: 'student' })
    saved = mockUserRepo.save.mock.calls[1][0]
    expect(saved.securityQuestion).toBe('Question par défaut')
    expect(saved.securityAnswer).toMatch(/^\$2[aby]\$/)
  })

  it('4. create professor with explicit security question stores it (hashed answer)', async () => {
    mockUserRepo.findOne.mockResolvedValue(null)

    await service.create({
      username: 'profY',
      password: 'secret123',
      role: 'professor',
      securityQuestion: 'Couleur préférée ?',
      securityAnswer: 'Bleu',
    })

    const saved = mockUserRepo.save.mock.calls[0][0]
    expect(saved.securityQuestion).toBe('Couleur préférée ?')
    expect(saved.securityAnswer).toMatch(/^\$2[aby]\$/)
    expect(bcrypt.compareSync('bleu', saved.securityAnswer)).toBe(true)
  })

  // -------------------------------------------------------------------------
  // update
  // -------------------------------------------------------------------------
  it('5. update throws USER_NOT_FOUND when the user is missing', async () => {
    mockUserRepo.findOne.mockResolvedValue(null)

    await expect(service.update({ id: 999, displayName: 'X' })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    })
    expect(mockUserRepo.save).not.toHaveBeenCalled()
  })

  it('6. update applies displayName and role fields', async () => {
    const existing = {
      id: 3,
      username: 'u3',
      displayName: 'Old Name',
      role: 'professor',
      isActive: true,
      createdAt: new Date(),
      lastLoginAt: null,
    } as any
    mockUserRepo.findOne.mockResolvedValue(existing)
    mockUserRepo.save.mockImplementation(async (e: any) => e)

    const dto = await service.update({ id: 3, displayName: 'New Name', role: 'admin' })

    expect(existing.displayName).toBe('New Name')
    expect(existing.role).toBe('admin')
    expect(mockUserRepo.save).toHaveBeenCalledWith(existing)
    expect(dto.displayName).toBe('New Name')
    expect(dto.role).toBe('admin')
  })

  // -------------------------------------------------------------------------
  // setActive
  // -------------------------------------------------------------------------
  it('7. setActive refuses to deactivate the last active admin (LAST_ADMIN)', async () => {
    mockUserRepo.findOne.mockResolvedValue({
      id: 1,
      username: 'soleAdmin',
      role: 'admin',
      isActive: true,
    })
    mockUserRepo.count.mockResolvedValue(1)

    await expect(service.setActive({ id: 1, isActive: false })).rejects.toMatchObject({
      code: 'LAST_ADMIN',
    })
    await expect(service.setActive({ id: 1, isActive: false })).rejects.toThrow(
      'dernier administrateur actif'
    )
    expect(mockUserRepo.count).toHaveBeenCalledWith({ where: { role: 'admin', isActive: true } })
    expect(mockUserRepo.save).not.toHaveBeenCalled()
  })

  it('8. setActive allows deactivation when another active admin exists', async () => {
    const existing = { id: 1, username: 'adminA', role: 'admin', isActive: true } as any
    mockUserRepo.findOne.mockResolvedValue(existing)
    mockUserRepo.count.mockResolvedValue(2)
    mockUserRepo.save.mockImplementation(async (e: any) => e)

    const dto = await service.setActive({ id: 1, isActive: false })

    expect(existing.isActive).toBe(false)
    expect(dto.isActive).toBe(false)
  })

  it('9. setActive for non-admin does not consult the active-admin count', async () => {
    const existing = { id: 4, username: 'prof1', role: 'professor', isActive: true } as any
    mockUserRepo.findOne.mockResolvedValue(existing)
    mockUserRepo.save.mockImplementation(async (e: any) => e)

    await service.setActive({ id: 4, isActive: false })

    expect(mockUserRepo.count).not.toHaveBeenCalled()
    expect(existing.isActive).toBe(false)
  })

  it('10. setActive re-activating an admin is never blocked', async () => {
    const existing = { id: 1, username: 'adminA', role: 'admin', isActive: false } as any
    mockUserRepo.findOne.mockResolvedValue(existing)
    mockUserRepo.save.mockImplementation(async (e: any) => e)

    const dto = await service.setActive({ id: 1, isActive: true })

    expect(existing.isActive).toBe(true)
    expect(dto.isActive).toBe(true)
    expect(mockUserRepo.count).not.toHaveBeenCalled()
  })

  // -------------------------------------------------------------------------
  // resetPassword
  // -------------------------------------------------------------------------
  it('11. resetPassword hashes the new password and leaves isActive unchanged', async () => {
    const existing = {
      id: 1,
      username: 'admin1',
      displayName: null,
      role: 'admin',
      isActive: true,
      password: 'old-hash',
      createdAt: new Date(),
      lastLoginAt: null,
    } as any
    mockUserRepo.findOne.mockResolvedValue(existing)
    mockUserRepo.save.mockImplementation(async (e: any) => e)

    const dto = await service.resetPassword({ id: 1, newPassword: 'newpass123' })

    expect(bcrypt.compareSync('newpass123', existing.password)).toBe(true)
    expect(existing.isActive).toBe(true)
    expect(dto.isActive).toBe(true)
    expect(dto).not.toHaveProperty('password')
  })

  it('12. resetPassword throws USER_NOT_FOUND for a missing user', async () => {
    mockUserRepo.findOne.mockResolvedValue(null)

    await expect(service.resetPassword({ id: 999, newPassword: 'x' })).rejects.toMatchObject({
      code: 'USER_NOT_FOUND',
    })
  })

  // -------------------------------------------------------------------------
  // list + getById
  // -------------------------------------------------------------------------
  it('13. list with search uses Like OR-conditions, pagination and DTO without password', async () => {
    const users = [
      { id: 1, username: 'admin1', displayName: 'Admin Principal', role: 'admin', isActive: true, createdAt: new Date(), lastLoginAt: null },
      { id: 2, username: 'prof1', displayName: null, role: 'professor', isActive: false, createdAt: new Date(), lastLoginAt: null, password: 'should-not-leak' },
    ]
    mockUserRepo.findAndCount.mockResolvedValue([users, 2])

    const result = await service.list({ page: 1, pageSize: 10, search: 'adm' })

    const arg = mockUserRepo.findAndCount.mock.calls[0][0]
    expect(Array.isArray(arg.where)).toBe(true)
    expect(arg.where).toHaveLength(2)
    expect(arg.order).toEqual({ createdAt: 'DESC', id: 'DESC' })
    expect(arg.skip).toBe(0)
    expect(arg.take).toBe(10)

    expect(result.total).toBe(2)
    expect(result.items).toHaveLength(2)
    expect(result.items[0]).toEqual(
      expect.objectContaining({ username: 'admin1', role: 'admin', isActive: true })
    )
    expect(result.items[1]).toEqual(
      expect.objectContaining({ username: 'prof1', role: 'professor', isActive: false })
    )
    expect(result.items[0]).not.toHaveProperty('password')
    expect(result.items[1]).not.toHaveProperty('password')
  })

  it('14. list without search passes empty where and trims blank search', async () => {
    mockUserRepo.findAndCount.mockResolvedValue([[], 0])

    await service.list({ page: 2, pageSize: 20, search: '   ' })

    const arg = mockUserRepo.findAndCount.mock.calls[0][0]
    expect(arg.where).toEqual({})
    expect(arg.skip).toBe(20)
  })

  it('15. getById returns the DTO or null', async () => {
    mockUserRepo.findOne.mockResolvedValue({ id: 1, username: 'admin1', displayName: null, role: 'admin', isActive: true, createdAt: new Date(), lastLoginAt: null })

    const dto = await service.getById(1)
    expect(dto).toEqual(expect.objectContaining({ id: 1, username: 'admin1' }))
    expect(dto).not.toHaveProperty('password')

    mockUserRepo.findOne.mockResolvedValue(null)
    expect(await service.getById(999)).toBeNull()
  })
})