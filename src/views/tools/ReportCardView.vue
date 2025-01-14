<template>
  <div class="report-card-view">
    <el-card class="config-section">
      <template #header>
        <div class="header-content">
          <h2>Gestion des Notes et Bulletins</h2>
          <div class="header-actions">
            <el-button type="primary" @click="showConfigDialog = true">
            <Icon icon="mdi:cog" class="mr-2" />
            Configuration
          </el-button>
          </div>
        </div>
      </template>

      <!-- Filtres -->
      <div class="filters">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="Classe">
        <el-select 
          v-model="selectedGrade" 
          placeholder="Sélectionner une classe"
          @change="loadStudents"
                class="w-full"
        >
          <el-option 
            v-for="grade in grades" 
            :key="grade.id"
            :label="grade.name"
            :value="grade.id"
          />
        </el-select>
            </el-form-item>
          </el-col>

          <el-col :span="8">
            <el-form-item label="Période">
        <el-select 
          v-model="selectedPeriod"
          placeholder="Sélectionner une période"
                class="w-full"
        >
          <el-option 
            v-for="period in periods" 
            :key="period.value"
            :label="period.label"
            :value="period.value"
          />
        </el-select>
            </el-form-item>
          </el-col>

          <el-col :span="8">
            <el-form-item label="Modèle de bulletin">
        <el-select 
          v-model="selectedTemplate"
                placeholder="Choisir un modèle"
                class="w-full"
        >
          <el-option 
            v-for="template in availableTemplates" 
            :key="template.id"
            :label="template.name"
                  :value="template.id"
                />
        </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <!-- Liste des étudiants -->
        <el-table 
          :data="students"
          v-loading="loading"
          @selection-change="handleSelectionChange"
        class="mt-4"
        >
          <el-table-column type="selection" width="55" />
          <el-table-column label="Photo" width="80">
            <template #default="{ row }">
              <el-avatar :size="40" :src="row.photo?.url">
                {{ getInitials(row) }}
              </el-avatar>
            </template>
          </el-table-column>
          <el-table-column prop="matricule" label="Matricule" width="120" />
          <el-table-column prop="firstname" label="Prénom" />
          <el-table-column prop="lastname" label="Nom" />
        <el-table-column label="Actions" width="200" align="center">
            <template #default="{ row }">
            <el-button-group>
              <el-button 
                type="warning"
                size="small"
                @click="editGrades(row)"
                :loading="editing[row.id]"
              >
                <Icon icon="mdi:pencil" />
              </el-button>
              <el-button 
                type="primary" 
                size="small"
                @click="previewReport(row)"
                :loading="generating[row.id]"
              >
                <Icon icon="mdi:eye" />
              </el-button>
              <el-button 
                type="success"
                size="small"
                @click="printSingleReport(row)"
                :loading="printing[row.id]"
              >
                <Icon icon="mdi:printer" />
              </el-button>
            </el-button-group>
            </template>
          </el-table-column>
        </el-table>

      <!-- Actions -->
      <div class="actions-bar">
        <el-button 
          type="primary" 
          :disabled="!canGenerateReports"
          @click="generateSelectedReports"
          :loading="generatingMultiple"
        >
          <Icon icon="mdi:printer" class="mr-2" />
          Imprimer les bulletins sélectionnés ({{ selectedStudents.length }})
        </el-button>
      </div>
    </el-card>

    <!-- Dialogue de saisie des notes -->
    <el-dialog 
      v-model="showGradesDialog"
      title="Saisie des Notes"
      width="90%"
      destroy-on-close
    >
      <student-grades-form
        v-if="showGradesDialog && currentStudent"
        :student-id="currentStudent.id"
        :grade-id="selectedGrade ?? 0"
        :period="selectedPeriod"
        :number-of-assignments="numberOfAssignments"
        @saved="onGradesSaved"
      />
    </el-dialog>

    <!-- Dialogue de prévisualisation -->
    <el-dialog 
      v-model="previewVisible" 
      title="Prévisualisation du bulletin"
      width="90%"
      top="5vh"
      append-to-body
    >
      <div class="preview-container" ref="previewRef" id="report-preview">
        <component 
          :is="getTemplateComponent"
          v-if="previewData"
          v-bind="previewData"
        />
      </div>

      <template #footer>
          <el-button @click="previewVisible = false">Fermer</el-button>
        <el-button type="primary" @click="printPreview">
            <Icon icon="mdi:printer" class="mr-2" />
            Imprimer
        </el-button>
      </template>
    </el-dialog>

    <!-- Dialogue de configuration -->
    <el-dialog
      v-model="showConfigDialog"
      title="Configuration des Notes"
      width="80%"
      destroy-on-close
    >
      <grade-config-form
        v-if="showConfigDialog && selectedGrade"
        :grade-id="selectedGrade"
        @saved="onConfigSaved"
        ref="configFormRef"
      />
      <template #footer>
        <el-button @click="showConfigDialog = false">Annuler</el-button>
        <el-button type="primary" @click="saveConfig" :loading="savingConfig">
          Enregistrer
        </el-button>
      </template>
    </el-dialog>

    <!-- Template Selection Dialog -->
    <el-dialog
      v-model="showTemplateSelector"
      title="Choisissez votre modèle de bulletin"
      width="95%"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      class="template-selector"
    >
      <div class="templates-accordion">
        <el-collapse v-model="activeTemplate">
          <el-collapse-item 
            v-for="template in availableTemplates" 
            :key="template.id"
            :name="template.id"
          >
            <template #title>
              <div class="template-header" :class="{ 'selected': selectedTemplate === template.id }">
                <h3>{{ template.name }}</h3>
                <p class="template-description">{{ template.description }}</p>
                <el-button 
                  type="primary"
                  size="small"
                  :class="{ 'is-selected': selectedTemplate === template.id }"
                  @click.stop="selectTemplate(template.id)"
                >
                  {{ selectedTemplate === template.id ? 'Modèle sélectionné' : 'Choisir ce modèle' }}
                </el-button>
              </div>
            </template>
            
            <div class="template-preview-container">
              <div class="template-preview-wrapper">
                <div class="template-preview">
                  <component
                    :is="template.component"
                    v-bind="sampleData"
                  />
                </div>
              </div>
            </div>
          </el-collapse-item>
        </el-collapse>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, markRaw, createVNode, render } from 'vue';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import GradeConfigForm from '@/components/report/GradeConfigForm.vue';
