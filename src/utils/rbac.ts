import type { MenuItem } from '@/components/util/AppItems'
import type { UserRole } from '@/types/user'

/**
 * RBAC frontend — single source of truth (menu + guard router).
 *
 * INTENTION PRODUIT (rôle `comptable`, validée backend deny-by-default) :
 * - Le menu `AppItems` taggue explicitement `roles: ['admin', 'comptable']`
 *   sur tout `submenu-3-*` (Comptabilité) et `roles: ['admin']` sur
 *   `submenu-admin` (Administration).
 * - Toutes les autres sections (Gestion Élèves / Professeurs / Plannings /
 *   Outils / Paramètres) n'ont PAS de `roles` → visibles par tout utilisateur
 *   authentifié, y compris `comptable`. C'est un choix conscient : le backend
 *   reste l'autorité (deny-by-default, `UNAUTHENTICATED` / `FORBIDDEN`), le
 *   frontend ne fait que du defense-in-depth (masquage menu + guard router).
 * - Si la spec évolue vers « compta seule » pour `comptable`, il suffira de
 *   tagguer les sections concernées avec `roles` — sans toucher cet util.
 *
 * @see {@link import('@/components/util/AppItems').AppItems} — taggage `roles` par entrée.
 * @see `src/routes/index.ts` — guard router consommateur de {@link isAllowedByRoles}.
 * @see `src/components/dashbord-menu.vue` — menu consommateur de {@link filterMenu}.
 */

/** Meta minimale lue par le guard (sous-ensemble de `RouteMeta`). */
export interface RouteRoleMeta {
  roles?: string[]
  requiresRole?: string
}

/**
 * Filtre récursivement le menu par rôle courant.
 *
 * - Une entrée sans `roles` est visible par tout utilisateur authentifié.
 * - Une entrée avec `roles` n'est visible que si `hasRole(...roles)` est vrai.
 * - Récursif sur `subItems` (3 niveaux : ex. Plannings).
 * - Un parent sans `route` dont tous les enfants sont filtrés est masqué.
 *
 * @param items - Entrées menu à filtrer (ne sont pas mutées, clones si `subItems` filtrés).
 * @param hasRole - Prédicat rôle (typiquement `userStore.hasRole` bindé).
 * @returns Nouvelles entrées visibles, structure préservée.
 *
 * @example
 * filterMenu(AppItems, (...r) => userStore.hasRole(...r))
 */
export function filterMenu(
  items: MenuItem[],
  hasRole: (...roles: UserRole[]) => boolean,
): MenuItem[] {
  const out: MenuItem[] = []
  for (const item of items) {
    if (item.roles && !hasRole(...item.roles)) continue
    const sub = item.subItems ? filterMenu(item.subItems, hasRole) : undefined
    if (item.subItems && (!sub || sub.length === 0) && !item.route) continue
    out.push(sub ? { ...item, subItems: sub } : item)
  }
  return out
}

/**
 * Décide l'accès route à partir des metas matchées (`to.matched[*].meta`).
 *
 * Sémantique (identique au guard historique) :
 * - `meta.roles: string[]` (compta : `['admin', 'comptable']`) — le rôle doit
 *   être inclus dès qu'au moins une meta matchée en déclare.
 * - `meta.requiresRole: string` legacy (admin : `'admin'`) — égalité stricte.
 * - Sans contrainte déclarée → autorisé (l'authentification reste vérifiée
 *   en amont par le guard : redirection `/login` si pas de session).
 *
 * @param matchedMetas - Metas des routes matchées (`to.matched.map(r => r.meta)`).
 * @param role - Rôle courant (`appUser?.role`), `undefined` si non connecté.
 * @returns `true` si le rôle satisfait toutes les contraintes, `false` sinon.
 *
 * @example
 * isAllowedByRoles(to.matched.map((r) => r.meta), appUser?.role)
 */
export function isAllowedByRoles(
  matchedMetas: readonly RouteRoleMeta[],
  role: string | undefined,
): boolean {
  const requiredRoles = matchedMetas.flatMap((m) => m.roles ?? [])
  const legacyRole = matchedMetas.map((m) => m.requiresRole).find(Boolean)
  return (
    (requiredRoles.length > 0 ? !!role && requiredRoles.includes(role) : true) &&
    (legacyRole ? !!role && role === legacyRole : true)
  )
}
