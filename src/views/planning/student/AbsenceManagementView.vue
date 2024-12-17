<template>
  <div class="absence-management">
    <el-container>
      <!-- Sidebar avec les filtres -->
      <el-aside width="300px" class="filters-sidebar">
        <el-card class="filter-card">
          <template #header>
            <div class="filter-header">
              <h3>Filtres</h3>
              <el-button type="primary" text @click="resetFilters">
                Réinitialiser
              </el-button>
            </div>
          </template>

          <el-form :model="filters" label-position="top">
            <el-form-item label="Période">
              <el-date-picker
                v-model="filters.dateRange"
                type="daterange"
                range-separator="-"
                start-placeholder="Début"
                end-placeholder="Fin"
                :shortcuts="dateShortcuts"
              />
            </el-form-item>

            <el-form-item label="Niveau">
              <el-select
                v-model="filters.gradeId"
                placeholder="Sélectionner un niveau"
                clearable
              >
                <el-option
                  v-for="grade in grades"
                  :key="grade.id"
                  :label="grade.name"
                  :value="grade.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="Type d'absence">
              <el-select
                v-model="filters.absenceType"
                placeholder="Type d'absence"
                clearable
              >
                <el-option
                  v-for="type in absenceTypes"
                  :key="type.value"
                  :label="type.label"
                  :value="type.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="Recherche élève">
              <el-input
                v-model="filters.studentSearch"
                placeholder="Nom, prénom ou matricule"
                clearable
              />
            </el-form-item>
          </el-form>
        </el-card>

        <!-- Statistiques -->
        <el-card class="statistics-card">
          <template #header>
            <h3>Statistiques</h3>
          </template>
          <div class="statistics">
            <div class="stat-item">
              <span class="stat-label">Total</span>
              <span class="stat-value">{{ statistics.total }}</span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Justifiées</span>
              <span class="stat-value success">
                {{ statistics.justified }} ({{ statistics.justifiedPercentage }}%)
              </span>
            </div>
            <div class="stat-item">
              <span class="stat-label">Non justifiées</span>
              <span class="stat-value danger">
                {{ statistics.unjustified }} ({{ statistics.unjustifiedPercentage }}%)
              </span>
            </div>
          </div>
        </el-card>
      </el-aside>

      <!-- Contenu principal -->
      <el-main class="main-content">
        <el-card class="absence-list-card">
          <template #header>
            <div class="list-header">
              <div class="header-title">
                <h2>Liste des absences</h2>
              </div>
              <div class="header-actions">
                <el-button-group>
                  <el-button
                    type="primary"
                    @click="showAddDialog = true"
                    :icon="Plus"
                  >
                    Nouvelle absence
                  </el-button>
                  <el-button
                    type="success"
                    @click="exportToExcel"
                    :icon="Download"
                  >
                    Exporter
                  </el-button>
                </el-button-group>
              </div>
            </div>
          </template>

          <el-table
            :data="paginatedAbsences"
            style="width: 100%"
            :height="tableHeight"
            v-loading="loading"
            :row-class-name="getRowClassName"
          >
            <el-table-column
              prop="student.matricule"
              label="Matricule"
              width="120"
              sortable
            />
            
            <el-table-column 
              label="Élève" 
              width="200" 
              sortable
            >
              <template #default="{ row }">
                {{ row.student.firstname }} {{ row.student.lastname }}
              </template>
            </el-table-column>

            <el-table-column 
              prop="grade.name" 
              label="Classe" 
              width="120" 
              sortable 
            />

            <el-table-column label="Date" width="180" sortable>
              <template #default="{ row }">
                <div>{{ formatDate(row.date) }}</div>
                <small v-if="row.startTime">
                  {{ row.startTime }} - {{ row.endTime }}
                </small>
              </template>
            </el-table-column>

            <el-table-column label="Type" width="150">
              <template #default="{ row }">
                <el-tag :type="getAbsenceTypeTag(row.absenceType)">
                  {{ absenceTypes.find(t => t.value === row.absenceType)?.label }}
                </el-tag>
              </template>
            </el-table-column>

            <el-table-column label="Motif" width="150">
              <template #default="{ row }">
                <el-tooltip
                  :content="row.reason"
                  placement="top"
                  :show-after="500"
                >
                  <el-tag :type="getReasonTypeTag(row.reasonType)">
                    {{ reasonTypes.find(r => r.value === row.reasonType)?.label }}
                  </el-tag>
                </el-tooltip>
              </template>
            </el-table-column>

            <!-- Autres colonnes du tableau -->
          </el-table>

          <div class="table-footer">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next"
              :total="filteredAbsences.length"
              background
            />
          </div>
        </el-card>
      </el-main>
    </el-container>

    <!-- Dialogs -->
    <absence-form
      v-model:visible="showAddDialog"
      @absence-added="handleAbsenceAdded"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Plus, Download } from '@element-plus/icons-vue';
import * as XLSX from 'xlsx';

interface Grade {
  id: number;
  name: string;
}

interface Course {
  id: number;
  name: string;
  professor: {
    id: number;
    firstname: string;
    lastname: string;
  };
}