import ReportTemplateOne from '@/components/report/templates/ReportTemplateOne.vue';
import ReportTemplateTwo from '@/components/report/templates/ReportTemplateTwo.vue';
import StudentGradesForm from '@/components/report/StudentGradesForm.vue';
import { ReportCardTemplate, SchoolInfo } from '@/types/report';
import printJS from 'print-js';
import 'element-plus/dist/index.css';

interface PreviewData {
  student: any;
  grades: any[];
  period: string;
  config: any;
  schoolInfo?: any;
  rank?: number;
  totalStudents?: number;
  observations?: string;
  generalAverage?: number;
}

// États
const loading = ref(false);
const editing = ref<Record<number, boolean>>({});
const generating = ref<Record<number, boolean>>({});
const printing = ref<Record<number, boolean>>({});
const generatingMultiple = ref(false);
const previewVisible = ref(false);
const showConfigDialog = ref(false);
const showGradesDialog = ref(false);
const currentStudent = ref<any>(null);
const selectedGrade = ref<number | null>(null);
const selectedPeriod = ref('');
const selectedTemplate = ref('template1');
const students = ref<any[]>([]);
const selectedStudents = ref<any[]>([]);
const previewData = ref<PreviewData | null>(null);
const grades = ref<any[]>([]);
const configFormRef = ref<InstanceType<typeof GradeConfigForm> | null>(null);
const savingConfig = ref(false);
const numberOfAssignments = ref(2);
const previewRef = ref<HTMLElement | null>(null);
const showTemplateSelector = ref(false);
const currentYear = ref<any>(null);

const periods = ref<any[]>([]);
const activeTemplate = ref(['template1']); // Le template actif dans l'accordéon

// Définition des templates disponibles
const availableTemplates: ReportCardTemplate[] = [
  { 
    id: 'template1', 
    name: 'Modèle Classique', 
    description: 'Un design simple et efficace',
    component: markRaw(ReportTemplateOne)
  },
  { 
    id: 'template2', 
    name: 'Modèle Moderne',
    description: 'Un style contemporain avec une mise en page dynamique',
    component: markRaw(ReportTemplateTwo)
  }
];

