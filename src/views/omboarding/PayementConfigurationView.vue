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
import { ref, computed} from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { PaymentConfig, PaymentConfigCreateInput } from '@/types/payment';
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue';
import { useCurrency } from '@/composables/useCurrency';
import WizardViewBase from './WizardViewBase.vue';
import { ensureUnlock, isAccountingLockError, isNoSecretError, mapAccountingError, openGuardedForm } from '@/composables/useAccountingGuard';
import { strictInvoke } from '@/utils/ipc';

/** Garde STRICT avant chaque écriture compta : modale systématique (mot de passe de connexion). */
async function guardAccountingWrite(): Promise<void> {
  try {
    await ensureUnlock({ force: true, fresh: true });
    } catch (guardErr) {
      if (isNoSecretError(guardErr)) {
        ElMessage.warning(mapAccountingError(guardErr));
      }
      throw guardErr;
    }
}

const emit = defineEmits(['configuration-saved', 'go-back']);
const { currency } = useCurrency();
const configurations = ref<PaymentConfig[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const showModal = ref(false);
// @ts-ignore
const currentConfig = ref<PaymentConfig>({
 classId: '',
  className: '',
  annualAmount: 0,
  inscriptionFee: 0,
  reInscriptionFee: 0,
  allowScholarship: false,
  scholarshipPercentages: [],
  scholarshipCriteria: ''
});

const modalTitle = computed(() => 
  `Configuration des frais - ${currentConfig.value.className}`
);

const openCreateModal = () => {
  // Garde d'OUVERTURE : popup AVANT l'ouverture du formulaire (onboarding).
  void (async () => {
    try {
      await openGuardedForm(() => {
        if (configurations.value.length === 0) {
          ElMessage.warning("Aucune classe n'est disponible pour configuration");
          return;
        }
        const nonConfigured = configurations.value.find(c => c.annualAmount === 0);
        currentConfig.value = nonConfigured ? { ...nonConfigured } : { ...configurations.value[0] };
        showModal.value = true;
      });
    } catch (err) {
        if (isNoSecretError(err)) {
          ElMessage.warning(mapAccountingError(err));
        }
      }
    })();
  };

  const editConfiguration = (config: PaymentConfig) => {
  // Garde d'OUVERTURE « Modifier » : popup AVANT l'ouverture du dialogue.
  void (async () => {
    try {
      await openGuardedForm(() => {
        currentConfig.value = { ...config };
        showModal.value = true;
      });
    } catch (err) {
        if (isNoSecretError(err)) {
          ElMessage.warning(mapAccountingError(err));
        }
      }
    })();
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

    // @ts-ignore
    const configData: PaymentConfigCreateInput = {
      classId: String(currentConfig.value.classId),
      annualAmount: Number(currentConfig.value.annualAmount),
      inscriptionFee: Number(currentConfig.value.inscriptionFee || 0),
      reInscriptionFee: Number(currentConfig.value.reInscriptionFee || 0),
      allowScholarship: Boolean(currentConfig.value.allowScholarship),
      scholarshipPercentages: Array.isArray(currentConfig.value.scholarshipPercentages) 
        ? currentConfig.value.scholarshipPercentages.map(Number) 
        : [],
      scholarshipCriteria: String(currentConfig.value.scholarshipCriteria || '')
    };

    // Garde mot de passe de connexion AVANT chaque écriture (modale systématique).
    await guardAccountingWrite();
    try {
      await strictInvoke('payment:saveConfig', configData);
    } catch (ipcErr) {
        if (isNoSecretError(ipcErr)) {
          ElMessage.warning(mapAccountingError(ipcErr));
          throw ipcErr;
        }
      if (!isAccountingLockError(ipcErr)) throw ipcErr;
      await ensureUnlock({ force: true, fresh: true });
      await strictInvoke('payment:saveConfig', configData);
    }

    ElMessage.success('Configuration sauvegardée avec succès');
    await loadConfigurations();
    showModal.value = false;
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
    const [grades, configsRaw] = await Promise.all([
      strictInvoke<Array<{ id: string; name: string }>>('grade:all'),
      strictInvoke<PaymentConfig[]>('payment:getConfigs').catch(() => [] as PaymentConfig[]),
    ]);

    if (!grades || !grades.length) {
      throw new Error('Erreur lors du chargement des classes');
    }

    const configs = Array.isArray(configsRaw) ? configsRaw : [];
    
    configurations.value = grades.map((grade: { id: string; name: string }) => {
      const config = configs.find((c: PaymentConfig) => String(c.classId) === String(grade.id));
      return {
        classId: String(grade.id),
        className: grade.name,
        annualAmount: config ? Number(config.annualAmount) : 0,
        inscriptionFee: config ? Number(config.inscriptionFee ?? 0) : 0,
        reInscriptionFee: config ? Number(config.reInscriptionFee ?? 0) : 0,
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