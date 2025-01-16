<template>
  <div class="student-card-view">
    <el-row :gutter="20" class="main-layout">
      <!-- Liste des étudiants (à gauche) -->
      <el-col :span="14" class="students-panel">
        <el-card class="students-card">
          <template #header>
            <div class="students-header">
              <div class="search-filters">
                <el-select 
                  v-model="selectedGrade" 
                  placeholder="Filtrer par classe" 
                  clearable
                  class="grade-filter"
                >
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
                  class="search-input"
                >
                  <template #prefix>
                    <Icon icon="mdi:magnify" />
                  </template>
                </el-input>
              </div>
            </div>
          </template>

          <el-table 
            :data="filteredStudents" 
            @selection-change="handleSelectionChange" 
            v-loading="loading"
            class="students-table"
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
            <el-table-column prop="grade.name" label="Classe" width="120" />
          </el-table>
        </el-card>
      </el-col>

      <!-- Panneau de droite (Configuration et Aperçu) -->
      <el-col :span="10" class="right-panel">
        <!-- Actions -->
        <el-card class="actions-card">
          <el-button 
            type="primary" 
            @click="handlePrint" 
            :disabled="!selectedStudents.length"
            class="print-button"
          >
            <Icon icon="mdi:printer" class="mr-2" />
            Imprimer les cartes sélectionnées ({{ selectedStudents.length }})
          </el-button>
        </el-card>

        <!-- Configuration et Aperçu -->
        <el-card class="config-preview-card">
          <el-tabs v-model="activeTab" class="config-tabs" type="border-card">
            <el-tab-pane label="Template" name="template">
              <div class="templates-container">
                <h4>Choisir un modèle de carte</h4>
                <div class="templates-grid">
                  <div 
                    v-for="template in templates" 
                    :key="template.id"
                    class="template-card"
                    :class="{ 'selected': selectedTemplate === template.id }"
                    @click="selectedTemplate = template.id"
                  >
                    <div class="template-content">
                      <h4>{{ template.name }}</h4>
                      <p>{{ template.description }}</p>
                    </div>
                    <el-radio :label="template.id" v-model="selectedTemplate" />
                  </div>
                </div>
              </div>
            </el-tab-pane>

            <el-tab-pane label="Couleurs" name="colors">
              <ColorSchemeSelector v-model="selectedColorScheme" />
            </el-tab-pane>

            <el-tab-pane label="Aperçu" name="preview">
              <div class="preview-container">
                <component
                  :is="getCurrentTemplate"
                  :student="previewStudent || selectedStudents[0] || {}"
                  :school-info="schoolInfo"
                  :color-scheme="selectedColorScheme"
                  class="preview-component"
                />
              </div>
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import CardTemplateOne from '@/components/cardStudent/templates/CardTemplateOne.vue';
import CardTemplateTwo from '@/components/cardStudent/templates/CardTemplateTwo.vue';
import CardTemplateThree from '@/components/cardStudent/templates/CardTemplateThree.vue';
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

