<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { PaymentConfig, PaymentConfigCreateInput, CustomPaymentConfig, PaymentSchedule } from '@/types/payment';
import { useCurrency } from '@/composables/useCurrency';
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue';
import { Delete, Plus, Calendar, Money, Setting } from '@element-plus/icons-vue';

// Assuming Grade has at least id and name
interface Grade {
  id: string;
  name: string;
}

const { currency } = useCurrency();
const activeTab = ref('fees');
const paymentConfigs = ref<PaymentConfig[]>([]);
const customPaymentConfigs = ref<CustomPaymentConfig[]>([]);
const grades = ref<Grade[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const showModal = ref(false);
const showCustomConfigModal = ref(false);
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

// Custom payment configuration states
const currentCustomConfig = ref<CustomPaymentConfig>({
  gradeId: 0,
  name: '',
  paymentType: 'monthly',
  totalAnnualAmount: 0,
  isDefault: false,
  monthlyConfig: {
    numberOfMonths: 10,
    startMonth: 9,
    monthlyAmount: 0,
    excludedMonths: [7, 8]
  },
  installmentConfig: {
    numberOfInstallments: 3,
    installments: []
  },
  customSchedule: {
    schedules: []
  }
});

const monthNames = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

// Fonction utilitaire pour nettoyer l'objet avant l'envoi via IPC
const serializeForIPC = (obj: any): any => {
  return JSON.parse(JSON.stringify(obj, (_key, value) => {
    // Convertir les dates en strings ISO
    if (value instanceof Date) {
      return value.toISOString();
    }
    // Filtrer les valeurs undefined
    if (value === undefined) {
      return null;
    }
    return value;
  }));
};

const selectedGradeForCustom = ref<string>('');


// Calculs pour la configuration personnalisée
const calculatedMonthlyAmount = computed(() => {
  if (!currentCustomConfig.value || currentCustomConfig.value.paymentType !== 'monthly') return 0;
  const config = currentCustomConfig.value.monthlyConfig;
  if (!config || config.numberOfMonths === 0) return 0;
  return Math.round(currentCustomConfig.value.totalAnnualAmount / config.numberOfMonths);
});

const totalInstallmentsAmount = computed(() => {
  if (!currentCustomConfig.value || currentCustomConfig.value.paymentType !== 'installments') return 0;
  const config = currentCustomConfig.value.installmentConfig;
  if (!config) return 0;
  return config.installments.reduce((sum, inst) => sum + (inst.amount || 0), 0);
});

const totalCustomScheduleAmount = computed(() => {
  if (!currentCustomConfig.value || currentCustomConfig.value.paymentType !== 'custom') return 0;
  const config = currentCustomConfig.value.customSchedule;
  if (!config) return 0;
  return config.schedules.reduce((sum, schedule) => sum + schedule.amount, 0);
});


const openCustomConfigModal = () => {
  currentCustomConfig.value = {
    gradeId: 0,
    name: '',
    paymentType: 'monthly',
    totalAnnualAmount: 0,
    isDefault: false,
    monthlyConfig: {
      numberOfMonths: 10,
      startMonth: 9,
      monthlyAmount: 0,
      excludedMonths: [7, 8]
    },
    installmentConfig: {
      numberOfInstallments: 3,
      installments: [
        { name: 'Première Tranche', percentage: 40, dueMonth: 9, amount: 0 },
        { name: 'Deuxième Tranche', percentage: 30, dueMonth: 1, amount: 0 },
        { name: 'Troisième Tranche', percentage: 30, dueMonth: 4, amount: 0 }
      ]
    },
    customSchedule: {
      schedules: []
    }
  };
  selectedGradeForCustom.value = '';
  showCustomConfigModal.value = true;
};

const updateMonthlyConfig = () => {
  if (currentCustomConfig.value.paymentType !== 'monthly') return;
  const config = currentCustomConfig.value.monthlyConfig!;
  config.monthlyAmount = calculatedMonthlyAmount.value;
};

const updateInstallmentAmounts = () => {
  if (currentCustomConfig.value.paymentType !== 'installments') return;
  const config = currentCustomConfig.value.installmentConfig!;
  const totalAmount = currentCustomConfig.value.totalAnnualAmount;
  
  config.installments.forEach(inst => {
    inst.amount = Math.round((totalAmount * inst.percentage) / 100);
  });
};

const addInstallment = () => {
  if (currentCustomConfig.value.paymentType !== 'installments') return;
  const config = currentCustomConfig.value.installmentConfig!;
  config.installments.push({
    name: `Tranche ${config.installments.length + 1}`,
    percentage: 0,
    dueMonth: 1,
    amount: 0
  });
  config.numberOfInstallments = config.installments.length;
};

const removeInstallment = (index: number) => {
  if (currentCustomConfig.value.paymentType !== 'installments') return;
  const config = currentCustomConfig.value.installmentConfig!;
  config.installments.splice(index, 1);
  config.numberOfInstallments = config.installments.length;
  updateInstallmentAmounts();
};

const addCustomSchedule = () => {
  if (currentCustomConfig.value.paymentType !== 'custom') return;
  const config = currentCustomConfig.value.customSchedule!;
  const today = new Date();
  const newSchedule: PaymentSchedule = {
    name: `Échéance ${config.schedules.length + 1}`,
    amount: 0,
    dueDate: today,
    order: config.schedules.length + 1,
    description: ''
  };
  config.schedules.push(newSchedule);
};

const removeCustomSchedule = (index: number) => {
  if (currentCustomConfig.value.paymentType !== 'custom') return;
  const config = currentCustomConfig.value.customSchedule!;
  config.schedules.splice(index, 1);
  // Réorganiser les ordres
  config.schedules.forEach((schedule, idx) => {
    schedule.order = idx + 1;
  });
};



const handleCustomGradeChange = (gradeId: string) => {
  const config = paymentConfigs.value.find(p => String(p.classId) === String(gradeId));
  if (config) {
    currentCustomConfig.value.gradeId = Number(gradeId);
    currentCustomConfig.value.totalAnnualAmount = config.annualAmount;
    if (currentCustomConfig.value.paymentType === 'monthly') {
      updateMonthlyConfig();
    } else if (currentCustomConfig.value.paymentType === 'installments') {
      updateInstallmentAmounts();
    }
  }
};

watch(() => currentCustomConfig.value.paymentType, (newType) => {
  if (newType === 'monthly') {
    updateMonthlyConfig();
  } else if (newType === 'installments') {
    updateInstallmentAmounts();
  }
});

watch(() => currentCustomConfig.value.totalAnnualAmount, () => {
  if (currentCustomConfig.value.paymentType === 'monthly') {
    updateMonthlyConfig();
  } else if (currentCustomConfig.value.paymentType === 'installments') {
    updateInstallmentAmounts();
  }
});



const modalTitle = computed(() => 
  `Configuration des frais de scolarité et d'inscription - ${currentPaymentConfig.value.className}`
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

const saveCustomPaymentConfig = async () => {
  try {
    if (!currentCustomConfig.value.gradeId) {
      ElMessage.error('Veuillez sélectionner une classe');
      return;
    }

    if (!currentCustomConfig.value.name) {
      ElMessage.error('Veuillez entrer un nom pour cette configuration');
      return;
    }

    // Validation selon le type
    if (currentCustomConfig.value.paymentType === 'monthly') {
      const config = currentCustomConfig.value.monthlyConfig!;
      if (config.numberOfMonths <= 0) {
        ElMessage.error('Le nombre de mois doit être supérieur à 0');
        return;
      }
    } else if (currentCustomConfig.value.paymentType === 'installments') {
      const totalPercentage = currentCustomConfig.value.installmentConfig!.installments
        .reduce((sum, inst) => sum + inst.percentage, 0);
      if (totalPercentage !== 100) {
        ElMessage.error('La somme des pourcentages doit être égale à 100%');
        return;
      }
    } else if (currentCustomConfig.value.paymentType === 'custom') {
      const totalAmount = totalCustomScheduleAmount.value;
      if (Math.abs(totalAmount - currentCustomConfig.value.totalAnnualAmount) > 1) {
        ElMessage.error('La somme des échéances doit être égale au montant annuel');
        return;
      }
    }

    isSaving.value = true;
    
    // Nettoyer l'objet pour l'envoi via IPC
    const configToSave = serializeForIPC(currentCustomConfig.value);
    
    const result = await window.ipcRenderer.invoke('payment:saveCustomConfig', configToSave);

    if (result.success) {
      ElMessage.success('Configuration personnalisée sauvegardée avec succès');
      showCustomConfigModal.value = false;
      await loadCustomConfigs();
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


const loadCustomConfigs = async () => {
  try {
    const result = await window.ipcRenderer.invoke('payment:getCustomConfigs');
    if (result.success) {
      customPaymentConfigs.value = result.data || [];
    }
  } catch (error) {
    console.error('Erreur lors du chargement des configurations personnalisées:', error);
  }
};

const editCustomConfig = async (config: CustomPaymentConfig) => {
  // Convertir les dates strings en objets Date pour l'édition
  const configWithDates = {
    ...config,
    customSchedule: config.customSchedule ? {
      schedules: config.customSchedule.schedules.map(schedule => ({
        ...schedule,
        dueDate: typeof schedule.dueDate === 'string' ? new Date(schedule.dueDate) : schedule.dueDate
      }))
    } : config.customSchedule
  };
  currentCustomConfig.value = configWithDates;
  selectedGradeForCustom.value = String(config.gradeId);
  showCustomConfigModal.value = true;
};

const deleteCustomConfig = async (config: CustomPaymentConfig) => {
  try {
    await ElMessageBox.confirm(
      `Êtes-vous sûr de vouloir supprimer la configuration "${config.name}" ?`,
      'Confirmation',
      {
        confirmButtonText: 'Oui, supprimer',
        cancelButtonText: 'Annuler',
        type: 'warning',
      }
    );

    const result = await window.ipcRenderer.invoke('payment:deleteCustomConfig', config.id);
    if (result.success) {
      ElMessage.success('Configuration supprimée avec succès');
      await loadCustomConfigs();
    } else {
      throw new Error(result.message || 'Erreur lors de la suppression');
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error('Erreur lors de la suppression:', error);
      ElMessage.error(error instanceof Error ? error.message : 'Une erreur est survenue');
    }
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


onMounted(async () => {
  await loadConfigurations();
  await loadCustomConfigs();
});
</script>

<template>
  <div class="payment-config-container">
    <el-tabs
        type="card"
        v-model="activeTab"
      >
        <el-tab-pane label="Frais de scolarité et d'inscription" name="fees">
          <div class="title">
            <el-button type="primary" @click="openCreateModal" class="create-btn">Configurer les Frais</el-button>
          </div>
          <mensuality-config-table :configs="paymentConfigs" @openUpdateForm="editPaymentConfiguration" />
        </el-tab-pane>
        <el-tab-pane label="Configuration Personnalisée" name="custom-config">
          <div class="title">
            <el-button type="primary" @click="openCustomConfigModal" class="create-btn">
              <el-icon><Setting /></el-icon>
              Nouvelle Configuration d'Échéances
            </el-button>
          </div>
          <div class="config-list">
            <el-table :data="customPaymentConfigs" stripe>
              <el-table-column prop="name" label="Nom de la Configuration" />
              <el-table-column label="Classe">
                <template #default="{ row }">
                  {{ paymentConfigs.find(p => p.classId == row.gradeId)?.className || '-' }}
                </template>
              </el-table-column>
              <el-table-column prop="paymentType" label="Type">
                <template #default="{ row }">
                  <el-tag :type="row.paymentType === 'monthly' ? 'success' : row.paymentType === 'installments' ? 'warning' : 'info'">
                    {{ row.paymentType === 'monthly' ? 'Mensualités' : row.paymentType === 'installments' ? 'Tranches' : 'Personnalisé' }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="Montant Annuel">
                <template #default="{ row }">
                  <currency-display :amount="row.totalAnnualAmount" />
                </template>
              </el-table-column>
              <el-table-column label="Actions" width="200">
                <template #default="{ row }">
                  <el-button type="primary" size="small" @click="editCustomConfig(row)">Modifier</el-button>
                  <el-button type="danger" size="small" @click="deleteCustomConfig(row)">Supprimer</el-button>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </el-tab-pane>
      </el-tabs>

      <!-- Modal de Configuration Personnalisée des Échéances -->
      <el-dialog
        v-model="showCustomConfigModal"
        :title="currentCustomConfig.id ? 'Modifier la Configuration' : 'Nouvelle Configuration d\'Échéances'"
        width="800px"
        destroy-on-close
      >
        <el-form :model="currentCustomConfig" label-position="top">
          <el-row :gutter="20">
            <el-col :span="12">
              <el-form-item label="Nom de la configuration" required>
                <el-input
                  v-model="currentCustomConfig.name"
                  placeholder="Ex: Paiement Mensuel Standard"
                />
              </el-form-item>
            </el-col>
            <el-col :span="12">
              <el-form-item label="Classe" required>
                <el-select
                  v-model="selectedGradeForCustom"
                  placeholder="Sélectionnez une classe"
                  @change="handleCustomGradeChange"
                  class="full-width"
                >
                  <el-option
                    v-for="config in paymentConfigs"
                    :key="config.classId"
                    :label="config.className"
                    :value="config.classId"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-form-item label="Type de paiement">
            <el-radio-group v-model="currentCustomConfig.paymentType">
              <el-radio-button value="monthly">
                <el-icon><Calendar /></el-icon> Mensualités
              </el-radio-button>
              <el-radio-button value="installments">
                <el-icon><Money /></el-icon> Tranches
              </el-radio-button>
              <el-radio-button value="custom">
                <el-icon><Setting /></el-icon> Personnalisé
              </el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="Montant Annuel Total">
            <currency-display :amount="currentCustomConfig.totalAnnualAmount" />
          </el-form-item>

          <!-- Configuration Mensualités -->
          <template v-if="currentCustomConfig.paymentType === 'monthly'">
            <el-divider>Configuration des Mensualités</el-divider>
            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="Nombre de mois">
                  <el-input-number
                    v-model="currentCustomConfig.monthlyConfig!.numberOfMonths"
                    :min="1"
                    :max="12"
                    @change="updateMonthlyConfig"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="Mois de début">
                  <el-select v-model="currentCustomConfig.monthlyConfig!.startMonth" class="full-width">
                    <el-option
                      v-for="(month, index) in monthNames"
                      :key="index"
                      :label="month"
                      :value="index + 1"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="Montant mensuel">
                  <currency-display :amount="calculatedMonthlyAmount" />
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="Mois exclus (vacances, etc.)">
              <el-select
                v-model="currentCustomConfig.monthlyConfig!.excludedMonths"
                multiple
                placeholder="Sélectionnez les mois exclus"
                class="full-width"
              >
                <el-option
                  v-for="(month, index) in monthNames"
                  :key="index"
                  :label="month"
                  :value="index + 1"
                />
              </el-select>
            </el-form-item>
          </template>

          <!-- Configuration Tranches -->
          <template v-if="currentCustomConfig.paymentType === 'installments'">
            <el-divider>Configuration des Tranches</el-divider>
            <div v-for="(installment, index) in currentCustomConfig.installmentConfig!.installments" :key="index" class="installment-item">
              <el-row :gutter="10" align="middle">
                <el-col :span="6">
                  <el-input
                    v-model="installment.name"
                    placeholder="Nom de la tranche"
                  />
                </el-col>
                <el-col :span="5">
                  <el-input-number
                    v-model="installment.percentage"
                    :min="0"
                    :max="100"
                    @change="updateInstallmentAmounts"
                  >
                    <template #suffix>%</template>
                  </el-input-number>
                </el-col>
                <el-col :span="6">
                  <el-select v-model="installment.dueMonth" placeholder="Mois d'échéance" class="full-width">
                    <el-option
                      v-for="(month, idx) in monthNames"
                      :key="idx"
                      :label="month"
                      :value="idx + 1"
                    />
                  </el-select>
                </el-col>
                <el-col :span="5">
                  <currency-display :amount="installment.amount || 0" />
                </el-col>
                <el-col :span="2">
                  <el-button
                    type="danger"
                    size="small"
                    circle
                    @click="removeInstallment(index)"
                    :disabled="currentCustomConfig.installmentConfig!.installments.length <= 1"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </el-col>
              </el-row>
            </div>
            <el-button type="primary" plain @click="addInstallment">
              <el-icon><Plus /></el-icon> Ajouter une tranche
            </el-button>
            <el-alert
              v-if="totalInstallmentsAmount !== currentCustomConfig.totalAnnualAmount"
              type="warning"
              :closable="false"
              show-icon
              style="margin-top: 10px"
            >
              Total des tranches: <currency-display :amount="totalInstallmentsAmount" /> 
              (Différence: <currency-display :amount="currentCustomConfig.totalAnnualAmount - totalInstallmentsAmount" />)
            </el-alert>
          </template>

          <!-- Configuration Personnalisée -->
          <template v-if="currentCustomConfig.paymentType === 'custom'">
            <el-divider>Configuration Personnalisée des Échéances</el-divider>
            <div v-for="(schedule, index) in currentCustomConfig.customSchedule!.schedules" :key="index" class="custom-schedule-item">
              <el-row :gutter="10" align="middle">
                <el-col :span="6">
                  <el-input
                    v-model="schedule.name"
                    placeholder="Nom de l'échéance"
                  />
                </el-col>
                <el-col :span="6">
                  <el-date-picker
                    v-model="schedule.dueDate"
                    type="date"
                    placeholder="Date d'échéance"
                    format="DD/MM/YYYY"
                    class="full-width"
                  />
                </el-col>
                <el-col :span="6">
                  <el-input-number
                    v-model="schedule.amount"
                    :min="0"
                    :step="1000"
                    class="full-width"
                  >
                    <template #suffix>{{ currency }}</template>
                  </el-input-number>
                </el-col>
                <el-col :span="4">
                  <el-input
                    v-model="schedule.description"
                    placeholder="Description"
                  />
                </el-col>
                <el-col :span="2">
                  <el-button
                    type="danger"
                    size="small"
                    circle
                    @click="removeCustomSchedule(index)"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </el-col>
              </el-row>
            </div>
            <el-button type="primary" plain @click="addCustomSchedule">
              <el-icon><Plus /></el-icon> Ajouter une échéance
            </el-button>
            <el-alert
              v-if="totalCustomScheduleAmount !== currentCustomConfig.totalAnnualAmount"
              type="warning"
              :closable="false"
              show-icon
              style="margin-top: 10px"
            >
              Total des échéances: <currency-display :amount="totalCustomScheduleAmount" />
              (Différence: <currency-display :amount="currentCustomConfig.totalAnnualAmount - totalCustomScheduleAmount" />)
            </el-alert>
          </template>

          <el-form-item label="Configuration par défaut" style="margin-top: 20px">
            <el-switch
              v-model="currentCustomConfig.isDefault"
              active-text="Oui"
              inactive-text="Non"
            />
            <div class="form-hint">Si activé, cette configuration sera utilisée par défaut pour les nouveaux étudiants</div>
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="showCustomConfigModal = false">Annuler</el-button>
          <el-button type="primary" @click="saveCustomPaymentConfig" :loading="isSaving">
            {{ currentCustomConfig.id ? 'Modifier' : 'Enregistrer' }}
          </el-button>
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

          <el-divider>Frais d'inscription et de ré-inscription</el-divider>

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

.config-list {
  padding: 1.5rem 0;
}

.full-width {
  width: 100%;
}

:deep(.el-input-number) {
  width: 100%;
}

.installment-item,
.custom-schedule-item {
  padding: 0.75rem;
  background: #f5f7fa;
  border-radius: 8px;
  margin-bottom: 0.75rem;
}

.installment-item:hover,
.custom-schedule-item:hover {
  background: #ebeef5;
}

.error-text {
  color: var(--el-color-error);
  font-weight: bold;
}

.form-hint {
  margin-top: 5px;
  font-size: 12px;
  color: #909399;
  line-height: 1.4;
}
</style>
