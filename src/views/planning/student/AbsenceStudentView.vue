<template>
  <div class="absence-management">
    <el-container>
      <!-- Sidebar avec les filtres -->
      <el-aside width="320px" class="filters-sidebar">
        <el-card class="filter-card">
          <template #header>
            <div class="filter-header">
              <h3><Icon icon="mdi:filter" class="mr-2" /> Filtres</h3>
              <el-button type="primary" text @click="resetFilters">
                Réinitialiser
              </el-button>
            </div>
          </template>

          <el-form :model="filters" label-position="top" class="filter-form">
            <el-form-item label="Période" class="compact-form-item">
              <el-date-picker
                v-model="filters.dateRange"
                type="daterange"
                range-separator="-"
                start-placeholder="Début"
                end-placeholder="Fin"
                :shortcuts="dateShortcuts"
                class="w-full"
              />
            </el-form-item>

            <el-form-item label="Niveau" class="compact-form-item">
              <el-select
                v-model="filters.gradeId"
                placeholder="Sélectionner un niveau"
                clearable
                class="w-full"
              >
                <el-option
                  v-for="grade in grades"
                  :key="grade.id"
                  :label="grade.name"
                  :value="grade.id"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="Type d'absence" class="compact-form-item">
              <el-select
                v-model="filters.absenceType"
                placeholder="Type d'absence"
                clearable
                class="w-full"
              >
                <el-option
                  v-for="type in absenceTypes"
                  :key="type.value"
                  :label="type.label"
                  :value="type.value"
                />
              </el-select>
            </el-form-item>

            <el-form-item label="Recherche élève" class="compact-form-item">
              <el-input
                v-model="filters.studentSearch"
                placeholder="Nom, prénom ou matricule"
                clearable
                class="w-full"
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
                    class="action-button"
                  >
                    <Icon icon="mdi:plus" class="mr-2" />
                    Nouvelle absence
                  </el-button>
                  <el-button
                    type="success"
                    @click="exportToExcel"
                    class="action-button"
                  >
                    <Icon icon="mdi:download" class="mr-2" />
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
            border
            stripe
            highlight-current-row
          >
            <el-table-column
              label="Élève"
              min-width="200"
              sortable
            >
              <template #default="{ row }">
                <div class="student-info">
                  <div class="student-details">
                    <span class="student-name">{{ row.student?.firstname }} {{ row.student?.lastname }}</span>
                    <small class="student-matricule">{{ row.student?.matricule }}</small>
                  </div>
                </div>
              </template>
            </el-table-column>

            <el-table-column
              label="Classe"
              width="120"
              sortable
            >
              <template #default="{ row }">
                {{ row.grade?.name }}
              </template>
            </el-table-column>

            <el-table-column label="Date" width="180" sortable>
              <template #default="{ row }">
                <div class="date-info">
                  <div class="date-primary">{{ formatDate(row.date) }}</div>
                  <small class="date-time" v-if="row.startTime">
                    {{ row.startTime }} - {{ row.endTime }}
                  </small>
                </div>
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

            <el-table-column label="Justification" width="180">
              <template #default="{ row }">
                <div class="justification-status">
                  <el-tag :type="row.justified ? 'success' : 'danger'">
                    {{ row.justified ? 'Justifiée' : 'Non justifiée' }}
                  </el-tag>
                  <div v-if="row.document" class="document-actions">
                    <el-button
                      type="primary"
                      link
                      size="small"
                      @click="viewDocument(row.document)"
                    >
                      <Icon icon="mdi:eye" class="mr-1" />
                      Voir
                    </el-button>
                    <el-button
                      type="success"
                      link
                      size="small"
                      @click="downloadDocument(row.document)"
                    >
                      <Icon icon="mdi:download" class="mr-1" />
                      Télécharger
                    </el-button>
                  </div>
                </div>
              </template>
            </el-table-column>
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

    <el-dialog
      v-model="dialogVisible"
      :title="currentDocument?.name"
      width="80%"
      :fullscreen="true"
      destroy-on-close
      class="document-dialog"
    >
      <div class="document-viewer">
        <template v-if="currentDocument?.isPdf">
          <object
            :data="currentDocument.content"
            type="application/pdf"
            width="100%"
            height="100%"
          >
            <p>Ce navigateur ne supporte pas l'affichage des PDF.</p>
          </object>
        </template>
        <template v-else-if="currentDocument?.isImage">
          <div class="image-container">
            <img
              :src="currentDocument.content"
              alt="Document justificatif"
            />
          </div>
        </template>
        <template v-else>
          <div class="unsupported-format">
            <Icon icon="mdi:file-document-outline" :width="48" />
            <p>Ce type de document ne peut pas être prévisualisé</p>
            <div class="document-info">
              <p v-if="currentDocument?.type">Type de document: {{ currentDocument.type }}</p>
              <p v-if="currentDocument?.name">Nom du fichier: {{ currentDocument.name }}</p>
            </div>
            <el-button 
              type="primary" 
              @click="currentDocument?.id ? downloadDocument({
                id: currentDocument.id,
                name: currentDocument.name || '',
                type: currentDocument.type || ''
              }) : undefined"
              :disabled="!currentDocument?.id"
            >
              Télécharger le document
            </el-button>
            <el-button 
              type="warning" 
              @click="forceViewAsPdf"
              class="mt-2"
            >
              Essayer d'afficher comme PDF
            </el-button>
          </div>
        </template>
      </div>
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="dialogVisible = false">Fermer</el-button>
          <el-button 
            type="primary" 
            @click="currentDocument?.id ? downloadDocument({
              id: currentDocument.id,
              name: currentDocument.name || '',
              type: currentDocument.type || ''
            }) : undefined"
            :disabled="!currentDocument?.id"
          >
            Télécharger
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import * as XLSX from 'xlsx';

