import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import * as bcrypt from 'bcryptjs'

// ---- Hoisted shared mocks ----
const mockStore = vi.hoisted(() => ({
  get: vi.fn().mockReturnValue(null),
  set: vi.fn(),
  delete: vi.fn(),
}))

const mockSupabase = vi.hoisted(() => ({
  auth: {
    getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
    signOut: vi.fn().mockResolvedValue({ error: null }),
    signInWithPassword: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
    signUp: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
  },
}))

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => '/tmp/e-school-auth-test'),
  },
}))

vi.mock('electron-store', () => ({
  __esModule: true,
  default: class {
    get = mockStore.get
    set = mockStore.set
    delete = mockStore.delete
  },
}))

vi.mock('#electron/config/supabase', () => ({
  supabaseConfig: { url: 'https://test.supabase.co', key: 'test-key' },
}))
vi.mock('../../../config/supabase', () => ({
  supabaseConfig: { url: 'https://test.supabase.co', key: 'test-key' },
}))

const mockClearSchemaClients = vi.hoisted(() => vi.fn())

vi.mock('#electron/backend/lib/supabaseClient', () => ({
  supabase: mockSupabase,
  clearSchemaClients: mockClearSchemaClients,
}))
vi.mock('../../lib/supabaseClient', () => ({
  supabase: mockSupabase,
  clearSchemaClients: mockClearSchemaClients,
}))

vi.mock('#electron/backend/lib/session', () => ({
  setCurrentSupabaseUserId: vi.fn(),
  getCurrentSupabaseUserId: vi.fn(() => null),
}))
vi.mock('../../lib/session', () => ({
  setCurrentSupabaseUserId: vi.fn(),
  getCurrentSupabaseUserId: vi.fn(() => null),
}))

vi.mock('../../../data-source', () => ({
  AppDataSource: {
    getInstance: vi.fn(),
    initialize: vi.fn(),
  },
}))

import { AuthService } from '../authService'
import { AppDataSource } from '../../../data-source'

