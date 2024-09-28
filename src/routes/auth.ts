import LoginView from "@/views/auth/LoginView.vue";
import ValidateAccountView from "@/views/auth/ValidateAccountView.vue";
import ForgotPasswordView from "@/views/auth/ForgotPasswordView.vue";


export const authRoutes = [
    {
        path : "/login" ,
        name : "login" ,
        component : LoginView ,
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
    },
    {
        path : "/forgot-password" ,
        name : "forgot-password" ,
        component : ForgotPasswordView ,
    },
]