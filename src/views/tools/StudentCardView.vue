<template>
  <div class="student-card-view">
    <el-row :gutter="20">
      <!-- Configuration -->
      <el-col :span="6">
        <el-card class="config-card">
          <template #header>
            <h2 class="config-header">Configuration des cartes</h2>
          </template>

          <el-tabs v-model="activeTab" class="config-tabs">
            <el-tab-pane label="Template" name="template">
              <div class="templates-list">
                <el-radio-group v-model="selectedTemplate">
                  <div v-for="template in templates" :key="template.id" class="template-item">
                    <el-radio :label="template.id">
                      <div class="template-info">
                        <h3>{{ template.name }}</h3>
                        <p>{{ template.description }}</p>
                      </div>
                    </el-radio>
                  </div>
                </el-radio-group>
              </div>
            </el-tab-pane>

            <el-tab-pane label="Couleurs" name="colors">
              <ColorSchemeSelector v-model="selectedColorScheme" />
            </el-tab-pane>
          </el-tabs>
        </el-card>
      </el-col>

      <!-- Aperçu -->
      <el-col :span="10">
        <el-card class="preview-card">
          <template #header>
            <h2>Aperçu</h2>
          </template>
          <div class="preview-container" ref="previewContainer">
            <component
              :is="getCurrentTemplate"
              :student="previewStudent || selectedStudents[0] || {}"
              :school-info="schoolInfo || { name: '', logo: { url: '', optimizedUrl: ''} }"
              :color-scheme="selectedColorScheme"
            />
          </div>
        </el-card>
      </el-col>

      <!-- Liste des étudiants -->
      <el-col :span="8">
        <el-card class="students-card">
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

              <div class="action-buttons">
                <el-button 
                  type="primary" 
                  @click="handleExportPDF" 
                  :disabled="!selectedStudents.length"
                >
                  <Icon icon="mdi:printer" class="mr-2" />
                  Imprimer ({{ selectedStudents.length }})
                </el-button>
                <el-button
                  type="warning"
                  @click="showHelpDialog = true"
                  icon="QuestionFilled"
                />
              </div>
            </div>
          </template>

          <el-table 
            :data="filteredStudents" 
            @selection-change="handleSelectionChange" 
            v-loading="loading"
            height="calc(100vh - 200px)"
          >
            <el-table-column type="selection" width="45" />
            <el-table-column label="Photo" width="70">
              <template #default="{ row }">
                <el-avatar :size="40" :src="row.photo?.url">
                  {{ getInitials(row) }}
                </el-avatar>
              </template>
            </el-table-column>
            <el-table-column prop="matricule" label="Matricule" width="100" />
            <el-table-column prop="firstname" label="Prénom" min-width="120" />
            <el-table-column prop="lastname" label="Nom" min-width="120" />
            <el-table-column prop="grade.name" label="Classe" width="100" />
          </el-table>
        </el-card>
      </el-col>
    </el-row>

    <!-- Dialog d'aide pour l'impression -->
    <el-dialog
      v-model="showHelpDialog"
      title="Aide à l'impression"
      width="600px"
    >
      <h3>Problèmes d'impression?</h3>
      
      <el-collapse>
        
        <el-collapse-item title="Imprimer individuellement" name="1">
          <p>Si l'impression multiple ne fonctionne pas ou prend du temps, Imprimer les cartes de manière individuelle".</p>
          <p>En raison de la taille des cartes, l'impression multiple peut prendre du temps et parfois échouer.</p>
        </el-collapse-item>
        
        
        <el-collapse-item title="Configurer votre imprimante" name="4">
          <p>Pour les cartes au format CR80 (format carte de crédit):</p>
          <ul>
            <li>Assurez-vous que votre imprimante accepte ce format ou qu'elle a un bac spécial pour cartes.</li>
            <li>Pour une imprimante standard, utilisez du papier épais et découpez les cartes après impression.</li>
            <li>L'orientation doit être en paysage (Landscape).</li>
          </ul>
          <p>Pour le format A4:</p>
          <ul>
            <li>Vérifiez que les options de mise à l'échelle sont désactivées (échelle 100%).</li>
            <li>N'activez pas les options "Ajuster à la page".</li>
          </ul>
        </el-collapse-item>
      </el-collapse>
      
      <template #footer>
        <el-button type="primary" @click="showHelpDialog = false">Compris</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import CardTemplateOne from '@/components/cardStudent/templates/CardTemplateOne.vue';
