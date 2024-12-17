import GradeView from "@/views/file/GradeView.vue";
import ClassRoomView from "@/views/file/ClassRoomView.vue";
import CourseView from "@/views/file/CourseView.vue";
import PayementConfigurationView from "@/views/file/PayementConfigurationView.vue";
import SchoolInfoView from "@/views/file/SchoolInfoView.vue";
 import NotesConfigurationView from "@/views/file/NotesConfigurationView.vue";
import YearRepartitionView from "@/views/file/YearRepartitionView.vue";


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
        path: '/school-notes',
        name: "Configuration des notes",
        component: NotesConfigurationView
    },
    {
        path: '/school-repartition',
        name: "Répartition année scolaire",
        component: YearRepartitionView
    },
]
 