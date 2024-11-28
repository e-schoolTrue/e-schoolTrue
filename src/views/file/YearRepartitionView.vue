<template>
  <div class="year-repartition-container">
    <div class="container-content">
      <el-button type="primary" @click="openCreateModal" class="create-btn">
        Créer une Répartition Annuelle
      </el-button>

      <el-table :data="yearRepartitions" class="repartition-table">
        <el-table-column prop="schoolYear" label="Année Scolaire" />
        <el-table-column label="Périodes">
          <template #default="scope">
            {{ scope.row.periodConfigurations?.length || 0 }} périodes
          </template>
        </el-table-column>
        <el-table-column label="Actions">
          <template #default="scope">
            <el-button size="small" @click="editRepartition(scope.row)">
              Modifier
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog v-model="showModal" :title="modalTitle" class="modal-dialog">
        <YearRepartitionForm
          :initial-data="currentRepartition || undefined"
          @submit="handleSubmit"
        />
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { ElMessage } from "element-plus";
import YearRepartitionForm from "@/components/schoolYear/YearRepartionForm.vue";

interface YearRepartition {
  id?: string | number;
  schoolYear: string;
  periodConfigurations: Array<{
    name: string;
    start: string | null;
    end: string | null;
  }>;
}

const yearRepartitions = ref<YearRepartition[]>([]);
const showModal = ref(false);
const currentRepartition = ref<YearRepartition | null>(null);

const modalTitle = computed(() =>
  currentRepartition.value
    ? "Modifier la Répartition Annuelle"
    : "Créer une Répartition Annuelle"
);

const openCreateModal = () => {
  currentRepartition.value = null;
  showModal.value = true;
};

const editRepartition = (repartition: YearRepartition) => {
  currentRepartition.value = { 
    ...repartition,
    periodConfigurations: repartition.periodConfigurations || []
  }
  showModal.value = true
}

const handleSubmit = async (data: YearRepartition) => {
  try {
    if (data.id) {
      await window.ipcRenderer.invoke("yearRepartition:update", {
        id: data.id,
        data,
      });
    } else {
      await window.ipcRenderer.invoke("yearRepartition:create", data);
    }

    await fetchYearRepartitions();
    showModal.value = false;
    ElMessage.success("Opération réussie");
  } catch (error) {
    ElMessage.error("Échec de l'opération");
    console.error(error);
  }
};

const fetchYearRepartitions = async () => {
  try {
    yearRepartitions.value = await window.ipcRenderer.invoke(
      "yearRepartition:getAll"
    );
  } catch (error) {
    ElMessage.error("Impossible de récupérer les répartitions");
    console.error(error);
  }
};

onMounted(fetchYearRepartitions);
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
