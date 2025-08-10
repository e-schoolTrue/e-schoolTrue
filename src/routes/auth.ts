import { RouteRecordRaw } from 'vue-router';

export const authRoutes: RouteRecordRaw[] = [
    {
        path : "/login" ,
        name : "login" ,
        component : () => import('@/views/auth/LoginView.vue'),
        meta: {
            requiresAuth: false
        }
    },
    {
        path : "/validate-account" ,
        name : "validate-account" ,
        component : () => import('@/views/auth/ValidateAccountView.vue'),
        meta: {
            requiresAuth: false
        }
    },
    {
        path : "/forgot-password" ,
        name : "forgot-password" ,
        component : () => import('@/views/auth/ForgotPasswordView.vue'),
        meta: {
            requiresAuth: false
        }
    }
]