import CardTemplateTwo from '@/components/cardStudent/templates/CardTemplateTwo.vue';
import CardTemplateThree from '@/components/cardStudent/templates/CardTemplateThree.vue';
import ColorSchemeSelector from '@/components/cardStudent/ColorSchemeSelector.vue';
import { DEFAULT_COLOR_SCHEME } from '@/constants/colorSchemes';
import type { ColorScheme, Student, SchoolInfo } from '@/types';
import { Loader } from '@/components/util/AppLoader'; // Assurez-vous que ce chemin est correct

import html2canvas from 'html2canvas';

// États réactifs
const loading = ref(false); // Pour le loader de la table
const activeTab = ref('template');
const selectedTemplate = ref('template1');
const selectedGrade = ref<number | null>(null);
const searchQuery = ref('');
const students = ref<Student[]>([]);
const selectedStudents = ref<Student[]>([]);
const grades = ref<any[]>([]);
const schoolInfo = ref<SchoolInfo | null>(null);
const previewStudent = ref<Student | null>(null);
const selectedColorScheme = ref<ColorScheme>({ ...DEFAULT_COLOR_SCHEME });
const showHelpDialog = ref(false);
const previewContainer = ref<HTMLDivElement | null>(null);
const worker = ref<Worker | null>(null);

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

const handleSelectionChange = (selection: any[]) => {
  selectedStudents.value = selection;
};

const getInitials = (student: any) => {
  return `${student.firstname?.[0] || ''}${student.lastname?.[0] || ''}`.toUpperCase();
};

// Helper pour réinitialiser l'état de l'aperçu et les styles des cartes
const resetPreviewAndCardStyles = async () => {
  previewStudent.value = selectedStudents.value.length > 0 ? selectedStudents.value[0] : (students.value.length > 0 ? students.value[0] : null);
  await nextTick();

  const cardElement = previewContainer.value?.querySelector<HTMLElement>(
    '.card-template-one, .card-template-two, .card-template-three'
  );
  if (cardElement) {
    const frontElement = cardElement.querySelector<HTMLElement>('.card-front');
    const backElement = cardElement.querySelector<HTMLElement>('.card-back');
    if (frontElement && backElement) {
      frontElement.style.transform = 'rotateY(0deg)';
      backElement.style.transform = 'rotateY(180deg)';
      frontElement.style.transition = ''; // Réactiver les transitions
      backElement.style.transition = '';
    }
  }
};


