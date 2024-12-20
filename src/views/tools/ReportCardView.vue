<template>
  <div class="report-card-view">
    <el-card class="config-section">
      <template #header>
        <div class="header-content">
          <h2>Génération des Bulletins</h2>
          <el-button type="primary" @click="goToConfig">
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
            :value="template.component"
          >
            <div class="template-option">
              <span>{{ template.name }}</span>
              <small>{{ template.description }}</small>
            </div>
          </el-option>
        </el-select>
      </div>

      <!-- Prévisualisation des templates -->
      <el-dialog
        v-model="templatePreviewVisible"
        title="Aperçu des modèles de bulletin"
        width="90%"
        top="5vh"
      >
        <div class="templates-preview">
          <div v-for="template in templates" :key="template.id" class="template-preview-item">
            <h3>{{ template.name }}</h3>
            <p>{{ template.description }}</p>
            <div class="template-preview-content">
              <component 
                :is="template.component"
                :student="sampleStudent"
                :grades="sampleGrades"
                :period="selectedPeriod"
                :config="config"
                :school-info="schoolInfo"
              />
            </div>
          </div>
        </div>
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
        <el-button @click="templatePreviewVisible = true">
          <Icon icon="mdi:eye" class="mr-2" />
          Aperçu des modèles
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
          :is="selectedTemplate"
          v-if="previewData"
          :student="previewData.student"
          :grades="previewData.grades"
          :period="selectedPeriod"
          :config="previewData.config"
          :school-info="schoolInfo"
          :rank="previewData.rank"
          :total-students="previewData.totalStudents"
          :observations="previewData.observations"
        />
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="previewVisible = false">Fermer</el-button>
          <el-button type="primary" @click="printPreview">
            <Icon icon="mdi:printer" class="mr-2" />
            Imprimer
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import { reportTemplates } from '@/config/reportTemplates';
import { ReportService } from '@/services/reportService';
import printJS from 'print-js';

const router = useRouter();
const reportService = new ReportService();

// États
const loading = ref(false);
const grades = ref([]);
const students = ref([]);
const selectedGrade = ref(null);
const selectedPeriod = ref(null);
const selectedTemplate = ref(reportTemplates[0].component);
const selectedStudents = ref([]);
const previewVisible = ref(false);
const previewData = ref(null);
const generating = reactive({});
const generatingMultiple = ref(false);
const schoolInfo = ref(null);
const previewRef = ref(null);
const templatePreviewVisible = ref(false);
const config = ref(null);
const sampleStudent = ref({
  firstname: 'Jean',
  lastname: 'Dupont',
  matricule: '2024001',
  grade: { name: '6ème A' },
  photo: { url: '' }
});
const sampleGrades = ref([
  { courseName: 'Mathématiques', coefficient: 2, grade: 15, classAverage: 12.5 },
  { courseName: 'Français', coefficient: 2, grade: 14, classAverage: 13 },
  // ... autres exemples de notes
]);

// Périodes
const periods = [
  { value: 'trimester1', label: '1er Trimestre' },
  { value: 'trimester2', label: '2ème Trimestre' },
  { value: 'trimester3', label: '3ème Trimestre' },
  { value: 'semester1', label: '1er Semestre' },
  { value: 'semester2', label: '2ème Semestre' },
  { value: 'year', label: 'Année Scolaire' }
];

// Templates disponibles
const templates = reportTemplates;

// Méthodes
const loadGrades = async () => {
  const result = await window.ipcRenderer.invoke('grade:all');
  if (result.success) {
    grades.value = result.data;
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
  } finally {
    loading.value = false;
  }
};

const handleSelectionChange = (selection) => {
  selectedStudents.value = selection;
};

const previewReport = async (student) => {
  generating[student.id] = true;
  try {
    const result = await reportService.generateReport(student.id, selectedPeriod.value);
    if (result.success) {
      previewData.value = result.data;
      previewVisible.value = true;
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    ElMessage.error('Erreur lors de la génération du bulletin');
  } finally {
    generating[student.id] = false;
  }
};

const generateReports = async () => {
  generatingMultiple.value = true;
  try {
    // Implémenter la génération multiple
  } finally {
    generatingMultiple.value = false;
  }
};

const printPreview = () => {
  if (!previewRef.value) return;
  
  printJS({
    printable: previewRef.value,
    type: 'html',
    targetStyles: ['*'],
    documentTitle: `Bulletin_${previewData.value?.student?.matricule}`,
    onPrintDialogClose: () => {
      console.log('Impression terminée');
    }
  });
};

const goToConfig = () => {
  router.push('/notes/configuration');
};

const getInitials = (student) => {
  return `${student.firstname[0]}${student.lastname[0]}`;
};

// Initialisation
onMounted(() => {
  loadGrades();
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
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 20px;
  padding: 20px;
}

.template-preview-item {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 15px;
}

.template-preview-content {
  transform: scale(0.5);
  transform-origin: top center;
  height: 400px;
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
</style> 