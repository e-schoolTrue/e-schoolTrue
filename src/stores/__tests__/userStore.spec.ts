import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUserStore, USER_STORAGE_KEY } from '@/stores/userStore'
import type { AppUser } from '@/types/user'

const adminUser: AppUser = {
  id: 1,
  username: 'admin1',
  displayName: 'Admin Principal',
  role: 'admin',
  isActive: true,
}

const professorUser: AppUser = {
  id: 2,
  username: 'prof1',
  displayName: 'M. Dupont',
  role: 'professor',
  isActive: true,
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  sessionStorage.clear()
})

// ---------------------------------------------------------------------------
// Suite: setUser
// ---------------------------------------------------------------------------
describe('userStore – setUser', () => {
  it('sets the user in state and persists it under the "user" localStorage key', () => {
    const store = useUserStore()
    store.setUser(adminUser)

    expect(store.user).toEqual(adminUser)
    expect(JSON.parse(localStorage.getItem(USER_STORAGE_KEY)!)).toEqual(adminUser)
  })
})

// ---------------------------------------------------------------------------
// Suite: clear
// ---------------------------------------------------------------------------
describe('userStore – clear', () => {
  it('clears state and removes the "user" key from localStorage and sessionStorage', () => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(adminUser))
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(adminUser))

    const store = useUserStore()
    store.clear()

    expect(store.user).toBeNull()
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull()
    expect(sessionStorage.getItem(USER_STORAGE_KEY)).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Suite: hydrate
// ---------------------------------------------------------------------------
describe('userStore – hydrate', () => {
  it('reads a valid user from localStorage', () => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(adminUser))

    const store = useUserStore()
    expect(store.hydrate()).toEqual(adminUser)
    expect(store.user).toEqual(adminUser)
  })

  it('falls back to sessionStorage when localStorage is empty', () => {
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(professorUser))

    const store = useUserStore()
    expect(store.hydrate()).toEqual(professorUser)
  })

  it('prefers localStorage over sessionStorage when both are set', () => {
    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(adminUser))
    sessionStorage.setItem(USER_STORAGE_KEY, JSON.stringify(professorUser))

    const store = useUserStore()
    expect(store.hydrate()).toEqual(adminUser)
  })

  it('clears storage and returns null when the stored user has no role', () => {
    localStorage.setItem(
      USER_STORAGE_KEY,
      JSON.stringify({ id: 3, username: 'ghost', displayName: null })
    )

    const store = useUserStore()
    expect(store.hydrate()).toBeNull()
    expect(store.user).toBeNull()
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull()
  })

  it('purges a role-less legacy payload from sessionStorage when localStorage is empty', () => {
    sessionStorage.setItem(
      USER_STORAGE_KEY,
      JSON.stringify({ id: 3, username: 'ghost', displayName: null })
    )

    const store = useUserStore()
    expect(store.hydrate()).toBeNull()
    expect(store.user).toBeNull()
    expect(sessionStorage.getItem(USER_STORAGE_KEY)).toBeNull()
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull()
  })

  it('returns null and clears storage on malformed JSON', () => {
    localStorage.setItem(USER_STORAGE_KEY, '{ broken json')

    const store = useUserStore()
    expect(store.hydrate()).toBeNull()
    expect(localStorage.getItem(USER_STORAGE_KEY)).toBeNull()
  })

  it('returns null when no user is stored', () => {
    const store = useUserStore()
    expect(store.hydrate()).toBeNull()
    expect(store.user).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Suite: isAdmin / hasRole
// ---------------------------------------------------------------------------
describe('userStore – derived and helpers', () => {
  it('exposes isAdmin only for admin users', () => {
    const store = useUserStore()
    store.setUser(adminUser)
    expect(store.isAdmin).toBe(true)

    store.setUser(professorUser)
    expect(store.isAdmin).toBe(false)
  })

  it('hasRole matches the current user role', () => {
    const store = useUserStore()
    store.setUser(professorUser)

    expect(store.hasRole('professor')).toBe(true)
    expect(store.hasRole('admin')).toBe(false)
    expect(store.hasRole('admin', 'professor')).toBe(true)
  })

  it('hasRole returns false when no user is set', () => {
    const store = useUserStore()
    expect(store.hasRole('admin')).toBe(false)
  })
})