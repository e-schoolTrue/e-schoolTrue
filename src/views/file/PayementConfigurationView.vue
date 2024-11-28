<template>
  <el-card class="payment-configuration-card shadow-lg">
    <template #header>
      <div class="header-with-actions">
        <div class="header-title">
          <Icon 
            icon="mdi:currency-usd" 
            width="24" 
            height="24" 
            color="#32CD32" 
            class="mr-3"
          />
          <h2>Configuration des Paiements par Classe</h2>
        </div>
        <el-button
          type="primary"
          @click="saveAllConfigurations"
          :loading="isSavingAll"
          class="save-all-btn"
        >
          <Icon 
            icon="mdi:content-save-all" 
            width="18" 
            height="18" 
            class="mr-2"
          />
          Tout Sauvegarder
        </el-button>
      </div>
    </template>

    <el-table 
      :data="configurations" 
      border 
      v-loading="isLoading"
      class="custom-table"
      row-class-name="table-row"
    >
      <el-table-column label="Classe" prop="className" width="150">
        <template #default="{ row }">
          <div class="class-name-cell">
            <Icon 
              icon="mdi:school" 
              width="20" 
              height="20" 
              color="#32CD32" 
              class="mr-2"
            />
            {{ row.className }}
          </div>
        </template>
      </el-table-column>

      <el-table-column label="Montant Annuel" width="220">
        <template #default="{ row }">
          <el-input-number
            v-model="row.annualAmount"
            :min="0"
            :step="5000"
            @change="handleAmountChange(row)"
            class="full-width"
            controls-position="right"
          >
            <template #prefix>
              <Icon 
                icon="mdi:cash" 
                width="20" 
                height="20" 
                color="#32CD32" 
              />
            </template>
          </el-input-number>
        </template>
      </el-table-column>

      <el-table-column label="Versements" width="180">
        <template #default="{ row }">
          <el-input-number
            v-model="row.installments"
            :min="1"
            :max="12"
            @change="handleInstallmentsChange(row)"
            class="full-width"
            controls-position="right"
          >
            <template #prefix>
              <Icon 
                icon="mdi:calendar-multiple" 
                width="20" 
                height="20" 
                color="#32CD32" 
              />
            </template>
          </el-input-number>
        </template>
      </el-table-column>

      <el-table-column label="Montant par Versement" width="200">
        <template #default="{ row }">
          <div class="installment-amount">
            <Icon 
              icon="mdi:coin" 
              width="20" 
              height="20" 
              color="#32CD32" 
              class="mr-2"
            />
            {{ calculateInstallmentAmount(row.annualAmount, row.installments) }} 
            FCFA
          </div>
        </template>
      </el-table-column>

      <el-table-column label="Actions" width="150">
        <template #default="{ row }">
          <el-button
            type="primary"
            size="small"
            @click="saveConfiguration(row)"
            :loading="row.isSaving"
            class="save-config-btn"
          >
            <Icon 
              icon="mdi:content-save" 
              width="16" 
              height="16" 
              class="mr-2"
            />
            Sauvegarder
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
</template>
<script setup lang="ts">
import { ref, onMounted } from "vue";
import { Icon } from '@iconify/vue';
import { ElMessage } from "element-plus";
import { GradeEntity } from "#electron/backend/entities/grade.ts";

interface PaymentConfig {
  classId: string; // Assurez-vous que c'est toujours une string
  className: string;
  annualAmount: number;
  installments: number;
  isSaving?: boolean;
}

const configurations = ref<PaymentConfig[]>([]);
const grades = ref<GradeEntity[]>([]);
const isLoading = ref(false);
const isSavingAll = ref(false);

const calculateInstallmentAmount = (
  annual: number,
  installments: number
): number => {
  return Math.round(annual / installments);
};

const handleAmountChange = (config: PaymentConfig): void => {
  if (config.annualAmount < 0) {
    config.annualAmount = 0;
  }
};

const handleInstallmentsChange = (config: PaymentConfig): void => {
  if (config.installments < 1) {
    config.installments = 1;
  } else if (config.installments > 12) {
    config.installments = 12;
  }
};

const initializeConfigurationsFromGrades = (
  grades: GradeEntity[],
  existingConfigs: PaymentConfig[]
): PaymentConfig[] => {
  return grades.map((grade) => {
    const existingConfig = existingConfigs.find(
      (config) => config.classId === String(grade.id)
    );
    return {
      classId: String(grade.id),
      className: grade.name ?? `Classe ${grade.id}`,
      annualAmount: existingConfig?.annualAmount ?? 0, // Utilise le montant de la config existante
      installments: existingConfig?.installments ?? 1,
      isSaving: false,
    };
  });
};