// Sample data pour la prévisualisation




const sampleData = {
  student: {
    firstname: "Thomas",
    lastname: "Dupont",
    matricule: "2024-001",
    grade: { name: "6ème A" },
    photo: null
  },
  grades: [
    {
      courseId: 1,
      courseName: "Mathématiques",
      courseGroup: "Sciences",
      coefficient: 4,
      assignments: [16, 15, 17],
      assignmentsAverage: 16,
      exam: 16,
      average: 16,
      classAverage: 12.5,
      appreciation: "Excellent niveau. Continue ainsi!"
    },
    {
      courseId: 2,
      courseName: "Français",
      courseGroup: "Lettres",
      coefficient: 4,
      assignments: [14, 15, 13],
      exam: 15,
      average: 14.5,
      classAverage: 11.8,
      appreciation: "Très bon travail ce trimestre"
    },
    {
      courseId: 3,
      courseName: "Histoire-Géographie",
      courseGroup: "Sciences Humaines",
      coefficient: 3,
      assignments: [15, 14],
      exam: 16,
      average: 15,
      classAverage: 12,
      appreciation: "Participation active et travail sérieux"
    }
  ],
  period: "Premier Trimestre",
  generalAverage: 15.2,
  classGeneralAverage: 12.1,
  rank: 2,
  totalStudents: 28,
  observations: "Excellent trimestre. Thomas fait preuve d'une grande motivation et d'une participation active en classe.",
  conduct: {
    discipline: "Excellent",
    attendance: "Très bien",
    workEthic: "Excellent"
  },
  schoolInfo: {
    name: "Collège Saint-Joseph",
    address: "12 rue de l'Education",
    phone: "01 23 45 67 89",
    email: "contact@saint-joseph.fr",
    logo: null
  }
};

// Computed
const canGenerateReports = computed(() => {
  return selectedStudents.value.length > 0 && selectedPeriod.value && selectedTemplate.value;
});

const getTemplateComponent = computed(() => {
  const template = availableTemplates.find(t => t.id === selectedTemplate.value);
  return template?.component || ReportTemplateOne;
});

