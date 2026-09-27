import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUserStore } from '@/stores/userStore'
import { ROLE_OPTIONS } from '@/constants/userOptions'
import { AppItems, type MenuItem } from '@/components/util/AppItems'
import { filterMenu, isAllowedByRoles } from '@/utils/rbac'
import { accountingRoutes } from '@/routes/accounting'
import { paymentRoutes } from '@/routes/payment'
import { adminRoutes } from '@/routes/admin'
import type { AppUser, UserRole } from '@/types/user'

/**
 * Suite RBAC rôle comptable (frontend).
 *
 * Couvre :
 * - userStore : isComptable / isAdminOrComptable / canAccessCompta
 * - ROLE_OPTIONS : les 4 rôles exposés (dont comptable)
 * - AppItems : tag admin+comptable sur tout submenu-3-*, admin seul sur submenu-admin
 * - Filtrage menu (vraie fonction `filterMenu` de `@/utils/rbac`,
 *   aussi importée par `dashbord-menu.vue`) :
 *   comptable voit compta mais pas admin, professor ne voit aucun compta
 * - Routes meta : accounting + payment restreintes admin/comptable, admin en requiresRole
 * - Guard router (vraie fonction `isAllowedByRoles` de `@/utils/rbac`,
 *   aussi importée par `src/routes/index.ts`) : professor/student
 *   redirigés sur /comptabilite/* et /payment/*, admin/comptable passent
 */

const mkUser = (role: UserRole): AppUser => ({
  id: role === 'admin' ? 1 : role === 'comptable' ? 3 : role === 'professor' ? 2 : 4,
  username: `${role}1`,
  displayName: role,
  role,
  isActive: true,
})

// NOTE : `filterMenu` et `isAllowedByRoles` sont importés de `@/utils/rbac`
// (single source partagée avec `dashbord-menu.vue` et `routes/index.ts`) —
// toute divergence casserait ces tests au lieu de passer en faux-positif.

function collectIds(items: MenuItem[]): string[] {
  const ids: string[] = []
  for (const item of items) {
    ids.push(item.id)
    if (item.subItems) ids.push(...collectIds(item.subItems))
  }
  return ids
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  sessionStorage.clear()
})

