export const studentRoutes = [
    {
        path: "/student",
        component: () => import("@/components/layouts/StudentLayout.vue"),
        children: [
            {
                path: "",
                name: "StudentList",
                component: () => import("@/views/student/StudentListView.vue"),
            },
            {
                path: "update/:id",
                name: "UpdateStudent",
                component: () => import("@/views/student/UpdateStudentView.vue"),
            },
            {
                path: ":id",
                name: "StudentDetails",
                component: () => import("@/views/student/StudentDetailsView.vue"),
            },
            {
                path: "payments",
                name: "PaymentManagement",
                component: () => import("@/views/student/PaymentManagementView.vue"),
            },
            {
                path: "absences",
                name: "AbsenceManagement",
                component: () => import("@/views/student/AbsenceManagementView.vue"),
            }
        ]
    },
    {
        path: "/student/add",
        name: "AddStudent",
        component: () => import("@/views/student/NewStudentView.vue"),
    },
];
