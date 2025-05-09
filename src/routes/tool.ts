export const toolRoutes = [
    {
      path: "/tools/generate-id",
      name: "StudentCard",
      component: () => import("@/views/tools/StudentCardView.vue"),
    },
    {
      path: "/tools/school-report",
      name: "ReportCard",
      component: () => import("@/views/tools/ReportCardView.vue"),
    },
    {
      path: "/tools/backup",
      name: "BackupRestore",
      component: () => import("@/views/tools/BackupView.vue"),
    },
  ]; 