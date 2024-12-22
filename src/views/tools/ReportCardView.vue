<template>
  <div class="report-card-view">
    <el-card class="config-section">
      <template #header>
        <div class="header-content">
          <h2>Génération des Bulletins</h2>
          <el-button type="primary" @click="goToConfig" class="config-button">
            <Icon icon="mdi:cog" class="mr-2" />
            Configuration
          </el-button>
        </div>
      </template>

      <!-- Filtres -->
      <div class="filters">
        <el-select 
          v-model="selectedGrade" 
          placeholder="Sélectionner une classe"
          @change="loadStudents"
        >
          <el-option 
            v-for="grade in grades" 
            :key="grade.id"
            :label="grade.name"
            :value="grade.id"
          />
        </el-select>

        <el-select 
          v-model="selectedPeriod"
          placeholder="Sélectionner une période"
        >
          <el-option 
            v-for="period in periods" 
            :key="period.value"
            :label="period.label"
            :value="period.value"
          />
        </el-select>

        <el-select 
          v-model="selectedTemplate"
          placeholder="Modèle de bulletin"
        >
          <el-option 
            v-for="template in templates" 
            :key="template.id"
            :label="template.name"
            :value="template"
          >
            <div class="template-option">
              <span>{{ template.name }}</span>
              <small>{{ template.description }}</small>
            </div>
          </el-option>
        </el-select>
      </div>

      <!-- Prévisualisation des templates -->
      <div class="preview-button">
        <el-button @click="templatePreviewVisible = true">
          <Icon icon="mdi:eye" class="mr-2" />
          Aperçu des modèles
        </el-button>
      </div>

      <!-- Dialog de prévisualisation des templates -->
      <el-dialog
        v-model="templatePreviewVisible"
        title="Aperçu des modèles de bulletin"
        width="90%"
        top="5vh"
        fullscreen
      >
        <div class="templates-preview">
          <div v-for="template in templates" :key="template.id" class="template-preview-item">
            <div class="template-header">
              <h3>{{ template.name }}</h3>
              <p>{{ template.description }}</p>
            </div>
            <div class="template-preview-content">
              <component
                :is="template.component"
                v-bind="samplePreviewData"
                :school-info="schoolInfo"
              />
            </div>
          </div>
        </div>
        <template #footer>
          <div class="dialog-footer">
            <el-button @click="templatePreviewVisible = false">Fermer</el-button>
          </div>
        </template>
      </el-dialog>

      <!-- Liste des étudiants avec scroll fixe -->
      <div class="students-table-container">
        <el-table 
          :data="students"
          v-loading="loading"
          @selection-change="handleSelectionChange"
          height="calc(100vh - 350px)"
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
          <el-table-column label="Actions" width="150" align="center">
            <template #default="{ row }">
              <el-button 
                type="primary" 
                @click="previewReport(row)"
                :loading="generating[row.id]"
              >
                <Icon icon="mdi:eye" />
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <!-- Actions fixes en bas -->
      <div class="fixed-actions">
        <el-button 
          type="primary" 
          :disabled="!selectedStudents.length"
          @click="generateReports"
          :loading="generatingMultiple"
        >
          <Icon icon="mdi:printer" class="mr-2" />
          Générer les bulletins sélectionnés
        </el-button>
      </div>
    </el-card>

    <!-- Prévisualisation du bulletin -->
    <el-dialog 
      v-model="previewVisible" 
      title="Prévisualisation du bulletin"
      width="90%"
      top="5vh"
      append-to-body
    >
      <div class="preview-container" ref="previewRef">
        <component 
          :is="selectedTemplate.component"
          v-if="previewData"
          v-bind="previewData"
          :period="selectedPeriod"
          :school-info="schoolInfo"
        />
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="previewVisible = false">Fermer</el-button>
          <el-button type="primary" @click="handlePrint">
            <Icon icon="mdi:printer" class="mr-2" />
            Imprimer
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, reactive } from 'vue';
import { Icon } from '@iconify/vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { reportTemplates } from '@/config/reportTemplates';
import type { ReportCardTemplate, ReportCard } from '@/types/report';
import printJS from 'print-js';

interface Student {
  id: number;
  firstname: string;
  lastname: string;
  matricule: string;
  photo?: {
    url?: string;
  };
  grade?: {
    id: number;
    name: string;
  };
}

interface Grade {
  id: number;
  name: string;
}

interface PreviewData {
  student: Student;
  grades: {
    courseId: number;
    courseName: string;
    coefficient: number;
    grade: number;
    appreciation: string;
  }[];
  average: number;
  classAverage: number;
  rank: number;
  totalStudents: number;
  generalAppreciation?: string;
}

const router = useRouter();
const students = ref<Student[]>([]);
const selectedStudents = ref<Student[]>([]);
const selectedGrade = ref<number | null>(null);
const selectedPeriod = ref<string>('');
const selectedTemplate = ref<ReportCardTemplate>(reportTemplates[0]);
const templates = ref(reportTemplates);
const loading = ref(false);
const generating = ref<Record<number, boolean>>({});
const generatingMultiple = ref(false);
const previewVisible = ref(false);
const previewData = ref<PreviewData | null>(null);
const grades = ref<Grade[]>([]);
const schoolInfo = ref<any>(null);
const templatePreviewVisible = ref(false);
const previewRef = ref<HTMLElement | null>(null);

// Périodes
const periods = [
  { value: 'TRIMESTER1', label: '1er Trimestre' },
  { value: 'TRIMESTER2', label: '2ème Trimestre' },
  { value: 'TRIMESTER3', label: '3ème Trimestre' }
];

