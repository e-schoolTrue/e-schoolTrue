<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { PaymentConfig, PaymentConfigCreateInput } from '@/types/payment';
// @ts-ignore
import { PaymentAnnualConfigEntity } from '#electron/backend/entities/paymentConfig';
import { useCurrency } from '@/composables/useCurrency';
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue';

// Assuming Grade has at least id and name
interface Grade {
  id: string;
  name: string;
}

const { currency } = useCurrency();
const activeTab = ref('mensuality');
const paymentConfigs = ref<PaymentConfig[]>([]);
const trancheConfigs = ref<PaymentAnnualConfigEntity[]>([]);
const grades = ref<Grade[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const showModal = ref(false);
const showTrancheModal = ref(false);
const currTrancheConfig = ref<PaymentAnnualConfigEntity>();
const currentPaymentConfig = ref<PaymentConfig>({ 
  classId: '',
  className: '',
  annualAmount: 0,
  inscriptionFee: 0,
  reInscriptionFee: 0,
  allowScholarship: false,
  scholarshipPercentages: [],
  scholarshipCriteria: ''
});

// New state for tranche configuration modal
const isTrancheConfigModalVisible = ref(false);

interface TrancheDataItem {
  id?: number;
  name: string;
  amount: number;
}

interface TrancheConfigData {
  id?: number;
  gradeId: string | null;
  annualAmount: number;
  trancheCount: number;
  tranches: TrancheDataItem[];
}

const editingTrancheConfig = ref<TrancheConfigData | null>(null);

const unconfiguredClasses = computed(() => {
  if (!trancheConfigs.value || !paymentConfigs.value) return [];
  const configuredGradeIds = new Set(trancheConfigs.value.map(c => String(c.grade.id)));
  return paymentConfigs.value.filter(p => p.annualAmount > 0 && !configuredGradeIds.has(String(p.classId)));
});

const totalTrancheAmount = computed(() => {
  if (!editingTrancheConfig.value) return 0;
  return editingTrancheConfig.value.tranches.reduce((sum, tranche) => sum + Number(tranche.amount || 0), 0);
});

const remainingToAllocate = computed(() => {
  if (!editingTrancheConfig.value) return 0;
  return editingTrancheConfig.value.annualAmount - totalTrancheAmount.value;
});

const openCreateTrancheConfigModal = () => {
  editingTrancheConfig.value = {
    id: undefined,
    gradeId: null,
    annualAmount: 0,
    trancheCount: 2,
    tranches: [
      { name: 'Tranche 1', amount: 0 },
      { name: 'Tranche 2', amount: 0 }
    ]
  };
  isTrancheConfigModalVisible.value = true;
};

const handleGradeChange = (gradeId: string) => {
  if (!editingTrancheConfig.value) return;
  const config = paymentConfigs.value.find(p => String(p.classId) === String(gradeId));
  if (config) {
    editingTrancheConfig.value.annualAmount = config.annualAmount;
  }
};

const updateTotalTranches = () => {
  if (!editingTrancheConfig.value) return;
  const count = Number(editingTrancheConfig.value.trancheCount);
  const currentTranches = editingTrancheConfig.value.tranches;
  const newTranches: TrancheDataItem[] = [];

  for (let i = 0; i < count; i++) {
    if (i < currentTranches.length) {
      newTranches.push(currentTranches[i]);
    } else {
      newTranches.push({ name: `Tranche ${i + 1}`, amount: 0 });
    }
  }
  editingTrancheConfig.value.tranches = newTranches;
};

const openTrancheDialog = (config: PaymentAnnualConfigEntity) => {
  showTrancheModal.value = true;
  currTrancheConfig.value = config;
};

const closeTrancheDialog = () => {
  showTrancheModal.value = false;
};

const modalTitle = computed(() => 
  `Configuration des frais - ${currentPaymentConfig.value.className}`
);

const openCreateModal = () => {
  if (paymentConfigs.value.length === 0) {
    ElMessage.warning("Aucune classe n'est disponible pour configuration");
    return;
  }
  
  const nonConfigured = paymentConfigs.value.find(c => c.annualAmount === 0);
  currentPaymentConfig.value = nonConfigured ? { ...nonConfigured } : { ...paymentConfigs.value[0] };
  showModal.value = true;
};

const editPaymentConfiguration = (config: PaymentConfig) => {
  currentPaymentConfig.value = { ...config };
  showModal.value = true;
};

const deleteTrancheConfiguration = async (config: PaymentAnnualConfigEntity) => {
  try {
    await ElMessageBox.confirm(
      `Êtes-vous sûr de vouloir supprimer la configuration des tranches pour la classe ${config.grade.name} ?`,
      'Confirmation',
      {
        confirmButtonText: 'Oui, supprimer',
        cancelButtonText: 'Annuler',
        type: 'warning',
      }
    );

    const result = await window.ipcRenderer.invoke('tranche-config:delete', config.id);
    if (result.success) {
      ElMessage.success('Configuration supprimée.');
      await loadTrancheConfigs();
    } else {
      throw new Error(result.message || 'Erreur lors de la suppression.');
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Failed to delete tranche config:', error);
      ElMessage.error(error instanceof Error ? error.message : 'Une erreur est survenue.');
    }
  }
};

const editTrancheConfiguration = (config: PaymentAnnualConfigEntity) => {
  const annualAmount = paymentConfigs.value.find(p => String(p.classId) === String(config.grade.id))?.annualAmount || 0;
  
  editingTrancheConfig.value = {
    id: config.id,
    gradeId: String(config.grade.id),
    annualAmount: annualAmount,
    trancheCount: config.trancheCount,
    tranches: config.tranches.map((t: any) => ({
      id: t.id,
      name: t.tranchName || t.name,
      amount: t.amount || 0
    }))
  };
  isTrancheConfigModalVisible.value = true;
};

const savePaymentConfiguration = async () => {
  try {
    isSaving.value = true;
    
    if (!currentPaymentConfig.value.classId) {
      ElMessage.error('Veuillez sélectionner une classe');
      return;
    }
    
    if (currentPaymentConfig.value.annualAmount <= 0) {
      ElMessage.error('Le montant des frais de scolarité doit être supérieur à 0');
      return;
    }

    if (currentPaymentConfig.value.allowScholarship && 
        (!currentPaymentConfig.value.scholarshipPercentages || 
         !Array.isArray(currentPaymentConfig.value.scholarshipPercentages) || 
         currentPaymentConfig.value.scholarshipPercentages.length === 0)) {
      ElMessage.error('Veuillez sélectionner au moins un pourcentage de bourse');
      return;
    }

    const configData: PaymentConfigCreateInput = {
      classId: String(currentPaymentConfig.value.classId),
      annualAmount: Number(currentPaymentConfig.value.annualAmount),
      inscriptionFee: Number(currentPaymentConfig.value.inscriptionFee),
      reInscriptionFee: Number(currentPaymentConfig.value.reInscriptionFee),
      allowScholarship: Boolean(currentPaymentConfig.value.allowScholarship),
      scholarshipPercentages: Array.isArray(currentPaymentConfig.value.scholarshipPercentages) 
        ? currentPaymentConfig.value.scholarshipPercentages.map(Number) 
        : [],
      scholarshipCriteria: String(currentPaymentConfig.value.scholarshipCriteria || '')
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

const saveTrancheConfiguration = async () => {
  if (!editingTrancheConfig.value) return;

  if (!editingTrancheConfig.value.gradeId) {
    ElMessage.error('Veuillez sélectionner une classe.');
    return;
  }
  if (remainingToAllocate.value !== 0) {
    ElMessage.error('La somme des montants des tranches doit être égale au montant annuel.');
    return;
  }

  isSaving.value = true;
  try {
    const { id, gradeId, tranches } = editingTrancheConfig.value;
    const payload = { id, gradeId, tranches: tranches.map(t => ({name: t.name, amount: t.amount})) };
    
    const event = id ? 'tranche-config:update' : 'tranche-config:create';
    const result = await window.ipcRenderer.invoke(event, payload);

    if (result.success) {
      ElMessage.success('Configuration des tranches sauvegardée.');
      isTrancheConfigModalVisible.value = false;
      await loadTrancheConfigs();
    } else {
      throw new Error(result.message || 'Erreur lors de la sauvegarde.');
    }
  } catch (error) {
    console.error('Failed to save tranche config:', error);
    ElMessage.error(error instanceof Error ? error.message : 'Une erreur est survenue.');
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

    grades.value = gradesResult.data;
    const configs = configsResult.success ? configsResult.data : [];

    paymentConfigs.value = grades.value.map((grade: { id: string; name: string; }) => {
      const config = configs.find((c: PaymentConfig) => String(c.classId) === String(grade.id));
      return {
        classId: String(grade.id),
        className: grade.name,
        annualAmount: config ? Number(config.annualAmount) : 0,
        inscriptionFee: config ? Number(config.inscriptionFee) : 0,
        reInscriptionFee: config ? Number(config.reInscriptionFee) : 0,
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

const loadTrancheConfigs = async () => {
  try {
    const result = await window.ipcRenderer.invoke('tranche-config:all');
    if (result.success) {
      trancheConfigs.value = result.data;
    } else {
      ElMessage.error('Erreur lors du chargement des configurations de tranches.');
    }
  } catch (error) {
    console.error('Failed to load tranche configs:', error);
    ElMessage.error('Une erreur est survenue lors du chargement des tranches.');
  }
};

onMounted(async () => {
  await loadConfigurations();
  await loadTrancheConfigs();
});
</script>

<template>
  <div class="payment-config-container">
    <el-tabs
        type="card"
        v-model="activeTab"
      >
        <el-tab-pane label="Mensualités" name="mensuality">
          <div class="title">
            <el-button type="primary" @click="openCreateModal" class="create-btn"> Configurer les Frais de Scolarité </el-button>
          </div>
          <mensuality-config-table :configs="paymentConfigs" @openUpdateForm="editPaymentConfiguration" />
        </el-tab-pane>
        <el-tab-pane label="Tranches" name="tranches">
          <div class="title">
            <el-button type="primary" @click="openCreateTrancheConfigModal" class="create-btn">Configuration des tranches</el-button>
          </div>
          <tranch-config-table :configs="trancheConfigs" @openUpdateForm="editTrancheConfiguration" @openDetails="openTrancheDialog" @delete="deleteTrancheConfiguration" />
        </el-tab-pane>
      </el-tabs>

      <TrancheConfigDetails :config="currTrancheConfig" :dialog="showTrancheModal" @closeDialog="closeTrancheDialog" />

      <el-dialog 
        v-model="isTrancheConfigModalVisible" 
        :title="editingTrancheConfig && editingTrancheConfig.id ? 'Modifier la configuration des tranches' : 'Nouvelle configuration des tranches'"
        width="600px"
        destroy-on-close
      >
        <el-form v-if="editingTrancheConfig" :model="editingTrancheConfig" label-position="top">
          <el-form-item label="Classe">
            <el-select
              v-model="editingTrancheConfig.gradeId"
              placeholder="Sélectionner une classe"
              class="full-width"
              @change="handleGradeChange"
              :disabled="!!editingTrancheConfig.id"
            >
              <el-option
                v-for="grade in unconfiguredClasses"
                :key="grade.classId"
                :label="grade.className"
                :value="grade.classId"
              />
              <el-option
                v-if="editingTrancheConfig.id"
                :key="editingTrancheConfig.gradeId"
                :label="paymentConfigs.find(p => p.classId === editingTrancheConfig.gradeId)?.className"
                :value="editingTrancheConfig.gradeId"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="Montant Annuel des Frais de Scolarité">
            <currency-display :amount="editingTrancheConfig.annualAmount" />
          </el-form-item>

          <el-form-item label="Nombre de tranches">
            <el-input-number v-model="editingTrancheConfig.trancheCount" :min="1" :max="12" @change="updateTotalTranches" />
          </el-form-item>

          <el-divider>Détails des tranches</el-divider>

          <div v-for="(tranche, index) in editingTrancheConfig.tranches" :key="index" class="tranche-item">
            <el-input v-model="tranche.name" placeholder="Nom de la tranche" />
            <el-input-number v-model="tranche.amount" :min="0" :step="1000" controls-position="right">
              <template #suffix>{{ currency }}</template>
            </el-input-number>
          </div>

          <div class="summary">
            <div>Montant total alloué: <currency-display :amount="totalTrancheAmount" /></div>
            <div>Reste à allouer: <currency-display :amount="remainingToAllocate" :class="{ 'error-text': remainingToAllocate !== 0 }" /></div>
          </div>

        </el-form>
        <template #footer>
          <el-button @click="isTrancheConfigModalVisible = false">Annuler</el-button>
          <el-button type="primary" @click="saveTrancheConfiguration" :loading="isSaving">Enregistrer</el-button>
        </template>
      </el-dialog>

      <el-dialog 
        v-model="showModal" 
        :title="modalTitle" 
        width="500px"
        destroy-on-close
      >
        <el-form 
          ref="formRef"
          :model="currentPaymentConfig"
          label-position="top"
        >
          <el-form-item label="Classe">
            <el-input 
              v-model="currentPaymentConfig.className" 
              disabled
            />
          </el-form-item>

          <el-form-item label="Frais de Scolarité Annuels">
            <el-input-number
              v-model="currentPaymentConfig.annualAmount"
              :min="0"
              :step="5000"
              class="full-width"
              controls-position="right"
            >
              <template #suffix>{{ currency }}</template>
            </el-input-number>
          </el-form-item>

          <el-divider>Frais d'inscription</el-divider>

          <el-form-item label="Frais d'inscription">
            <el-input-number
              v-model="currentPaymentConfig.inscriptionFee"
              :min="0"
              :step="5000"
              class="full-width"
              controls-position="right"
            >
              <template #suffix>{{ currency }}</template>
            </el-input-number>
          </el-form-item>

          <el-form-item label="Frais de ré-inscription">
            <el-input-number
              v-model="currentPaymentConfig.reInscriptionFee"
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
              v-model="currentPaymentConfig.allowScholarship"
              active-text="Oui"
              inactive-text="Non"
            />
          </el-form-item>

          <template v-if="currentPaymentConfig.allowScholarship">
            <el-form-item label="Pourcentages de bourse disponibles">
              <el-select
                v-model="currentPaymentConfig.scholarshipPercentages"
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
                v-model="currentPaymentConfig.scholarshipCriteria"
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
            @click="savePaymentConfiguration"
            :loading="isSaving"
          >
            Enregistrer
          </el-button>
        </template>
      </el-dialog>
  </div>
</template>


<style scoped>

:deep(.el-tabs__item.is-top) {
  color: white;
  background-color: var(--el-color-primary);
}

:deep(.el-tabs__item.is-active) {
  color: orange;
  background-color: var(--el-color-primary);
}
.payment-config-container {
  padding: 1.5rem;
}

.title{
  width: 100%;
  display: flex;
  justify-content: center;
}

.create-btn {
  width: 100%;
  max-width: 28rem;
  margin: 0 auto;
}

.config-table {
  width: 100%;
}

.full-width {
  width: 100%;
}

:deep(.el-input-number) {
  width: 100%;
}

.tranche-item {
  display: flex;
  gap: 1rem;
  margin-bottom: 1rem;
  align-items: center;
}

.tranche-item .el-input {
  flex: 1;
}

.tranche-item .el-input-number {
  flex: 1;
}

.summary {
  margin-top: 1rem;
  padding: 1rem;
  background-color: #f5f7fa;
  border-radius: 4px;
}

.error-text {
  color: var(--el-color-error);
  font-weight: bold;
}
</style>
