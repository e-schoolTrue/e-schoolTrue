<template>
  <div class="configuration-wizard">
    <el-card class="wizard-card">
      <template #header>
        <div class="wizard-header">
          <!-- Indicateur d'étapes pour Desktop -->
          <el-steps :active="currentStep" finish-status="success" simple class="desktop-steps">
            <el-step v-for="(titre, index) in etapesTitres" :key="index" :title="titre" />
          </el-steps>

          <!-- Indicateur d'étapes pour Mobile/Tablette -->
          <div class="mobile-steps-indicator">
            <span class="step-info">Étape {{ currentStep + 1 }} sur {{ configViewsKeys.length }}</span>
            <span class="step-title">: {{ currentStepTitle }}</span>
          </div>
        </div>
      </template>

      <div class="wizard-content">
        <component
          :is="currentViewComponent"
          @configuration-saved="handleConfigurationSaved"
          @go-back="handleGoBack" 
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus'; // Importer ElMessage pour les erreurs

// Importation des composants de vue
import WelcomView from './omboarding/WelcomView.vue';
import DataLocationView from './omboarding/DataLocationView.vue';
import GeneralInfoView from './omboarding/GeneralInfoView.vue';
import YearRepartitionView from './omboarding/YearRepartitionView.vue';
import GradeView from './omboarding/GradeView.vue';
import CourseView from './omboarding/CourseView.vue';
import LanguageSettingView from './omboarding/LanguageSettingView.vue';
import SupervisorInfoView from './omboarding/SupervisorInfoView.vue';
import PayementConfigurationView from './omboarding/PayementConfigurationView.vue';
// ... autres imports ...

// Interface pour le format attendu du logo par le backend (basé sur SchoolInfoView)
interface IFileUpload {
  content: string; // Base64 content
  name: string;
  type: string;
}

const router = useRouter();
const currentStep = ref(0);

// Clés internes
const configViewsKeys = ref([
  'Welcome',
  'DataLocation',
  'GeneralInfo',
  'YearRepartition',
  'Grade',
  'Course',
  'LanguageSetting',
  'SupervisorInfo',
  'PayementConfiguration'
]);

// Titres français
const etapesTitres = ref([
  'Bienvenue',
  'Localisation',
  'Infos Générales',
  'Année Scolaire',
  'Niveaux',
  'Matières',
  'Langue',
  'Superviseur',
  'Configuration des Paiements'
]);

// Mapping Clés -> Composants
const viewComponents = {
  Welcome: WelcomView,
  DataLocation: DataLocationView,
  GeneralInfo: GeneralInfoView,
  YearRepartition: YearRepartitionView,
  Grade: GradeView,
  Course: CourseView,
  LanguageSetting: LanguageSettingView,
  SupervisorInfo: SupervisorInfoView,
  PayementConfiguration: PayementConfigurationView
};

// Stockage des données de configuration de chaque étape
const configurationData = ref<Record<string, any>>({});

// --- Computed Properties ---
const currentViewComponent = computed(() => {
  const currentViewKey = configViewsKeys.value[currentStep.value];
  return viewComponents[currentViewKey as keyof typeof viewComponents];
});

const currentStepTitle = computed(() => {
  return etapesTitres.value[currentStep.value] || '';
});

// --- Lifecycle Hooks ---
onMounted(async () => {
  // ... (logique onMounted inchangée) ...
    try {
    console.log('Démarrage de la vérification du premier lancement...');
    // Assurez-vous que window.ipcRenderer est bien défini (contexte Electron)
    if (window.ipcRenderer) {
        const response = await window.ipcRenderer.invoke('is-first-launch');
        console.log('Réponse du serveur:', response);

        if (!response.success) {
          console.error('Erreur lors de la vérification:', response.error);
           ElMessage.error(`Erreur de vérification: ${response.error || 'Inconnue'}`);
          return;
        }

        if (!response.data) {
          console.log('Ce n\'est pas le premier lancement, redirection vers /...');
          router.replace('/');
        } else {
          console.log('Premier lancement détecté, affichage du wizard...');
        }
    } else {
        console.warn("Contexte non-Electron, la vérification du premier lancement est ignorée.");
        // Comportement par défaut si hors Electron (ex: développement web)
        // Mettez ici la logique appropriée, par exemple toujours afficher le wizard
    }
  } catch (error: any) {
    console.error('Erreur lors de la vérification du premier lancement:', error);
     ElMessage.error(`Erreur critique: ${error.message || 'Impossible de vérifier le statut de lancement.'}`);

  }
});

