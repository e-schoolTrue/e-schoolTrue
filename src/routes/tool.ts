export const toolRoutes = [
    {
      path: "/tools/automatic-messaging",
      name: "WhatsappMassMessage",
      component: () => import("@/views/message/WhatsappMassMessageView.vue"),
    },
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
      path: "/tools/save-data",
      name: "Backup",
      component: () => import("@/views/tools/BackupView.vue"),
    },
    
  ]; 