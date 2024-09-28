export const AppItems = [
    {
        id:"submenu-1",
        title: "Gestion des Elèves",
        icon: "twemoji:student-light-skin-tone",
        subItems:[
            {
                id: "submenu-1-1",
                title: "Nouvelle Inscription",
                icon: "twemoji:spiral_calendar_pad",
                route: "/student/add",
                subItems:[]
            },
            {
                id: "submenu-1-2",
                title: "Elèves",
                icon: "twemoji:spiral_calendar_pad",
                route: "/student",
                subItems:[]
            },
             {
                id: "submenu-1-3",
                title: "Absence",
                icon: "twemoji:spiral_calendar_pad",
                route: "/student/:id/absences",
                subItems:[]
            }
        ]
    },
    {
        id:"submenu-2",
        title: "Gestion des Professeurs",
        icon: "twemoji:woman-teacher",
        subItems:[
            {
                id: "submenu-2-1",
                title: "Nouvelle Inscription",
                icon: "twemoji:spiral_calendar_pad",
                route: "/teachers",
            },
            {
                id: "submenu-2-2",
                title: "Professeurs",
                icon: "twemoji:spiral_calendar_pad",
                route: "/teachers/add",
            }
        ]
    },
    {
        id:"submenu-6",
        title: "Fichier",
        icon: "flat-color-icons:folder",
        subItems:[
            {
                id: "submenu-6-1",
                title: "Info école",
                icon: "ic:round-school",
                route: "/info-school",
            },
            {
                id: "submenu-6-2",
                title: "Niveau scolaire",
                icon: "material-symbols:grade-outline",
                route: "/grade",
            },
            {
                id: "submenu-6-3",
                title: "Salles de classe",
                icon: "arcticons:classroom",
                route: "/classroom",
            },
            {
                id: "submenu-6-4",
                title: "Matières",
                icon: "vscode-icons:folder-type-module",
                route: "/course",
            },
            {
                id: "submenu-6-5",
                title: "Configuration des notes",
                icon: "fa6-solid:school-circle-xmark",
                route: "/school-notes",
            }
        ]
    }
]