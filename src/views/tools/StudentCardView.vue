<template>
  <div class="student-card-view">
    <el-row :gutter="20">
      <!-- Configuration -->
      <el-col :span="8">
        <el-card>
          <template #header>
            <h2>Configuration des cartes</h2>
          </template>

          <el-tabs v-model="activeTab">
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

        <!-- Aperçu -->
        <el-card class="mt-4 preview-card">
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
      <el-col :span="16">
        <el-card>
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
                  type="success" 
                  @click="handleExportPDF(false)" 
                  :disabled="!selectedStudents.length"
                >
                  <Icon icon="mdi:file-pdf-box" class="mr-2" />
                  Exporter PDF
                </el-button>
                <el-button 
                  type="primary" 
                  @click="handleExportPDF(true)" 
                  :disabled="!selectedStudents.length"
                >
                  <Icon icon="mdi:printer" class="mr-2" />
                  Imprimer
                </el-button>
                <el-button 
                  type="info" 
                  @click="showOptionsDialog = true"
                  icon="Setting"
                />
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
            height="calc(100vh - 300px)"
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
    </el-row>

    <!-- Dialog de configuration des options d'impression -->
    <el-dialog
      v-model="showOptionsDialog"
      title="Options d'impression"
      width="500px"
    >
      <el-form :model="printOptions" label-position="top">
        <el-form-item label="Format d'impression">
          <el-radio-group v-model="printOptions.format">
            <el-radio label="cr80">Format CR80 standard (85.6mm × 54mm)</el-radio>
            <el-radio label="a4">Format A4 (plusieurs cartes par page)</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item label="Impression">
          <el-checkbox v-model="printOptions.doubleSided">Recto-verso</el-checkbox>
        </el-form-item>
        
        <el-form-item label="Qualité">
          <el-slider v-model="printOptions.quality" :min="70" :max="100" :step="5" />
        </el-form-item>

        <el-form-item label="Optimisation">
          <el-checkbox v-model="printOptions.optimize">Optimiser les images pour l'impression</el-checkbox>
          <div class="option-description">
            Améliore la qualité et réduit la taille des photos pour une meilleure impression
          </div>
        </el-form-item>
        
        <el-form-item label="Marges (mm)" v-if="printOptions.format === 'a4'">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-input-number v-model="printOptions.marginH" :min="0" :max="20" :step="1" />
              <span class="ml-2">Horizontale</span>
            </el-col>
            <el-col :span="12">
              <el-input-number v-model="printOptions.marginV" :min="0" :max="20" :step="1" />
              <span class="ml-2">Verticale</span>
            </el-col>
          </el-row>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showOptionsDialog = false">Annuler</el-button>
        <el-button type="primary" @click="showOptionsDialog = false">Confirmer</el-button>
      </template>
    </el-dialog>
    
    <!-- Dialog de confirmation d'impression -->
    <el-dialog
      v-model="showPrintDialog"
      title="Confirmation d'impression"
      width="500px"
    >
      <p>Voulez-vous imprimer {{ selectedStudents.length }} carte(s) d'étudiant?</p>
      <p>Format: {{ printOptions.format === 'cr80' ? 'CR80 Standard' : 'A4' }}</p>
      <p>Mode: {{ printOptions.doubleSided ? 'Recto-verso' : 'Recto uniquement' }}</p>
      
      <template #footer>
        <el-button @click="showPrintDialog = false">Annuler</el-button>
        <el-button type="primary" @click="confirmPrint">Imprimer</el-button>
      </template>
    </el-dialog>
    
    <!-- Dialog d'aide pour l'impression -->
    <el-dialog
      v-model="showHelpDialog"
      title="Aide à l'impression"
      width="600px"
    >
      <h3>Problèmes d'impression?</h3>
      <p>Si l'impression des cartes est bloquée, essayez de :</p>
      <ul>
        <li>Utiliser un ordinateur portable au lieu d'un ordinateur de bureau</li>
        <li>Imprimer en mode recto-verso si possible</li>
      </ul>
      
      <template #footer>
        <el-button type="primary" @click="showHelpDialog = false">Compris</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, withDefaults, onMounted, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import CardTemplateOne from '@/components/cardStudent/templates/CardTemplateOne.vue';
import CardTemplateTwo from '@/components/cardStudent/templates/CardTemplateTwo.vue';
import CardTemplateThree from '@/components/cardStudent/templates/CardTemplateThree.vue';
import ColorSchemeSelector from '@/components/cardStudent/ColorSchemeSelector.vue';
import { DEFAULT_COLOR_SCHEME } from '@/constants/colorSchemes';
import type { ColorScheme, Student, SchoolInfo } from '@/types';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

// Types
interface CardData {
  id: string;
  data: {
    student: {
      firstname: string;
      lastname: string;
      matricule: string;
      gradeName: string;
      photoUrl: string;
    };
    school: {
      name: string;
      logoUrl: string;
    };
    colors: {
      primary: string;
      secondary: string;
    };
    dates: {
      schoolYear: string;
      validUntil: string;
    };
    templateId: string;
  }
}

interface PrintOptionsType {
  format: 'cr80' | 'a4';
  doubleSided: boolean;
  quality: number;
  marginH: number;
  marginV: number;
  optimize: boolean;
}

interface Props {}
const props = withDefaults(defineProps<Props>(), {});

interface Emits {}
const emit = defineEmits<Emits>();

// États réactifs
const loading = ref(false);
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
const showOptionsDialog = ref(false);
const showPrintDialogRef = ref(false);
const showHelpDialog = ref(false);
const printOptions = ref<PrintOptionsType>({
  format: 'cr80',
  doubleSided: true,
  quality: 90,
  marginH: 5,
  marginV: 5,
  optimize: true
});
const previewContainer = ref<HTMLDivElement | null>(null);
const isFlipped = ref(false);

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

// Computed pour gérer le dialogue d'impression
const showPrintDialog = computed({
  get: () => showPrintDialogRef.value,
  set: (value) => {
    showPrintDialogRef.value = value;
  }
});

// Méthodes

const handleSelectionChange = (selection: any[]) => {
  selectedStudents.value = selection;
};

