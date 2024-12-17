<template>
  <div class="year-repartition-container">
    <div class="container-content">
      <el-button type="primary" @click="openCreateModal" class="create-btn">
        Créer une Répartition Annuelle
      </el-button>

      <el-table :data="yearRepartitions" class="repartition-table" row-key="id">
        <el-table-column prop="schoolYear" label="Année Scolaire" />
        <el-table-column label="Type">
          <template #default="scope">
            {{ getPeriodType(scope.row.periodConfigurations) }}
          </template>
        </el-table-column>
        <el-table-column label="Périodes">
          <template #default="scope">
            <div v-for="period in scope.row.periodConfigurations" :key="period.name">
              {{ period.name }}: {{ formatDate(period.start) }} - {{ formatDate(period.end) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="150">
          <template #default="scope">
            <el-button size="small" @click="editRepartition(scope.row)">
              Modifier
            </el-button>
            <el-button size="small" type="danger" @click="deleteRepartition(scope.row)">
              Supprimer
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog v-model="showModal" :title="modalTitle" class="modal-dialog" destroy-on-close>
        <YearRepartitionForm
          v-if="showModal"
          :initial-data="currentRepartition"
          @submit="handleSubmit"
        />
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import YearRepartitionForm from "@/components/schoolYear/YearRepartionForm.vue";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

interface Period {
  name: string;
  start: string | null;
  end: string | null;
}

interface YearRepartition {
  id?: string | number;
  schoolYear: string;
  periodConfigurations: Period[];
}

const yearRepartitions = ref<YearRepartition[]>([]);
const showModal = ref(false);
const currentRepartition = ref<YearRepartition | null>(null);

const modalTitle = computed(() =>
  currentRepartition.value
    ? "Modifier la Répartition Annuelle"
    : "Créer une Répartition Annuelle"
);

const formatDate = (date: string | null) => {
  if (!date) return '';
  return format(new Date(date), 'dd/MM/yyyy', { locale: fr });
};

const getPeriodType = (periods: Period[]) => {
  return periods.length === 2 ? 'Semestre' : 'Trimestre';
};

const openCreateModal = () => {
  currentRepartition.value = null;
  showModal.value = true;
};

const editRepartition = (repartition: YearRepartition) => {
  currentRepartition.value = JSON.parse(JSON.stringify(repartition));
  showModal.value = true;
};

const deleteRepartition = async (repartition: YearRepartition) => {
  try {
    await ElMessageBox.confirm(
      'Êtes-vous sûr de vouloir supprimer cette répartition ?',
      'Confirmation',
      {
        confirmButtonText: 'Oui',
        cancelButtonText: 'Non',
        type: 'warning'
      }
    );

    if (repartition.id) {
      const result = await window.ipcRenderer.invoke("yearRepartition:delete", repartition.id);
      if (result.success) {
        ElMessage.success("Répartition supprimée avec succès");
        await fetchYearRepartitions();
      } else {
        throw new Error(result.message || "Échec de la suppression");
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : "Une erreur est survenue");
    }
  }
};

const handleSubmit = async (data: YearRepartition) => {
  try {
    const payload = JSON.parse(JSON.stringify(data));
    if (payload.id) {
      const result = await window.ipcRenderer.invoke("yearRepartition:update", {
        id: payload.id,
        data: payload,
      });
      if (!result.success) {
        throw new Error(result.message || "Échec de la mise à jour");
      }
    } else {
      const result = await window.ipcRenderer.invoke("yearRepartition:create", payload);
      if (!result.success) {
        throw new Error(result.message || "Échec de la création");
      }
    }

    await fetchYearRepartitions();
    showModal.value = false;
    ElMessage.success("Opération réussie");
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Échec de l'opération");
    console.error(error);
  }
};

const fetchYearRepartitions = async () => {
  try {
    const result = await window.ipcRenderer.invoke("yearRepartition:getAll");
    if (result.success) {
      yearRepartitions.value = result.data;
    } else {
      throw new Error(result.message || "Échec de la récupération des répartitions");
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Impossible de récupérer les répartitions");
    console.error(error);
  }
};

fetchYearRepartitions();
</script>

<style scoped>
.year-repartition-container {
  max-width: 64rem;
  margin: 0 auto;
  padding: 1.5rem;
}

.container-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.create-btn {
  width: 100%;
  max-width: 28rem;
}

.repartition-table {
  width: 100%;
}

.modal-dialog {
  text-align: center;
}
</style>
