<template>
  <wizard-view-base>
    <template #title>
      Configurez les frais de scolarité pour chaque classe.
      <div class="subtitle">
        Vous pourrez toujours modifier ces configurations plus tard dans les paramètres.
      </div>
    </template>

    <div class="container-content">
      <div class="actions-container">
        <el-button type="primary" @click="openCreateModal" class="create-btn">
          Configurer les Frais de Scolarité
        </el-button>
        <el-button @click="skipConfiguration" class="skip-btn">
          Configurer Plus Tard
        </el-button>
      </div>

      <el-table 
        :data="configurations" 
        class="config-table" 
        row-key="classId"
        v-loading="isLoading"
      >
        <el-table-column prop="className" label="Classe" />
        <el-table-column label="Frais de Scolarité">
          <template #default="{ row }">
            <currency-display :amount="row.annualAmount" />
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="150">
          <template #default="scope">
            <el-button 
              size="small" 
              type="primary"
              @click="editConfiguration(scope.row)"
            >
              Modifier
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog 
        v-model="showModal" 
        :title="modalTitle" 
        width="500px"
        destroy-on-close
      >
        <el-form 
          ref="formRef"
          :model="currentConfig"
          label-position="top"
        >
          <el-form-item label="Classe">
            <el-input 
              v-model="currentConfig.className" 
              disabled
            />
          </el-form-item>

          <el-form-item label="Frais de Scolarité Annuels">
            <el-input-number
              v-model="currentConfig.annualAmount"
              :min="0"
              :step="5000"
              class="full-width"
              controls-position="right"
            >
              <template #suffix>{{ currency }}</template>
            </el-input-number>
          </el-form-item>

          <el-divider>Configuration des bourses</el-divider>

          <el-form-item label="Autoriser les bourses">
            <el-switch
              v-model="currentConfig.allowScholarship"
              active-text="Oui"
              inactive-text="Non"
            />
          </el-form-item>

          <template v-if="currentConfig.allowScholarship">
            <el-form-item label="Pourcentages de bourse disponibles">
              <el-select
                v-model="currentConfig.scholarshipPercentages"
                multiple
                class="full-width"
                placeholder="Sélectionnez les pourcentages"
              >
                <el-option
                  v-for="percent in [25, 50, 75, 100]"
                  :key="percent"
                  :label="`${percent}%`"
                  :value="percent"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="Critères d'éligibilité">
              <el-input
                v-model="currentConfig.scholarshipCriteria"
                type="textarea"
                :rows="3"
                placeholder="Décrivez les critères d'éligibilité pour les bourses"
              />
            </el-form-item>
          </template>
        </el-form>

        <template #footer>
          <el-button @click="showModal = false">Annuler</el-button>
          <el-button 
            type="primary" 
            @click="saveConfiguration"
            :loading="isSaving"
          >
            Enregistrer
          </el-button>
        </template>
      </el-dialog>
    </div>

    <template #actions>
      <el-button
        type="info"
        @click="goBack"
        class="action-button">
        Retourner
      </el-button>
      <el-button
        type="primary"
        @click="goNext"
        class="action-button">
        Continuer
      </el-button>
    </template>
  </wizard-view-base>
</template>

<script setup lang="ts">
import { ref, computed, defineEmits } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { PaymentConfig, PaymentConfigCreateInput } from '@/types/payment';
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue';
import { useCurrency } from '@/composables/useCurrency';
import WizardViewBase from './WizardViewBase.vue';

