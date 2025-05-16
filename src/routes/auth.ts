import { RouteRecordRaw } from 'vue-router';
import LoginView from "@/views/auth/LoginView.vue";
import ValidateAccountView from "@/views/auth/ValidateAccountView.vue";
import ForgotPasswordView from "@/views/auth/ForgotPasswordView.vue";


export const authRoutes: RouteRecordRaw[] = [
    {
        path : "/login" ,
        name : "login" ,
        component : LoginView ,
        meta: {
            requiresAuth: false
        }
    },
    {
        path : "/validate-account" ,
        name : "validate-account" ,
        component : ValidateAccountView ,
    },
    {
        path : "/forgot-password" ,
        name : "forgot-password" ,
        component : ForgotPasswordView ,
        meta: {
            requiresAuth: false
        }
    },
]