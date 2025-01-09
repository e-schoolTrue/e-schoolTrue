export const planningRoutes = [
  // Routes pour les élèves
  {
    path: "/planning/students/absences",
    name: "StudentAbsences",
    component: () => import("@/views/planning/student/AbsenceStudentView.vue"),
  },
  {
    path: "/planning/students/homework",
    name: "StudentHomework",
    component: () => import("@/views/planning/student/HomeworkView.vue"),
  },
  {
    path: "/planning/students/vacation",
    name: "StudentVacation",
    component: () => import("@/views/planning/student/VacationView.vue"),
  },

  
  // Routes pour les professeurs
  {
    path: "/planning/professors/absences",
    name: "ProfessorAbsences",
    component: () => import("@/views/planning/professor/AbsenceProfView.vue"),
  },
  {
    path: "/planning/professors/vacation",
    name: "ProfessorVacation",
    component: () => import("@/views/planning/professor/VacationView.vue"),
  },

];