const getInitials = (student: any) => {
  return `${student.firstname?.[0] || ''}${student.lastname?.[0] || ''}`.toUpperCase();
};

// Fonction utilitaire pour gérer les URLs des images
const getImageUrl = async (file: any): Promise<string> => {
  if (!file) return '';
  
  // Si l'URL est déjà un data URL, on le retourne directement
  if (file.url?.startsWith('data:')) {
    return file.url;
  }
  
  try {
    // Récupérer l'URL du fichier via l'API
    const result = await window.ipcRenderer.invoke('file:getUrl', { fileId: file.id });
    if (result.success && result.data) {
      return result.data;
    }
  } catch (error) {
    console.error('Erreur lors du chargement de l\'image:', error);
  }
  
  return '';
};

// Fonction d'optimisation d'image
const optimizeImageForPrint = async (dataUrl: string, quality: number): Promise<string> => {
  return new Promise((resolve) => {
    if (!dataUrl || !dataUrl.startsWith('data:')) {
      resolve(dataUrl); // Retourne l'image originale si ce n'est pas un data URL
      return;
    }
    
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      // Calculer les dimensions optimales pour l'impression
      // Pour une carte CR80, 300dpi serait ~1000x600px
      const optimalWidth = Math.min(1000, img.width);
      const ratio = optimalWidth / img.width;
      const optimalHeight = img.height * ratio;
      
      canvas.width = optimalWidth;
      canvas.height = optimalHeight;
      
      if (ctx) {
        // Dessiner l'image avec une meilleure netteté
        ctx.imageSmoothingEnabled = true;
        ctx.imageSmoothingQuality = 'high';
        ctx.drawImage(img, 0, 0, optimalWidth, optimalHeight);
        
        // Convertir en format JPEG de haute qualité pour l'impression
        const optimizedDataUrl = canvas.toDataURL('image/jpeg', quality / 100);
        resolve(optimizedDataUrl);
      } else {
        resolve(dataUrl); // En cas d'échec, utiliser l'original
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
};

const handlePrintWithElectron = async () => {
  if (!window.electronAPI) {
    throw new Error("API Electron non disponible");
  }
  
  try {
    ElMessage.info("Préparation de l'impression...");
    
    // Optimisation des images si nécessaire
    if (printOptions.value.optimize) {
      ElMessage.info("Optimisation des images...");
      
      if (schoolInfo.value?.logo?.url) {
        schoolInfo.value.logo.optimizedUrl = await optimizeImageForPrint(
          schoolInfo.value.logo.url, 
          printOptions.value.quality
        );
      }
      
      // Photos des étudiants (par lots pour éviter le blocage du thread)
      const batchSize = 5;
      const batches = [];
      
      for (let i = 0; i < selectedStudents.value.length; i += batchSize) {
        batches.push(selectedStudents.value.slice(i, i + batchSize));
      }
      
      for (const batch of batches) {
        await Promise.all(batch.map(async (student) => {
          if (student.photo?.url) {
            student.photo.optimizedUrl = await optimizeImageForPrint(
              student.photo.url,
              printOptions.value.quality
            );
          }
        }));
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    // Préparer les données pour l'impression
    const printData = {
      students: selectedStudents.value.map(student => ({
        firstname: student.firstname || '',
        lastname: student.lastname || '',
        matricule: student.matricule || '',
        grade: {
          name: student.grade?.name || ''
        },
        photo: {
          url: student.photo?.optimizedUrl || student.photo?.url || ''
        },
        schoolYear: student.schoolYear || ''
      })),
      schoolInfo: {
        name: schoolInfo.value?.name || '',
        logo: {
          url: schoolInfo.value?.logo?.optimizedUrl || schoolInfo.value?.logo?.url || ''
        },
        phone: schoolInfo.value?.phone || '',
        email: schoolInfo.value?.email || '',
        address: schoolInfo.value?.address || ''
      },
      template: selectedTemplate.value,
      colorScheme: {
        primary: selectedColorScheme.value.primary,
        secondary: selectedColorScheme.value.secondary,
        text: selectedColorScheme.value.text,
        background: selectedColorScheme.value.background
      },
      options: { ...printOptions.value }
    };

    ElMessage.info("Envoi à l'imprimante...");
    const result = await window.electronAPI.printStudentCards(printData);
    
    if (!result.success) {
      throw new Error(result.error || "Échec de l'impression");
    }
    
    ElMessage.success(result.message || "Impression terminée avec succès");
  } catch (error) {
    console.error('Erreur lors de l\'impression via Electron:', error);
    throw error;
  }
};

const confirmPrint = async () => {
  console.log('Début impression - fermeture dialogue');
  showPrintDialog.value = false;

  try {
    console.log('Vérification environnement Electron:', window.electronAPI ? 'Disponible' : 'Non disponible');
    
    // Si Electron est disponible, utiliser son API native
    if (window.electronAPI && typeof window.electronAPI.printStudentCards === 'function') {
      console.log('Impression via API Electron...');
      
      try {
        await handlePrintWithElectron();
        return;
      } catch (err) {
        console.error('Échec de l\'API Electron, fallback sur méthode alternative:', err);
        ElMessage.warning("L'impression via Electron a échoué, essai d'une méthode alternative...");
      }
    }
    
    // Fallback: utiliser la méthode d'impression du navigateur
    ElMessage.info("Préparation de l'impression via navigateur...");
    handlePrintAlternative();
  } catch (error) {
    console.error('Erreur lors de l\'impression:', error);
    ElMessage.error("Erreur lors de l'impression: " + (error instanceof Error ? error.message : "Erreur inconnue"));
  }
};

const cleanupPrintResources = (printFrame: HTMLIFrameElement, pdfUrl: string) => {
  requestAnimationFrame(() => {
    if (document.body.contains(printFrame)) {
      document.body.removeChild(printFrame);
    }
    URL.revokeObjectURL(pdfUrl);
  });
};

// Fonction utilitaire pour capturer une carte (utilisée par handleExportPDF et handlePrintAlternative)
const captureStudentCard = async (student: Student, options = { returnCanvases: false }) => {
  if (!previewContainer.value) {
    throw new Error("Conteneur de prévisualisation non trouvé");
  }
  
  // Mettre à jour la prévisualisation avec l'étudiant sélectionné
  previewStudent.value = student;
  
  // Attendre que le DOM soit mis à jour
  await nextTick();
  
  // Attendre un délai supplémentaire pour s'assurer que tous les éléments sont chargés
  // (images, polices, etc.)
  await new Promise(resolve => setTimeout(resolve, 300));
  
  // Récupérer les éléments de la carte après que tout soit chargé
  // Rechercher la carte dans le conteneur de prévisualisation
  const cardElement = previewContainer.value.querySelector('.card-template-one, .card-template-two, .card-template-three') as HTMLElement;
  if (!cardElement) {
    throw new Error(`Carte pour l'étudiant ${student.id} non trouvée dans la prévisualisation`);
  }
  
  // Récupérer le parent (pour les transformations et styles)
  const cardParent = cardElement.closest('.card-template-base') || cardElement.parentElement as HTMLElement;
  if (!cardParent) {
    throw new Error(`Parent de la carte pour l'étudiant ${student.id} non trouvé`);
  }
  
  try {
    // Fonction utilitaire pour attendre que les images soient chargées
    const waitForImagesLoaded = async (element: HTMLElement): Promise<void> => {
      const images = Array.from(element.querySelectorAll('img'));
      if (images.length === 0) return Promise.resolve();
      
      return Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve(); // Continuer même si l'image ne charge pas
        });
      }));
    };
    
    // Récupérer les styles calculés pour préserver les couleurs
    const computedStyles = window.getComputedStyle(cardElement);
    
    // Récupérer les variables CSS importantes
    const cssVars = {
      '--primary-color': computedStyles.getPropertyValue('--primary-color') || '#1976d2',
      '--secondary-color': computedStyles.getPropertyValue('--secondary-color') || '#424242',
      '--text-color': computedStyles.getPropertyValue('--text-color') || '#333333',
      '--background-color': computedStyles.getPropertyValue('--background-color') || '#ffffff'
    };
    
    // Créer un conteneur temporaire pour le recto avec dimensions précises
    const tempContainer = document.createElement('div');
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '-9999px';
    tempContainer.style.width = '85.6mm'; // Largeur exacte de la carte
    tempContainer.style.height = '54mm';  // Hauteur exacte de la carte
    tempContainer.style.overflow = 'hidden';
    tempContainer.style.margin = '0';
    tempContainer.style.padding = '0';
    tempContainer.style.border = 'none';
    tempContainer.style.boxSizing = 'border-box';
    document.body.appendChild(tempContainer);
    
    // Cloner le template complet (parent + enfant) pour préserver la structure et les styles
    const cardParentClone = cardParent.cloneNode(false) as HTMLElement;
    cardParentClone.style.transform = 'none';
    cardParentClone.style.transition = 'none';
    cardParentClone.style.width = '100%';
    cardParentClone.style.height = '100%';
    cardParentClone.style.position = 'relative';
    cardParentClone.style.overflow = 'hidden';
    cardParentClone.style.margin = '0';
    cardParentClone.style.padding = '0';
    cardParentClone.style.border = 'none';
    cardParentClone.style.boxSizing = 'border-box';
    
    // Appliquer les variables CSS au clone
    Object.entries(cssVars).forEach(([key, value]) => {
      if (value) cardParentClone.style.setProperty(key, value);
    });
    
    // Cloner le contenu du recto
    const frontClone = cardElement.cloneNode(true) as HTMLElement;
    frontClone.style.position = 'relative';
    frontClone.style.width = '100%';
    frontClone.style.height = '100%';
    frontClone.style.transform = 'none';
    frontClone.style.transition = 'none';
    frontClone.style.boxShadow = 'none';
    frontClone.style.margin = '0';
    frontClone.style.padding = '0';
    frontClone.style.border = 'none';
    frontClone.style.boxSizing = 'border-box';
    
    // Appliquer les variables CSS au clone du contenu
    Object.entries(cssVars).forEach(([key, value]) => {
      if (value) frontClone.style.setProperty(key, value);
    });
    
    // Masquer le verso dans le clone
    const backElements = frontClone.querySelectorAll('.card-back');
    backElements.forEach(el => {
      (el as HTMLElement).style.display = 'none';
    });
    
    // Ajouter le clone du contenu au clone du parent
    cardParentClone.appendChild(frontClone);
    tempContainer.appendChild(cardParentClone);
    
    // Attendre que toutes les images soient chargées
    await waitForImagesLoaded(frontClone);
    
    // Attendre un court instant pour que le DOM se stabilise
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Capturer le recto avec des options améliorées pour éliminer les marges
    const frontCanvas = await html2canvas(cardParentClone, {
      scale: 3, // Augmenter la résolution
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: cssVars['--background-color'],
      imageTimeout: 5000, // Augmenter le timeout pour les images
      x: 0,
      y: 0,
      width: cardParentClone.offsetWidth,
      height: cardParentClone.offsetHeight,
      windowWidth: cardParentClone.offsetWidth,
      windowHeight: cardParentClone.offsetHeight,
      scrollX: 0,
      scrollY: 0,
      removeContainer: false,
      onclone: (clonedDoc) => {
        // Force le rendu des polices et des styles
        const clonedElement = clonedDoc.querySelector('.card-template-one, .card-template-two, .card-template-three');
        if (clonedElement) {
          clonedElement.setAttribute('data-html2canvas-render', 'true');
          // Forcer les dimensions et supprimer les marges
          (clonedElement as HTMLElement).style.margin = '0';
          (clonedElement as HTMLElement).style.padding = '0';
          (clonedElement as HTMLElement).style.border = 'none';
          (clonedElement as HTMLElement).style.boxSizing = 'border-box';
          (clonedElement as HTMLElement).style.width = '100%';
          (clonedElement as HTMLElement).style.height = '100%';
        }
      }
    });
    
    // Convertir le canvas en image avec une qualité élevée
    const frontImgData = frontCanvas.toDataURL('image/jpeg', 1.0);
    
    // Vérifier si le template a un verso
    const backElement = cardElement.querySelector('.card-back');
    let backCanvas = null;
    let backImgData = null;
    
    if (backElement) {
      // Créer un nouveau conteneur pour le verso avec dimensions précises
      const backContainer = document.createElement('div');
      backContainer.style.position = 'absolute';
      backContainer.style.left = '-9999px';
      backContainer.style.top = '-9999px';
      backContainer.style.width = '85.6mm'; // Largeur exacte de la carte
      backContainer.style.height = '54mm';  // Hauteur exacte de la carte
      backContainer.style.fontFamily = computedStyles.fontFamily;
      backContainer.style.overflow = 'hidden';
      backContainer.style.margin = '0';
      backContainer.style.padding = '0';
      backContainer.style.border = 'none';
      backContainer.style.boxSizing = 'border-box';
      document.body.appendChild(backContainer);
      
      // Créer un nouveau parent pour le verso
      const backParentClone = cardParent.cloneNode(false) as HTMLElement;
      backParentClone.style.transform = 'none';
      backParentClone.style.transition = 'none';
      backParentClone.style.width = '100%';
      backParentClone.style.height = '100%';
      backParentClone.style.position = 'relative';
      backParentClone.style.overflow = 'hidden';
      backParentClone.style.margin = '0';
      backParentClone.style.padding = '0';
      backParentClone.style.border = 'none';
      backParentClone.style.boxSizing = 'border-box';
      
      // Appliquer les variables CSS au clone du parent
      Object.entries(cssVars).forEach(([key, value]) => {
        if (value) backParentClone.style.setProperty(key, value);
      });
      
      // Cloner le verso
      const backClone = backElement.cloneNode(true) as HTMLElement;
      
      // Appliquer les styles au verso pour éliminer les marges
      backClone.style.transform = 'none';
      backClone.style.position = 'static';
      backClone.style.display = 'block';
      backClone.style.width = '100%';
      backClone.style.height = '100%';
      backClone.style.boxShadow = 'none';
      backClone.style.margin = '0';
      backClone.style.padding = '0';
      backClone.style.border = 'none';
      backClone.style.boxSizing = 'border-box';
      
      // Appliquer les variables CSS au clone du verso
      Object.entries(cssVars).forEach(([key, value]) => {
        if (value) backClone.style.setProperty(key, value);
      });
      
      // Ajouter le verso au parent
      backParentClone.appendChild(backClone);
      backContainer.appendChild(backParentClone);
      
      // Attendre que toutes les images soient chargées
      await waitForImagesLoaded(backClone);
      
      // Attendre un court instant pour que le DOM se stabilise
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capturer le verso avec des options améliorées pour éliminer les marges
      backCanvas = await html2canvas(backParentClone, {
        scale: 3, // Augmenter la résolution
        useCORS: true,
        allowTaint: true,
        logging: false,
        backgroundColor: cssVars['--background-color'],
        imageTimeout: 5000, // Augmenter le timeout pour les images
        x: 0,
        y: 0,
        width: backParentClone.offsetWidth,
        height: backParentClone.offsetHeight,
        windowWidth: backParentClone.offsetWidth,
        windowHeight: backParentClone.offsetHeight,
        scrollX: 0,
        scrollY: 0,
        removeContainer: false,
        onclone: (clonedDoc) => {
          // Force le rendu des polices et des styles
          const clonedBackElement = clonedDoc.querySelector('.card-back');
          if (clonedBackElement) {
            clonedBackElement.setAttribute('data-html2canvas-render', 'true');
            // Forcer les dimensions et supprimer les marges
            (clonedBackElement as HTMLElement).style.margin = '0';
            (clonedBackElement as HTMLElement).style.padding = '0';
            (clonedBackElement as HTMLElement).style.border = 'none';
            (clonedBackElement as HTMLElement).style.boxSizing = 'border-box';
            (clonedBackElement as HTMLElement).style.width = '100%';
            (clonedBackElement as HTMLElement).style.height = '100%';
          }
        }
      });
      
      // Convertir le canvas en image avec une qualité élevée
      backImgData = backCanvas.toDataURL('image/jpeg', 1.0);
      
      // Nettoyer
      document.body.removeChild(backContainer);
    }
    
    // Nettoyer
    document.body.removeChild(tempContainer);
    
    // Vérifier que les images ont bien été générées
    if (!frontImgData || frontImgData === 'data:,') {
      throw new Error(`Échec de la capture du recto de la carte pour l'étudiant ${student.id}`);
    }
    
    if (options.returnCanvases) {
      return { frontCanvas, backCanvas };
    }
    
    return { frontImgData, backImgData };
  } catch (error) {
    console.error(`Erreur lors de la capture de la carte pour l'étudiant ${student.id}:`, error);
    throw error;
  }
};