// Données exemple pour la prévisualisation
const samplePreviewData = reactive({
  student: {
    id: 0,
    firstname: 'John',
    lastname: 'Doe',
    matricule: '12345',
    grade: { id: 1, name: '6ème A' }
  },
  grades: [
    { 
      courseId: 1, 
      courseName: 'Mathématiques', 
      coefficient: 2, 
      grade: 15, 
      appreciation: 'Bon travail' 
    },
    { 
      courseId: 2, 
      courseName: 'Français', 
      coefficient: 2, 
      grade: 14, 
      appreciation: 'Peut mieux faire' 
    }
  ],
  average: 14.5,
  classAverage: 13.8,
  rank: 1,
  totalStudents: 30,
  generalAppreciation: 'Excellent trimestre',
  period: 'TRIMESTER1'
});

// Chargement des données
const loadGrades = async () => {
  try {
    const result = await window.ipcRenderer.invoke('grade:all');
    if (result.success) {
      grades.value = result.data;
    }
  } catch (error) {
    console.error('Erreur lors du chargement des classes:', error);
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
    console.error('Erreur lors du chargement des étudiants:', error);
    ElMessage.error('Erreur lors du chargement des étudiants');
  } finally {
    loading.value = false;
  }
};

const loadSchoolInfo = async () => {
  try {
    const result = await window.ipcRenderer.invoke('school:info');
    if (result.success) {
      schoolInfo.value = result.data;
    }
  } catch (error) {
    console.error('Erreur lors du chargement des informations de l\'école:', error);
  }
};

// Actions
const previewReport = async (student: Student) => {
  generating.value[student.id] = true;
  try {
    const result = await window.ipcRenderer.invoke('report:preview', {
      studentId: student.id,
      period: selectedPeriod.value
    });

    if (result.success) {
      previewData.value = {
        student,
        ...result.data,
        average: Number(result.data.average).toFixed(2),
        classAverage: Number(result.data.classAverage).toFixed(2)
      };
      previewVisible.value = true;
    }
  } catch (error) {
    console.error('Erreur lors de la prévisualisation:', error);
    ElMessage.error('Erreur lors de la prévisualisation');
  } finally {
    generating.value[student.id] = false;
  }
};

const handleSelectionChange = (selection: Student[]) => {
  selectedStudents.value = selection;
};

const generateReports = async () => {
  if (!selectedPeriod.value || !selectedTemplate.value) {
    ElMessage.warning('Veuillez sélectionner une période et un modèle');
    return;
  }
  
  generatingMultiple.value = true;
  try {
    const result = await window.ipcRenderer.invoke('report:generateMultiple', {
      studentIds: selectedStudents.value.map(s => s.id),
      period: selectedPeriod.value,
      templateId: selectedTemplate.value.id
    });
    
    if (result.success) {
      ElMessage.success('Bulletins générés avec succès');
      printJS({
        printable: result.data,
        type: 'pdf',
        showModal: true
      });
    }
  } catch (error) {
    console.error('Erreur lors de la génération des bulletins:', error);
    ElMessage.error('Erreur lors de la génération');
  } finally {
    generatingMultiple.value = false;
  }
};

const getInitials = (student: Student): string => {
  return `${student.firstname[0]}${student.lastname[0]}`;
};

const goToConfig = () => {
  router.push('/settings/notes');
};

// Fonction d'impression
const handlePrint = () => {
  if (!previewRef.value) return;
  
  printJS({
    printable: previewRef.value.innerHTML,
    type: 'html',
    targetStyles: ['*'],
    documentTitle: `Bulletin_${previewData.value?.student?.matricule}`,
    onPrintDialogClose: () => {
      console.log('Impression terminée');
    }
  });
};

// Initialisation
onMounted(() => {
  loadGrades();
  loadSchoolInfo();
});

// Watcher pour charger les étudiants quand la classe change
watch(selectedGrade, () => {
  if (selectedGrade.value) {
    loadStudents();
  }
});
</script>

<style scoped>
.report-card-view {
  padding: 20px;
  height: 100vh;
  display: flex;
  flex-direction: column;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filters {
  display: flex;
  gap: 16px;
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

.students-table-container {
  flex: 1;
  overflow: hidden;
}

.fixed-actions {
  position: sticky;
  bottom: 0;
  background: white;
  padding: 16px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 16px;
  z-index: 10;
}

.templates-preview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
  gap: 30px;
  padding: 20px;
  background-color: #f5f7fa;
}

.template-preview-item {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.template-header {
  padding: 15px;
  border-bottom: 1px solid #eee;
}

.template-header h3 {
  margin: 0;
  color: var(--el-color-primary);
  font-size: 18px;
}

.template-header p {
  margin: 5px 0 0;
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.template-preview-content {
  padding: 20px;
  transform: scale(0.6);
  transform-origin: top center;
  height: 600px;
  overflow: hidden;
}

.preview-container {
  background: #f5f7fa;
  padding: 20px;
  min-height: 60vh;
  overflow-y: auto;
}

@media print {
  .config-section,
  .el-dialog__header,
  .el-dialog__footer {
    display: none !important;
  }

  .preview-container {
    padding: 0;
    overflow: visible;
  }
}

.config-button {
  display: flex;
  align-items: center;
  gap: 8px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-button {
  margin-bottom: 20px;
}

/* Ajustements pour le mode plein écran */
:deep(.el-dialog.is-fullscreen) {
  .el-dialog__body {
    height: calc(100vh - 120px);
    overflow-y: auto;
  }
}
</style> 