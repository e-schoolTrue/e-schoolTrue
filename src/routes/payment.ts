export const paymentRoutes = [
  {
    path: "/payment/students",
    name: "StudentPayments",
    component: () => import("@/views/student/PaymentManagementView.vue"),
  },
  {
    path: "/payment/professors",
    name: "ProfessorPayments",
    component: () => import("@/views/professor/ProfessorPaymentView.vue"),
  }
];