// ---------------------------------------------------------------------------
// 1. userStore : isComptable / isAdminOrComptable / canAccessCompta
// ---------------------------------------------------------------------------
describe('comptable – userStore getters', () => {
  it('isComptable est vrai uniquement pour le rôle comptable', () => {
    const store = useUserStore()
    for (const role of ['admin', 'professor', 'student', 'comptable'] as UserRole[]) {
      store.setUser(mkUser(role))
      expect(store.isComptable).toBe(role === 'comptable')
    }
  })

  it('isAdminOrComptable / canAccessCompta : matrice admin/comptable=true, professor/student=false, null=false', () => {
    const store = useUserStore()
    const matrix: Array<[UserRole | null, boolean]> = [
      ['admin', true],
      ['comptable', true],
      ['professor', false],
      ['student', false],
      [null, false],
    ]
    for (const [role, expected] of matrix) {
      if (role) store.setUser(mkUser(role))
      else store.clear()
      expect(store.isAdminOrComptable).toBe(expected)
      expect(store.canAccessCompta).toBe(expected)
      // canAccessCompta est un alias strict de isAdminOrComptable
      expect(store.canAccessCompta).toBe(store.isAdminOrComptable)
    }
  })

  it('isAdmin reste inchangé : vrai uniquement pour admin (comptable ≠ admin)', () => {
    const store = useUserStore()
    store.setUser(mkUser('comptable'))
    expect(store.isAdmin).toBe(false)
    expect(store.isComptable).toBe(true)
    store.setUser(mkUser('admin'))
    expect(store.isAdmin).toBe(true)
    expect(store.isComptable).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// 2. ROLE_OPTIONS : 4 rôles dont comptable
// ---------------------------------------------------------------------------
describe('comptable – ROLE_OPTIONS', () => {
  it('expose les 4 rôles admin/comptable/professor/student', () => {
    const values = ROLE_OPTIONS.map((o) => o.value).sort()
    expect(values).toEqual(['admin', 'comptable', 'professor', 'student'])
  })

  it('libellé français du rôle comptable', () => {
    expect(ROLE_OPTIONS.find((o) => o.value === 'comptable')?.label).toBe('Comptable')
  })
})

// ---------------------------------------------------------------------------
// 3. AppItems : taggage rôles
// ---------------------------------------------------------------------------
describe('comptable – AppItems taggage', () => {
  const comptaSubIds = [
    'submenu-3-1',
    'submenu-3-2',
    'submenu-3-3',
    'submenu-3-4',
    'submenu-3-5',
    'submenu-3-6',
    'submenu-3-7',
    'submenu-3-8',
    'submenu-3-9',
  ]

  it('toutes les entrées compta (3-1 → 3-9, y compris 3-2/3-3) sont taggées admin+comptable', () => {
    const submenu3 = AppItems.find((i) => i.id === 'submenu-3')
    expect(submenu3).toBeDefined()
    const byId = new Map((submenu3!.subItems ?? []).map((s) => [s.id, s]))
    for (const id of comptaSubIds) {
      const item = byId.get(id)
      expect(item, `${id} doit exister`).toBeDefined()
      expect(item!.roles).toEqual(['admin', 'comptable'])
    }
  })

  it('Administration reste réservée à admin seul', () => {
    const admin = AppItems.find((i) => i.id === 'submenu-admin')
    expect(admin?.roles).toEqual(['admin'])
  })
})

// ---------------------------------------------------------------------------
// 4. Filtrage menu (dashbord-menu.vue)
// ---------------------------------------------------------------------------
describe('comptable – filtrage menu', () => {
  it('comptable voit les items compta mais pas Administration', () => {
    const store = useUserStore()
    store.setUser(mkUser('comptable'))
    const ids = collectIds(filterMenu(AppItems, (...r) => store.hasRole(...r)))
    expect(ids).toContain('submenu-3-1')
    expect(ids).toContain('submenu-3-2')
    expect(ids).toContain('submenu-3-3')
    expect(ids).toContain('submenu-3-9')
    expect(ids).not.toContain('submenu-admin')
  })

  it('admin voit compta ET administration', () => {
    const store = useUserStore()
    store.setUser(mkUser('admin'))
    const ids = collectIds(filterMenu(AppItems, (...r) => store.hasRole(...r)))
    expect(ids).toContain('submenu-3-2')
    expect(ids).toContain('submenu-admin')
  })

  it('professor ne voit aucun item compta ni admin', () => {
    const store = useUserStore()
    store.setUser(mkUser('professor'))
    const ids = collectIds(filterMenu(AppItems, (...r) => store.hasRole(...r)))
    for (const id of ['submenu-3-1', 'submenu-3-2', 'submenu-3-3', 'submenu-3-9']) {
      expect(ids).not.toContain(id)
    }
    expect(ids).not.toContain('submenu-admin')
  })

  it('student ne voit aucun item compta ni admin', () => {
    const store = useUserStore()
    store.setUser(mkUser('student'))
    const ids = collectIds(filterMenu(AppItems, (...r) => store.hasRole(...r)))
    expect(ids).not.toContain('submenu-3-1')
    expect(ids).not.toContain('submenu-admin')
  })
})

// ---------------------------------------------------------------------------
// 5. Routes meta
// ---------------------------------------------------------------------------
describe('comptable – routes meta', () => {
  it('toutes les routes accounting exigent roles admin+comptable', () => {
    expect(accountingRoutes.length).toBeGreaterThan(0)
    for (const r of accountingRoutes) {
      expect(r.meta?.roles).toEqual(['admin', 'comptable'])
      expect(r.meta?.requiresAuth).toBe(true)
    }
  })

  it('/payment/students et /payment/professors exigent roles admin+comptable', () => {
    const byPath = new Map(paymentRoutes.map((r) => [r.path, r]))
    expect(byPath.get('/payment/students')?.meta?.roles).toEqual(['admin', 'comptable'])
    expect(byPath.get('/payment/professors')?.meta?.roles).toEqual(['admin', 'comptable'])
  })

  it('routes admin en legacy requiresRole=admin (comptable exclu)', () => {
    for (const r of adminRoutes) {
      expect(r.meta?.requiresRole).toBe('admin')
    }
  })
})

// ---------------------------------------------------------------------------
// 6. Guard router : matrice d'accès
// ---------------------------------------------------------------------------
describe('comptable – guard router', () => {
  const comptaMeta = { roles: ['admin', 'comptable'] }
  const adminLegacyMeta = { requiresRole: 'admin' }

  it.each([
    ['/comptabilite', comptaMeta],
    ['/encaissements', comptaMeta],
    ['/payment/students', comptaMeta],
    ['/payment/professors', comptaMeta],
    ['/caisse', comptaMeta],
    ['/depenses', comptaMeta],
  ])('admin + comptable passent sur %s, professor/student redirigés', (_path, meta) => {
    expect(isAllowedByRoles([meta], 'admin')).toBe(true)
    expect(isAllowedByRoles([meta], 'comptable')).toBe(true)
    expect(isAllowedByRoles([meta], 'professor')).toBe(false)
    expect(isAllowedByRoles([meta], 'student')).toBe(false)
    expect(isAllowedByRoles([meta], undefined)).toBe(false)
  })

  it('comptable est redirigé sur les routes admin legacy (/utilisateurs, /journal-activite)', () => {
    expect(isAllowedByRoles([adminLegacyMeta], 'admin')).toBe(true)
    expect(isAllowedByRoles([adminLegacyMeta], 'comptable')).toBe(false)
    expect(isAllowedByRoles([adminLegacyMeta], 'professor')).toBe(false)
  })
})
