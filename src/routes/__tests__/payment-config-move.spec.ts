import { describe, it, expect, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useUserStore } from '@/stores/userStore'
import { AppItems, type MenuItem } from '@/components/util/AppItems'
import { filterMenu, isAllowedByRoles } from '@/utils/rbac'
import { accountingRoutes } from '@/routes/accounting'
import { fileRoutes } from '@/routes/file'
import type { AppUser, UserRole } from '@/types/user'

/**
 * Demande 4 — déplacement configuration des paiements dans Comptabilité.
 *
 * Couvre les deux couches RBAC :
 * - Couche 1 (menu) : `filterMenu(AppItems, ...)` — admin/comptable voient
 *   `submenu-3-10`, les autres rôles ne le voient pas.
 * - Couche 2 (guard) : `isAllowedByRoles` sur la meta de
 *   `/comptabilite/config-paiements` — admin/comptable passent (200),
 *   professor/student/undefined refusés (403 → redirect `/` côté guard).
 */

const mkUser = (role: UserRole): AppUser => ({
  id: role === 'admin' ? 1 : role === 'comptable' ? 3 : role === 'professor' ? 2 : 4,
  username: `${role}1`,
  displayName: role,
  role,
  isActive: true,
})

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

describe('demande 4 – route /comptabilite/config-paiements', () => {
  it('existe avec meta requiresAuth + roles admin,comptable', () => {
    const route = accountingRoutes.find((r) => r.path === '/comptabilite/config-paiements')
    expect(route, '/comptabilite/config-paiements doit exister dans accountingRoutes').toBeDefined()
    expect(route!.meta?.requiresAuth).toBe(true)
    expect(route!.meta?.roles).toEqual(['admin', 'comptable'])
  })

  it('pointe vers PayementConfigurationView.vue (lazy component défini)', () => {
    const route = accountingRoutes.find((r) => r.path === '/comptabilite/config-paiements')
    expect(route!.component).toBeDefined()
  })
})

describe('demande 4 – compat /payment-config en redirect', () => {
  it('/payment-config redirige vers /comptabilite/config-paiements sans component', () => {
    const legacy = (fileRoutes as Array<Record<string, unknown>>).find((r) => r.path === '/payment-config')
    expect(legacy, '/payment-config doit être conservé dans fileRoutes pour compat').toBeDefined()
    expect(legacy!.redirect).toBe('/comptabilite/config-paiements')
    expect(legacy!.component).toBeUndefined()
  })
})

describe('demande 4 – menu AppItems', () => {
  it('submenu-3-10 ajouté dans Comptabilité avec route + roles admin,comptable', () => {
    const submenu3 = AppItems.find((i) => i.id === 'submenu-3')
    expect(submenu3).toBeDefined()
    const item = (submenu3!.subItems ?? []).find((s) => s.id === 'submenu-3-10')
    expect(item, 'submenu-3-10 doit exister sous Comptabilité').toBeDefined()
    expect(item!.title).toBe('Config. paiements')
    expect(item!.route).toBe('/comptabilite/config-paiements')
    expect(item!.roles).toEqual(['admin', 'comptable'])
  })

  it('submenu-6-2-2 retiré de Paramètres (plus aucune entrée vers /payment-config)', () => {
    expect(collectIds(AppItems)).not.toContain('submenu-6-2-2')
    const allRoutes = collectIds(AppItems)
      .map((id) => id)
    expect(allRoutes).not.toContain('submenu-6-2-2')
    const submenu6 = AppItems.find((i) => i.id === 'submenu-6')
    const configAnnee = (submenu6!.subItems ?? []).find((s) => s.id === 'submenu-6-2')
    const routesAnnee = (configAnnee!.subItems ?? []).map((s) => s.route)
    expect(routesAnnee).not.toContain('/payment-config')
  })
})

describe('demande 4 – RBAC couche 1 (filterMenu)', () => {
  it('admin et comptable voient submenu-3-10', () => {
    for (const role of ['admin', 'comptable'] as UserRole[]) {
      const store = useUserStore()
      store.setUser(mkUser(role))
      const ids = collectIds(filterMenu(AppItems, (...r) => store.hasRole(...r)))
      expect(ids, `${role} doit voir submenu-3-10`).toContain('submenu-3-10')
    }
  })

  it('professor / student ne voient pas submenu-3-10', () => {
    for (const role of ['professor', 'student'] as UserRole[]) {
      const store = useUserStore()
      store.setUser(mkUser(role))
      const ids = collectIds(filterMenu(AppItems, (...r) => store.hasRole(...r)))
      expect(ids, `${role} ne doit pas voir submenu-3-10`).not.toContain('submenu-3-10')
    }
  })
})

describe('demande 4 – RBAC couche 2 (isAllowedByRoles → 403)', () => {
  const meta = { requiresAuth: true, roles: ['admin', 'comptable'] }

  it('admin / comptable autorisés (200)', () => {
    expect(isAllowedByRoles([meta], 'admin')).toBe(true)
    expect(isAllowedByRoles([meta], 'comptable')).toBe(true)
  })

  it('professor / student / anonyme refusés (403 → guard redirect /)', () => {
    expect(isAllowedByRoles([meta], 'professor')).toBe(false)
    expect(isAllowedByRoles([meta], 'student')).toBe(false)
    expect(isAllowedByRoles([meta], undefined)).toBe(false)
  })
})
