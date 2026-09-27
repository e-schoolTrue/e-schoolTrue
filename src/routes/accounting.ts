import type { RouteRecordRaw } from 'vue-router'

/**
 * Routes comptabilité avancée (9 écrans).
 * Enfants de HomeView, restreintes aux rôles `admin` / `comptable`
 * via `meta.requiresAuth` + `meta.roles`.
 */
export const accountingRoutes: RouteRecordRaw[] = [
  {
    path: '/comptabilite',
    name: 'AccountingDashboard',
    component: () => import('@/views/accounting/AccountingDashboardView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'comptable'] },
  },
  {
    path: '/encaissements',
    name: 'AccountingEncaissements',
    component: () => import('@/views/accounting/StudentPaymentView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'comptable'] },
  },
  {
    path: '/recus/:id',
    name: 'AccountingReceipt',
    component: () => import('@/views/accounting/ReceiptView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'comptable'] },
  },
  {
    path: '/impayes',
    name: 'AccountingArrears',
    component: () => import('@/views/accounting/ArrearsView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'comptable'] },
  },
  {
    path: '/depenses',
    name: 'AccountingExpenses',
    component: () => import('@/views/accounting/ExpenseView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'comptable'] },
  },
  {
    path: '/enseignants',
    name: 'AccountingTeachers',
    redirect: '/payment/professors?tab=heures',
    meta: { requiresAuth: true, roles: ['admin', 'comptable'] },
  },
  {
    path: '/bulletins/:id',
    name: 'AccountingSlip',
    redirect: (to) => ({ path: '/payment/professors', query: { tab: 'bulletins', id: String((to.params as Record<string, string>).id ?? '') } }),
    meta: { requiresAuth: true, roles: ['admin', 'comptable'] },
  },
  {
    path: '/caisse',
    name: 'AccountingCash',
    component: () => import('@/views/accounting/CashRegisterView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'comptable'] },
  },
  {
    path: '/rapports',
    name: 'AccountingReports',
    component: () => import('@/views/accounting/FinancialReportsView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'comptable'] },
  },
  {
    path: '/comptabilite/setup',
    name: 'AccountingSetup',
    component: () => import('@/views/accounting/AccountingSetupView.vue'),
    meta: { requiresAuth: true, roles: ['admin', 'comptable'] },
  },
]
