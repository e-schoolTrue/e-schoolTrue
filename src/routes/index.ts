// @ts-nocheck
import {createMemoryHistory, createRouter, createWebHashHistory} from 'vue-router'
import HomeView from "@/views/HomeView.vue";
import DashboardView from "@/views/DashboardView.vue";
import {fileRoutes} from "@/routes/file.ts";
import {studentRoutes} from "@/routes/student.ts";
import {authRoutes} from "@/routes/auth.ts";
import {omboardingRoutes} from "@/routes/onboarding.ts";
import {professorRoutes} from "@/routes/professor";
import {toolRoutes} from '@/routes/tool';
import {planningRoutes} from '@/routes/planning';
import {paymentRoutes} from '@/routes/payment';


const routes = [
    {
        path: "/",
        component: HomeView,
        children: [
            {
                path: "",
                name: "dashboard",
                component: DashboardView,
            },
            ...fileRoutes,
            ...studentRoutes,
            ...professorRoutes,
            ...toolRoutes,
            ...planningRoutes,
            ...paymentRoutes
        ]
    },
    ...authRoutes,
    {
        path: "/onboarding",
        children: omboardingRoutes
    }
];

const router = createRouter({
    history: createMemoryHistory(),
    routes
});

export {router}
