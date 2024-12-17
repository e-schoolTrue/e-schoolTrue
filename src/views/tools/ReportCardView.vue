<template>
  <div class="report-card-view">
    <el-row :gutter="20">
      <!-- Colonne de configuration -->
      <el-col :span="8">
        <el-card class="config-section">
          <template #header>
            <h2>Configuration du bulletin</h2>
          </template>

          <el-tabs v-model="activeTab">
            <!-- Sélection du template -->
            <el-tab-pane label="Template" name="template">
              <div class="templates-list">
                <el-radio-group v-model="selectedTemplate" class="template-radio-group">
                  <div
                    v-for="template in templates"
                    :key="template.id"
                    class="template-item"
                  >
                    <el-radio :label="template.id">
                      <div class="template-info">
                        <h3>{{ template.name }}</h3>
                        <p>{{ template.description }}</p>
                      </div>
                    </el-radio>
                    <div class="template-preview">
                      <component
                        :is="template.component"
                        :report="previewReport"
                        :school-info="schoolInfo"
                      />
                    </div>
                  </div>
                </el-radio-group>
              </div>
            </el-tab-pane>

            <!-- Configuration période -->
            <el-tab-pane label="Période" name="period">
              <el-form>
                <el-form-item label="Année scolaire">
                  <el-select v-model="selectedSchoolYear">
                    <el-option
                      v-for="year in schoolYears"
                      :key="year"
                      :label="year"
                      :value="year"
                    />
                  </el-select>
                </el-form-item>

                <el-form-item label="Période">
                  <el-select v-model="selectedPeriod">
                    <el-option
                      v-for="period in periods"
                      :key="period.value"
                      :label="period.label"
                      :value="period.value"
                    />
                  </el-select>
                </el-form-item>
              </el-form>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>

      <!-- Colonne de droite pour la liste des étudiants -->
      <el-col :span="16">
        <el-card class="students-section">
          <template #header>
            <div class="students-header">
              <div class="filters">
                <el-select v-model="selectedGrade" placeholder="Filtrer par classe" clearable>
                  <el-option
                    v-for="grade in grades"
                    :key="grade.id"
                    :label="grade.name"
                    :value="grade.id"
                  />
                </el-select>

                <el-input
                  v-model="searchQuery"
                  placeholder="Rechercher un étudiant..."
                  clearable
                >
                  <template #prefix>
                    <Icon icon="mdi:magnify" />
                  </template>
                </el-input>
              </div>

              <el-button 
                type="primary" 
                @click="generateReports" 
                :disabled="!selectedStudents.length"
              >
                <Icon icon="mdi:file-document" class="mr-2" />
                Générer ({{ selectedStudents.length }})
              </el-button>
            </div>
          </template>

          <el-table
            :data="filteredStudents"
            @selection-change="handleSelectionChange"
            v-loading="loading"
            height="calc(100vh - 300px)"
          >
            <el-table-column type="selection" width="55" />
            <el-table-column label="Matricule" prop="matricule" width="120" />
            <el-table-column label="Nom" prop="lastname" />
            <el-table-column label="Prénom" prop="firstname" />
            <el-table-column label="Classe" prop="grade.name" width="120" />
            <el-table-column label="Moyenne" width="100" align="center">
              <template #default="{ row }">
                {{ getStudentAverage(row.id) }}
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- Dialog de prévisualisation -->
    <el-dialog
      v-model="previewDialogVisible"
      title="Prévisualisation des bulletins"
      width="80%"
      fullscreen
    >
      <div class="preview-container">
        <component
          v-for="student in selectedStudents"
          :key="student.id"
          :is="getSelectedTemplateComponent"
          :report="getStudentReport(student)"
          :school-info="schoolInfo"
          class="preview-item"
        />
      </div>

      <template #footer>
        <el-button @click="previewDialogVisible = false">Fermer</el-button>
        <el-button type="primary" @click="printReports">
          <Icon icon="mdi:printer" class="mr-2" />
          Imprimer
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { Icon } from '@iconify/vue';
import type { ReportCard, ReportCardTemplate } from '@/types/report';
import ReportTemplateOne from '@/components/report/templates/ReportTemplateOne.vue';
import ReportTemplateTwo from '@/components/report/templates/ReportTemplateTwo.vue';
import ReportTemplateThree from '@/components/report/templates/ReportTemplateThree.vue';
import { ElMessage } from 'element-plus';