// Méthodes
const loadGrades = async () => {
  try {
    const result = await window.ipcRenderer.invoke('grade:all');
    if (result.success) {
      grades.value = result.data;
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error('Erreur lors du chargement des classes');
  }
};

const loadStudents = async () => {
  if (!selectedGrade.value) return;
  
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('student:getByGrade', selectedGrade.value);
    if (result.success) {
      students.value = result.data;
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error('Erreur lors du chargement des étudiants');
  } finally {
    loading.value = false;
  }
};

const formatSchoolInfo = (schoolData: any): SchoolInfo => {
  return {
    name: schoolData.name,
    type: schoolData.type,
    address: schoolData.address,
    town: schoolData.town,
    phone: schoolData.phone,
    email: schoolData.email,
    country: schoolData.country as 'MAR' | 'SEN' | 'CAF' | 'GIN',
    logo: schoolData.logo ? {
      url: `data:${schoolData.logo.type};base64,${schoolData.logo.content}`
    } : undefined
  };
};

const previewReport = async (student: any) => {
  try {
    if (!selectedPeriod.value) {
      ElMessage.warning('Veuillez sélectionner une période');
      return;
    }

    generating.value[student.id] = true;
    console.log('Demande de prévisualisation pour:', {
      studentId: student.id,
      period: selectedPeriod.value
    });
    
    // Récupérer les notes
    const gradesResult = await window.ipcRenderer.invoke('report:getGrades', {
      studentId: student.id,
      period: selectedPeriod.value
    });

    console.log('Résultat des notes:', gradesResult);

    // Récupérer les infos de l'école
    const schoolResult = await window.ipcRenderer.invoke('school:get');
    console.log('Résultat école:', schoolResult);
    
    if (gradesResult.success && gradesResult.data) {
      previewData.value = {
        student,
        period: selectedPeriod.value,
        grades: gradesResult.data.grades || [],
        generalAverage: gradesResult.generalAverage,
        config: {},
        schoolInfo: schoolResult.success ? formatSchoolInfo(schoolResult.data) : null
      };
      console.log('Preview data:', previewData.value);
      previewVisible.value = true;
    } else {
      ElMessage.error(gradesResult.message || 'Erreur lors de la récupération des notes');
    }
  } catch (error) {
    console.error('Erreur prévisualisation:', error);
    ElMessage.error('Erreur lors de la prévisualisation');
  } finally {
    generating.value[student.id] = false;
  }
};


const printSingleReport = async (student: any) => {
  try {
    if (!selectedPeriod.value) {
      ElMessage.warning('Veuillez sélectionner une période');
      return;
    }

    printing.value[student.id] = true;

    const [gradesResult, schoolResult] = await Promise.all([
      window.ipcRenderer.invoke('report:getGrades', {
        studentId: student.id,
        period: selectedPeriod.value
      }),
      window.ipcRenderer.invoke('school:get')
    ]);

    if (gradesResult.success && gradesResult.data) {
      previewData.value = {
        student,
        period: selectedPeriod.value,
        grades: gradesResult.data.grades || [],
        generalAverage: gradesResult.generalAverage,
        config: {},
        schoolInfo: schoolResult.success ? formatSchoolInfo(schoolResult.data) : null
      };

      printPreview();
    }
  } catch (error) {
    console.error('Erreur impression:', error);
    ElMessage.error('Erreur lors de l\'impression');
  } finally {
    printing.value[student.id] = false;
  }
};

const generateSelectedReports = async () => {
  if (!selectedStudents.value.length) return;
  
  generatingMultiple.value = true;
  try {
    const schoolResult = await window.ipcRenderer.invoke('school:get');
    const schoolInfo = schoolResult.success ? formatSchoolInfo(schoolResult.data) : null;

    // Créer le contenu HTML pour tous les bulletins
    const reportsHTML = await Promise.all(
      selectedStudents.value.map(async (student) => {
        const gradesResult = await window.ipcRenderer.invoke('report:getGrades', {
          studentId: student.id,
          period: selectedPeriod.value
        });

        if (gradesResult.success && gradesResult.data) {
          const reportData = {
            student,
            period: selectedPeriod.value,
            grades: gradesResult.data.grades,
            generalAverage: gradesResult.generalAverage,
            schoolInfo
          };

          const template = availableTemplates.find(t => t.id === selectedTemplate.value);
          if (template) {
            const component = template.component;
            // Créer une instance temporaire pour le rendu
            const vm = createVNode(component, reportData);
            const container = document.createElement('div');
            render(vm, container);
            return container.innerHTML;
          }
        }
        return '';
      })
    );

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <html>
          <head>
            <title>Bulletins</title>
            <link rel="stylesheet" href="https://unpkg.com/element-plus/dist/index.css">
            <style>
              body { margin: 0; padding: 0; }
              .report-card {
                width: 210mm;
                min-height: 297mm;
                padding: 10mm;
                margin: 0;
                box-sizing: border-box;
                page-break-after: always;
              }
              @media print {
                @page { margin: 0; }
                body { margin: 0; }
              }
            </style>
          </head>
          <body>
            ${reportsHTML.join('')}
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.focus();
      setTimeout(() => {
        printWindow.print();
        printWindow.close();
      }, 250);
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error('Erreur lors de la génération des bulletins');
  } finally {
    generatingMultiple.value = false;
  }
};

const printPreview = () => {
  if (!previewData.value) return;
  
  const element = document.getElementById('report-preview');
  if (element) {
    printJS({
      printable: 'report-preview',
      type: 'html',
      css: [
        'https://fonts.googleapis.com/css2?family=Arial:wght@400;500;600;700&display=swap',
        '/src/assets/base.css',
      ],
      style: `
        @page { 
          size: 210mm 297mm; 
          margin: 0; 
        }
        body { 
          margin: 0;
          padding: 0;
          background: white;
        }
        #report-preview {
          width: 210mm;
          height: 297mm;
          margin: 0;
          padding: 0;
          background: white;
        }
        .report-card {
          width: 210mm;
          height: 297mm;
          padding: 15mm;
          margin: 0;
          box-sizing: border-box;
          background: white;
        }
        .grades-table {
          width: 100%;
          border-collapse: collapse;
        }
        .grades-table th,
        .grades-table td {
          border: 1px solid #000;
          padding: 4px 6px;
        }
        .center { text-align: center; }
        .totals { font-weight: bold; }
      `,
      scanStyles: true,
      targetStyles: ['*'],
      documentTitle: `Bulletin_${previewData.value.student.firstname}_${previewData.value.student.lastname}`,
      honorColor: true,
      maxWidth: 210,
    });
  }
};

const handleSelectionChange = (selection: any[]) => {
  selectedStudents.value = selection;
};

const getInitials = (student: any): string => {
  return `${student.firstname[0]}${student.lastname[0]}`;
};

const saveConfig = async () => {
  if (!configFormRef.value) return;
  
  try {
    await configFormRef.value.saveConfig();
    showConfigDialog.value = false;
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la configuration:', error);
    ElMessage.error('Erreur lors de la sauvegarde de la configuration');
  }
};

const onConfigSaved = () => {
  ElMessage.success('Configuration enregistrée avec succès');
  showConfigDialog.value = false;
};

const editGrades = async (student: any) => {
  if (!selectedPeriod.value) {
    ElMessage.warning('Veuillez sélectionner une période');
    return;
  }

  if (!selectedGrade.value) {
    ElMessage.warning('Veuillez sélectionner une classe');
    return;
  }

  currentStudent.value = student;
  editing.value[student.id] = true;
  
  try {
    // Utiliser une valeur par défaut si la config n'existe pas
    const configResult = await window.ipcRenderer.invoke('gradeConfig:get', {
      gradeId: selectedGrade.value
    });

    numberOfAssignments.value = configResult.success ? 
      configResult.data?.defaultAssignments || 2 : 2;

    showGradesDialog.value = true;
  } catch (error) {
    console.error('Erreur lors de l\'édition:', error);
    // Utiliser une valeur par défaut en cas d'erreur
    numberOfAssignments.value = 2;
    showGradesDialog.value = true;
  } finally {
    editing.value[student.id] = false;
  }
};

const onGradesSaved = () => {
  showGradesDialog.value = false;
  ElMessage.success('Notes enregistrées avec succès');
};

const initializeYear = async () => {
  try {
    const result = await window.ipcRenderer.invoke('yearRepartition:getCurrent');
    if (result.success) {
      currentYear.value = result.data;
      periods.value = result.data.periodConfigurations.map((p: any) => ({
        value: p.name,
        label: p.name,
        start: p.start,
        end: p.end
      }));
    }
  } catch (error) {
    console.error('Erreur initialisation année:', error);
  }
};

const selectTemplate = async (templateId: string) => {
  console.log('Template sélectionné:', templateId);
  selectedTemplate.value = templateId;
  
  try {
    console.log('Envoi de la requête de sauvegarde...');
    const result = await window.ipcRenderer.invoke('preference:saveTemplate', templateId);
    console.log('Résultat de la sauvegarde:', result);
    
    if (result.success) {
      showTemplateSelector.value = false;
      ElMessage.success('Modèle de bulletin enregistré avec succès');
    } else {
      throw new Error('Échec de la sauvegarde');
    }
  } catch (error) {
    console.error('Erreur lors de la sélection du template:', error);
    ElMessage.error('Erreur lors de la sélection du modèle');
  }
};

// Initialisation
onMounted(async () => {
  try {
    // Charger les classes
    await loadGrades();
    
    // Charger l'année scolaire et les périodes
    await initializeYear();
    
    // Vérifier si un template a déjà été choisi
    const prefResult = await window.ipcRenderer.invoke('preference:getTemplate');
    if (!prefResult.success || !prefResult.data) {
      showTemplateSelector.value = true;
    } else {
      selectedTemplate.value = prefResult.data;
    }
  } catch (error) {
    console.error('Erreur initialisation:', error);
    ElMessage.error('Erreur lors de l\'initialisation');
  }
});
</script>

<style scoped>
.report-card-view {
  padding: 20px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filters {
  margin-bottom: 20px;
}

.template-option {
  display: flex;
  flex-direction: column;
}

.template-option small {
  color: var(--el-text-color-secondary);
  font-size: 12px;
}

.actions-bar {
  margin-top: 20px;
  padding: 16px;
  border-top: 1px solid var(--el-border-color-lighter);
  display: flex;
  justify-content: flex-end;
}

.preview-container {
  background: #f5f5f5;
  padding: 20px;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 70vh;
  overflow: auto;
}

.w-full {
  width: 100%;
}

.mr-2 {
  margin-right: 8px;
}

@media print {
  .el-card,
  .el-dialog__header,
  .el-dialog__footer {
    display: none !important;
  }

  .preview-container {
    padding: 0;
    overflow: visible;
    height: auto;
    max-height: none;
  }
}

.range-config {
  margin-bottom: 20px;
}

.range-config h4 {
  margin-bottom: 10px;
  color: var(--el-text-color-regular);
}

.course-config {
  margin-top: 20px;
}

.template-carousel {
  background: #f5f7fa;
  border-radius: 8px;
  padding: 20px;
  height: 600px;
}

.template-preview {
  width: 210mm;
  height: 297mm;
  margin: 0 auto;
  background: white;
  box-shadow: 0 0 10px rgba(0,0,0,0.1);
  transform-origin: top center;
  transform: scale(0.8);
}

.template-description {
  color: #666;
  margin: 10px 0;
  text-align: center;
}

.el-dialog.template-selector {
  margin: 5vh auto !important;
}

.el-carousel {
  height: 100%;
}

.el-carousel__item {
  padding: 20px;
}

.template-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 30px;
  padding: 20px;
}

.template-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border: 2px solid #eee;
  border-radius: 12px;
  background: white;
  cursor: pointer;
  transition: all 0.3s ease;
  min-width: 500px;
}

