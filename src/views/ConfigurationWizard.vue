<template>
  <div class="configuration-wizard">
    <el-card class="wizard-card">
      <template #header>
       
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
import { ElMessage } from 'element-plus'; // Importer ElMessage et ElMessageBox pour les erreurs et les confirmations

// Importation des composants de vue
import WelcomView from './omboarding/WelcomView.vue';
import DataLocationView from './omboarding/DataLocationView.vue';
import GeneralInfoView from './omboarding/GeneralInfoView.vue';
import YearRepartitionView from './omboarding/YearRepartitionView.vue';
import GradeView from './omboarding/GradeView.vue';
import CourseView from './omboarding/CourseView.vue';
import LanguageSettingView from './omboarding/LanguageSettingView.vue';
import PayementConfigurationView from './omboarding/PayementConfigurationView.vue';
import SupervisorInfoView from './omboarding/SupervisorInfoView.vue';
import LicenseView from './omboarding/LicenseView.vue';
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
  'PayementConfiguration',
  'SupervisorInfo',
  'License'
]);

// Titres français

// Mapping Clés -> Composants
const viewComponents = {
  Welcome: WelcomView,
  DataLocation: DataLocationView,
  GeneralInfo: GeneralInfoView,
  YearRepartition: YearRepartitionView,
  Grade: GradeView,
  Course: CourseView,
  LanguageSetting: LanguageSettingView,
  PayementConfiguration: PayementConfigurationView,
  SupervisorInfo: SupervisorInfoView,
  License: LicenseView
};

// --- Computed Properties ---
const currentViewComponent = computed(() => {
  const currentViewKey = configViewsKeys.value[currentStep.value];
  return viewComponents[currentViewKey as keyof typeof viewComponents];
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
        
    }
  } catch (error: any) {
    console.error('Erreur lors de la vérification du premier lancement:', error);
     ElMessage.error(`Erreur critique: ${error.message || 'Impossible de vérifier le statut de lancement.'}`);

  }
});

// --- Methodes ---

// Gère la réception des données d'une étape et passe à la suivante
const handleConfigurationSaved = async () => {
  const currentKey = configViewsKeys.value[currentStep.value];
  console.log(`Configuration sauvegardée pour l'étape ${currentKey}`);
  

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
    console.log('Retour à l\'étape précédente');
    currentStep.value--;
  } else {
     console.log('Impossible de retourner en arrière depuis la première étape');
  }
};


const nextStep = async () => {
  if (currentStep.value < configViewsKeys.value.length - 1) {
    currentStep.value++;
    console.log('Passage à l\'étape:', currentStep.value, configViewsKeys.value[currentStep.value]);
  } else {
   
    console.log('Configuration terminée, redirection vers l\'application...');
    
    try {

      if (window.ipcRenderer) {
        try {
          await window.ipcRenderer.invoke('set-first-launch-complete');
          console.log('Premier lancement marqué comme terminé');
        } catch (e) {
          console.warn('Impossible de marquer le premier lancement comme terminé:', e);
        }
      }
      
  
      
      ElMessage.success('Configuration initiale terminée avec succès !');
      console.log('Redirection vers /...');
      
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