interface Student {
  id: number;
  firstname: string;
  lastname: string;
  matricule: string;
  grade: Grade;
  absences?: Absence[];
}

interface Absence {
  id: number;
  date: Date;
  startTime?: string;
  endTime?: string;
  reason: string;
  reasonType: 'MEDICAL' | 'FAMILY' | 'UNAUTHORIZED' | 'SCHOOL_ACTIVITY' | 'OTHER';
  absenceType: 'FULL_DAY' | 'MORNING' | 'AFTERNOON' | 'COURSE';
  justified: boolean;
  student: Student;
  grade: Grade;
  course?: Course;
  justificationDocument?: string;
  comments?: string;
  parentNotified: boolean;
  notificationDate?: Date;
}

interface Filters {
  dateRange: [Date, Date] | null;
  gradeId: number | null;
  absenceType: string | null;
  justified: boolean | null;
  studentSearch: string;
  courseId: number | null;
  reasonType: string | null;
}

// États
const loading = ref(false);
const showAddDialog = ref(false);
const currentPage = ref(1);
const pageSize = ref(20);
const grades = ref<Grade[]>([]);
const absences = ref<Absence[]>([]);
const filters = ref<Filters>({
  dateRange: null,
  gradeId: null,
  absenceType: null,
  justified: null,
  studentSearch: '',
  courseId: null,
  reasonType: null
});

// Options pour les sélecteurs
const absenceTypes = [
  { value: 'FULL_DAY', label: 'Journée complète' },
  { value: 'MORNING', label: 'Matin' },
  { value: 'AFTERNOON', label: 'Après-midi' },
  { value: 'COURSE', label: 'Par cours' }
];

const reasonTypes = [
  { value: 'MEDICAL', label: 'Médical' },
  { value: 'FAMILY', label: 'Familial' },
  { value: 'UNAUTHORIZED', label: 'Non autorisé' },
  { value: 'SCHOOL_ACTIVITY', label: 'Activité scolaire' },
  { value: 'OTHER', label: 'Autre' }
];

const dateShortcuts = [
  {
    text: "Aujourd'hui",
    value: () => {
      const today = new Date();
      return [today, today];
    }
  },
  {
    text: 'Cette semaine',
    value: () => {
      const end = new Date();
      const start = new Date();
      start.setDate(start.getDate() - start.getDay());
      return [start, end];
    }
  },
  {
    text: 'Ce mois',
    value: () => {
      const end = new Date();
      const start = new Date(end.getFullYear(), end.getMonth(), 1);
      return [start, end];
    }
  }
];

// Computed properties
const filteredAbsences = computed(() => {
  return absences.value.filter(absence => {
    if (filters.value.dateRange) {
      const [start, end] = filters.value.dateRange;
      const absenceDate = new Date(absence.date);
      if (absenceDate < start || absenceDate > end) return false;
    }

    if (filters.value.gradeId && absence.grade.id !== filters.value.gradeId) {
      return false;
    }

    if (filters.value.absenceType && absence.absenceType !== filters.value.absenceType) {
      return false;
    }

    if (filters.value.justified !== null && absence.justified !== filters.value.justified) {
      return false;
    }

    if (filters.value.courseId && absence.course?.id !== filters.value.courseId) {
      return false;
    }

    if (filters.value.reasonType && absence.reasonType !== filters.value.reasonType) {
      return false;
    }

    if (filters.value.studentSearch) {
      const searchTerm = filters.value.studentSearch.toLowerCase();
      const studentName = `${absence.student.firstname} ${absence.student.lastname} ${absence.student.matricule}`.toLowerCase();
      if (!studentName.includes(searchTerm)) return false;
    }

    return true;
  });
});

const paginatedAbsences = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredAbsences.value.slice(start, end);
});

const statistics = computed(() => {
  const total = filteredAbsences.value.length;
  const justified = filteredAbsences.value.filter(a => a.justified).length;
  const unjustified = total - justified;

  return {
    total,
    justified,
    unjustified,
    justifiedPercentage: total ? ((justified / total) * 100).toFixed(1) : '0.0',
    unjustifiedPercentage: total ? ((unjustified / total) * 100).toFixed(1) : '0.0'
  };
});

// Méthodes de chargement des données
const loadGrades = async () => {
  try {
    const result = await window.ipcRenderer.invoke('grade:all');
    if (result?.success) {
      grades.value = result.data;
    } else {
      throw new Error(result?.error || 'Erreur lors du chargement des niveaux');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des niveaux:', error);
    ElMessage.error("Erreur lors du chargement des niveaux");
  }
};


const loadAbsences = async () => {
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('absence:all');
    console.log('Résultat du chargement des absences:', result);
    
    if (result?.success) {
      absences.value = result.data.map((absence: any) => ({
        ...absence,
        date: new Date(absence.date),
        notificationDate: absence.notificationDate ? new Date(absence.notificationDate) : undefined,
        student: {
          ...absence.student,
          grade: absence.grade
        }
      }));
      console.log('Absences chargées:', absences.value);
    } else {
      throw new Error(result?.error || 'Erreur lors du chargement des absences');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des absences:', error);
    ElMessage.error("Erreur lors du chargement des absences");
  } finally {
    loading.value = false;
  }
};

// Gestion des absences
const handleAbsenceAdded = async (newAbsence: Partial<Absence>) => {
  try {
    const result = await window.ipcRenderer.invoke('absence:add', newAbsence);
    if (result?.success) {
      ElMessage.success("Absence ajoutée avec succès");
      await loadAbsences();
      showAddDialog.value = false;
    } else {
      throw new Error(result?.error || "Erreur lors de l'ajout");
    }
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'absence:', error);
    ElMessage.error(error instanceof Error ? error.message : "Erreur lors de l'ajout de l'absence");
  }
};



