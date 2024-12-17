export const studentRoutes = [
  {
    path: "/student",
    name: "StudentList",
    component: () => import("@/views/student/StudentListView.vue"),
  },
  {
    path: "/student/update/:id",
    name: "UpdateStudent",
    component: () => import("@/views/student/UpdateStudentView.vue"),
  },
  {
    path: "/student/:id",
    name: "StudentDetails",
    component: () => import("@/views/student/StudentDetailsView.vue"),
  },

  {
    path: "/student/add",
    name: "AddStudent",
    component: () => import("@/views/student/NewStudentView.vue"),
  },
];