.template-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

.template-card.selected {
  border-color: var(--el-color-primary);
  box-shadow: 0 5px 15px rgba(0,0,0,0.1);
}

.template-preview-wrapper {
  width: 100%;
  height: 600px;
  overflow: hidden;
  border: 1px solid #eee;
  border-radius: 8px;
  margin: 15px 0;
  position: relative;
  background: white;
}

.template-preview {
  width: 210mm;
  height: 297mm;
  transform: scale(0.35);
  transform-origin: top center;
  overflow-y: auto;
  padding: 20px;
  margin: 0 auto;
}

.template-card h3 {
  font-size: 1.2em;
  margin-bottom: 10px;
  color: var(--el-color-primary);
}

.template-description {
  color: #666;
  text-align: center;
  margin: 10px 0;
  font-size: 0.9em;
  line-height: 1.4;
}

.is-selected {
  background-color: var(--el-color-success);
  border-color: var(--el-color-success);
}

.templates-accordion {
  margin: -20px;
}

.template-header {
  display: flex;
  align-items: center;
  gap: 20px;
  padding: 10px;
  border-radius: 8px;
  transition: all 0.3s ease;
}

.template-header.selected {
  background-color: var(--el-color-primary-light-9);
}

.template-header h3 {
  margin: 0;
  font-size: 1.2em;
  color: var(--el-color-primary);
  flex: 0 0 auto;
}

