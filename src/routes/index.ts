import { createRouter, createWebHashHistory } from 'vue-router'; 
const HomeView = () => import('@/views/HomeView.vue');
const DashboardView = () => import('@/views/DashboardView.vue');
const ConfigurationWizard = () => import('@/views/ConfigurationWizard.vue');
import {fileRoutes} from "@/routes/file.ts";
import {studentRoutes} from "@/routes/student.ts";
import {authRoutes} from "@/routes/auth.ts";
import omboardingRoutes from "@/routes/onboarding.ts";
import {professorRoutes} from "@/routes/professor";
import {toolRoutes} from '@/routes/tool';
import {planningRoutes} from '@/routes/planning';
import {paymentRoutes} from '@/routes/payment';
import {accountingRoutes} from '@/routes/accounting';
import {adminRoutes} from '@/routes/admin';
import {profileRoutes} from '@/routes/profile';
import {useUserStore} from '@/stores/userStore';


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
            ...paymentRoutes,
            ...accountingRoutes,
            ...adminRoutes,
            ...profileRoutes
        ]
    },
    ...authRoutes,
    {
        path: "/onboarding",
        children: omboardingRoutes
    },
    {
        path: "/:pathMatch(.*)*",
        redirect: "/"
    }
];

const router = createRouter({
    history: createWebHashHistory(), // Changer ici
    routes
});

/**
 * Vérifie la session côté backend (`auth:checkStatus`) avec timeout court.
 *
 * @returns `true` si authentifié, `false` si le backend dit non,
 *   `null` si indéterminé (IPC absent en dev web, timeout, erreur) → fail-open,
 *   le backend reste garde-fou (UNAUTHENTICATED/FORBIDDEN).
 */
async function checkBackendSession(timeoutMs = 2500): Promise<boolean | null> {
    const ipc = (window as unknown as { ipcRenderer?: { invoke: (c: string, ...a: unknown[]) => Promise<unknown> } }).ipcRenderer;
    if (!ipc || typeof ipc.invoke !== 'function') return null;
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
        const result = await Promise.race([
            ipc.invoke('auth:checkStatus'),
            new Promise<never>((_, reject) => {
                timer = setTimeout(() => reject(new Error('Timeout auth:checkStatus')), timeoutMs);
            }),
        ]) as { success?: boolean; data?: { isAuthenticated?: boolean } | null } | null;
        const flag = result?.data?.isAuthenticated;
        if (typeof flag === 'boolean') return flag;
        return null;
    } catch {
        return null;
    } finally {
        if (timer !== undefined) clearTimeout(timer);
    }
}

// Ajouter un guard pour rediriger vers /configuration-wizard au premier lancement
router.beforeEach(async (to, _from, next) => {
    // Navigation guard : pas de log du payload utilisateur (PII).

    // Liste des routes publiques qui ne nécessitent pas d'authentification
    const publicRoutes = ['/login', '/forgot-password', '/validate-account', '/configuration-wizard'];
    
    // Le userStore est la seule source de vérité pour la clé 'user'.
    // Pinia est installé AVANT le router dans src/main.ts, l'appel est donc sûr ici.
    const userStore = useUserStore();

    try {
        // Vérifier d'abord si c'est le premier lancement
        const response = await window.ipcRenderer.invoke('is-first-launch');
        console.log('Premier lancement ?', response.data)
        
        if (response.data && to.path !== '/configuration-wizard') {
            next('/configuration-wizard');
            return;
        }

        // Hydrater le store depuis localStorage/sessionStorage (renvoie null
        // si la session est absente ou invalide, auquel cas les clés sont purgées).
        let appUser = userStore.hydrate();

        // Revalidation backend best-effort : après un restart Electron le backend
        // peut être déconnecté alors que localStorage contient encore un user,
        // ce qui faisait exploser users:list en UNAUTHENTICATED sur /admin.
        // Fail-open si IPC absent (dev web) ou timeout : on laisse passer.
        if (appUser) {
            const backendAuth = await checkBackendSession(2500);
            if (backendAuth === false) {
                userStore.clear();
                appUser = null;
                if (to.path !== '/login') {
                    next('/login');
                    return;
                }
            }
        }

        // Si ce n'est pas le premier lancement, vérifier l'authentification
        if (publicRoutes.includes(to.path)) {
            next();
            return;
        }

        // Vérifier si l'utilisateur est connecté
        if (!appUser && to.path !== '/login') {
            next('/login');
            return;
        }

        // Si l'utilisateur est sur /login et est déjà connecté, rediriger vers le dashboard
        if (to.path === '/login' && appUser) {
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