const emit = defineEmits(['configuration-saved', 'go-back']);
const { currency } = useCurrency();
const configurations = ref<PaymentConfig[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const showModal = ref(false);
const currentConfig = ref<PaymentConfig>({
  classId: '',
  className: '',
  annualAmount: 0,
  allowScholarship: false,
  scholarshipPercentages: [],
  scholarshipCriteria: ''
});

const modalTitle = computed(() => 
  `Configuration des frais - ${currentConfig.value.className}`
);

const openCreateModal = () => {
  if (configurations.value.length === 0) {
    ElMessage.warning("Aucune classe n'est disponible pour configuration");
    return;
  }
  
  const nonConfigured = configurations.value.find(c => c.annualAmount === 0);
  currentConfig.value = nonConfigured ? { ...nonConfigured } : { ...configurations.value[0] };
  showModal.value = true;
};

const editConfiguration = (config: PaymentConfig) => {
  currentConfig.value = { ...config };
  showModal.value = true;
};

const saveConfiguration = async () => {
  try {
    isSaving.value = true;
    
    if (!currentConfig.value.classId) {
      ElMessage.error('Veuillez sélectionner une classe');
      return;
    }
    
    if (currentConfig.value.annualAmount <= 0) {
      ElMessage.error('Le montant des frais de scolarité doit être supérieur à 0');
      return;
    }

    // Validation des bourses si l'option est activée
    if (currentConfig.value.allowScholarship && 
        (!currentConfig.value.scholarshipPercentages || 
         !Array.isArray(currentConfig.value.scholarshipPercentages) || 
         currentConfig.value.scholarshipPercentages.length === 0)) {
      ElMessage.error('Veuillez sélectionner au moins un pourcentage de bourse');
      return;
    }

    const configData: PaymentConfigCreateInput = {
      classId: String(currentConfig.value.classId),
      annualAmount: Number(currentConfig.value.annualAmount),
      allowScholarship: Boolean(currentConfig.value.allowScholarship),
      scholarshipPercentages: Array.isArray(currentConfig.value.scholarshipPercentages) 
        ? currentConfig.value.scholarshipPercentages.map(Number) 
        : [],
      scholarshipCriteria: String(currentConfig.value.scholarshipCriteria || '')
    };

    const result = await window.ipcRenderer.invoke('payment:saveConfig', configData);

    if (result.success) {
      ElMessage.success('Configuration sauvegardée avec succès');
      await loadConfigurations();
      showModal.value = false;
    } else {
      throw new Error(result.message || 'Erreur lors de la sauvegarde');
    }
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    ElMessage.error(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde');
  } finally {
    isSaving.value = false;
  }
};

const loadConfigurations = async () => {
  isLoading.value = true;
  try {
    const [gradesResult, configsResult] = await Promise.all([
      window.ipcRenderer.invoke('grade:all'),
      window.ipcRenderer.invoke('payment:getConfigs')
    ]);

    if (!gradesResult.success || !gradesResult.data) {
      throw new Error('Erreur lors du chargement des classes');
    }

    const grades = gradesResult.data;
    const configs = configsResult.success ? configsResult.data : [];
    
    configurations.value = grades.map((grade: { id: string; name: string }) => {
      const config = configs.find((c: PaymentConfig) => String(c.classId) === String(grade.id));
      return {
        classId: String(grade.id),
        className: grade.name,
        annualAmount: config ? Number(config.annualAmount) : 0,
        allowScholarship: config ? config.allowScholarship : false,
        scholarshipPercentages: config ? config.scholarshipPercentages : [],
        scholarshipCriteria: config ? config.scholarshipCriteria : ''
      };
    });

  } catch (error) {
    console.error("Erreur lors du chargement:", error);
    ElMessage.error('Erreur lors du chargement des configurations');
  } finally {
    isLoading.value = false;
  }
};

const goNext = async () => {
  if (configurations.value.length === 0) {
    ElMessage.warning('Veuillez configurer au moins une classe');
    return;
  }

  const hasUnconfigured = configurations.value.some(c => c.annualAmount === 0);
  if (hasUnconfigured) {
    ElMessage.warning('Veuillez configurer toutes les classes avant de continuer');
    return;
  }

  // S'assurer qu'il n'y a pas de dupliqués avant d'émettre l'événement
  const uniqueConfigs = new Map();
  configurations.value.forEach(config => {
    // Si une configuration existe déjà pour cette classe, on utilise celle avec le montant le plus élevé
    if (!uniqueConfigs.has(config.className) || 
        uniqueConfigs.get(config.className).annualAmount < config.annualAmount) {
      uniqueConfigs.set(config.className, config);
    }
  });

  // Convertir le Map en tableau pour l'émission d'événement
  const uniqueConfigsArray = Array.from(uniqueConfigs.values());
  
  console.log('Configurations uniques envoyées:', uniqueConfigsArray);
  emit('configuration-saved', uniqueConfigsArray);
};

const goBack = () => {
  emit('go-back');
};

const skipConfiguration = () => {
  ElMessageBox.confirm(
    'Vous pourrez configurer les frais de scolarité plus tard dans les paramètres. Voulez-vous continuer ?',
    'Confirmer',
    {
      confirmButtonText: 'Oui, configurer plus tard',
      cancelButtonText: 'Non, configurer maintenant',
      type: 'warning'
    }
  )
    .then(() => {
      emit('configuration-saved', []);
    })
    .catch(() => {
      // L'utilisateur a choisi de rester sur la page de configuration
    });
};

// Charger les configurations au montage
loadConfigurations();
</script>

<style scoped>
.container-content {
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
  height: calc(100vh - 200px);
  overflow-y: auto;
  margin-bottom: 20px;
}

/* Assure que les boutons restent en bas */
:deep(.wizard-view-base) {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

:deep(.wizard-view-base__content) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.wizard-view-base__actions) {
  flex-shrink: 0;
  padding: 20px;
  background: white;
  border-top: 1px solid #ebeef5;
  position: sticky;
  bottom: 0;
  z-index: 10;
}

.actions-container {
  display: flex;
  gap: 1rem;
  justify-content: center;
  margin-bottom: 2rem;
}

.create-btn, .skip-btn {
  min-width: 200px;
}

.subtitle {
  font-size: 0.9rem;
  color: #606266;
  margin-top: 0.5rem;
}

.config-table {
  width: 100%;
  margin-bottom: 20px;
}

.full-width {
  width: 100%;
}

:deep(.el-form-item__label) {
  font-weight: 600;
  color: #606266;
  padding-bottom: 4px;
  line-height: 1.4;
}

:deep(.el-input__wrapper),
:deep(.el-textarea__wrapper),
:deep(.el-input-number) {
  box-shadow: 0 0 0 1px #dcdfe6 inset;
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover),
:deep(.el-textarea__wrapper:hover),
:deep(.el-input-number:hover) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}
</style>