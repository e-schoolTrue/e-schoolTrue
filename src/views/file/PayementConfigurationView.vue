<template>
  <div class="payment-config-container">
    <div class="container-content">
      <el-button type="primary" @click="openCreateModal" class="create-btn">
        Configurer les Frais de Scolarité
      </el-button>

      <el-table 
        :data="configurations" 
        class="config-table" 
        row-key="classId"
        v-loading="isLoading"
      >
        <el-table-column prop="className" label="Classe" />
        <el-table-column label="Frais de Scolarité">
          <template #default="{ row }">
            {{ formatAmount(row.annualAmount) }} FCFA
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
              <template #suffix>FCFA</template>
            </el-input-number>
          </el-form-item>
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
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';

interface PaymentConfig {
  classId: string;
  className: string;
  annualAmount: number;
}

const configurations = ref<PaymentConfig[]>([]);
const isLoading = ref(false);
const isSaving = ref(false);
const showModal = ref(false);
const currentConfig = ref<PaymentConfig>({
  classId: '',
  className: '',
  annualAmount: 0
});

const modalTitle = computed(() => 
  `Configuration des frais - ${currentConfig.value.className}`
);

const formatAmount = (amount: number): string => {
  return new Intl.NumberFormat('fr-FR').format(amount);
};

const openCreateModal = () => {
  showModal.value = true;
};

const editConfiguration = (config: PaymentConfig) => {
  currentConfig.value = { ...config };
  showModal.value = true;
};

const saveConfiguration = async () => {
  try {
    isSaving.value = true;
    const result = await window.ipcRenderer.invoke('payment:saveConfig', {
      classId: currentConfig.value.classId,
      annualAmount: currentConfig.value.annualAmount
    });

    if (result.success) {
      ElMessage.success('Configuration sauvegardée avec succès');
      await loadConfigurations();
      showModal.value = false;
    } else {
      throw new Error(result.message || 'Erreur lors de la sauvegarde');
    }
  } catch (error) {
    ElMessage.error('Erreur lors de la sauvegarde');
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

    console.log("Résultat des grades:", gradesResult);
    console.log("Résultat des configs:", configsResult);

    if (gradesResult.success && gradesResult.data) {
      const grades = gradesResult.data;
      const configs = configsResult.success ? configsResult.data : [];

      configurations.value = grades.map((grade: { id: any; name: any; }) => {
        const config = configs.find((c: { classId: any; }) => String(c.classId) === String(grade.id));
        return {
          classId: String(grade.id),
          className: grade.name,
          annualAmount: config ? Number(config.annualAmount) : 0
        };
      });

      console.log("Configurations finales:", configurations.value);
    }
  } catch (error) {
    console.error("Erreur lors du chargement:", error);
    ElMessage.error('Erreur lors du chargement des configurations');
  } finally {
    isLoading.value = false;
  }
};

// Charger les configurations au montage
loadConfigurations();
</script>

<style scoped>
.payment-config-container {
  max-width: 64rem;
  margin: 0 auto;
  padding: 1.5rem;
}

.container-content {
  display: flex;
  flex-direction: column;
  gap: 1rem;
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