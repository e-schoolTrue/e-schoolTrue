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
import NotesConfigurationView from '@/views/file/NotesConfigurationView.vue';

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
    },
    {
        path: '/settings/notes',
        name: 'notes-configuration',
        component: NotesConfigurationView,
        meta: {
            title: 'Configuration des Notes'
        }
    }
];

const router = createRouter({
    history: createMemoryHistory(),
    routes
});

export {router}