describe('AuthService', () => {
  let service: AuthService
  let mockUserRepo: any
  let mockDataSource: any
  let mockUser: any

  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})

    // restoreAllMocks() in afterEach resets module-level mocks: re-apply defaults.
    mockStore.get.mockReturnValue(null)
    mockSupabase.auth.getUser.mockResolvedValue({ data: { user: null }, error: null })
    mockSupabase.auth.getSession.mockResolvedValue({ data: { session: null }, error: null })
    mockSupabase.auth.signOut.mockResolvedValue({ error: null })
    mockSupabase.auth.signInWithPassword.mockResolvedValue({ data: { user: null }, error: null })
    mockSupabase.auth.signUp.mockResolvedValue({ data: { user: null }, error: null })

    mockUser = {
      id: 7,
      username: 'admin1',
      password: bcrypt.hashSync('secret123', 4),
      role: 'admin',
      displayName: 'Admin Principal',
      isActive: true,
      securityQuestion: 'Question ?',
      securityAnswer: 'answer',
      lastLoginAt: null,
    }

    mockUserRepo = {
      findOne: vi.fn().mockResolvedValue(mockUser),
      create: vi.fn((e: any) => e),
      save: vi.fn(async (e: any) => e),
    }

    mockDataSource = {
      getRepository: vi.fn((entity: any) => {
        const name = entity?.name ?? ''
        if (name === 'UserEntity') return mockUserRepo
        return mockUserRepo
      }),
    }

    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDataSource as any)

    service = new AuthService()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // -------------------------------------------------------------------------
  // validateSupervisor – error paths
  // -------------------------------------------------------------------------
  it('1. login of an inactive account returns ACCOUNT_DISABLED and null currentUser', async () => {
    mockUser.isActive = false

    const result = await service.validateSupervisor('admin1', 'secret123')

    expect(result.success).toBe(false)
    expect(result.error).toBe('ACCOUNT_DISABLED')
    expect(result.message).toContain('désactivé')
    expect(await service.getCurrentUser()).toBeNull()
    expect(mockUserRepo.save).not.toHaveBeenCalled()
    expect(mockStore.set).not.toHaveBeenCalled()
  })

  it('2. login with wrong password returns INVALID_PASSWORD and null currentUser', async () => {
    const result = await service.validateSupervisor('admin1', 'wrong-password')

    expect(result.success).toBe(false)
    expect(result.error).toBe('INVALID_PASSWORD')
    expect(result.message).toBe('Mot de passe incorrect')
    expect(await service.getCurrentUser()).toBeNull()
  })

  it('3. login of an unknown user returns USER_NOT_FOUND and null currentUser', async () => {
    mockUserRepo.findOne.mockResolvedValue(null)

    const result = await service.validateSupervisor('ghost', 'secret123')

    expect(result.success).toBe(false)
    expect(result.error).toBe('USER_NOT_FOUND')
    expect(await service.getCurrentUser()).toBeNull()
  })

  // -------------------------------------------------------------------------
  // validateSupervisor – success path
  // -------------------------------------------------------------------------
  it('4. login success enriches currentUser with role/displayName/isActive', async () => {
    const result = await service.validateSupervisor('admin1', 'secret123')

    expect(result.success).toBe(true)
    expect(result.data).toEqual(
      expect.objectContaining({
        id: 7,
        username: 'admin1',
        displayName: 'Admin Principal',
        role: 'admin',
        isActive: true,
      })
    )
    expect(result.error).toBeNull()
  })

  it('5. login success updates lastLoginAt, persists via repo.save and store.set', async () => {
    await service.validateSupervisor('admin1', 'secret123')

    expect(mockUser.lastLoginAt).toBeInstanceOf(Date)
    expect(mockUserRepo.save).toHaveBeenCalledTimes(1)
    expect(mockStore.set).toHaveBeenCalledWith(
      'currentUser',
      expect.objectContaining({
        id: 7,
        username: 'admin1',
        displayName: 'Admin Principal',
        role: 'admin',
        isActive: true,
      })
    )
  })

  it('6. getCurrentUser returns the full shape after a successful login', async () => {
    await service.validateSupervisor('admin1', 'secret123')

    const current = await service.getCurrentUser()
    expect(current).toEqual(
      expect.objectContaining({
        id: 7,
        username: 'admin1',
        displayName: 'Admin Principal',
        role: 'admin',
        isActive: true,
      })
    )
  })

  it('7. getCurrentUser is null before any login', async () => {
    expect(await service.getCurrentUser()).toBeNull()
  })

  // -------------------------------------------------------------------------
  // init / logout
  // -------------------------------------------------------------------------
  it('8. init restores the currentUser from the store', async () => {
    const stored = { id: 7, username: 'admin1', role: 'admin', displayName: 'Admin Principal', isActive: true }
    mockStore.get.mockReturnValue(stored)

    await service.init()

    expect(mockStore.get).toHaveBeenCalledWith('currentUser')
    expect(await service.getCurrentUser()).toEqual(stored)
  })

  it('9. logout clears the currentUser', async () => {
    await service.validateSupervisor('admin1', 'secret123')
    expect(await service.getCurrentUser()).not.toBeNull()

    await service.logout()

    expect(await service.getCurrentUser()).toBeNull()
  })

  it('10. logout purges persisted currentUser (no ghost login on restart)', async () => {
    await service.validateSupervisor('admin1', 'secret123')

    await service.logout()

    expect(mockStore.delete).toHaveBeenCalledWith('currentUser')
    expect(await service.getCurrentUser()).toBeNull()
  })

  it('11. signOutFromSupabase purges session + supabaseUser + schema clients (best-effort offline)', async () => {
    const { setCurrentSupabaseUserId } = await import('../../lib/session')

    await service.signOutFromSupabase()

    expect(mockSupabase.auth.signOut).toHaveBeenCalled()
    expect(setCurrentSupabaseUserId).toHaveBeenCalledWith(null)
    expect(mockStore.delete).toHaveBeenCalledWith('supabaseUser')
    expect(mockClearSchemaClients).toHaveBeenCalled()
  })

  it('12. signOutFromSupabase still purges local even if supabase.signOut throws (offline)', async () => {
    mockSupabase.auth.signOut.mockRejectedValueOnce(new Error('network offline'))
    const { setCurrentSupabaseUserId } = await import('../../lib/session')

    await service.signOutFromSupabase()

    expect(setCurrentSupabaseUserId).toHaveBeenCalledWith(null)
    expect(mockStore.delete).toHaveBeenCalledWith('supabaseUser')
    expect(mockClearSchemaClients).toHaveBeenCalled()
  })

  it('13. init purges invalid stored currentUser (fail-closed)', async () => {
    mockStore.get.mockReturnValue({ username: 'admin1' } as any)

    await service.init()

    expect(await service.getCurrentUser()).toBeNull()
    expect(mockStore.delete).toHaveBeenCalledWith('currentUser')
  })

  it('14. init accepte un id string numerique legacy et le normalise en number', async () => {
    mockStore.get.mockReturnValue({ id: '7', username: 'admin1', role: 'admin' } as any)

    await service.init()

    expect(await service.getCurrentUser()).toEqual(
      expect.objectContaining({ id: 7, username: 'admin1', role: 'admin', displayName: null, isActive: true })
    )
    // Auto-réparation : réécriture normalisée.
    expect(mockStore.set).toHaveBeenCalledWith('currentUser', expect.objectContaining({ id: 7 }))
  })

  it('15. init accepte les 4 roles valides (admin/professor/student/comptable) et purge un role inconnu', async () => {
    mockStore.get.mockReturnValue({ id: 3, username: 'c1', role: 'comptable' } as any)
    await service.init()
    expect(await service.getCurrentUser()).toEqual(expect.objectContaining({ id: 3, role: 'comptable' }))

    mockStore.get.mockReturnValue({ id: 3, username: 'c1', role: 'superuser' } as any)
    await service.init()
    expect(await service.getCurrentUser()).toBeNull()
    expect(mockStore.delete).toHaveBeenCalledWith('currentUser')
  })

  it('16. init ne fait jamais echouer le demarrage si Supabase est injoignable (offline)', async () => {
    mockStore.get.mockReturnValue({ id: 7, username: 'admin1', role: 'admin' } as any)
    mockSupabase.auth.getUser.mockRejectedValueOnce(new Error('network offline'))

    await expect(service.init()).resolves.toBeUndefined()
    // La session locale reste restaurée même sans cloud.
    expect(await service.getCurrentUser()).toEqual(expect.objectContaining({ id: 7, username: 'admin1' }))
  })
})