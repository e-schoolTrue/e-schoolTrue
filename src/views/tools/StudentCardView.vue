<template>
  <div class="student-card-view">
    <el-row :gutter="20">
      <!-- Colonne de gauche pour la configuration -->
      <el-col :span="8">
        <el-card class="config-section">
          <template #header>
            <h2>Configuration des cartes</h2>
          </template>

          <el-tabs v-model="activeTab">
            <!-- Onglet Template -->
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
                        :student="previewStudent"
                        :school-info="schoolInfo"
                        :color-scheme="selectedColorScheme"
                      />
                    </div>
                  </div>
                </el-radio-group>
              </div>
            </el-tab-pane>

            <!-- Onglet Couleurs -->
            <el-tab-pane label="Couleurs" name="colors">
              <ColorSchemeSelector
                v-model="selectedColorScheme"
                @update:modelValue="updatePreview"
              />
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

              <el-button type="primary" @click="printSelectedCards" :disabled="!selectedStudents.length">
                <Icon icon="mdi:printer" class="mr-2" />
                Imprimer ({{ selectedStudents.length }})
              </el-button>
            </div>
          </template>

          <!-- Table des étudiants -->
          <el-table
            :data="filteredStudents"
            @selection-change="handleSelectionChange"
            v-loading="loading"
            height="calc(100vh - 300px)"
          >
            <el-table-column type="selection" width="55" />
            
            <el-table-column label="Photo" width="80">
              <template #default="{ row }">
                <el-avatar :size="40" :src="row.photo?.path">
                  {{ getInitials(row) }}
                </el-avatar>
              </template>
            </el-table-column>

            <el-table-column prop="matricule" label="Matricule" width="120" />
            <el-table-column prop="firstname" label="Prénom" />
            <el-table-column prop="lastname" label="Nom" />
            <el-table-column prop="grade.name" label="Classe" width="120" />

            <el-table-column label="Aperçu" width="100" align="center">
              <template #default="{ row }">
                <el-button type="primary" @click="previewStudent = row">
                  <Icon icon="mdi:eye" />
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- Dialog d'impression -->
    <el-dialog
      v-model="printDialogVisible"
      title="Impression des cartes"
      width="80%"
      top="5vh"
    >
      <div class="print-preview">
        <div
          v-for="student in selectedStudents"
          :key="student.id"
          class="print-card"
        >
          <component
            :is="getCurrentTemplate"
            :student="student"
            :school-info="schoolInfo"
            :color-scheme="selectedColorScheme"
          />
        </div>
      </div>

      <template #footer>
        <el-button @click="printDialogVisible = false">Annuler</el-button>
        <el-button type="primary" @click="handlePrint">
          <Icon icon="mdi:printer" class="mr-2" />
          Imprimer
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import CardTemplateOne from '@/components/cardStudent/templates/CardTemplateOne.vue';
import CardTemplateTwo from '@/components/cardStudent/templates/CardTemplateTwo.vue';
import CardTemplateThree from '@/components/cardStudent/templates/CardTemplateThree.vue';
import ColorSchemeSelector from '@/components/cardStudent/ColorSchemeSelector.vue';
import { DEFAULT_COLOR_SCHEME } from '@/constants/colorSchemes';
import type { ColorScheme } from '@/types/card';

// États
const loading = ref(false);
const activeTab = ref('template');
const selectedTemplate = ref('template1');
const selectedGrade = ref<number | null>(null);
const searchQuery = ref('');
const students = ref<any[]>([]);
const selectedStudents = ref<any[]>([]);
const grades = ref<any[]>([]);
const schoolInfo = ref<any>(null);
const printDialogVisible = ref(false);
const previewStudent = ref<any>(null);
const selectedColorScheme = ref<ColorScheme>({ ...DEFAULT_COLOR_SCHEME });

// Templates disponibles
const templates = [
  {
    id: 'template1',
    component: CardTemplateOne,
    name: 'Template Classique',
    description: 'Design professionnel et épuré'
  },
  {
    id: 'template2',
    component: CardTemplateTwo,
    name: 'Template Moderne',
    description: 'Style contemporain et dynamique'
  },
  {
    id: 'template3',
    component: CardTemplateThree,
    name: 'Template Premium',
    description: 'Design élégant et sophistiqué'
  }
];

// Computed properties
const getCurrentTemplate = computed(() => {
  const template = templates.find(t => t.id === selectedTemplate.value);
  return template ? template.component : CardTemplateOne;
});

const filteredStudents = computed(() => {
  let filtered = [...students.value];
  
  if (selectedGrade.value) {
    filtered = filtered.filter(s => s.grade?.id === selectedGrade.value);
  }
  
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(s => 
      s.firstname?.toLowerCase().includes(query) ||
      s.lastname?.toLowerCase().includes(query) ||
      s.matricule?.toLowerCase().includes(query)
    );
  }
  
  return filtered;
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

    if (studentsResult.success) {
      // Charger les URLs des images pour chaque étudiant
      const studentsWithImages = await Promise.all(
        studentsResult.data.map(async (student: any) => {
          if (student.photo?.path) {
            const fileResult = await window.ipcRenderer.invoke('file:getUrl', student.photo.path);
            if (fileResult.success) {
              student.photo.url = `data:${fileResult.data.type};base64,${fileResult.data.content}`;
            }
          }
          return student;
        })
      );
      students.value = studentsWithImages;
      
      // Définir un étudiant de prévisualisation
      if (students.value.length > 0) {
        previewStudent.value = students.value[0];
      }
    }

    if (schoolResult.success) {
      schoolInfo.value = schoolResult.data;
      if (schoolInfo.value?.logo?.path) {
        const fileResult = await window.ipcRenderer.invoke('file:getUrl', schoolInfo.value.logo.path);
        if (fileResult.success) {
          schoolInfo.value.logo.url = `data:${fileResult.data.type};base64,${fileResult.data.content}`;
        }
      }
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error('Erreur lors du chargement des données');
  } finally {
    loading.value = false;
  }
};

const handleSelectionChange = (selection: any[]) => {
  selectedStudents.value = selection;
};

const getInitials = (student: any) => {
  return `${student.firstname?.[0] || ''}${student.lastname?.[0] || ''}`.toUpperCase();
};

const updatePreview = () => {
  // Mise à jour de la prévisualisation si nécessaire
};

const handlePrint = () => {
  // Logique d'impression
  printDialogVisible.value = false;
};

const printSelectedCards = () => {
  if (selectedStudents.value.length === 0) {
    ElMessage.warning('Veuillez sélectionner au moins un étudiant');
    return;
  }
  printDialogVisible.value = true;
};

// Initialisation
onMounted(loadData);
</script>

<style scoped>
.student-card-view {
  padding: 20px;
  min-height: calc(100vh - 40px);
  background-color: #f5f7fa;
}

.template-radio-group {
  display: flex;
  flex-direction: column;
  gap: 20px;
  width: 100%;
}

.template-item {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 15px;
  transition: all 0.3s ease;
}

.template-item:hover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
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
  display: flex;
  justify-content: center;
  margin-top: 15px;
  transform: scale(0.8);
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

.print-preview {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(85.6mm, 1fr));
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

  .print-preview {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 10mm;
  }

  .print-card {
    page-break-inside: avoid;
  }
}
</style> 