.template-description {
  margin: 0;
  color: #666;
  font-size: 0.9em;
  flex: 1;
}

.template-preview-container {
  padding: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  margin-top: 10px;
}

.template-preview-wrapper {
  width: 100%;
  height: 800px;
  overflow: hidden;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.template-preview {
  width: 210mm;
  height: 297mm;
  transform: scale(0.45);
  transform-origin: top center;
  margin: 0 auto;
  background: white;
  padding: 20px;
  overflow-y: auto;
}

:deep(.el-collapse-item__header) {
  background: transparent;
}

:deep(.el-collapse-item__wrap) {
  background: transparent;
}

:deep(.el-collapse) {
  border: none;
}

:deep(.el-collapse-item__content) {
  padding-bottom: 20px;
}


#multiple-reports-container {
  display: none; /* Caché par défaut */
}

@media print {
  #multiple-reports-container {
    display: block;
  }
  
  /* Cacher les autres éléments lors de l'impression */
  .el-card,
  .el-dialog,
  .actions-bar {
    display: none !important;
  }
}
.is-selected {
  background-color: var(--el-color-success);
  border-color: var(--el-color-success);
}

@media print {
  .preview-container {
    padding: 0;
    background: none;
  }

  .template-preview {
    transform: none;
    box-shadow: none;
  }
}
</style> 