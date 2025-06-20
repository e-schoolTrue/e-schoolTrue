import { createRouter, createWebHashHistory } from 'vue-router'; 
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
                meta: { requiresAuth: true }
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
    // Redirection par défaut vers le dashboard
    {
        path: "/:pathMatch(.*)*",
        redirect: "/"
    }
];

const router = createRouter({
    history: createWebHashHistory(), // Changer ici
    routes
});

// Ajouter un guard pour rediriger vers /configuration-wizard au premier lancement
router.beforeEach(async (to, _from, next) => {
    console.log('Navigation vers:', to.path)
    console.log('État utilisateur:', localStorage.getItem('user'))
    
    // Liste des routes publiques qui ne nécessitent pas d'authentification
    const publicRoutes = ['/login', '/forgot-password', '/validate-account', '/configuration-wizard'];
    
    try {
        // Vérifier d'abord si c'est le premier lancement
        const response = await window.ipcRenderer.invoke('is-first-launch');
        console.log('Premier lancement ?', response.data)
        
        if (response.data && to.path !== '/configuration-wizard') {
            next('/configuration-wizard');
            return;
        }

        // Si ce n'est pas le premier lancement, vérifier l'authentification
        if (publicRoutes.includes(to.path)) {
            next();
            return;
        }

        // Vérifier si l'utilisateur est connecté
        const user = localStorage.getItem('user') || sessionStorage.getItem('user');
        console.log('Utilisateur trouvé:', user)
        
        if (!user && to.path !== '/login') {
            next('/login');
            return;
        }

        // Si l'utilisateur est sur /login et est déjà connecté, rediriger vers le dashboard
        if (to.path === '/login' && user) {
            next('/');
            return;
        }

        next();
    } catch (error) {
        console.error('Erreur lors de la vérification:', error);
        next('/login');
    }
});

export {router}
