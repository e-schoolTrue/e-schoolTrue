import type { RouteRecordRaw } from 'vue-router'

/**
 * Routes de gestion des paiements (legacy, pré-comptabilité avancée).
 * `/payment/students` et `/payment/professors` sont exposées dans le
 * menu "Comptabilité" → restreintes aux rôles `admin` / `comptable`
 * via `meta.requiresAuth` + `meta.roles` (contrôlé dans le guard).
 * `/payment/mensuality` est VOLONTAIREMENT ouverte à tout utilisateur
 * authentifié (pas de `meta.roles`) : ce n'est pas un oubli. L'accès
 * anonyme reste bloqué en amont par le guard (`!appUser` → `/login`).
 */
export const paymentRoutes: RouteRecordRaw[] = [
  {
    path: "/payment/students",
    name: "StudentPayments",
    component: () => import("@/views/student/PaymentManagementView.vue"),
    meta: { requiresAuth: true, roles: ['admin', 'comptable'] },
  },
  {
    path: "/payment/professors",
    name: "ProfessorPayments",
    component: () => import("@/views/professor/ProfessorPaymentView.vue"),
    meta: { requiresAuth: true, roles: ['admin', 'comptable'] },
  },
  {
    path: "/payment/mensuality",
    name: "Mensuality",
    component: () => import("@/views/student/MensualityView.vue"),
  }
];