// Fonction complètement réécrite pour l'exportation PDF sans blocage de l'interface
// avec option d'impression directe
const handleExportPDF = (printDirectly = false) => {
  if (!selectedStudents.value.length || !previewContainer.value) {
    ElMessage.error("Aucun étudiant sélectionné ou conteneur non trouvé");
    return;
  }
  
  // Désactiver le chargement global pour éviter la confusion avec deux indicateurs
  loading.value = false;
  
  // Créer un élément de progression visuelle
  const progressContainer = document.createElement('div');
  progressContainer.className = 'pdf-export-progress';
  progressContainer.style.position = 'fixed';
  progressContainer.style.top = '50%';
  progressContainer.style.left = '50%';
  progressContainer.style.transform = 'translate(-50%, -50%)';
  progressContainer.style.backgroundColor = 'white';
  progressContainer.style.padding = '20px';
  progressContainer.style.borderRadius = '8px';
  progressContainer.style.boxShadow = '0 4px 12px rgba(0, 0, 0, 0.15)';
  progressContainer.style.zIndex = '9999';
  progressContainer.style.minWidth = '300px';
  progressContainer.style.textAlign = 'center';
  
  const progressTitle = document.createElement('h3');
  progressTitle.textContent = printDirectly ? "Préparation de l'impression..." : "Exportation PDF en cours";
  progressTitle.style.margin = '0 0 15px 0';
  progressContainer.appendChild(progressTitle);
  
  const progressText = document.createElement('div');
  progressText.style.marginBottom = '10px';
  progressContainer.appendChild(progressText);
  
  const progressBar = document.createElement('div');
  progressBar.style.width = '100%';
  progressBar.style.height = '8px';
  progressBar.style.backgroundColor = '#f0f0f0';
  progressBar.style.borderRadius = '4px';
  progressBar.style.overflow = 'hidden';
  progressContainer.appendChild(progressBar);
  
  const progressFill = document.createElement('div');
  progressFill.style.width = '0%';
  progressFill.style.height = '100%';
  progressFill.style.backgroundColor = 'var(--el-color-primary)';
  progressFill.style.transition = 'width 0.3s ease';
  progressBar.appendChild(progressFill);
  
  const cancelButton = document.createElement('button');
  cancelButton.textContent = "Annuler";
  cancelButton.style.marginTop = '15px';
  cancelButton.style.padding = '5px 15px';
  cancelButton.style.border = 'none';
  cancelButton.style.borderRadius = '4px';
  cancelButton.style.backgroundColor = '#f56c6c';
  cancelButton.style.color = 'white';
  cancelButton.style.cursor = 'pointer';
  progressContainer.appendChild(cancelButton);
  
  document.body.appendChild(progressContainer);
  
  // Variables pour gérer l'exportation
  let isCancelled = false;
  let currentIndex = 0;
  const totalStudents = selectedStudents.value.length;
  const cardImages = [];
  
  // Créer le PDF
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [54, 85.6]
  });

  // Ajouter un titre au PDF
  pdf.setFontSize(12);
  pdf.text("Cartes d'étudiants", 10, 5);
  
  // Gestionnaire d'annulation
  cancelButton.addEventListener('click', () => {
    isCancelled = true;
    if (document.body.contains(progressContainer)) {
      document.body.removeChild(progressContainer);
    }
    ElMessage.info(printDirectly ? "Impression annulée" : "Exportation PDF annulée");
  });
  
  // Fonction pour nettoyer les ressources à la fin du processus
  const cleanup = () => {
    if (document.body.contains(progressContainer)) {
      document.body.removeChild(progressContainer);
    }
  };
  
  // Fonction pour traiter un étudiant à la fois
  const processNextStudent = () => {
    if (isCancelled) {
      cleanup();
      return;
    }
    
    if (currentIndex >= totalStudents) {
      // Finalisation
      progressText.textContent = printDirectly ? "Préparation de l'impression..." : "Finalisation de l'export PDF...";
      progressFill.style.width = '100%';
      
      // Sauvegarder ou imprimer le PDF après un court délai
      setTimeout(() => {
        if (!isCancelled) {
          const filename = `cartes-etudiants-${new Date().toISOString().slice(0, 10)}.pdf`;
          
          if (printDirectly) {
            // Imprimer directement le PDF
            pdf.autoPrint(); // Active l'impression automatique
            
            // Créer un iframe invisible pour l'impression
            const iframe = document.createElement('iframe');
            iframe.style.position = 'fixed';
            iframe.style.left = '-9999px';
            document.body.appendChild(iframe);
            
            // Ouvrir le PDF dans l'iframe et déclencher l'impression
            iframe.onload = () => {
              setTimeout(() => {
                iframe.contentWindow.focus();
                iframe.contentWindow.print();
                
                // Nettoyer après l'impression
                setTimeout(() => {
                  document.body.removeChild(iframe);
                  cleanup();
                  ElMessage.success({
                    message: "Impression envoyée à l'imprimante",
                    duration: 3000
                  });
                }, 1000);
              }, 500);
            };
            
            // Générer le PDF comme URL de données et l'ouvrir dans l'iframe
            iframe.src = pdf.output('datauristring');
          } else {
            // Sauvegarder le PDF normalement
            pdf.save(filename);
            
            // Nettoyer
            cleanup();
            
            ElMessage.success({
              message: `Export PDF réussi! Fichier: ${filename}`,
              duration: 3000
            });
          }
        }
      }, 500);
      
      return;
    }
    
    // Mettre à jour la progression
    const progress = Math.round(((currentIndex + 1) / totalStudents) * 100);
    progressFill.style.width = `${progress}%`;
    progressText.textContent = `Traitement de la carte ${currentIndex + 1}/${totalStudents}`;
    
    const student = selectedStudents.value[currentIndex];
    
    // Préparer l'étudiant pour la capture
    previewStudent.value = student;
    
    // Utiliser setTimeout pour permettre au DOM de se mettre à jour
    setTimeout(async () => {
      try {
        // Récupérer l'élément de la carte
        const cardElement = previewContainer.value.querySelector('.card-template-one, .card-template-two, .card-template-three');
        if (!cardElement) {
          throw new Error(`Carte pour l'étudiant ${student.id} non trouvée`);
        }
        
        // Capturer le recto
        const frontCanvas = await html2canvas(cardElement, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          onclone: (clonedDoc) => {
            const clonedCard = clonedDoc.querySelector('.card-template-one, .card-template-two, .card-template-three');
            if (clonedCard) {
              // Masquer le verso
              const backElements = clonedCard.querySelectorAll('.card-back');
              backElements.forEach(el => {
                el.style.display = 'none';
              });
            }
          }
        });
        
        const frontImgData = frontCanvas.toDataURL('image/jpeg', 0.95);
        
        // Ajouter une nouvelle page (sauf pour la première carte)
        if (currentIndex > 0) pdf.addPage();
        
        // Ajouter le recto au PDF
        pdf.addImage(frontImgData, 'JPEG', 0, 0, 85.6, 54);
        
        // Vérifier s'il y a un verso
        const backElement = cardElement.querySelector('.card-back');
        if (backElement) {
          // Capturer le verso dans un autre setTimeout pour éviter le blocage
          setTimeout(async () => {
            try {
              const backCanvas = await html2canvas(cardElement, {
                scale: 2,
                useCORS: true,
                allowTaint: true,
                logging: false,
                backgroundColor: '#ffffff',
                onclone: (clonedDoc) => {
                  const clonedCard = clonedDoc.querySelector('.card-template-one, .card-template-two, .card-template-three');
                  if (clonedCard) {
                    // Masquer le recto et afficher le verso
                    const frontElements = clonedCard.querySelectorAll('.card-front');
                    frontElements.forEach(el => {
                      el.style.display = 'none';
                    });
                    
                    const backElements = clonedCard.querySelectorAll('.card-back');
                    backElements.forEach(el => {
                      el.style.display = 'block';
                      el.style.transform = 'none';
                      el.style.position = 'static';
                    });
                  }
                }
              });
              
              const backImgData = backCanvas.toDataURL('image/jpeg', 0.95);
              
              // Ajouter le verso au PDF
              pdf.addPage();
              pdf.addImage(backImgData, 'JPEG', 0, 0, 85.6, 54);
              
              // Passer à l'étudiant suivant
              currentIndex++;
              setTimeout(processNextStudent, 50);
            } catch (error) {
              console.error(`Erreur lors de la capture du verso pour ${student.firstname} ${student.lastname}:`, error);
              currentIndex++;
              setTimeout(processNextStudent, 50);
            }
          }, 50);
        } else {
          // Pas de verso, passer à l'étudiant suivant
          currentIndex++;
          setTimeout(processNextStudent, 50);
        }
      } catch (error) {
        console.error(`Erreur lors du traitement de la carte pour ${student.firstname} ${student.lastname}:`, error);
        progressText.textContent = `Erreur: ${error.message} - Passage à la carte suivante...`;
        currentIndex++;
        setTimeout(processNextStudent, 50);
      }
    }, 50);
  };
  
  // Démarrer le traitement
  setTimeout(processNextStudent, 100);
};


