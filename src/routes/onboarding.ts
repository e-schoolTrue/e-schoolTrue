
import GeneralInfo from "@/views/omboarding/GeneralInfoView.vue";
import LanguageSetting from "@/views/omboarding/LanguageSettingView.vue";
import SupervisorInfo from "@/views/omboarding/SupervisorInfoView.vue";
import WelcomView from "@/views/omboarding/WelcomView.vue";

export const omboardingRoutes = [
    {
        path : '' ,
        name : "welcome" ,
        component : WelcomView ,
    },
    {
        path : 'data-location' ,
        name : "data-location" ,
        component : WelcomView ,
    },
    {
        path : "general-info" ,
        name : "general-info" ,
        component : GeneralInfo ,
    },
    {
        path : "language-setting" ,
        name : "language-setting" ,
        component : LanguageSetting ,
    },
    {
        path : "supervisor-info" ,
        name : "supervisor-info" ,
        component : SupervisorInfo ,
    }
]