// --- Methodes ---

// Fonction utilitaire pour convertir File en Base64
async function convertFileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file); // Lit le contenu en Base64 Data URL
    reader.onload = () => {
        // Extrait uniquement la partie base64 après la virgule
        const base64String = (reader.result as string).split(',')[1];
        resolve(base64String);
    }
    reader.onerror = (error) => reject(error);
  });
}


// Gère la réception des données d'une étape et passe à la suivante
const handleConfigurationSaved = async (data: any) => {
  const currentKey = configViewsKeys.value[currentStep.value];
  
  // Mapping des clés frontend vers backend
  const keyMapping: Record<string, string> = {
    'GeneralInfo': 'school',
    'Grade': 'grades',
    'Course': 'courses',
    'PayementConfiguration': 'paymentConfig',
    'YearRepartition': 'yearRepartition'
  };

  // Utiliser la clé mappée ou la clé originale si pas de mapping
  const backendKey = keyMapping[currentKey] || currentKey;
  configurationData.value[backendKey] = data;
  
  console.log(`Données sauvegardées pour l'étape ${currentKey} (${backendKey}):`, data);
  await nextStep();
};

// Gère le retour à l'étape précédente
const handleGoBack = () => {
  if (currentStep.value > 0) {
    console.log('Retour à l\'étape précédente');
    currentStep.value--;
  } else {
     console.log('Impossible de retourner en arrière depuis la première étape');
     // Optionnel: peut-être rediriger ou afficher un message si on est sur la première "vraie" étape
     // Par exemple, si l'étape 0 est 'Welcome', on ne peut pas revenir en arrière.
  }
};

// Passe à l'étape suivante ou sauvegarde la configuration finale
const nextStep = async () => {
  if (currentStep.value < configViewsKeys.value.length - 1) {
    currentStep.value++;
    console.log('Passage à l\'étape:', currentStep.value, configViewsKeys.value[currentStep.value]);
  } else {
    // --- Dernière étape : Préparation et Sauvegarde finale ---
    console.log('Tentative de sauvegarde de la configuration finale...');
    console.log('Données brutes collectées:', JSON.stringify(configurationData.value, null, 2)); // Log pour voir les données avant traitement

    // Préparer le payload final pour l'IPC
    const finalPayload: Record<string, any> = {};

    try {
        // Copier les données et traiter le logo si nécessaire
        for (const key in configurationData.value) {
            if (key === 'GeneralInfo' && configurationData.value[key]?.logoFile instanceof File) {
                // Traitement spécifique pour GeneralInfo avec logoFile
                const generalInfoData = { ...configurationData.value[key] };
                const logoFile: File = generalInfoData.logoFile;

                console.log('Traitement du logoFile pour GeneralInfo...');
                const base64Content = await convertFileToBase64(logoFile);

                // Créer la structure attendue par le backend pour le logo
                const logoPayload: IFileUpload = {
                    content: base64Content,
                    name: logoFile.name,
                    type: logoFile.type,
                };

                // Ajouter les données de GeneralInfo au payload final
                // en remplaçant logoFile par la structure logo
                delete generalInfoData.logoFile; // Supprimer le fichier brut
                finalPayload[key] = {
                    ...generalInfoData,
                    logo: logoPayload // Ajouter le logo traité
                };
                 console.log('Logo traité et ajouté au payload pour GeneralInfo.');

            } else {
                // Copier les autres données telles quelles
                finalPayload[key] = configurationData.value[key];
            }
        }

        console.log('Payload final préparé pour IPC:', JSON.stringify(finalPayload, null, 2));

       // Envoyer via IPC si disponible
       if (window.ipcRenderer) {
          const response = await window.ipcRenderer.invoke('save-configuration', finalPayload);
          console.log('Réponse de la sauvegarde IPC:', response);

          if (response.success) {
            ElMessage.success('Configuration initiale sauvegardée avec succès !');
            console.log('Configuration sauvegardée, redirection vers /...');
            await window.ipcRenderer.invoke('set-first-launch-complete');
            router.replace('/');
          } else {
            console.error('Erreur lors de la sauvegarde via IPC:', response.error);
            ElMessage.error(`Erreur lors de la sauvegarde: ${response.error || 'Erreur inconnue du backend'}`);
          }
       } else {
            console.warn("Contexte non-Electron, la sauvegarde est simulée/ignorée.");
            ElMessage.info("Mode développement: Sauvegarde simulée.");
            router.replace('/'); // Simuler la redirection
       }
    } catch (error: any) {
        console.error('Erreur lors de la préparation ou sauvegarde de la configuration:', error);
        ElMessage.error(`Erreur critique lors de la sauvegarde: ${error.message || 'Erreur inconnue'}`);
        if (error instanceof Error && error.message.includes('FileReader')) {
             ElMessage.error('Erreur lors de la lecture du fichier logo.');
        }
    }
  }
};
</script>