// Fonction utilitaire pour générer la carte d'étudiant
const generateCardHTML = (
  student: Student,
  schoolInfo: SchoolInfo,
  templateId: string,
  colorScheme: ColorScheme
): CardData => {
  // Créer une fonction qui retourne un objet avec les données structurées
  // au lieu de générer du HTML
  const data = {
    student: {
      firstname: student.firstname || '',
      lastname: student.lastname || '',
      matricule: student.matricule || '',
      gradeName: student.grade?.name || '',
      photoUrl: student.photo?.optimizedUrl || student.photo?.url || ''
    },
    school: {
      name: schoolInfo?.name || '',
      logoUrl: schoolInfo?.logo?.optimizedUrl || schoolInfo?.logo?.url || ''
    },
    colors: {
      primary: colorScheme.primary,
      secondary: colorScheme.secondary
    },
    dates: {
      schoolYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
      validUntil: new Date(new Date().getFullYear() + 1, 6, 31).toLocaleDateString('fr-FR')
    },
    templateId
  };
  
  // Générer un identifiant unique pour cette carte
  const cardId = 'card_' + Math.random().toString(36).substr(2, 9);
  
  // Retourner les données au lieu du HTML
  return {
    id: cardId,
    data
  };
};

// Nouvelle fonction pour créer une représentation HTML d'une carte
// Cette fonction sera utilisée dans la méthode d'impression
const renderCard = (cardData: CardData): HTMLElement => {
  const { student, school, colors, dates, templateId } = cardData.data;
  
  // Créer un élément DOM pour la carte
  const card = document.createElement('div');
  card.id = cardData.id;
  card.className = 'card-print-container';
  card.style.width = '85.6mm';
  card.style.height = '54mm';
  card.style.position = 'relative';
  card.style.backgroundColor = 'white';
  card.style.overflow = 'hidden';
  card.style.pageBreakAfter = 'always';
  
  // Appliquer le style en fonction du template
  switch (templateId) {
    case 'template2':
      // En-tête avec couleur primaire
      const header2 = document.createElement('div');
      header2.style.backgroundColor = colors.primary;
      header2.style.color = 'white';
      header2.style.padding = '3mm';
      header2.style.textAlign = 'center';
      header2.style.marginBottom = '2mm';
      
      const schoolName2 = document.createElement('div');
      schoolName2.style.fontSize = '4mm';
      schoolName2.style.fontWeight = 'bold';
      schoolName2.textContent = school.name;
      header2.appendChild(schoolName2);
      
      // Photo de l'étudiant
      const photoContainer2 = document.createElement('div');
      photoContainer2.style.display = 'flex';
      photoContainer2.style.flexDirection = 'column';
      photoContainer2.style.alignItems = 'center';
      photoContainer2.style.padding = '2mm';
      
      const photoFrame2 = document.createElement('div');
      photoFrame2.style.borderRadius = '50%';
      photoFrame2.style.overflow = 'hidden';
      photoFrame2.style.width = '20mm';
      photoFrame2.style.height = '20mm';
      photoFrame2.style.marginBottom = '2mm';
      photoFrame2.style.border = `2mm solid ${colors.secondary}`;
      
      const photo2 = document.createElement('img');
      photo2.src = student.photoUrl;
      photo2.style.width = '100%';
      photo2.style.height = '100%';
      photo2.style.objectFit = 'cover';
      photo2.alt = "Photo";
      photoFrame2.appendChild(photo2);
      photoContainer2.appendChild(photoFrame2);
      
      // Informations de l'étudiant
      const infoContainer2 = document.createElement('div');
      infoContainer2.style.textAlign = 'center';
      
      const studentName2 = document.createElement('div');
      studentName2.style.fontSize = '4.5mm';
      studentName2.style.fontWeight = 'bold';
      studentName2.style.marginBottom = '1mm';
      studentName2.style.color = colors.secondary;
      studentName2.textContent = `${student.firstname} ${student.lastname}`;
      infoContainer2.appendChild(studentName2);
      
      const matricule2 = document.createElement('div');
      matricule2.style.fontSize = '3mm';
      matricule2.style.marginBottom = '1mm';
      matricule2.style.color = '#666';
      matricule2.textContent = `№ ${student.matricule}`;
      infoContainer2.appendChild(matricule2);
      
      const grade2 = document.createElement('div');
      grade2.style.fontSize = '3mm';
      grade2.style.marginBottom = '1mm';
      grade2.textContent = `Classe: ${student.gradeName}`;
      infoContainer2.appendChild(grade2);
      
      photoContainer2.appendChild(infoContainer2);
      
      // Pied de carte
      const footer2 = document.createElement('div');
      footer2.style.position = 'absolute';
      footer2.style.bottom = '0';
      footer2.style.left = '0';
      footer2.style.right = '0';
      footer2.style.backgroundColor = colors.secondary;
      footer2.style.color = 'white';
      footer2.style.padding = '2mm';
      footer2.style.textAlign = 'center';
      footer2.style.fontSize = '2.5mm';
      footer2.textContent = `Année scolaire ${dates.schoolYear} · Valide jusqu'au: ${dates.validUntil}`;
      
      // Assembler la carte
      card.appendChild(header2);
      card.appendChild(photoContainer2);
      card.appendChild(footer2);
      break;
      
    case 'template3':
      // En-tête design avec dégradé
      const header3 = document.createElement('div');
      header3.style.background = `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`;
      header3.style.height = '10mm';
      header3.style.position = 'relative';
      header3.style.marginBottom = '12mm';
      
      // Logo en haut à gauche
      const logoDiv3 = document.createElement('div');
      logoDiv3.style.position = 'absolute';
      logoDiv3.style.top = '2mm';
      logoDiv3.style.left = '2mm';
      
      const logo3 = document.createElement('img');
      logo3.src = school.logoUrl;
      logo3.style.width = '6mm';
      logo3.style.height = '6mm';
      logo3.style.objectFit = 'contain';
      logo3.alt = "Logo";
      logoDiv3.appendChild(logo3);
      
      // Photo centrée sur le haut
      const photoFrame3 = document.createElement('div');
      photoFrame3.style.position = 'absolute';
      photoFrame3.style.top = '10mm';
      photoFrame3.style.left = '50%';
      photoFrame3.style.transform = 'translateX(-50%)';
      photoFrame3.style.background = 'white';
      photoFrame3.style.borderRadius = '50%';
      photoFrame3.style.width = '20mm';
      photoFrame3.style.height = '20mm';
      photoFrame3.style.display = 'flex';
      photoFrame3.style.justifyContent = 'center';
      photoFrame3.style.alignItems = 'center';
      photoFrame3.style.border = '0.5mm solid #ddd';
      photoFrame3.style.overflow = 'hidden';
      
      const photo3 = document.createElement('img');
      photo3.src = student.photoUrl;
      photo3.style.width = '19mm';
      photo3.style.height = '19mm';
      photo3.style.objectFit = 'cover';
      photo3.alt = "Photo";
      photoFrame3.appendChild(photo3);
      
      header3.appendChild(logoDiv3);
      header3.appendChild(photoFrame3);
      
      // Corps de la carte
      const body3 = document.createElement('div');
      body3.style.padding = '0 3mm';
      body3.style.textAlign = 'center';
      
      const nameDiv3 = document.createElement('div');
      nameDiv3.style.fontSize = '4mm';
      nameDiv3.style.fontWeight = 'bold';
      nameDiv3.style.marginBottom = '2mm';
      nameDiv3.style.color = colors.primary;
      nameDiv3.textContent = `${student.firstname} ${student.lastname}`;
      
      const matriculeDiv3 = document.createElement('div');
      matriculeDiv3.style.fontSize = '3mm';
      matriculeDiv3.style.marginBottom = '1mm';
      matriculeDiv3.style.fontWeight = '500';
      matriculeDiv3.style.color = colors.secondary;
      matriculeDiv3.textContent = `Matricule: ${student.matricule}`;
      
      const gradeDiv3 = document.createElement('div');
      gradeDiv3.style.fontSize = '3mm';
      gradeDiv3.style.marginBottom = '1mm';
      gradeDiv3.textContent = `Classe: ${student.gradeName}`;
      
      body3.appendChild(nameDiv3);
      body3.appendChild(matriculeDiv3);
      body3.appendChild(gradeDiv3);
      
      // Pied de carte
      const footer3 = document.createElement('div');
      footer3.style.position = 'absolute';
      footer3.style.bottom = '0';
      footer3.style.left = '0';
      footer3.style.right = '0';
      footer3.style.backgroundColor = '#f5f5f5';
      footer3.style.padding = '2mm';
      footer3.style.display = 'flex';
      footer3.style.justifyContent = 'space-between';
      footer3.style.fontSize = '2.5mm';
      
      const yearDiv3 = document.createElement('div');
      yearDiv3.textContent = `Année: ${dates.schoolYear}`;
      
      const expDiv3 = document.createElement('div');
      expDiv3.textContent = `Exp: ${dates.validUntil}`;
      
      footer3.appendChild(yearDiv3);
      footer3.appendChild(expDiv3);
      
      // Assembler la carte
      card.appendChild(header3);
      card.appendChild(body3);
      card.appendChild(footer3);
      break;
      
    case 'template1':
    default:
      // En-tête avec logo et nom de l'école
      const header1 = document.createElement('div');
      header1.style.display = 'flex';
      header1.style.alignItems = 'center';
      header1.style.marginBottom = '3mm';
      header1.style.backgroundColor = 'white';
      header1.style.padding = '5mm 5mm 0 5mm';
      
      const logo1 = document.createElement('img');
      logo1.src = school.logoUrl;
      logo1.style.width = '8mm';
      logo1.style.height = '8mm';
      logo1.style.objectFit = 'contain';
      logo1.style.marginRight = '3mm';
      logo1.style.display = 'block';
      logo1.alt = "Logo";
      
      const schoolName1 = document.createElement('div');
      schoolName1.style.fontSize = '3.5mm';
      schoolName1.style.fontWeight = 'bold';
      schoolName1.style.color = colors.primary;
      schoolName1.textContent = school.name;
      
      header1.appendChild(logo1);
      header1.appendChild(schoolName1);
      
      // Corps de la carte
      const body1 = document.createElement('div');
      body1.style.display = 'flex';
      body1.style.gap = '3mm';
      body1.style.backgroundColor = 'white';
      body1.style.padding = '0 5mm';
      
      const photo1 = document.createElement('img');
      photo1.src = student.photoUrl;
      photo1.style.width = '25mm';
      photo1.style.height = '32mm';
      photo1.style.objectFit = 'cover';
      photo1.style.border = '0.3mm solid #ddd';
      photo1.style.display = 'block';
      photo1.alt = "Photo";
      
      const info1 = document.createElement('div');
      info1.style.flex = '1';
      
      const name1 = document.createElement('div');
      name1.style.fontSize = '4mm';
      name1.style.fontWeight = 'bold';
      name1.style.marginBottom = '2mm';
      name1.style.color = colors.secondary;
      name1.textContent = `${student.firstname} ${student.lastname}`;
      
      const matricule1 = document.createElement('div');
      matricule1.style.fontSize = '3mm';
      matricule1.style.marginBottom = '1mm';
      matricule1.style.color = colors.primary;
      matricule1.style.fontWeight = '500';
      matricule1.textContent = `№ ${student.matricule}`;
      
      const grade1 = document.createElement('div');
      grade1.style.fontSize = '3mm';
      grade1.style.marginBottom = '1mm';
      grade1.textContent = `Classe: ${student.gradeName}`;
      
      const year1 = document.createElement('div');
      year1.style.fontSize = '3mm';
      year1.style.marginBottom = '1mm';
      year1.textContent = `Année: ${dates.schoolYear}`;
      
      info1.appendChild(name1);
      info1.appendChild(matricule1);
      info1.appendChild(grade1);
      info1.appendChild(year1);
      
      body1.appendChild(photo1);
      body1.appendChild(info1);
      
      // Pied de carte
      const validity1 = document.createElement('div');
      validity1.style.position = 'absolute';
      validity1.style.bottom = '5mm';
      validity1.style.right = '5mm';
      validity1.style.fontSize = '2.5mm';
      validity1.style.backgroundColor = 'white';
      validity1.textContent = `Valide jusqu'au: ${dates.validUntil}`;
      
      // Assembler la carte
      card.appendChild(header1);
      card.appendChild(body1);
      card.appendChild(validity1);
  }
  
  return card;
};