// États
const loading = ref(false);
const activeTab = ref('template');
const selectedTemplate = ref('template1');
const selectedSchoolYear = ref('2023-2024');
const selectedPeriod = ref('t1');
const selectedGrade = ref<number | null>(null);
const searchQuery = ref('');
const selectedStudents = ref<any[]>([]);
const previewDialogVisible = ref(false);
const schoolInfo = ref<any>(null);
const students = ref<any[]>([]);
const grades = ref<any[]>([]);

// Templates disponibles
const templates: ReportCardTemplate[] = [
  {
    id: 'template1',
    name: 'Classique',
    description: 'Template de bulletin classique avec en-tête institutionnel',
    component: ReportTemplateOne
  },
  {
    id: 'template2',
    name: 'Moderne',
    description: 'Design moderne avec mise en page optimisée',
    component: ReportTemplateTwo
  },
  {
    id: 'template3',
    name: 'Détaillé',
    description: 'Format détaillé avec graphiques et statistiques',
    component: ReportTemplateThree
  }
];

// Périodes disponibles
const periods = [
  { value: 't1', label: '1er Trimestre' },
  { value: 't2', label: '2ème Trimestre' },
  { value: 't3', label: '3ème Trimestre' },
  { value: 'annual', label: 'Annuel' }
];

// Années scolaires
const schoolYears = computed(() => {
  const currentYear = new Date().getFullYear();
  return [
    `${currentYear-1}-${currentYear}`,
    `${currentYear}-${currentYear+1}`
  ];
});

// Étudiants filtrés
const filteredStudents = computed(() => {
  let filtered = students.value;
  
  if (selectedGrade.value) {
    filtered = filtered.filter(s => s.grade.id === selectedGrade.value);
  }
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(s => 
      s.firstname.toLowerCase().includes(query) ||
      s.lastname.toLowerCase().includes(query) ||
      s.matricule.toLowerCase().includes(query)
    );
  }
  
  return filtered;
});

// Composant template sélectionné
const getSelectedTemplateComponent = computed(() => {
  return templates.find(t => t.id === selectedTemplate.value)?.component;
});

// Rapport de prévisualisation
const previewReport = computed(() => {
  if (!students.value.length) return null;
  return getStudentReport(students.value[0]);
});

// Méthodes
const loadData = async () => {
  loading.value = true;
  try {
    const [studentsResult, gradesResult, schoolResult] = await Promise.all([
      window.ipcRenderer.invoke('student:all'),
      window.ipcRenderer.invoke('grade:all'),
      window.ipcRenderer.invoke('school:get')
    ]);

    if (studentsResult.success) students.value = studentsResult.data;
    if (gradesResult.success) grades.value = gradesResult.data;
    if (schoolResult.success) schoolInfo.value = schoolResult.data;
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
    ElMessage.error('Erreur lors du chargement des données');
  } finally {
    loading.value = false;
  }
};

const handleSelectionChange = (selection: any[]) => {
  selectedStudents.value = selection;
};

const getStudentAverage = (studentId: number) => {
  // À implémenter: calcul de la moyenne de l'étudiant
  return '15.5';
};

const getStudentReport = (student: any): ReportCard => {
  // À implémenter: génération du rapport pour un étudiant
  return {
    id: 0,
    period: selectedPeriod.value,
    schoolYear: selectedSchoolYear.value,
    grades: [],
    average: 0,
    classAverage: 0,
    rank: 1,
    totalStudents: 0,
    student: student
  };
};

const generateReports = () => {
  previewDialogVisible.value = true;
};

const printReports = () => {
  window.print();
};

// Chargement initial
onMounted(loadData);
</script>

<style scoped>
.report-card-view {
  padding: 20px;
}

.templates-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.template-item {
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 15px;
  transition: all 0.3s ease;
}

.template-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 2px 12px 0 rgba(0,0,0,.1);
}

.template-info {
  margin-bottom: 15px;
}

.template-info h3 {
  margin: 0 0 5px 0;
  font-size: 16px;
}

.template-info p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.template-preview {
  transform: scale(0.5);
  transform-origin: top center;
}

.students-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 15px;
}

.filters {
  display: flex;
  gap: 15px;
  flex: 1;
}

.preview-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 20px;
}

@media print {
  .config-section,
  .students-section,
  .el-dialog__header,
  .el-dialog__footer {
    display: none !important;
  }

  .preview-container {
    padding: 0;
  }

  .preview-item {
    page-break-after: always;
  }
}
</style> 