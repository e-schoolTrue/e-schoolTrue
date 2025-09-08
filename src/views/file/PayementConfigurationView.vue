<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { PaymentConfig, PaymentConfigCreateInput } from '@/types/payment';
// @ts-ignore
import { PaymentAnnualConfigEntity } from '#electron/backend/entities/paymentConfig';
import { useCurrency } from '@/composables/useCurrency';
import { GradeType } from '@/types/grade';

const { currency } = useCurrency();
const activeTab = ref('mensuality');
const paymentConfigs = ref<PaymentConfig[]>([]);
const trancheConfigs = ref<PaymentAnnualConfigEntity[]>([
  {
    id: 1,
    trancheCount: 2,
    grade:{
      id: 1,
      code: "P1",
      name: "Première année",
      type:GradeType.PRIMARY,
      schedules: []
    },
    tranches: [
      {
        id: 1,
        tranchName: "première tranche",
        tranchMonthCount: 1,
        entries: [
          {
            id: 1,
            startDate: new Date(),
            endDate: new Date()
          }
        ]
      },
      {
        id: 2,
        tranchName: "deuxième tranche",
        tranchMonthCount: 1,
        entries: [
          {
            id: 2,
            startDate: new Date(),
            endDate: new Date()
          }
        ]
      }
    ]
  }
]);
const isLoading = ref(false);
const isSaving = ref(false);
const showModal = ref(false);
const showTrancheModal = ref(false);
const currTrancheConfig = ref<PaymentAnnualConfigEntity>()
const currentPaymentConfig = ref<PaymentConfig>({
  classId: '',
  className: '',
  annualAmount: 0,
  allowScholarship: false,
  scholarshipPercentages: [],
  scholarshipCriteria: ''
});

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

const deleteTrancheConfiguration = (config: PaymentAnnualConfigEntity) => {
  console.log(config)
  showModal.value = true;
};

const editTrancheConfiguration = (config: PaymentAnnualConfigEntity) => {
  console.log(config)
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

    // Validation des bourses si l'option est activée
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

    paymentConfigs.value = grades.map((grade: { id: string; name: string; }) => {
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

onMounted(async () => {
  await loadConfigurations();
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
          <!-- <el-table 
            :data="configurations" 
            class="config-table" 
            row-key="classId"
            v-loading="isLoading"
          >
            <el-table-column prop="className" label="Classe" />
            <el-table-column label="Frais d'inscription">
              <template #default="{ row }">
                <currency-display :amount="row.inscriptionFee" />
              </template>
            </el-table-column>

            <el-table-column label="Frais de Scolarité">
              <template #default="{ row }">
                <currency-display :amount="row.annualAmount" />
              </template>
            </el-table-column>

            <el-table-column prop="reduction" label="Reduction sur paiement annuel" >
              <template #default="{ row }">
                {{ row.reduction }} %
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
          </el-table> -->
        <mensuality-config-table :configs="paymentConfigs" @openUpdateForm="editPaymentConfiguration" />
        </el-tab-pane>
        <el-tab-pane label="Tranches" name="tranches">
          <div class="title">
            <el-button type="primary" @click="openCreateModal" class="create-btn">Configuration des tranches</el-button>
          </div>
          <!-- <el-table 
            :data="configurations" 
            class="config-table" 
            row-key="classId"
            v-loading="isLoading"
          >
            <el-table-column prop="className" label="Classe"/>
            <el-table-column label="Frais de Scolarité">
              <template #default="{ row }">
                <currency-display :amount="row.annualAmount" />
              </template>
            </el-table-column>
            <el-table-column label="Actions">
              <template #default="scope">
                <el-space style="cursor: pointer" @click="openDialog">
                  <Icon icon="clarity:eye-line" width="20" height="20" />
                  <el-text>voir les details</el-text>
                  <el-button 
                    size="small" 
                    type="primary"
                    @click="editConfiguration(scope.row)"
                  >
                    Modifier
                  </el-button>
              </el-space>
                
              </template>
            </el-table-column>
          </el-table> -->
          <tranch-config-table :configs="trancheConfigs" @openUpdateForm="editTrancheConfiguration" @openDetails="openTrancheDialog" @delete="deleteTrancheConfiguration" />
        </el-tab-pane>
      </el-tabs>

      <TrancheConfigDetails :config="currTrancheConfig" :dialog="showTrancheModal" @closeDialog="closeTrancheDialog" />


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
</style>