// Initialisation
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
        // Utiliser school:getLogo pour le logo de l'école
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
      // Traiter les photos des étudiants
      students.value = await Promise.all(studentsResult.data.map(async (student) => {
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
    }
  } catch (error) {
    console.error('Erreur chargement:', error);
    ElMessage.error('Erreur lors du chargement des données');
  } finally {
    loading.value = false;
  }
};

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.student-card-view {
  padding: 24px;
  height: calc(100vh - 40px);
  background-color: #f5f7fa;
  overflow: hidden;
  position: relative;
  font-family: 'Poppins', sans-serif;
}

.el-row {
  height: 100%;
}

.el-col {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.el-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  border-radius: 12px;
  transition: all 0.3s ease;
  border: none;
  overflow: hidden;
}

.el-card:hover {
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.12);
  transform: translateY(-2px);
}

.templates-list {
  max-height: 150px;
  overflow-y: auto;
  padding: 10px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
}

.template-item {
  border: 1px solid #eee;
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 10px;
  transition: all 0.3s ease;
  background-color: #ffffff;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.template-item:hover {
  border-color: var(--el-color-primary);
  background-color: var(--el-color-primary-light-9);
}

.template-info h3 {
  margin: 0 0 3px 0;
  font-size: 14px;
}

.template-info p {
  margin: 0;
  color: #666;
  font-size: 12px;
}

