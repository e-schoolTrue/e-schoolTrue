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
      :title="`Notes de ${currentStudent?.firstname} ${currentStudent?.lastname}`"
      width="80%"
      destroy-on-close
    >
      <student-grades-form
        v-if="showGradesDialog"
        :student-id="currentStudent?.id"
        :grade-id="selectedGrade!"
        :period="selectedPeriod"
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
      width="80%"
      :close-on-click-modal="false"
      :close-on-press-escape="false"
      :show-close="false"
      class="template-selector"
    >
      <div class="template-grid">
        <div 
          v-for="template in availableTemplates" 
          :key="template.id"
          class="template-card"
        >
          <h3>{{ template.name }}</h3>
          <p class="template-description">{{ template.description }}</p>
          <div class="template-preview">
            <component
              :is="template.component"
              v-bind="sampleData"
            />
          </div>
          <el-button 
            type="primary" 
            @click="selectTemplate(template.id)"
            class="select-button"
          >
            Choisir ce modèle
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue';
import { Icon } from '@iconify/vue';
import { ElMessage } from 'element-plus';
import printJS from 'print-js';
import GradeConfigForm from '@/components/report/GradeConfigForm.vue';
import ReportTemplateOne from '@/components/report/templates/ReportTemplateOne.vue';
import ReportTemplateTwo from '@/components/report/templates/ReportTemplateTwo.vue';
import ReportTemplateThree from '@/components/report/templates/ReportTemplateThree.vue';
import StudentGradesForm from '@/components/report/StudentGradesForm.vue';
import type { ReportCardTemplate } from '@/types/report';

interface PreviewData {
  student: any;
  grades: any[];
  period: string;
  config: any;
  schoolInfo?: any;
  rank?: number;
  totalStudents?: number;
  observations?: string;
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
const currentPeriod = ref('');
const periods = ref<any[]>([]);

// Définition des templates disponibles
const availableTemplates: ReportCardTemplate[] = [
  { 
    id: 'template1', 
    name: 'Modèle Classique', 
    description: 'Un design simple et efficace, idéal pour une présentation traditionnelle',
    component: ReportTemplateOne 
  },
  { 
    id: 'template2', 
    name: 'Modèle Moderne',
    description: 'Un style contemporain avec une mise en page dynamique',
    component: ReportTemplateTwo 
  },
  { 
    id: 'template3', 
    name: 'Modèle Avancé',
    description: 'Une présentation sophistiquée avec graphiques et analyses détaillées',
    component: ReportTemplateThree 
  }
];

// Sample data pour la prévisualisation
const sampleStudent = {
  firstname: "John",
  lastname: "Doe",
  matricule: "12345",
  grade: { name: "6ème A" },
  photo: null,
  birthDay: "2010-01-01",
  birthPlace: "Paris"
};

const sampleGrades = [
  {
    courseId: 1,
    courseName: "Mathématiques",
    courseGroup: "Sciences",
    coefficient: 2,
    assignments: [14, 16],
    exam: 15,
    average: 15,
    classAverage: 12.5,
    appreciation: "Très bon travail"
  },
  {
    courseId: 2,
    courseName: "Français",
    courseGroup: "Lettres",
    coefficient: 2,
    assignments: [13, 14],
    exam: 14,
    average: 13.5,
    classAverage: 11.5,
    appreciation: "Bon travail"
  }
];

const sampleData = {
  student: sampleStudent,
  grades: sampleGrades,
  period: "trimester1",
  generalAverage: 14.25,
  classGeneralAverage: 12,
  rank: 3,
  totalStudents: 25,
  observations: "Élève sérieux et appliqué",
  conduct: {
    discipline: "Très bien",
    attendance: "Excellent",
    workEthic: "Très bien"
  },
  schoolInfo: {
    name: "Collège Sample",
    address: "123 rue de l'école",
    phone: "01 23 45 67 89",
    email: "contact@college-sample.fr"
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

const previewReport = async (student: any) => {
  try {
    generating.value[student.id] = true;
    const result = await window.ipcRenderer.invoke('report:generate', {
      studentId: student.id,
      period: selectedPeriod.value
    });

    if (result.success) {
      previewData.value = {
        ...result.data,
        student,
        schoolInfo: null // À implémenter avec les infos de l'école
      };
      previewVisible.value = true;
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
    printing.value[student.id] = true;
    const result = await window.ipcRenderer.invoke('report:generate', {
      studentId: student.id,
      period: selectedPeriod.value
    });

    if (result.success) {
      previewData.value = {
        ...result.data,
        student,
        schoolInfo: null
      };

      await nextTick();
      
      const element = document.getElementById('report-preview');
      if (element) {
        printJS({
          printable: 'report-preview',
          type: 'html',
          targetStyles: ['*'],
          documentTitle: `Bulletin_${student.firstname}_${student.lastname}`,
          scanStyles: true,
          css: [
            'https://unpkg.com/element-plus/dist/index.css',
            // Ajoutez ici d'autres fichiers CSS si nécessaire
          ]
        });
      }
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
    const result = await window.ipcRenderer.invoke('report:generateMultiple', {
      studentIds: selectedStudents.value.map(s => s.id),
      period: selectedPeriod.value,
      templateId: selectedTemplate.value
    });
    
    if (result.success) {
      printJS({
        printable: result.data,
        type: 'html',
        targetStyles: ['*'],
        documentTitle: 'Bulletins'
      });
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error('Erreur lors de la génération');
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
      targetStyles: ['*'],
      documentTitle: 'Bulletin_Preview',
      scanStyles: true,
      css: [
        'https://unpkg.com/element-plus/dist/index.css'
      ]
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
  console.log('Édition des notes pour l\'étudiant:', student);
  currentStudent.value = student;
  editing.value[student.id] = true;
  
  try {
    // Charger la configuration existante
    const configResult = await window.ipcRenderer.invoke('gradeConfig:get', {
      gradeId: selectedGrade.value
    });
    console.log('Configuration récupérée:', configResult);

    if (configResult.success) {
      // Mettre à jour le nombre de devoirs et les pondérations
      numberOfAssignments.value = configResult.data.defaultAssignments;
      console.log('Nombre de devoirs configuré:', numberOfAssignments.value);
    }

    showGradesDialog.value = true;
  } catch (error) {
    console.error('Erreur lors de l\'édition:', error);
    ElMessage.error('Erreur lors du chargement de la configuration');
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
    const result = await window.ipcRenderer.invoke('year:getCurrent');
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
  try {
    const result = await window.ipcRenderer.invoke('preference:saveTemplate', templateId);
    if (result.success) {
      selectedTemplate.value = templateId;
      showTemplateSelector.value = false;
      ElMessage.success('Modèle de bulletin enregistré avec succès');
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
  background: white;
  padding: 20px;
  min-height: 60vh;
  max-height: 70vh;
  overflow-y: auto;
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
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
  height: 100%;
  padding: 20px;
}

.preview-container {
  flex: 1;
  width: 100%;
  overflow: auto;
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
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
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  padding: 20px;
}

.template-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 8px;
  background: white;
}

.template-preview {
  width: 100%;
  height: 400px;
  overflow: auto;
  border: 1px solid #eee;
  border-radius: 8px;
  margin: 15px 0;
  padding: 10px;
  transform: scale(0.5);
  transform-origin: top center;
}

.select-button {
  width: 200px;
  margin-top: 15px;
}

.template-description {
  color: #666;
  text-align: center;
  margin: 10px 0;
}
</style> 