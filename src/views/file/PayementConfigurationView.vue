<template>
  <el-card class="configuration-card">
    <template #header>
      <div class="header-with-actions">
        <h2>Configuration des Paiements par Classe</h2>
        <el-button
          type="primary"
          @click="saveAllConfigurations"
          :loading="isSavingAll"
        >
          Tout Sauvegarder
        </el-button>
      </div>
    </template>

    <el-table :data="configurations" border v-loading="isLoading">
      <el-table-column label="Classe" prop="className" width="120">
        <template #default="{ row }">
          {{ row.className }}
        </template>
      </el-table-column>

      <el-table-column label="Montant Annuel" width="200">
        <el-table-column label="Montant Annuel" width="200">
          <template #default="{ row }">
            <el-input-number
              v-model="row.annualAmount"
              :min="0"
              :step="5000"
              @change="handleAmountChange(row)"
            />
          </template>
        </el-table-column>
      </el-table-column>

      <el-table-column label="Nombre de Versements" width="200">
        <template #default="{ row }">
          <el-input-number
            v-model="row.installments"
            :min="1"
            :max="12"
            @change="handleInstallmentsChange(row)"
          />
        </template>
      </el-table-column>

      <el-table-column label="Montant par Versement">
        <template #default="{ row }">
          {{
            calculateInstallmentAmount(row.annualAmount, row.installments)
          }}
          FCFA
        </template>
      </el-table-column>

      <el-table-column label="Actions" width="120">
        <template #default="{ row }">
          <el-button
            type="primary"
            size="small"
            @click="saveConfiguration(row)"
            :loading="row.isSaving"
          >
            Sauvegarder
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-card>
  

</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
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
.configuration-card {
  margin: 20px;
}

.el-input-number {
  width: 100%;
}

.header-with-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-with-actions h2 {
  margin: 0;
}
</style>