.option-description {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
  margin-left: 24px;
}

.preview-card {
  margin-top: 15px;
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 400px);
}

.preview-card :deep(.el-card__body) {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.preview-container {
  flex: 1;
  padding: 40px;
  display: flex;
  justify-content: center;
  align-items: center;
  background: linear-gradient(135deg, #f8f9fa, #fff);
  border-radius: 12px;
  position: relative;
  overflow: hidden;
  box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.03);
}

.preview-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    rgba(0, 0, 0, 0.01) 10px,
    rgba(0, 0, 0, 0.01) 20px
  );
  border-radius: 8px;
}

.preview-container :deep(.card-template) {
  transform: scale(1.5);
  transition: transform 0.3s ease;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  position: relative;
  z-index: 1;
}

.preview-container:hover :deep(.card-template) {
  transform: scale(1.6);
}

.students-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 20px;
  padding: 0 5px;
}

.el-card :deep(.el-card__header) {
  padding: 15px 20px;
  border-bottom: 1px solid rgba(0, 0, 0, 0.05);
  background-color: #fafbfc;
}

.el-card :deep(.el-card__header h2) {
  margin: 0;
  font-size: 18px;
  font-weight: 600;
  color: #333;
}

.action-buttons {
  display: flex;
  gap: 10px;
  align-items: center;
}