interface Grade {
  id: number;
  name: string;
}

interface Absence {
  id: number;
  date: Date;
  reason: string;
  reasonType: string;
  absenceType: string;
  justified: boolean;
  document?: number | null;
  comments?: string;
  startTime?: string;
  endTime?: string;
  parentNotified: boolean;
  student?: {
    id: number;
    firstname: string;
    lastname: string;
    matricule: string;
  };
  grade?: {
    id: number;
    name: string;
  };
  course?: {
    id: number;
    name: string;
  };
  type: 'STUDENT' | 'PROFESSOR';
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

    if (filters.value.gradeId && absence.grade?.id !== filters.value.gradeId) {
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
      const studentName = `${absence.student?.firstname} ${absence.student?.lastname} ${absence.student?.matricule}`.toLowerCase();
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
  console.log('=== Vue - Début loadAbsences ===');
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('absence:allStudent');
    console.log('Résultat brut du chargement des absences:', result);
    
    if (result?.success) {
      absences.value = result.data.map((absence: any) => {
        console.log('Traitement absence:', absence);
        return {
          ...absence,
          date: new Date(absence.date),
          student: absence.student || null,
          grade: absence.grade || null,
          course: absence.course || null,
          justified: Boolean(absence.justified),
          document: absence.document || null,
          startTime: absence.startTime || null,
          endTime: absence.endTime || null,
          parentNotified: Boolean(absence.parentNotified)
        };
      });
      console.log('Absences traitées:', absences.value);
    }
  } catch (error) {
    console.error('Erreur détaillée lors du chargement des absences:', error);
    ElMessage.error("Erreur lors du chargement des absences");
  } finally {
    loading.value = false;
  }
};

// Gestion des absences
const handleAbsenceAdded = async (newAbsence: Partial<Absence>) => {
  console.log('=== Vue - Début handleAbsenceAdded ===');
  console.log('Nouvelle absence à ajouter:', newAbsence);
  
  try {
    const result = await window.ipcRenderer.invoke('absence:add', newAbsence);
    console.log('Résultat de l\'ajout:', result);
    
    if (result?.success) {
      ElMessage.success("Absence ajoutée avec succès");
      showAddDialog.value = false;
      // Recharger immédiatement les absences
      await loadAbsences();
    } else {
      throw new Error(result?.error || "Erreur lors de l'ajout");
    }
  } catch (error) {
    console.error('Erreur détaillée lors de l\'ajout:', error);
    ElMessage.error(error instanceof Error ? error.message : "Erreur lors de l'ajout de l'absence");
  }
};

// Ajouter un watcher pour recharger les absences quand le dialogue se ferme
watch(() => showAddDialog.value, (newValue) => {
  if (!newValue) { // Si le dialogue vient de se fermer
    loadAbsences(); // Recharger les absences
  }
});

// Gestion des notifications

