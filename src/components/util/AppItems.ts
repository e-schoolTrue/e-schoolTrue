import type { UserRole } from '@/types/user'

export interface MenuItem {
    id: string;
    title: string;
    icon: string;
    route?: string;
    description?: string;
    /** Si défini, l'entrée n'est visible que pour les rôles listés. */
    roles?: UserRole[];
    subItems?: MenuItem[];
}

export const AppItems: MenuItem[] = [
    {
        id: "submenu-1",
        title: "Gestion des Elèves",
        icon: "mdi:account-school",
        subItems: [
            {
                id: "submenu-1-1",
                title: "Nouvelle Inscription",
                icon: "mdi:account-plus",
                route: "/student/add",
                subItems: []
            },
            {
                id: "submenu-1-2",
                title: "Elèves",
                icon: "mdi:account-group",
                route: "/student",
                subItems: []
            },
            {
                id: "submenu-1-3",
                title: "Réinscriptions",
                icon: "mdi:account-convert",
                route: "/student/re-enrollment",
                subItems: []
            },
        ]
    },
    {
        id: "submenu-2",
        title: "Gestion des Professeurs",
        icon: "mdi:human-male-board",
        subItems: [
            {
                id: "submenu-2-1",
                title: "Nouvelle Inscription",
                icon: "mdi:account-plus",
                route: "/professor/add",
            },
            {
                id: "submenu-2-2",
                title: "Liste des Professeurs",
                icon: "mdi:account-tie",
                route: "/professor",
            }
        ]
    },
    {
        id: "submenu-3",
        title: "Comptabilité",
        icon: "mdi:cash-register",
        subItems: [
            {
                id: "submenu-3-1",
                title: "Tableau de bord",
                icon: "mdi:view-dashboard-outline",
                route: "/comptabilite",
                roles: ['admin', 'comptable']
            },
            {
                id: "submenu-3-2",
                title: "Paiements Élèves",
                icon: "mdi:cash",
                route: "/payment/students",
                description: "Gérer les frais de scolarité et autres paiements",
                roles: ['admin', 'comptable']
            },
            {
                id: "submenu-3-3",
                title: "Bulletins Paie",
                icon: "mdi:cash-multiple",
                route: "/payment/professors?tab=bulletins",
                description: "Bulletins enseignants (PAY-ENS)",
                roles: ['admin', 'comptable']
            },
            {
                id: "submenu-3-4",
                title: "Encaissements",
                icon: "mdi:cash-register",
                route: "/encaissements",
                roles: ['admin', 'comptable']
            },
            {
                id: "submenu-3-5",
                title: "Impayés",
                icon: "mdi:alert-circle-outline",
                route: "/impayes",
                roles: ['admin', 'comptable']
            },
            {
                id: "submenu-3-6",
                title: "Dépenses",
                icon: "mdi:cart-outline",
                route: "/depenses",
                roles: ['admin', 'comptable']
            },
            {
                id: "submenu-3-7",
                title: "Paie Profs",
                icon: "mdi:cash-multiple",
                route: "/payment/professors?tab=heures",
                description: "Heures mensuelles enseignants",
                roles: ['admin', 'comptable']
            },
            {
                id: "submenu-3-8",
                title: "Caisse",
                icon: "mdi:safe",
                route: "/caisse",
                roles: ['admin', 'comptable']
            },
            {
                id: "submenu-3-9",
                title: "Rapports",
                icon: "mdi:file-chart-outline",
                route: "/rapports",
                roles: ['admin', 'comptable']
            }
        ]
    },
    {
        id: "submenu-4",
        title: "Gestion des Plannings",
        icon: "fluent-emoji:calendar",
        subItems: [
            {
                id: "submenu-4-1",
                title: "Planning Élèves",
                icon: "fluent-emoji:spiral-calendar",
                subItems: [
                    {
                        id: "submenu-4-1-1",
                        title: "Absences",
                        icon: "fluent-emoji:cross-mark",
                        route: "/planning/students/absences",
                    },
                    {
                        id: "submenu-4-1-2",
                        title: "Planning Devoirs",
                        icon: "fluent-emoji:memo",
                        route: "/planning/students/homework",
                    },
                    {
                        id: "submenu-4-1-3",
                        title: "Congés",
                        icon: "fluent-emoji:beach-with-umbrella",
                        route: "/planning/students/vacation",
                    },
                    {
                        id: "submenu-4-1-4",
                        title: "Emploi du temps",
                        icon: "fluent-emoji:calendar",
                        route: "/planning/students/planning",
                    }
                ]
            },
            {
                id: "submenu-4-2",
                title: "Planning Professeurs",
                icon: "fluent-emoji:teacher",
                subItems: [
                    {
                        id: "submenu-4-2-1",
                        title: "Absences",
                        icon: "fluent-emoji:cross-mark",
                        route: "/planning/professors/absences",
                    },
                    {
                        id: "submenu-4-2-2",
                        title: "Congés",
                        icon: "fluent-emoji:beach-with-umbrella",
                        route: "/planning/professors/vacation",
                    },
                    {
                        // NOTE(review SEV4) : id historiquement dupliqué `submenu-4-2-2`
                        // corrigé en `submenu-4-2-3` (clés `:key` uniques pour el-menu).
                        id: "submenu-4-2-3",
                        title: "Emploi du temps",
                        icon: "fluent-emoji:calendar",
                        route: "/planning/professors/planning",
                    },
                    {
                        id: "submenu-4-2-4",
                        title: "Configuration créneaux",
                        icon: "fluent-emoji:clock",
                        route: "/planning/professors/schedule-config",
                    }
                ]
            }
        ]
    },
    {
        id: "submenu-5",
        title: "Outils",
        icon: "fluent-emoji:hammer-and-wrench",
        subItems: [
            {
                id: "submenu-5-1",
                title: "Bulletin Scolaire",
                icon: "fluent-emoji:graduation-cap",
                subItems: [
                    {
                        id: "submenu-5-1-1",
                        title: "Notes",
                        icon: "fluent-emoji:open-book",
                        route: "/tools/school-report/notes",
                    },
                    {
                        id: "submenu-5-1-2",
                        title: "Impression et Modèle",
                        icon: "fluent-emoji:printer",
                        route: "/tools/school-report/print-model",
                    }
                ]
            },
            {
                id: "submenu-5-1-3",
                title: "Fiche de Centralisation",
                icon: "mdi:chart-bar",
                route: "/centralized-notes",
                description: "Visualisation et classement des notes"
            },
            {
                id: "submenu-5-1-4",
                title: "Procès-Verbal Annuel",
                icon: "mdi:file-document-outline",
                route: "/centralisation/proces-verbal-annuel",
                description: "Synthèse annuelle des résultats"
            },
            {
                id: "submenu-5-2",
                title: "Documents Scolaires",
                icon: "fluent-emoji:file-folder",
                subItems: [
                    {
                        id: "submenu-5-2-1",
                        title: "Attestations et Certificats de Scolarité",
                        icon: "fluent-emoji:page-with-curl",
                        route: "/tools/documents/scolarity",

                    }
                ]
            },
            {
                id: "submenu-5-3",
                title: "Carte d/'Identité Scolaire",
                icon: "fluent-emoji:identification-card",
                route: "/tools/generate-id",
            },
            {
                id: "submenu-5-4",
                title: "Synchronisation Cloud",
                icon: "mdi:database-sync",
                route: "/tools/sync",
                description: "Sync cloud et historique"
            }
        ]
    },
    {
        id: "submenu-admin",
        title: "Administration",
        icon: "mdi:shield-account",
        roles: ['admin'],
        subItems: [
            {
                id: "submenu-admin-1",
                title: "Utilisateurs",
                icon: "mdi:account-cog",
                route: "/utilisateurs",
            },
            {
                id: "submenu-admin-2",
                title: "Journal d'activité",
                icon: "mdi:clipboard-text-clock",
                route: "/journal-activite",
            }
        ]
    },
    {
        id: "submenu-6",
        title: "Paramètres",
        icon: "mdi:settings",
        subItems: [
            {
                id: "submenu-6-1",
                title: "Configuration École",
                icon: "fluent-emoji:school",
                subItems: [
                    {
                        id: "submenu-6-1-1",
                        title: "Info école",
                        icon: "fluent-emoji:school",
                        route: "/info-school",
                    },
                    {
                        id: "submenu-6-1-2",
                        title: "Niveau scolaire",
                        icon: "fluent-emoji:star",
                        route: "/grade",
                    },
                    {
                        id: "submenu-6-1-3",
                        title: "Salles de classe",
                        icon: "mdi:school",
                        route: "/classroom",
                    },
                    {
                        id: "submenu-6-1-4",
                        title: "Matières",
                        icon: "fluent-emoji:open-book",
                        route: "/course",
                    },
                    {
                        id: "submenu-6-1-5",
                        title: "Configuration de la notation",
                        icon: "fluent-emoji:open-book",
                        route: "/note-config",
                    }
                ]
            },
            {
                id: "submenu-6-2",
                title: "Configuration Année",
                icon: "fluent-emoji:calendar",
                subItems: [
                    {
                        id: "submenu-6-2-1",
                        title: "Répartition année scolaire",
                        icon: "fluent-emoji:calendar",
                        route: "/school-repartition",
                    },
                    {
                        id: "submenu-6-2-2",
                        title: "Configuration des paiements",
                        icon: "mdi:cash-register",
                        route: "/payment-config",
                    }
                ]
            },
            {
                id: "submenu-6-3",
                title: "Sécurité",
                icon: "mdi:security",
                subItems: [
                    {
                        id: "submenu-6-3-1",
                        title: "Changement de mot de passe",
                        icon: "mdi:key",
                        route: "/change-password",
                    },
                    {
                        id: "submenu-6-3-2",
                        title: "Statut de la licence et activation",
                        icon: "mdi:license",
                        route: "/license-status",
                    }
                ]
            },
            {
                id: "submenu-6-4",
                title: "Apparence",
                icon: "mdi:palette",
                route: "/apparence",
            }
        ]
    }
]