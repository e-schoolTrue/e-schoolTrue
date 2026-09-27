import type { RouteRecordRaw } from 'vue-router'

/**
 * Routes d'administration (gestion des utilisateurs + journal d'activité).
 * Enfants de HomeView, restreintes au rôle 'admin' via `meta.requiresRole`
 * (contrôlé dans le guard de src/routes/index.ts).
 */
export const adminRoutes: RouteRecordRaw[] = [
  {
    path: '/utilisateurs',
    name: 'users',
    component: () => import('@/views/admin/UserManagementView.vue'),
    meta: { requiresAuth: true, requiresRole: 'admin' },
  },
  {
    path: '/journal-activite',
    name: 'audit-log',
    component: () => import('@/views/admin/AuditLogView.vue'),
    meta: { requiresAuth: true, requiresRole: 'admin' },
  },
]