export const fileRoutes = [
    {
        path: '/grade',
        name: "Niveau scolaire",
        component: () => import('@/views/file/GradeView.vue')
    },
    {
        path: '/classroom',
        name: "Salles de classe",
        component: () => import('@/views/file/ClassRoomView.vue')
    },
    {
        path: '/course',
        name: "Matières",
        component: () => import('@/views/file/CourseView.vue')
    },
    {
        path: '/payment-config',
        name: "Configuration des paiements",
        component: () => import('@/views/file/PayementConfigurationView.vue')
    },
    {
        path: '/info-school',
        name: "Info école",
        component: () => import('@/views/file/SchoolInfoView.vue')
    },
    {
        path: '/school-repartition',
        name: "Répartition année scolaire",
        component: () => import('@/views/file/YearRepartitionView.vue')
    },
    {
        path: '/change-password',
        name: "Changement de mot de passe",
        component: () => import('@/views/auth/ForgotPasswordView.vue')
    },
    {
        path: '/license-status',
        name: "Statut de la licence",
        component: () => import('@/views/file/LicenseStatusView.vue')
    },
    {
        path: '/note-config',
        name: "Configuration de la notation",
        component: () => import('@/views/file/NoteConfigView.vue')
    },
    {
        path: '/centralized-notes',
        name: "Fiche de centralisation",
        component: () => import('@/views/tools/CentralizedGradesView.vue')
    },
    {
        path: '/apparence',
        name: 'Apparence',
        component: () => import('@/views/settings/ApparenceView.vue')
    }
]