.action-buttons :deep(.el-button) {
  border-radius: 8px;
  transition: all 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.05);
}

.action-buttons :deep(.el-button:hover) {
  transform: translateY(-2px);
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

.filters {
  display: flex;
  gap: 15px;
  flex: 1;
}

.filters :deep(.el-input),
.filters :deep(.el-select) {
  border-radius: 8px;
  overflow: hidden;
}

.filters :deep(.el-input__wrapper),
.filters :deep(.el-select .el-input__wrapper) {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.04);
  border-radius: 8px;
  padding: 2px 15px;
  transition: all 0.3s ease;
}

.filters :deep(.el-input__wrapper:hover),
.filters :deep(.el-select .el-input__wrapper:hover) {
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.08);
}

.filters :deep(.el-input__wrapper:focus-within),
.filters :deep(.el-select .el-input__wrapper:focus-within) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.ml-2 {
  margin-left: 8px;
}

.el-table {
  height: calc(100vh - 160px) !important;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.05);
}

.el-table :deep(th.el-table__cell) {
  background-color: #f9fafc;
  font-weight: 600;
  color: #333;
  padding: 12px 0;
}

.el-table :deep(td.el-table__cell) {
  padding: 10px 0;
  transition: background-color 0.2s ease;
}

.el-table :deep(.el-table__row:hover td.el-table__cell) {
  background-color: rgba(var(--el-color-primary-rgb), 0.1);
}

.el-table :deep(.el-checkbox__input.is-checked .el-checkbox__inner) {
  background-color: var(--el-color-primary);
  border-color: var(--el-color-primary);
}

.el-table :deep(.el-avatar) {
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
  border: 2px solid white;
  transition: transform 0.2s ease;
}

.el-table :deep(.el-table__row:hover .el-avatar) {
  transform: scale(1.05);
}

@media print {
  .student-card-view > *:not(.print-content) {
    display: none !important;
  }
}
</style>

