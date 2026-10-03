<template>
  <div class="configuration-wizard">
    <el-card class="wizard-card">
      <template #header>
       
      </template>

      <div class="wizard-content">
        <el-alert
          v-if="currentViewKey === 'YearRepartition'"
          type="info"
          :closable="false"
          show-icon
          title="Presets par niveau : Préscolaire / Primaire → 3 trimestres, Secondaire → 2 semestres"
          description="Choisissez le niveau dans l'étape : le régime et les dates types sont pré-remplis (ajustables)."
          class="wizard-level-hint"
        />
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
import { ElMessage } from 'element-plus'; // Importer ElMessage et ElMessageBox pour les erreurs et les confirmations

// Importation des composants de vue
import WelcomView from './omboarding/WelcomView.vue';
import ImportBackupView from './omboarding/ImportBackupView.vue';
import DataLocationView from './omboarding/DataLocationView.vue';
import GeneralInfoView from './omboarding/GeneralInfoView.vue';
import YearRepartitionView from './omboarding/YearRepartitionView.vue';
import GradeView from './omboarding/GradeView.vue';
import CourseView from './omboarding/CourseView.vue';
import LanguageSettingView from './omboarding/LanguageSettingView.vue';
import PayementConfigurationView from './omboarding/PayementConfigurationView.vue';
import SupervisorInfoView from './omboarding/SupervisorInfoView.vue';



const router = useRouter();
const currentStep = ref(0);

// Clés internes
// Ordre : Welcome → ImportBackup (skippable, 2ème position) → DataLocation → GeneralInfo → …
const configViewsKeys = ref([
  'Welcome',
  'ImportBackup',
  'DataLocation',
  'GeneralInfo',
  'YearRepartition',
  'Grade',
  'Course',
  'LanguageSetting',
  'PayementConfiguration',
  'SupervisorInfo'
]);

// Titres français

// Mapping Clés -> Composants
const viewComponents = {
  Welcome: WelcomView,
  ImportBackup: ImportBackupView,
  DataLocation: DataLocationView,
  GeneralInfo: GeneralInfoView,
  YearRepartition: YearRepartitionView,
  Grade: GradeView,
  Course: CourseView,
  LanguageSetting: LanguageSettingView,
  PayementConfiguration: PayementConfigurationView,
  SupervisorInfo: SupervisorInfoView
};

// --- Computed Properties ---
const currentViewKey = computed(() => configViewsKeys.value[currentStep.value]);
const currentViewComponent = computed(() => {
  const key = configViewsKeys.value[currentStep.value];
  return viewComponents[key as keyof typeof viewComponents];
});


// --- Lifecycle Hooks ---
onMounted(async () => {
  // ... (logique onMounted inchangée) ...
    try {
    // Assurez-vous que window.ipcRenderer est bien défini (contexte Electron)
    if (window.ipcRenderer) {
        const response = await window.ipcRenderer.invoke('is-first-launch');

        // P0 FIX: backend now returns {success:true, data:boolean, error:null, message:''}
        // Be tolerant: only treat as error when success === false explicitly.
        if (response.success === false) {
          console.error('Erreur lors de la vérification:', response.error);
           ElMessage.error(`Erreur de vérification: ${response.error || 'Inconnue'}`);
          return;
        }
        // Fallback for old IPC shape without success field: if data is undefined, treat as error
        if (response.data === undefined) {
          console.error('Erreur lors de la vérification: réponse sans data', response);
          ElMessage.error(`Erreur de vérification: ${response.error || 'Réponse invalide'}`);
          return;
        }

        if (!response.data) {
          router.replace('/');
        } else {
          // Guard anti-boucle après import + relaunch : si un import a déjà été
          // confirmé (flag posé par BackupImportCard avant backup:confirmImport),
          // on retire l'étape ImportBackup pour ne pas la reproposer.
          try {
            if (localStorage.getItem('eschool:wizard-backup-imported')) {
              configViewsKeys.value = configViewsKeys.value.filter((k) => k !== 'ImportBackup');
            }
          } catch {
            /* stockage indisponible : le wizard reste inchangé */
          }
        }
    } else {
        console.warn("Contexte non-Electron, la vérification du premier lancement est ignorée.");
        
    }
  } catch (error: any) {
    console.error('Erreur lors de la vérification du premier lancement:', error);
    ElMessage.error(`Erreur critique: ${error.message || 'Impossible de vérifier le statut de lancement.'}`);

  }
});

// --- Methodes ---

// Gère la réception des données d'une étape et passe à la suivante
const handleConfigurationSaved = async () => {
  

  if (currentStep.value === configViewsKeys.value.length - 1) {
    await finishConfiguration();
  } else {
  
    await nextStep();
  }
};


const finishConfiguration = async () => {
  try {
  
    const firstLaunchResult = await window.ipcRenderer.invoke('set-first-launch-complete');
    
    if (!firstLaunchResult.success) {
      console.warn('Avertissement: Impossible de marquer le premier lancement comme terminé');
    }

    ElMessage({
      message: 'Configuration terminée avec succès',
      type: 'success',
      duration: 2000,
      onClose: () => {
        // Rediriger vers la page d'accueil après le message de succès
        router.push('/').then(() => {
        ElMessage({
          message: 'Connexion réussie',
          type: 'success'
        })
      })
      }
    });
  } catch (error) {
    console.error('Erreur lors de la finalisation de la configuration:', error);
    ElMessage.error(error instanceof Error ? error.message : 'Erreur lors de la finalisation');
  }
};

// Gère le retour à l'étape précédente
const handleGoBack = () => {
  if (currentStep.value > 0) {
    currentStep.value--;
  } else {
  }
};


const nextStep = async () => {
  if (currentStep.value < configViewsKeys.value.length - 1) {
    currentStep.value++;
  } else {
   
    
    try {

      if (window.ipcRenderer) {
        try {
          await window.ipcRenderer.invoke('set-first-launch-complete');
        } catch (e) {
          console.warn('Impossible de marquer le premier lancement comme terminé:', e);
        }
      }
      
  
      
      ElMessage.success('Configuration initiale terminée avec succès !');
      
      // Forcer une redirection dure pour contourner les guards de navigation
      window.location.href = '/';
    } catch (error: any) {
      console.error('Erreur lors de la finalisation:', error);
      ElMessage.error(`Erreur finale: ${error.message || 'Erreur inconnue'}`);
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