// Export des données
const exportToExcel = () => {
  try {
    const exportData = filteredAbsences.value.map(absence => ({
      'Date': new Date(absence.date).toLocaleDateString(),
      'Élève': absence.student ? `${absence.student.firstname} ${absence.student.lastname}` : 'N/A',
      'Matricule': absence.student?.matricule || 'N/A',
      'Classe': absence.grade?.name || 'N/A',
      'Type': absenceTypes.find(t => t.value === absence.absenceType)?.label || 'N/A',
      'Motif': reasonTypes.find(r => r.value === absence.reasonType)?.label || 'N/A',
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

// Ajouter la fonction de téléchargement
const downloadDocument = async (documentData: any) => {
  try {
    const result = await window.ipcRenderer.invoke('student:downloadDocument', documentData.id);
    console.log('Résultat du téléchargement:', result);
    
    if (!result?.success || !result.data?.content) {
      throw new Error('Données du document manquantes ou invalides');
    }

    // Convertir le base64 en blob
    const byteString = atob(result.data.content);
    const byteArray = new Uint8Array(byteString.length);
    for (let i = 0; i < byteString.length; i++) {
      byteArray[i] = byteString.charCodeAt(i);
    }
    
    // Créer et télécharger le blob
    const blob = new Blob([byteArray], { type: result.data.type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = result.data.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error('Erreur lors du téléchargement:', error);
    ElMessage.error('Erreur lors du téléchargement du document: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
  }
};

const dialogVisible = ref(false);
const currentDocument = ref<{
  id?: number;
  content?: string;
  type?: string;
  name?: string;
  isPdf?: boolean;
  isImage?: boolean;
} | null>(null);

const viewDocument = async (documentData: any) => {
  try {
    const result = await window.ipcRenderer.invoke('student:downloadDocument', documentData.id);
    if (result?.success && result.data?.content) {
      // Afficher le type de document pour le débogage
      console.log('Type de document:', result.data.type);
      console.log('Extension du fichier:', result.data.name?.split('.').pop()?.toLowerCase());
      
      // Déterminer si c'est un PDF basé sur le type MIME, l'extension ou le contenu du fichier
      const fileExt = result.data.name?.split('.').pop()?.toLowerCase();
      
      // Vérifier si le contenu commence par %PDF (signature des fichiers PDF)
      const contentSample = result.data.content.substring(0, 10);
      const contentIsPdf = contentSample.includes('%PDF');
      
      const isPdf = 
        result.data.type?.includes('pdf') || 
        result.data.type?.includes('application/pdf') || 
        fileExt === 'pdf' ||
        // Cas spécifique détecté - JUSTIFICATION avec extension pdf
        (result.data.type === 'JUSTIFICATION' && fileExt === 'pdf') ||
        contentIsPdf;
      
      // Déterminer si c'est une image
      const isImage = 
        result.data.type?.includes('image') || 
        ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(fileExt || '');
      
      // Déterminer le type MIME correct
      let mimeType = result.data.type;
      if (isPdf) {
        mimeType = 'application/pdf';
      } else if (isImage) {
        mimeType = `image/${fileExt || 'jpeg'}`;
      }
      
      const content = `data:${mimeType};base64,${result.data.content}`;

      currentDocument.value = {
        id: documentData.id,
        content: content,
        type: mimeType,
        name: result.data.name,
        isPdf,
        isImage
      };

      dialogVisible.value = true;
    } else {
      ElMessage.error("Erreur lors du chargement du document");
    }
  } catch (error) {
    console.error("Erreur lors du chargement du document:", error);
    ElMessage.error("Une erreur s'est produite lors du chargement du document");
  }
};

const forceViewAsPdf = () => {
  if (!currentDocument.value) return;
  
  console.log('Forçage de l\'affichage en PDF');
  
  // Modifier le type pour forcer l'affichage en PDF
  currentDocument.value = {
    ...currentDocument.value,
    type: 'application/pdf',
    isPdf: true,
    isImage: false
  };
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
  margin-bottom: 15px;
  border-radius: 8px;
  box-shadow: var(--el-box-shadow-light);
}

.filter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 15px;
  height: 40px;
}

:deep(.filter-card .el-card__header),
:deep(.statistics-card .el-card__header) {
  padding: 0;
}

:deep(.filter-card .el-card__body) {
  padding: 12px 5px;
}

:deep(.statistics-card .el-card__body) {
  padding: 5px 0;
}

.filter-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.filter-form {
  padding: 0 10px;
}

.filter-form .el-form-item {
  margin-bottom: 15px;
}

.filter-form .el-form-item:last-child {
  margin-bottom: 5px;
}

.compact-form-item {
  margin-bottom: 10px !important;
}

:deep(.compact-form-item .el-form-item__label) {
  padding-bottom: 2px;
  line-height: 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

:deep(.compact-form-item .el-form-item__content) {
  line-height: 1;
}

:deep(.el-date-editor.el-input__wrapper),
:deep(.el-select .el-input__wrapper),
:deep(.el-input .el-input__wrapper) {
  padding: 0 10px;
  height: 32px;
}

:deep(.el-input__inner) {
  font-size: 13px;
}

:deep(.el-date-editor--daterange) {
  width: 100%;
}

:deep(.el-input__wrapper) {
  padding: 0 10px;
}

:deep(.el-form-item__label) {
  padding-bottom: 3px;
  line-height: 18px;
  font-size: 13px;
}

.statistics {
  padding: 5px 15px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.stat-item:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.stat-label {
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.stat-value {
  font-weight: 600;
  font-size: 16px;
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
  padding: 0 10px;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-title h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 500;
}

.action-button {
  font-weight: 500;
}

.table-footer {
  padding: 20px;
  display: flex;
  justify-content: flex-end;
}

:deep(.el-table) {
  --el-table-border-color: var(--el-border-color-lighter);
  --el-table-header-bg-color: var(--el-fill-color-light);
  --el-table-row-hover-bg-color: var(--el-fill-color-light);
}

:deep(.el-table .el-table__header th) {
  font-weight: 600;
  color: var(--el-text-color-primary);
  background-color: #f5f7fa;
  height: 50px;
}

:deep(.el-table .el-table__row) {
  height: 56px;
}

:deep(.el-table .warning-row) {
  --el-table-tr-bg-color: var(--el-color-warning-light);
}

:deep(.el-table .success-row) {
  --el-table-tr-bg-color: var(--el-color-success-light);
}

.student-info {
  display: flex;
  flex-direction: column;
}

.student-name {
  font-weight: 500;
  color: var(--el-text-color-primary);
}

.student-matricule {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 4px;
}

.date-info {
  display: flex;
  flex-direction: column;
}

.date-primary {
  font-weight: 500;
}

.date-time {
  color: var(--el-text-color-secondary);
  font-size: 12px;
  margin-top: 4px;
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

.justification-status {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: flex-start;
}

.document-actions {
  display: flex;
  gap: 10px;
  margin-top: 5px;
}

.el-button.el-button--primary.is-link, 
.el-button.el-button--success.is-link {
  height: auto;
  padding: 4px 0;
  font-size: 12px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.document-viewer {
  width: 100%;
  height: 80vh;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f7fa;
  border-radius: 4px;
  overflow: auto;
  padding: 20px;
}

.unsupported-format {
  text-align: center;
  padding: 2rem;
}

.unsupported-format .el-icon {
  margin-bottom: 1rem;
  color: #909399;
}

.document-info {
  margin: 15px auto;
  padding: 10px;
  background-color: #f0f2f5;
  border-radius: 4px;
  max-width: 400px;
  text-align: left;
  font-size: 12px;
  color: #606266;
}

:deep(.el-dialog__body) {
  padding: 0;
  margin: 10px;
}

:deep(.el-dialog__header) {
  margin-right: 0;
  padding: 16px;
  border-bottom: 1px solid var(--el-border-color-lighter);
}

.w-full {
  width: 100%;
}

/* Styles pour les icônes */
.mr-1 {
  margin-right: 4px;
}

.mr-2 {
  margin-right: 8px;
}

.icon-container {
  display: inline-flex;
  align-items: center;
}

.image-container {
  width: 100%;
  height: 100%;
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f7fa;
  border-radius: 4px;
  overflow: hidden;
}

.image-container img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  padding: 10px;
}

:deep(.el-date-picker__shortcuts) {
  padding: 0 8px;
  margin: 0 auto;
}

:deep(.el-date-picker__shortcut) {
  width: auto;
  font-size: 12px;
  padding: 0 8px;
  display: inline-flex;
  align-items: center;
  height: 28px;
}

.mt-2 {
  margin-top: 12px;
}
</style>