<style scoped>
/* --- Styles existants --- */
.configuration-wizard {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: 100vh;
  background-color: #f5f7fa;
  padding: 20px;
  box-sizing: border-box;
  overflow: hidden;
}

.wizard-card {
  width: 100%;
  max-width: 1000px;
  margin-top: 20px;
  margin-bottom: 20px;
  display: flex;
  flex-direction: column;
  height: calc(100vh - 40px);
}

.wizard-header {
  padding: 10px 0;
  flex-shrink: 0;
}

.desktop-steps {
  display: block;
}

.mobile-steps-indicator {
  display: none;
  text-align: center;
  font-size: 1em;
  font-weight: bold;
  color: #303133;
  padding: 10px 15px;
  background-color: #f9fafc;
  border-radius: 4px;
  border: 1px solid #ebeef5;
}

.mobile-steps-indicator .step-info {
  color: #909399;
  margin-right: 8px;
}
.mobile-steps-indicator .step-title {
  color: #303133;
}

@media (max-width: 768px) {
  .desktop-steps {
    display: none;
  }
  .mobile-steps-indicator {
    display: block;
  }
  .configuration-wizard {
    padding: 10px;
  }
  .wizard-card {
    margin-top: 10px;
    margin-bottom: 10px;
    height: calc(100vh - 20px);
  }
  :deep(.el-card__header) {
    padding: 10px 15px !important;
  }
  .wizard-content {
    padding: 10px 5px;
  }
}

.wizard-content {
  flex: 1;
  overflow: hidden;
  position: relative;
  padding: 20px 5px;
  box-sizing: border-box;
}

:deep(.el-card__body) {
  height: 100%;
  display: flex;
  flex-direction: column;
  padding: 0;
}

:deep(.el-card__header) {
  padding: 15px 20px;
  border-bottom: 1px solid #ebeef5;
  background-color: #fff;
}

:deep(.el-step__title) {
  font-size: 0.9em;
}

:deep(.el-step.is-simple .el-step__title) {
  font-size: 13px;
}
:deep(.el-step.is-simple .el-step__arrow::after),
:deep(.el-step.is-simple .el-step__arrow::before) {
  width: 6px;
  height: 6px;
}

/* Style pour éviter que le contenu ne saute pendant le chargement du composant */
.wizard-content > :deep(div) {
  width: 100%;
  height: 100%;
  overflow: auto;
}

</style>