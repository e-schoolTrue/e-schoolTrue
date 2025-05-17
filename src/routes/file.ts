import GradeView from "@/views/file/GradeView.vue";
import ClassRoomView from "@/views/file/ClassRoomView.vue";
import CourseView from "@/views/file/CourseView.vue";
import PayementConfigurationView from "@/views/file/PayementConfigurationView.vue";
import SchoolInfoView from "@/views/file/SchoolInfoView.vue";
import YearRepartitionView from "@/views/file/YearRepartitionView.vue";
import ForgotPasswordView from "@/views/auth/ForgotPasswordView.vue";
import LicenseStatusView from "@/views/file/LicenseStatusView.vue";


export const fileRoutes = [

    {
        path : '/grade' ,
        name : "Niveau scolaire" ,
        component : GradeView
    },
    {
        path : '/classroom' ,
        name : "Salles de classe" ,
        component : ClassRoomView
    },
    {
        path : '/course' ,
        name : "Matières" ,
        component : CourseView
    },
    {
        path: '/payment-config',
        name: "Configuration des paiements",
        component: PayementConfigurationView
    },
    {
        path: '/info-school',
        name: "Info école",
        component: SchoolInfoView

    },
  
    {
        path: '/school-repartition',
        name: "Répartition année scolaire",
        component: YearRepartitionView
    },
    {
        path: '/change-password',
        name: "Changement de mot de passe",
        component: ForgotPasswordView
    },
    {
        path: '/license-status',
        name: "Statut de la licence",
        component: LicenseStatusView
    }

]
 