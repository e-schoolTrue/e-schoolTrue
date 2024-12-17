<template>
  <div class="vacation-view">
    <el-card class="vacation-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <Icon icon="fluent-emoji:beach-with-umbrella" class="header-icon" />
            <h2>Gestion des Congés Professeurs</h2>
          </div>
          <el-button type="primary" @click="showAddDialog">
            <Icon icon="mdi:plus" class="mr-2" />
            Nouvelle Demande
          </el-button>
        </div>
      </template>

      <!-- Filtres -->
      <div class="filters">
        <el-select 
          v-model="selectedStatus" 
          placeholder="Statut" 
          clearable
          class="filter-item"
        >
          <el-option
            v-for="status in statuses"
            :key="status.value"
            :label="status.label"
            :value="status.value"
          >
            <Icon :icon="status.icon" class="mr-2" />
            {{ status.label }}
          </el-option>
        </el-select>

        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="→"
          start-placeholder="Date début"
          end-placeholder="Date fin"
          class="filter-item"
        />
      </div>

      <!-- Liste des congés -->
      <el-table :data="filteredVacations" v-loading="loading" border>
        <el-table-column label="Professeur" min-width="200">
          <template #default="{ row }">
            <div class="professor-info" v-if="row.professor">
              <el-avatar :size="32">
                {{ getInitials(row.professor) }}
              </el-avatar>
              <div class="professor-details">
                <span>{{ row.professor.firstname }} {{ row.professor.lastname }}</span>
                <small>{{ getTeachingInfo(row.professor) }}</small>
              </div>
            </div>
            <span v-else>Professeur non trouvé</span>
          </template>
        </el-table-column>

        <el-table-column label="Période" width="200">
          <template #default="{ row }">
            <div class="period-info">
              <Icon icon="mdi:calendar-range" class="mr-2" />
              {{ formatDateRange(row.startDate, row.endDate) }}
            </div>
          </template>
        </el-table-column>

        <el-table-column prop="reason" label="Motif" min-width="200" show-overflow-tooltip />

        <el-table-column label="Statut" width="120" align="center">
          <template #default="{ row }">
            <el-tag :type="getStatusType(row.status)">
              <Icon :icon="getStatusIcon(row.status)" class="mr-1" />
              {{ formatStatus(row.status) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="Actions" width="180" fixed="right" align="center">
          <template #default="{ row }">
            <el-button-group>
              <el-tooltip content="Approuver" placement="top" v-if="row.status === 'pending'">
                <el-button type="success" circle size="small" @click="approveVacation(row)">
                  <Icon icon="mdi:check" />
                </el-button>
              </el-tooltip>

              <el-tooltip content="Rejeter" placement="top" v-if="row.status === 'pending'">
                <el-button type="danger" circle size="small" @click="rejectVacation(row)">
                  <Icon icon="mdi:close" />
                </el-button>
              </el-tooltip>

              <el-tooltip content="Supprimer" placement="top">
                <el-button type="warning" circle size="small" @click="deleteVacation(row)">
                  <Icon icon="mdi:delete" />
                </el-button>
              </el-tooltip>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Dialog d'ajout -->
    <el-dialog
      v-model="dialogVisible"
      title="Nouvelle demande de congé"
      width="500px"
      :before-close="closeDialog"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        label-width="120px"
        @submit.prevent="saveVacation"
      >
        <el-form-item label="Professeur" required>
          <el-select v-model="form.professorId" filterable placeholder="Sélectionner">
            <el-option
              v-for="prof in professors"
              :key="prof.id"
              :label="`${prof.firstname} ${prof.lastname}`"
              :value="prof.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="Période" required>
          <el-date-picker
            v-model="form.dateRange"
            type="daterange"
            range-separator="→"
            start-placeholder="Début"
            end-placeholder="Fin"
            style="width: 100%"
          />
        </el-form-item>

        <el-form-item label="Motif" required>
          <el-input
            v-model="form.reason"
            type="textarea"
            :rows="3"
            placeholder="Motif du congé..."
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="closeDialog">Annuler</el-button>
        <el-button type="primary" @click="saveVacation" :loading="saving">
          Soumettre
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';

interface Professor {
  id: number;
  firstname: string;
  lastname: string;
  teaching?: Array<{
    course?: { name: string };
    class?: { name: string };
  }>;
}

interface Vacation {
  id: number;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'rejected';
  professor: Professor;
}

// États avec des valeurs initiales sûres
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const professors = ref<Professor[]>([]);
const vacations = ref<Vacation[]>([]);
const selectedStatus = ref<string | null>(null);
const dateRange = ref<[Date, Date] | null>(null);
const formRef = ref(); // Ajouter une référence pour le formulaire

// Initialiser le formulaire avec des valeurs par défaut
const form = ref({
  professorId: null as number | null,
  dateRange: null as [Date, Date] | null,
  reason: ''
});

// Nettoyer le formulaire avant de fermer le dialog
const closeDialog = () => {
  form.value = {
    professorId: null,
    dateRange: null,
    reason: ''
  };
  dialogVisible.value = false;
};

// Modifier showAddDialog pour utiliser closeDialog
const showAddDialog = () => {
  closeDialog(); // Réinitialiser le formulaire
  dialogVisible.value = true;
};

// Modifier saveVacation pour gérer proprement les erreurs
const saveVacation = async () => {
  if (!formRef.value) return;

  try {
    await formRef.value.validate();
    if (!form.value.professorId || !form.value.dateRange || !form.value.reason) {
      ElMessage.warning('Veuillez remplir tous les champs');
      return;
    }

    saving.value = true;
    const [startDate, endDate] = form.value.dateRange;
    
    const vacationData = {
      professorId: form.value.professorId,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate.toISOString().split('T')[0],
      reason: form.value.reason,
      status: 'pending'
    };

    console.log("Données à envoyer:", vacationData); // Debug
    const result = await window.ipcRenderer.invoke('vacation:create', vacationData);
    console.log("Résultat de la création:", result); // Debug

    if (result.success) {
      ElMessage.success('Demande de congé créée avec succès');
      closeDialog();
      await loadVacations();
    } else {
      throw new Error(result.message || 'Erreur lors de la création');
    }
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    ElMessage.error('Erreur lors de la création de la demande');
  } finally {
    saving.value = false;
  }
};

// Modifier loadVacations pour mieux gérer les erreurs
const loadVacations = async () => {
  if (loading.value) return;
  
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('vacation:getByProfessor');
    console.log("Résultat de getByProfessor:", result); // Debug

    if (result.success && Array.isArray(result.data)) {
      vacations.value = result.data.filter((v: { professor: any; }) => v && v.professor);
      console.log("Vacations filtrées:", vacations.value); // Debug
    } else {
      throw new Error(result.message || 'Données invalides');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des congés:', error);
    ElMessage.error('Erreur lors du chargement des congés');
    vacations.value = [];
  } finally {
    loading.value = false;
  }
};

// Modifier onMounted pour gérer les erreurs d'initialisation
onMounted(async () => {
  try {
    await Promise.all([
      loadProfessors(),
      loadVacations()
    ]);
  } catch (error) {
    console.error('Erreur lors de l\'initialisation:', error);
    ElMessage.error('Erreur lors du chargement des données');
  }
});

// Cleanup lors de la destruction du composant
onUnmounted(() => {
  vacations.value = [];
  professors.value = [];
});

// Options de statut
const statuses = [
  { value: 'pending', label: 'En attente', icon: 'mdi:clock-outline' },
  { value: 'approved', label: 'Approuvé', icon: 'mdi:check-circle' },
  { value: 'rejected', label: 'Rejeté', icon: 'mdi:close-circle' }
];

// Computed
const filteredVacations = computed(() => {
  let filtered = [...vacations.value];

  if (selectedStatus.value) {
    filtered = filtered.filter(v => v.status === selectedStatus.value);
  }

  if (dateRange.value) {
    const [start, end] = dateRange.value;
    filtered = filtered.filter(v => {
      const vacationStart = new Date(v.startDate);
      const vacationEnd = new Date(v.endDate);
      return vacationStart >= start && vacationEnd <= end;
    });
  }

  return filtered;
});

// Méthodes
const loadProfessors = async () => {
  try {
    const result = await window.ipcRenderer.invoke('professor:all');
    if (result.success) {
      professors.value = result.data;
    }
  } catch (error) {
    ElMessage.error('Erreur lors du chargement des professeurs');
  }
};

const getInitials = (professor: Professor | null): string => {
  if (!professor?.firstname || !professor?.lastname) return 'NA';
  return `${professor.firstname[0]}${professor.lastname[0]}`.toUpperCase();
};

const getTeachingInfo = (professor: Professor | null): string => {
  if (!professor?.teaching?.length) return 'Non assigné';
  return professor.teaching
    .map(t => {
      if (t?.course?.name) return t.course.name;
      if (t?.class?.name) return t.class.name;
      return '';
    })
    .filter(Boolean)
    .join(', ') || 'Non assigné';
};

const formatDateRange = (start: string, end: string): string => {
  return `${new Date(start).toLocaleDateString('fr-FR')} → ${new Date(end).toLocaleDateString('fr-FR')}`;
};

const getStatusType = (status: string): string => {
  const types: Record<string, string> = {
    pending: 'warning',
    approved: 'success',
    rejected: 'danger'
  };
  return types[status] || 'info';
};

const getStatusIcon = (status: string): string => {
  const icons: Record<string, string> = {
    pending: 'mdi:clock-outline',
    approved: 'mdi:check-circle',
    rejected: 'mdi:close-circle'
  };
  return icons[status] || 'mdi:help-circle';
};

const formatStatus = (status: string): string => {
  const labels: Record<string, string> = {
    pending: 'En attente',
    approved: 'Approuvé',
    rejected: 'Rejeté'
  };
  return labels[status] || status;
};

const approveVacation = async (vacation: Vacation) => {
  try {
    const result = await window.ipcRenderer.invoke('vacation:updateStatus', {
      id: vacation.id,
      status: 'approved'
    });
    if (result.success) {
      ElMessage.success('Congé approuvé');
      await loadVacations();
    }
  } catch (error) {
    ElMessage.error('Erreur lors de l\'approbation');
  }
};

const rejectVacation = async (vacation: Vacation) => {
  try {
    const result = await window.ipcRenderer.invoke('vacation:updateStatus', {
      id: vacation.id,
      status: 'rejected'
    });
    if (result.success) {
      ElMessage.success('Congé rejeté');
      await loadVacations();
    }
  } catch (error) {
    ElMessage.error('Erreur lors du rejet');
  }
};

const deleteVacation = async (vacation: Vacation) => {
  try {
    await ElMessageBox.confirm(
      'Êtes-vous sûr de vouloir supprimer cette demande ?',
      'Confirmation',
      { type: 'warning' }
    );

    const result = await window.ipcRenderer.invoke('vacation:delete', vacation.id);
    if (result.success) {
      ElMessage.success('Demande supprimée');
      await loadVacations();
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Erreur lors de la suppression');
    }
  }
};
</script>