// Gestion des notifications

// Export des données
const exportToExcel = () => {
  try {
    const exportData = filteredAbsences.value.map(absence => ({
      'Date': new Date(absence.date).toLocaleDateString(),
      'Élève': `${absence.student.firstname} ${absence.student.lastname}`,
      'Matricule': absence.student.matricule,
      'Classe': absence.grade.name,
      'Type': absenceTypes.find(t => t.value === absence.absenceType)?.label,
      'Motif': reasonTypes.find(r => r.value === absence.reasonType)?.label,
      'Justifiée': absence.justified ? 'Oui' : 'Non',
      'Cours': absence.course?.name || 'N/A',
      'Commentaires': absence.comments || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Absences');
    
    // Générer le nom du fichier avec la date
    const date = new Date().toISOString().split('T')[0];
    XLSX.writeFile(wb, `absences_${date}.xlsx`);
    
    ElMessage.success("Export réussi");
  } catch (error) {
    ElMessage.error("Erreur lors de l'export");
  }
};

// Réinitialisation des filtres
const resetFilters = () => {
  filters.value = {
    dateRange: null,
    gradeId: null,
    absenceType: null,
    justified: null,
    studentSearch: '',
    courseId: null,
    reasonType: null
  };
  currentPage.value = 1;
};

// Initialisation
onMounted(async () => {
  try {
    await Promise.all([
      loadGrades(),
      loadAbsences()
    ]);
  } catch (error) {
    console.error('Erreur lors de l\'initialisation:', error);
    ElMessage.error("Erreur lors de l'initialisation des données");
  }
});

// Calcul dynamique de la hauteur du tableau
const tableHeight = computed(() => {
  return 'calc(100vh - 280px)';
});

// Méthodes utilitaires
const formatDate = (date: Date) => {
  return new Date(date).toLocaleDateString('fr-FR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
};

const getAbsenceTypeTag = (type: string) => {
  const types: Record<string, string> = {
    'FULL_DAY': 'danger',
    'MORNING': 'warning',
    'AFTERNOON': 'warning',
    'COURSE': 'info'
  };
  return types[type] || 'default';
};

const getReasonTypeTag = (type: string) => {
  const types: Record<string, string> = {
    'MEDICAL': 'success',
    'FAMILY': 'info',
    'UNAUTHORIZED': 'danger',
    'SCHOOL_ACTIVITY': 'warning',
    'OTHER': 'default'
  };
  return types[type] || 'default';
};

const getRowClassName = ({ row }: { row: Absence }) => {
  if (!row.justified) return 'warning-row';
  return 'success-row';
};
</script>

<style scoped>
.absence-management {
  height: 100vh;
  background-color: var(--el-bg-color-page);
}

.el-container {
  height: 100%;
  padding: 20px;
}

.filters-sidebar {
  padding-right: 20px;
}

.filter-card, .statistics-card {
  margin-bottom: 20px;
  border-radius: 8px;
  box-shadow: var(--el-box-shadow-light);
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filter-header h3 {
  margin: 0;
  font-size: 16px;
  color: var(--el-text-color-primary);
}

.statistics {
  padding: 10px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.stat-label {
  color: var(--el-text-color-secondary);
  font-size: 14px;
}

.stat-value {
  font-weight: 600;
  font-size: 18px;
}

.stat-value.success {
  color: var(--el-color-success);
}

.stat-value.danger {
  color: var(--el-color-danger);
}

.main-content {
  padding: 0;
}

.absence-list-card {
  height: 100%;
  border-radius: 8px;
  box-shadow: var(--el-box-shadow-light);
}

.list-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title h2 {
  margin: 0;
  font-size: 18px;
}

.table-footer {
  padding: 16px;
  display: flex;
  justify-content: flex-end;
}

:deep(.el-table) {
  --el-table-border-color: var(--el-border-color-lighter);
  --el-table-header-bg-color: var(--el-fill-color-light);
}

:deep(.el-table .warning-row) {
  --el-table-tr-bg-color: var(--el-color-warning-light);
}

:deep(.el-table .success-row) {
  --el-table-tr-bg-color: var(--el-color-success-light);
}

.action-column {
  .el-button {
    padding: 6px;
  }
}

.document-link {
  color: var(--el-color-primary);
  text-decoration: none;
  
  &:hover {
    text-decoration: underline;
  }
}

.notification-badge {
  position: relative;
  
  .el-badge__content {
    transform: scale(0.8);
  }
}
</style>