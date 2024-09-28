
export const studentRoutes = [
    {
        path: "/student",
        name: "student",
        component: () => import("@/views/student/StudentListView.vue"),
    },
    {
        path: "/student/add",
        name: "addStudent",
        component: () => import("@/views/student/NewStudentView.vue"),
    },
    {
        path: "/student/:id",
        name: "editStudent",
        component: () => import("@/views/student/UpdateStudentView.vue"),
    },
    {
        path: "/student/:id/absences",  // Route pour la gestion des absences
        name: "studentAbsences",
        component: () => import("@/views/student/AbsenceStudentView.vue"),  // Chemin vers la vue des absences
    }
];
