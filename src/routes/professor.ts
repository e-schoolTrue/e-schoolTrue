export const professorRoutes = [
  {
    path: "/professor",
    name: "ProfessorList",
    component: () => import("@/views/professor/ProfessorListView.vue"),
  },
  {
    path: "/professor/add",
    name: "AddProfessor",
    component: () => import("@/views/professor/NewProfView.vue"),
  },
  {
    path: "/professor/update/:id",
    name: "UpdateProfessor",
    component: () => import("@/views/professor/UpdateProfessorView.vue"),
  },
  {
    path: "/professor/:id",
    name: "ProfessorDetails",
    component: () => import("@/views/professor/ProfessorDetailsView.vue"),
  }
]; 