const saveConfiguration = async (config: PaymentConfig): Promise<void> => {
  try {
    config.isSaving = true;
    const configToSave = {
      classId: config.classId,
      className: config.className,
      annualAmount: config.annualAmount,
      installments: config.installments,
    };

    const result = await window.ipcRenderer.invoke(
      "payment:saveConfig",
      configToSave
    );
    if (result.success) {
      ElMessage.success(`Configuration sauvegardée pour ${config.className}`);
    } else {
      ElMessage.error(
        result.message || "Erreur lors de la sauvegarde de la configuration"
      );
    }
  } catch (error) {
    console.error("Erreur:", error);
    ElMessage.error("Une erreur est survenue lors de la sauvegarde");
  } finally {
    config.isSaving = false;
  }
};

const loadConfigurations = async (): Promise<PaymentConfig[]> => {
  try {
    const result = await window.ipcRenderer.invoke("payment:getConfigs");
    console.log("les données reçues sont :", result);
    if (result.success && result.data) {
      return result.data as PaymentConfig[];
      console.log("les données reçues sont :", result);
    }
    return [];
  } catch (error) {
    console.error("Erreur lors du chargement des configurations:", error);
    ElMessage.error("Erreur lors du chargement des configurations");
    return [];
  }
};

const loadGrades = async (): Promise<{ id: string }[]> => {
  try {
    const result = await window.ipcRenderer.invoke("grade:all");
    if (result.success && Array.isArray(result.data)) {
      // Assurez-vous que tous les IDs sont des strings
      const processedGrades = result.data.map((grade: { id: any }) => ({
        ...grade,
        id: String(grade.id), // Conversion explicite en string
      }));
      grades.value = processedGrades;
      return processedGrades;
    }
    ElMessage.error(result.message || "Erreur lors du chargement des niveaux");
    return [];
  } catch (error) {
    console.error("Erreur lors du chargement des niveaux:", error);
    ElMessage.error("Erreur lors du chargement des niveaux");
    return [];
  }
};

const saveAllConfigurations = async (): Promise<void> => {
  try {
    isSavingAll.value = true;
    let hasError = false;

    for (const config of configurations.value) {
      if (!config.className) continue;

      const configToSave = {
        classId: config.classId,
        className: config.className,
        annualAmount: config.annualAmount,
        installments: config.installments,
      };

      const result = await window.ipcRenderer.invoke(
        "payment:saveConfig",
        configToSave
      );
      if (!result.success) {
        hasError = true;
        console.error(
          `Erreur pour la classe ${config.className}:`,
          result.message
        );
      }
    }

    if (hasError) {
      ElMessage.warning(
        "Certaines configurations n'ont pas pu être sauvegardées"
      );
    } else {
      ElMessage.success(
        "Toutes les configurations ont été sauvegardées avec succès"
      );
    }
  } catch (error) {
    console.error("Erreur lors de la sauvegarde globale:", error);
    ElMessage.error("Une erreur est survenue lors de la sauvegarde globale");
  } finally {
    isSavingAll.value = false;
  }
};

const initializeData = async (): Promise<void> => {
  isLoading.value = true;
  try {
    const [gradesData, existingConfigs] = await Promise.all([
      loadGrades(),
      loadConfigurations(),
    ]);
    if (gradesData.length > 0) {
      configurations.value = initializeConfigurationsFromGrades(
        gradesData as unknown as GradeEntity[],
        existingConfigs
      );
      configurations.value = [...configurations.value]; // Force la réactivité en créant une nouvelle référence
    }
  } catch (error) {
    console.error("Erreur lors de l'initialisation:", error);
    ElMessage.error("Erreur lors de l'initialisation des données");
  } finally {
    isLoading.value = false;
  }
};

onMounted(() => {
  initializeData();
});
</script>
<style scoped>
.payment-configuration-card {
  margin: 20px;
  border-radius: 12px;
  overflow: hidden;
}

.shadow-lg {
  box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1), 
              0 4px 6px -2px rgba(0, 0, 0, 0.05);
}

.header-with-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
}

.header-title {
  display: flex;
  align-items: center;
}

.header-title h2 {
  margin: 0;
  font-size: 1.25rem;
  color: #32CD32;
  font-weight: 600;
}

.save-all-btn {
  display: flex;
  align-items: center;
}

.save-config-btn {
  display: flex;
  align-items: center;
}

.custom-table {
  width: 100%;
}

.table-row {
  transition: background-color 0.3s ease;
}

.table-row:hover {
  background-color: #f5f5f5;
}

.class-name-cell {
  display: flex;
  align-items: center;
}

.installment-amount {
  display: flex;
  align-items: center;
}

.full-width {
  width: 100%;
}

.mr-2 {
  margin-right: 0.5rem;
}

.mr-3 {
  margin-right: 0.75rem;
}

:deep(.el-input-number__increase),
:deep(.el-input-number__decrease) {
  background-color: #32CD32;
  color: white;
}

:deep(.el-input__wrapper) {
  box-shadow: none;
}

@media (max-width: 768px) {
  .header-with-actions {
    flex-direction: column;
    gap: 10px;
  }

  .save-all-btn {
    width: 100%;
    justify-content: center;
  }
}
</style>