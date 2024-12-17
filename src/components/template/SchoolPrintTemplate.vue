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
                  <div v-for="template in templates" :key="template.id" class="template-item">
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
              <ColorSchemeSelector v-model="selectedColorScheme" @update:modelValue="updatePreview" />
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
                  <el-option v-for="grade in grades" :key="grade.id" :label="grade.name" :value="grade.id" />
                </el-select>
                <el-input v-model="searchQuery" placeholder="Rechercher un étudiant..." clearable>
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

          <el-table :data="filteredStudents" @selection-change="handleSelectionChange" v-loading="loading" height="calc(100vh - 300px)">
            <el-table-column type="selection" width="55" />
            <el-table-column label="Photo" width="80">
              <template #default="{ row }">
                <el-avatar :size="40" :src="row.photo?.path">{{ getInitials(row) }}</el-avatar>
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
const previewStudent = ref<any>(null);
const selectedColorScheme = ref<ColorScheme>({ ...DEFAULT_COLOR_SCHEME });
const printDialogVisible =ref<number | null>(null);
// Templates disponibles

const printSelectedCards = () => {
  if (selectedStudents.value.length === 0) {
    ElMessage.warning('Veuillez sélectionner au moins un étudiant');
    return;
  }
  printDialogVisible.value = true;
};


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
const loadSchoolInfo = async () => {
  try {
    const result = await window.ipcRenderer.invoke('school:get');
    if (result.success) {
      schoolInfo.value = result.data;
      if (schoolInfo.value?.logo?.path) {
        const fileResult = await window.ipcRenderer.invoke('file:getUrl', schoolInfo.value.logo.path);
        if (fileResult.success) {
          schoolInfo.value.logo.url = `data:${fileResult.data.type};base64,${fileResult.data.content}`;
        }
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement des informations de l\'école:', error);
  }
};

const loadData = async () => {
  loading.value = true;
  try {
    const [studentsResult, gradesResult] = await Promise.all([
      window.ipcRenderer.invoke('student:all'),
      window.ipcRenderer.invoke('grade:all')
    ]);

    if (studentsResult.success) {
      students.value = studentsResult.data;
      if (students.value.length > 0) previewStudent.value = students.value[0];
    }
    if (gradesResult.success) grades.value = gradesResult.data;
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
    ElMessage.error('Erreur lors du chargement des données');
  } finally {
    loading.value = false;
  }
};
const updatePreview = () => {
 // logic to update preview 
};


const handleSelectionChange = (selection: any[]) => {
  selectedStudents.value = selection;
};

const getInitials = (student: any) => `${student.firstname?.[0] || ''}${student.lastname?.[0] || ''}`.toUpperCase();

// Initialisation
onMounted(async () => {
  await loadSchoolInfo();
  await loadData();
});
</script>

<style scoped>
.print-page {
  width: 210mm;
  min-height: 297mm;
  padding: 20mm;
  margin: 0 auto;
  background: white;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  position: relative;
}

.republic-header {
  text-align: center;
  margin-bottom: 20px;
}

.header {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 20px;
  align-items: center;
  margin-bottom: 30px;
  border-bottom: 2px solid #333;
  padding-bottom: 15px;
}

.header-left {
  text-align: left;
}

.header-center {
  text-align: center;
}

.header-right {
  text-align: right;
}

.school-logo {
  max-height: 80px;
  width: auto;
}

.document-header {
  text-align: center;
  margin: 20px 0;
}

.document-title {
  font-size: 24px;
  font-weight: bold;
  margin-bottom: 10px;
}

.generic-table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
}

.generic-table th,
.generic-table td {
  border: 1px solid #ddd;
  padding: 8px;
  text-align: left;
}

.generic-table th {
  background-color: #f5f5f5;
  font-weight: bold;
}

.generic-table tr:nth-child(even) {
  background-color: #fafafa;
}

.footer {
  position: absolute;
  bottom: 20mm;
  width: calc(100% - 40mm);
  text-align: center;
  font-size: 12px;
  color: #666;
  border-top: 1px solid #ddd;
  padding-top: 10px;
}

@media print {
  .print-page {
    width: 100%;
    min-height: auto;
    padding: 0;
    margin: 0;
    box-shadow: none;
  }

  @page {
    size: A4;
    margin: 20mm;
  }
}
</style>