// Computed
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
  try {
    loading.value = true;
    const [schoolResult, gradesResult, studentsResult] = await Promise.all([
      window.ipcRenderer.invoke('school:get'),
      window.ipcRenderer.invoke('grade:all'),
      window.ipcRenderer.invoke('student:all')
    ]);

    if (schoolResult.success && schoolResult.data) {
      const school = schoolResult.data;
      if (school.logo?.id) {
        const logoResult = await window.ipcRenderer.invoke('getStudentPhoto', school.logo.id);
        if (logoResult.success && logoResult.data) {
          school.logo.url = `data:${logoResult.data.type};base64,${logoResult.data.content}`;
        }
      }
      schoolInfo.value = school;
    }

    if (gradesResult.success) {
      grades.value = gradesResult.data;
    }

    if (studentsResult.success) {
      students.value = await Promise.all(studentsResult.data.map(async (student: any) => {
        if (student.photo?.id) {
          const photoResult = await window.ipcRenderer.invoke('getStudentPhoto', student.photo.id);
          if (photoResult.success && photoResult.data) {
            student.photo.url = `data:${photoResult.data.type};base64,${photoResult.data.content}`;
          }
        }
        return student;
      }));
    }
  } catch (error) {
    console.error('Erreur chargement:', error);
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

const handlePrint = () => {
  if (!selectedStudents.value.length) return;

  const printWindow = window.open('', '_blank');
  if (!printWindow) return;

  // Styles spécifiques pour l'impression
  const styles = document.createElement('style');
  styles.textContent = `
    @page {
      size: 85.6mm 54mm landscape;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      width: 85.6mm;
      height: 54mm;
      background: white;
    }
    .print-container {
      width: 85.6mm;
    }
    .print-card {
      width: 85.6mm;
      height: 54mm;
      padding: 5mm;
      page-break-after: always;
      background: white;
      display: flex;
      flex-direction: column;
      position: relative;
    }
    .card-header {
      display: flex;
      align-items: center;
      gap: 5mm;
      margin-bottom: 3mm;
      height: 8mm;
    }
    .school-info {
      display: flex;
      align-items: center;
      gap: 2mm;
    }
    .school-logo {
      width: 6mm;
      height: 6mm;
      object-fit: contain;
    }
    .school-name {
      font-size: 3mm;
      color: ${selectedColorScheme.value.primary};
      font-weight: bold;
    }
    .card-content {
      display: flex;
      gap: 5mm;
      flex: 1;
    }
    .photo-section {
      width: 25mm;
    }
    .student-photo {
      width: 25mm;
      height: 32mm;
      object-fit: cover;
      border: 0.3mm solid #ddd;
      border-radius: 1mm;
    }
    .info-section {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: 2mm;
    }
    .student-name {
      font-size: 4mm;
      font-weight: bold;
      color: ${selectedColorScheme.value.secondary};
    }
    .student-details {
      font-size: 3mm;
      color: #666;
    }
    .matricule {
      color: ${selectedColorScheme.value.primary};
      font-weight: 500;
    }
    @media print {
      .print-card {
        break-inside: avoid;
      }
    }
  `;

  // Création du HTML pour chaque carte
  const createCardHTML = (student: any) => `
    <div class="print-card">
      <div class="card-header">
        <div class="school-info">
          <img src="${schoolInfo.value?.logo?.url || ''}" class="school-logo" alt="Logo">
          <div class="school-name">${schoolInfo.value?.name || ''}</div>
        </div>
      </div>
      <div class="card-content">
        <div class="photo-section">
          <img src="${student.photo?.url || ''}" class="student-photo" alt="Photo">
        </div>
        <div class="info-section">
          <div class="student-name">${student.firstname || ''} ${student.lastname || ''}</div>
          <div class="student-details matricule">№ ${student.matricule || ''}</div>
          <div class="student-details">Classe: ${student.grade?.name || ''}</div>
        </div>
      </div>
    </div>
  `;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=85.6mm, height=54mm, initial-scale=1.0">
        <title>Cartes Étudiants</title>
      </head>
      <body>
        <div class="print-container">
          ${selectedStudents.value.map(student => createCardHTML(student)).join('')}
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.head.appendChild(styles);

  // Script pour l'impression
  const printScript = document.createElement('script');
  printScript.textContent = `
    window.onload = () => {
      setTimeout(() => {
        window.print();
        window.close();
      }, 1000);
    };
  `;
  printWindow.document.body.appendChild(printScript);
  printWindow.document.close();
};

// Initialisation
loadData();
</script>


<style scoped>
.student-card-view {
  padding: 1rem;
  height: calc(100vh - 80px);
  background-color: var(--el-bg-color-page);
}

.main-layout {
  height: 100%;
}

/* Panel gauche - Liste des étudiants */
.students-panel {
  height: 100%;
}

.students-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.students-table {
  flex: 1;
  height: calc(100% - 60px);
}

/* Panel droite */
.right-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.actions-card {
  padding: 0.5rem;
}

.print-button {
  width: 100%;
}

.config-preview-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Configuration des templates */
.templates-container {
  padding: 1rem;
}

.templates-grid {
  display: grid;
  gap: 1rem;
  margin-top: 1rem;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 0.5rem;
}

.template-card {
  border: 1px solid var(--el-border-color);
  border-radius: var(--el-border-radius-base);
  padding: 1rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.template-card.selected {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

/* Aperçu */
.preview-container {
  height: 400px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(45deg, #f8f9fa, #fff);
  padding: 2rem;
}

.preview-component {
  transform: scale(1.2);
  transition: transform 0.3s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.preview-container:hover .preview-component {
  transform: scale(1.3);
}

/* Utilitaires */
.search-filters {
  display: flex;
  gap: 1rem;
}

.grade-filter {
  width: 200px;
}

.search-input {
  flex: 1;
}

/* Responsive */
@media (max-width: 1200px) {
  .main-layout {
    flex-direction: column;
  }

  .el-col {
    width: 100% !important;
  }

  .students-panel {
    height: 50vh;
    margin-bottom: 1rem;
  }

  .preview-container {
    height: 300px;
  }
}
</style>