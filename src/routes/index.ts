// @ts-nocheck
import {createMemoryHistory, createRouter, createWebHashHistory} from 'vue-router'
import HomeView from "@/views/HomeView.vue";
import DashboardView from "@/views/DashboardView.vue";
import ConfigurationWizard from "@/views/ConfigurationWizard.vue";
import {fileRoutes} from "@/routes/file.ts";
import {studentRoutes} from "@/routes/student.ts";
import {authRoutes} from "@/routes/auth.ts";
import omboardingRoutes from "@/routes/onboarding.ts";
import {professorRoutes} from "@/routes/professor";
import {toolRoutes} from '@/routes/tool';
import {planningRoutes} from '@/routes/planning';
import {paymentRoutes} from '@/routes/payment';


const routes = [
    {
        path: "/configuration-wizard",
        name: "configuration-wizard",
        component: ConfigurationWizard
    },
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

// Ajouter un guard pour rediriger vers /configuration-wizard au premier lancement
router.beforeEach(async (to, from, next) => {
    if (to.path !== '/configuration-wizard') {
        try {
            const response = await window.ipcRenderer.invoke('is-first-launch');
            if (response.data) {
                next('/configuration-wizard');
            } else {
                next();
            }
        } catch (error) {
            console.error('Erreur lors de la vérification du premier lancement:', error);
            next();
        }
    } else {
        next();
    }
});

export {router}
