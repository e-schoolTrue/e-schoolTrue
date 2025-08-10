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
        <el-table-column label="Statut" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.isCurrent" type="success">En cours</el-tag>
            <el-button 
              v-else 
              type="primary" 
              link
              @click="setCurrentYear(scope.row)"
            >
              Définir 
            </el-button>
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

      <el-dialog 
        v-model="showModal" 
        :title="modalTitle" 
        class="modal-dialog"
        :destroy-on-close="true"
        :close-on-click-modal="false"
      >
        <YearRepartitionForm
          v-if="showModal"
          :initial-data="currentRepartition"
          @submit="handleSubmit"
          @cancel="showModal = false"
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
import { 
    YearRepartition, 
    PeriodConfiguration, 
    YearRepartitionResponse,
    YearRepartitionCreateInput,
    YearRepartitionUpdateInput
} from '@/types/year';

const yearRepartitions = ref<YearRepartitionResponse[]>([]);
const showModal = ref(false);
const currentRepartition = ref<YearRepartition | null>(null);

const modalTitle = computed(() =>
  currentRepartition.value
    ? "Modifier la Répartition Annuelle"
    : "Créer une Répartition Annuelle"
);

const formatDate = (date: string | Date | null) => {
  if (!date) return '';
  return format(new Date(date), 'dd/MM/yyyy', { locale: fr });
};

const getPeriodType = (periods: PeriodConfiguration[]) => {
  return periods.length === 2 ? 'Semestre' : 'Trimestre';
};

const closeModal = () => {
  showModal.value = false;
  currentRepartition.value = null;
};

const openCreateModal = () => {
  currentRepartition.value = null;
  showModal.value = true;
};

const editRepartition = (repartition: YearRepartitionResponse) => {
  // Convertir les dates string en Date pour le formulaire
  const convertedRepartition: YearRepartition = {
    id: repartition.id,
    schoolYear: repartition.schoolYear,
    periodConfigurations: repartition.periodConfigurations.map(period => ({
      name: period.name,
      start: period.start,
      end: period.end
    })),
    isCurrent: repartition.isCurrent
  };
  
  currentRepartition.value = convertedRepartition;
  showModal.value = true;
};

const deleteRepartition = async (repartition: YearRepartitionResponse) => {
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

const handleSubmit = async (data: YearRepartitionCreateInput | YearRepartitionUpdateInput) => {
  try {
    // Vérifier si c'est une mise à jour (l'ID est présent dans les données)
    const isUpdate = 'id' in data && data.id !== undefined;
    console.log(`Mode: ${isUpdate ? 'Mise à jour' : 'Création'}, ID: ${isUpdate ? data.id : 'N/A'}`);
    
    // Préparer les données en formatant correctement les dates
    const formattedData = {
      ...data,
      periodConfigurations: data.periodConfigurations?.map(period => ({
        name: period.name,
        start: period.start ? new Date(period.start).toISOString() : null,
        end: period.end ? new Date(period.end).toISOString() : null
      })) || []
    };
    
    let result;
    
    if (isUpdate) {
      // S'assurer que l'ID est correctement extrait avant de l'envoyer
      const id = (data as any).id;
      console.log("Mode mise à jour - ID:", id);
      console.log("Données à envoyer:", JSON.stringify({
        id,
        data: formattedData
      }, null, 2));
      
      // Envoi explicite de l'ID et des données séparément
      result = await window.ipcRenderer.invoke("yearRepartition:update", {
        id,
        data: formattedData
      });
      
      console.log("Résultat de la mise à jour:", JSON.stringify(result, null, 2));
    } else {
      console.log("Mode création - Données:", JSON.stringify(formattedData, null, 2));
      result = await window.ipcRenderer.invoke("yearRepartition:create", formattedData);
      console.log("Résultat de la création:", JSON.stringify(result, null, 2));
    }

    if (!result.success) {
      throw new Error(result.message || (isUpdate ? "Échec de la mise à jour" : "Échec de la création"));
    }

    await fetchYearRepartitions();
    closeModal();
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

const setCurrentYear = async (repartition: YearRepartitionResponse) => {
  try {
    await ElMessageBox.confirm(
      `Êtes-vous sûr de vouloir définir ${repartition.schoolYear} comme année scolaire en cours ?`,
      'Confirmation',
      {
        confirmButtonText: 'Oui',
        cancelButtonText: 'Non',
        type: 'warning'
      }
    );

    console.log(`Tentative de définition de l'année courante avec ID: ${repartition.id}`);
    
    try {
      const result = await window.ipcRenderer.invoke(
        "yearRepartition:setCurrent", 
        repartition.id
      );
      
      console.log("Résultat de yearRepartition:setCurrent:", JSON.stringify(result, null, 2));

      if (result.success) {
        ElMessage.success("Année scolaire en cours mise à jour avec succès");
      } else {
        console.error("Erreur de définition de l'année courante:", result.error || result.message);
        ElMessage.error(`Erreur: ${result.error || result.message}`);
      }
      
      // Rafraîchir la liste dans tous les cas pour refléter l'état actuel
      await fetchYearRepartitions();
      
    } catch (apiError) {
      console.error("Exception lors de l'appel à yearRepartition:setCurrent:", apiError);
      ElMessage.error("Une erreur technique est survenue lors de la définition de l'année scolaire en cours");
      // Essayer quand même de rafraîchir la liste
      await fetchYearRepartitions();
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error("Erreur dans le processus setCurrentYear:", error);
      ElMessage.error(
        error instanceof Error ? error.message : "Une erreur est survenue"
      );
    }
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