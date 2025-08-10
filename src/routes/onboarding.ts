import { RouteRecordRaw } from 'vue-router';

const onboardingRoutes: RouteRecordRaw[] = [
  {
    path: 'welcome',
    name: 'welcome',
    component: () => import('../views/omboarding/WelcomView.vue'),
    meta: {
      requiresAuth: false,
      title: 'Bienvenue'
    }
  },
  {
    path: 'data-location',
    name: 'data-location',
    component: () => import('../views/omboarding/DataLocationView.vue'),
    meta: {
      requiresAuth: false,
      title: 'Localisation'
    }
  },
  {
    path: 'general-info',
    name: 'general-info',
    component: () => import('../views/omboarding/GeneralInfoView.vue'),
    meta: {
      requiresAuth: false,
      title: 'Infos Générales'
    }
  },
  {
    path: 'year-repartition',
    name: 'year-repartition',
    component: () => import('../views/omboarding/YearRepartitionView.vue'),
    meta: {
      requiresAuth: false,
      title: 'Année Scolaire'
    }
  },
  {
    path: 'grade',
    name: 'grade',
    component: () => import('../views/omboarding/GradeView.vue'),
    meta: {
      requiresAuth: false,
      title: 'Niveaux'
    }
  },
  {
    path: 'course',
    name: 'course',
    component: () => import('../views/omboarding/CourseView.vue'),
    meta: {
      requiresAuth: false,
      title: 'Matières'
    }
  },
  {
    path: 'language-setting',
    name: 'language-setting',
    component: () => import('../views/omboarding/LanguageSettingView.vue'),
    meta: {
      requiresAuth: false,
      title: 'Langue'
    }
  },
  {
    path: 'supervisor-info',
    name: 'supervisor-info',
    component: () => import('../views/omboarding/SupervisorInfoView.vue'),
    meta: {
      requiresAuth: false,
      title: 'Superviseur'
    }
  },
  {
    path: 'payement-configuration',
    name: 'payement-configuration',
    component: () => import('../views/omboarding/PayementConfigurationView.vue'),
    meta: {
      requiresAuth: false,
      title: 'Configuration de Paiement'
    }
  }
];

export default onboardingRoutes;