
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
    {
      path: "/tools/documents/scolarity",
      name: "DocumentEditor",
      component: () => import("@/views/tools/DocumentsView.vue"),
    },
    {
      path: "/tools/documents/administrative-report",
      name: "AdministrativeReport",
      component: () => import("@/views/tools/AdministrativeReportView.vue"),
    }
  ]; 