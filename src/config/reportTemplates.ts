import type { ReportCardTemplate } from '@/types/report';
import ReportTemplateOne from '@/components/report/templates/ReportTemplateOne.vue';
import ReportTemplateTwo from '@/components/report/templates/ReportTemplateTwo.vue';
import ReportTemplateThree from '@/components/report/templates/ReportTemplateThree.vue';

export const reportTemplates: ReportCardTemplate[] = [
  {
    id: '1',
    name: 'Template Classique',
    description: 'Mise en page traditionnelle avec tableau de notes',
    component: ReportTemplateOne
  },
  {
    id: '2',
    name: 'Template Moderne',
    description: 'Design moderne avec graphiques de performance',
    component: ReportTemplateTwo
  },
  {
    id: '3',
    name: 'Template Minimaliste',
    description: 'Style épuré avec focus sur les compétences',
    component: ReportTemplateThree
  }
]; 