import type { RouteRecordRaw } from 'vue-router'

export const profileRoutes: RouteRecordRaw[] = [
  {
    path: '/profil',
    name: 'profil',
    component: () => import('@/views/ProfileView.vue'),
    meta: { requiresAuth: true },
  },
]
