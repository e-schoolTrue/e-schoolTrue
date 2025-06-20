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
      path: "/tools/sync",
      name: "Sync",
      component: () => import("@/views/tools/SyncView.vue"),
    },
  ]; 