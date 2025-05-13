import { RouteRecordRaw } from 'vue-router';
import WelcomView from '../views/omboarding/WelcomView.vue';
import DataLocationView from '../views/omboarding/DataLocationView.vue';
import GeneralInfoView from '../views/omboarding/GeneralInfoView.vue';
import YearRepartitionView from '../views/omboarding/YearRepartitionView.vue';
import GradeView from '../views/omboarding/GradeView.vue';
import CourseView from '../views/omboarding/CourseView.vue';
import LanguageSettingView from '../views/omboarding/LanguageSettingView.vue';
import SupervisorInfoView from '../views/omboarding/SupervisorInfoView.vue';
import PayementConfigurationView from '../views/omboarding/PayementConfigurationView.vue';

const omboardingRoutes: RouteRecordRaw[] = [
  {
    path: 'welcome',
    name: 'welcome',
    component: WelcomView,
    meta: {
      requiresAuth: false,
      title: 'Bienvenue'
    }
  },
  {
    path: 'data-location',
    name: 'data-location',
    component: DataLocationView,
    meta: {
      requiresAuth: false,
      title: 'Localisation'
    }
  },
  {
    path: 'general-info',
    name: 'general-info',
    component: GeneralInfoView,
    meta: {
      requiresAuth: false,
      title: 'Infos Générales'
    }
  },
  {
    path: 'year-repartition',
    name: 'year-repartition',
    component: YearRepartitionView,
    meta: {
      requiresAuth: false,
      title: 'Année Scolaire'
    }
  },
  {
    path: 'grade',
    name: 'grade',
    component: GradeView,
    meta: {
      requiresAuth: false,
      title: 'Niveaux'
    }
  },
  {
    path: 'course',
    name: 'course',
    component: CourseView,
    meta: {
      requiresAuth: false,
      title: 'Matières'
    }
  },
  {
    path: 'language-setting',
    name: 'language-setting',
    component: LanguageSettingView,
    meta: {
      requiresAuth: false,
      title: 'Langue'
    }
  },
  {
    path: 'supervisor-info',
    name: 'supervisor-info',
    component: SupervisorInfoView,
    meta: {
      requiresAuth: false,
      title: 'Superviseur'
    }
  },
  {
    path: 'payement-configuration',
    name: 'payement-configuration',
    component: PayementConfigurationView,
    meta: {
      requiresAuth: false,
      title: 'Configuration de Paiement'
    }
  }
];

export default omboardingRoutes;