const handleExportPDF = async () => {
  if (!selectedStudents.value.length) {
    ElMessage.error("Aucun étudiant sélectionné.");
    return;
  }
  if (!previewContainer.value) {
    ElMessage.error("Conteneur d'aperçu non trouvé.");
    return;
  }
  
  Loader.showLoader("Préparation de l'impression...");
  loading.value = true; // Loader de la table

  const cardElement = previewContainer.value?.querySelector<HTMLElement>(
    '.card-template-one, .card-template-two, .card-template-three'
  );
  
  if (!cardElement) {
    ElMessage.error("Template de carte non trouvé dans l'aperçu.");
    loading.value = false;
    Loader.hideLoader();
    return;
  }

  const allCapturedCardImages: { frontImgData: string; backImgData: string }[] = [];
  const totalStudents = selectedStudents.value.length;

  try {
    // Étape 1: Capturer toutes les images sur le thread principal
    for (let i = 0; i < totalStudents; i++) {
      const student = selectedStudents.value[i];
      previewStudent.value = student; 
      
      const progressCapture = Math.round(((i + 1) / totalStudents) * 50);
      Loader.showLoader(`Capture carte ${i + 1}/${totalStudents}... (${progressCapture}%)`);
      
      const frontElement = cardElement.querySelector<HTMLElement>('.card-front');
      const backElement = cardElement.querySelector<HTMLElement>('.card-back');

      if (!frontElement || !backElement) {
          ElMessage.warning(`Éléments recto/verso non trouvés pour ${student.firstname} ${student.lastname}. Carte ignorée.`);
          continue;
      }
      
      frontElement.style.transform = 'rotateY(0deg)';
      backElement.style.transform = 'rotateY(180deg)';
      frontElement.style.transition = 'none'; 
      backElement.style.transition = 'none';
      await nextTick(); 

      const frontCanvas = await html2canvas(frontElement, {
          scale: 2, useCORS: true, allowTaint: true, backgroundColor: null, logging: false,
          onclone: (clonedDoc) => {
              const clonedFront = clonedDoc.querySelector<HTMLElement>('.card-front');
              if (clonedFront) {
                  clonedFront.style.transform = 'rotateY(0deg)';
                  clonedFront.style.transition = 'none';
              }
          }
      });
      const frontImgData = frontCanvas.toDataURL('image/jpeg', 0.92);

      frontElement.style.transform = 'rotateY(-180deg)';
      backElement.style.transform = 'rotateY(0deg)';
      await nextTick();

      const backCanvas = await html2canvas(backElement, {
          scale: 2, useCORS: true, allowTaint: true, backgroundColor: null, logging: false,
          onclone: (clonedDoc) => {
              const clonedBack = clonedDoc.querySelector<HTMLElement>('.card-back');
               if (clonedBack) {
                  clonedBack.style.transform = 'rotateY(0deg)';
                  clonedBack.style.transition = 'none';
              }
          }
      });
      const backImgData = backCanvas.toDataURL('image/jpeg', 0.92);

      allCapturedCardImages.push({ frontImgData, backImgData });

      if ((i + 1) % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    if (allCapturedCardImages.length === 0) {
        ElMessage.warning("Aucune carte n'a pu être capturée.");
        loading.value = false;
        Loader.hideLoader();
        await resetPreviewAndCardStyles();
        return;
    }

    Loader.showLoader("Génération du PDF en cours... (50%)");

    if (worker.value) {
        worker.value.terminate();
        worker.value = null;
    }
    worker.value = new Worker(new URL('@/workers/cardWorker.ts', import.meta.url), { type: 'module' });

    worker.value.onmessage = async (e) => {
      const { success, blob, error: workerError } = e.data;
      if (success && blob) {
        Loader.showLoader("Ouverture de l'impression...");
        
        const pdfUrl = URL.createObjectURL(blob);
        const printWindow = window.open(pdfUrl, '_blank');

        if (printWindow) {
          // Attendre un peu pour que le PDF se charge dans la nouvelle fenêtre
          await new Promise(resolve => setTimeout(resolve, 1500)); 
          
          try {
            // L'appel à printWindow.print() peut être bloqué ou échouer silencieusement
            // selon les navigateurs et les configurations.
            printWindow.print();
            ElMessage.success("Impression lancée. Vérifiez la fenêtre d'impression.");
          } catch (printError) {
            console.error('Erreur lors de printWindow.print():', printError);
            ElMessage.error("Erreur lors du lancement de l'impression. Le PDF est ouvert pour impression manuelle.");
          } finally {
            Loader.hideLoader(); // Cacher le loader global ici
          }
        } else {
          ElMessage.error("Impossible d'ouvrir la fenêtre d'impression. Vérifiez les bloqueurs de pop-up. Le PDF est prêt mais non affiché.");
          Loader.hideLoader();
        }
      } else {
        console.error('Erreur du worker PDF:', workerError);
        ElMessage.error(`Erreur lors de la génération du PDF: ${workerError || 'Erreur inconnue du worker'}`);
        Loader.hideLoader();
      }
      
      // Actions finales communes à onmessage
      loading.value = false; // Cacher le loader de la table
      if (worker.value) {
        worker.value.terminate();
        worker.value = null;
      }
      await resetPreviewAndCardStyles();
    };

    worker.value.onerror = async (err) => {
      console.error('Erreur générale du Web Worker:', err);
      ElMessage.error('Erreur inattendue avec le service d\'impression.');
      Loader.hideLoader(); // Cacher le loader global
      loading.value = false; // Cacher le loader de la table
      if (worker.value) {
          worker.value.terminate();
          worker.value = null;
      }
      await resetPreviewAndCardStyles();
    };

    worker.value.postMessage({
      allCardsData: allCapturedCardImages,
      schoolName: schoolInfo.value?.name
    });
    
    // NE PAS cacher le loader ou mettre loading.value à false ici.
    // Cela se fera dans onmessage ou onerror du worker.

  } catch (error) { // Gère les erreurs pendant la capture d'image ou la configuration du worker
    console.error('Erreur générale dans handleExportPDF:', error);
    ElMessage.error("Erreur lors de la préparation de l'impression.");
    Loader.hideLoader(); // Cacher le loader global
    loading.value = false; // Cacher le loader de la table
    if (worker.value) { // Si le worker a été créé mais a échoué avant postMessage ou pendant
        worker.value.terminate();
        worker.value = null;
    }
    await resetPreviewAndCardStyles();
  } 
  // Il n'y a PLUS de 'finally' ici pour gérer le loader, car c'est géré par les callbacks du worker ou le catch ci-dessus.
};


// Initialisation
const loadData = async () => {
  try {
    loading.value = true; // Loader de table pour le chargement initial
    const [schoolResult, gradesResult, studentsResult] = await Promise.all([
      window.ipcRenderer.invoke('school:get'),
      window.ipcRenderer.invoke('grade:all'),
      window.ipcRenderer.invoke('student:all')
    ]);

    if (schoolResult.success && schoolResult.data) {
      const school = schoolResult.data;
      if (school.logo?.id) {
        const logoResult = await window.ipcRenderer.invoke('school:getLogo', school.logo.id);
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
      students.value = await Promise.all(studentsResult.data.map(async (student: Student) => {
        const processedStudent = { ...student };
        if (student.photo?.id) {
          const photoResult = await window.ipcRenderer.invoke('getStudentPhoto', student.photo.id);
          if (photoResult.success && photoResult.data) {
            processedStudent.photo = {
              ...student.photo,
              url: `data:${photoResult.data.type};base64,${photoResult.data.content}`
            };
          }
        }
        return processedStudent;
      }));
      // Mettre à jour l'aperçu initial si des étudiants sont chargés
      if (students.value.length > 0 && !previewStudent.value) {
        previewStudent.value = students.value[0];
      }
    }
  } catch (error) {
    console.error('Erreur chargement:', error);
    ElMessage.error('Erreur lors du chargement des données');
  } finally {
    loading.value = false; // Fin du loader de table pour le chargement initial
  }
};

onMounted(async () => {
  await loadData();
  // Assurer un état d'aperçu initial correct après le chargement des données
  await resetPreviewAndCardStyles();
});

onUnmounted(() => {
  if (worker.value) {
    worker.value.terminate();
    worker.value = null;
  }
  // Si le loader global est toujours affiché pour une raison quelconque (improbable mais par sécurité)
  Loader.hideLoader();
});

</script>

<style scoped>
.student-card-view {
  padding: 20px;
  height: calc(100vh - 40px);
  background-color: #f5f7fa;
  overflow: hidden;
}

.el-row {
  height: 100%;
}

.el-col {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.config-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.config-header {
  margin: 0;
  font-size: 1.2rem;
  padding: 8px 0;
}

.config-tabs {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.config-tabs :deep(.el-tabs__header) {
  margin-bottom: 15px;
}

.config-tabs :deep(.el-tabs__content) {
  flex: 1;
  overflow-y: auto;
  padding: 10px 0;
}

.config-tabs :deep(.el-tabs__nav) {
  width: 100%;
  display: flex;
}

.config-tabs :deep(.el-tabs__item) {
  flex: 1;
  text-align: center;
}

.templates-list {
  height: 100%;
  overflow-y: auto;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.template-item {
  border: 1px solid #eee;
  border-radius: 8px;
  padding: 12px;
  margin-bottom: 10px;
  transition: all 0.3s ease;
}

.template-item:last-child {
  margin-bottom: 0;
}

.template-info h3 {
  margin: 0 0 5px 0;
  font-size: 15px;
}

.template-info p {
  margin: 0;
  color: #666;
  font-size: 13px;
}

.preview-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.preview-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.preview-container {
  flex: 1;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(45deg, #f8f9fa, #fff);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.students-card {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.students-card :deep(.el-card__body) {
  flex: 1;
  padding: 10px;
}

.students-header {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.filters {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.el-table {
  margin-top: 10px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

@media (max-width: 1400px) {
  .el-col {
    width: 100% !important;
    margin-bottom: 20px;
  }
  
  .preview-card {
    height: 500px;
  }
}
</style>

