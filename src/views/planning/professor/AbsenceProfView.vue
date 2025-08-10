<template>
  <div class="absence-view">
    <el-card class="absence-card">
      <template #header>
        <div class="card-header">
          <h2>Gestion des Absences Professeurs</h2>
          <el-button type="primary" @click="showAddDialog">
            <Icon icon="mdi:plus" class="mr-2" />
            Nouvelle Absence
          </el-button>
        </div>
      </template>

      <!-- Filtres -->
      <div class="filters">
        <el-input
          v-model="searchQuery"
          placeholder="Rechercher un professeur..."
          clearable
          @input="handleSearch"
        >
          <template #prefix>
            <Icon icon="mdi:magnify" />
          </template>
        </el-input>

        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="→"
          start-placeholder="Date début"
          end-placeholder="Date fin"
          @change="handleSearch"
        />
      </div>

      <!-- Liste des absences -->
      <el-table :data="filteredAbsences" v-loading="loading">
        <el-table-column label="Professeur" min-width="200">
          <template #default="{ row }">
            <div class="professor-info">
              <el-avatar :size="32">
                {{ getInitials(row.professor) }}
              </el-avatar>
              <div class="professor-details">
                <span>{{ row.professor.firstname }} {{ row.professor.lastname }}</span>
                <small>{{ getTeachingInfo(row.professor) }}</small>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Période">
          <template #default="{ row }">
            {{ formatDate(row.date) }}
            <template v-if="row.absenceType === 'COURSE'">
              {{ row.startTime }} - {{ row.endTime }}
            </template>
          </template>
        </el-table-column>

        <el-table-column prop="reason" label="Motif" min-width="200" show-overflow-tooltip />

        <el-table-column label="Justificatif" width="120" align="center">
          <template #default="{ row }">
            <el-button
              v-if="row.document"
              type="primary"
              size="small"
              @click="viewDocument(row.document)"
            >
              Voir
            </el-button>
            <el-tag v-else type="info" size="small">
              Aucun
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="Actions" width="180" align="center" fixed="right">
          <template #default="{ row }">
            <el-tooltip content="Modifier" placement="top">
              <el-button type="primary" circle size="small" @click="editAbsence(row)">
                <Icon icon="mdi:pencil" />
              </el-button>
            </el-tooltip>
            
            <el-tooltip content="Supprimer" placement="top">
              <el-button type="danger" circle size="small" @click="deleteAbsence(row)">
                <Icon icon="mdi:delete" />
              </el-button>
            </el-tooltip>

            <el-tooltip content="Voir le justificatif" placement="top" v-if="row.document">
              <el-button type="info" circle size="small" @click="viewDocument(row.document)">
                <Icon icon="mdi:file-document" />
              </el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Dialog d'ajout/modification -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? 'Modifier l\'absence' : 'Nouvelle absence'"
      width="600px"
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="140px"
        status-icon
      >
        <el-form-item label="Professeur" prop="professorId">
          <el-select
            v-model="form.professorId"
            filterable
            placeholder="Sélectionner un professeur"
            :disabled="isEditing"
          >
            <el-option
              v-for="prof in professors"
              :key="prof.id"
              :label="`${prof.firstname} ${prof.lastname}`"
              :value="prof.id"
            >
              <Icon icon="mdi:account-tie" class="mr-2" />
              {{ prof.firstname }} {{ prof.lastname }}
            </el-option>
          </el-select>
        </el-form-item>

        <el-form-item label="Type d'absence" prop="absenceType">
          <el-radio-group v-model="form.absenceType">
            <el-radio label="FULL_DAY">
              <Icon icon="mdi:calendar-blank" class="mr-1" />
              Journée complète
            </el-radio>
            <el-radio label="COURSE">
              <Icon icon="mdi:clock-outline" class="mr-1" />
              Heures de cours
            </el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="Date" prop="date">
          <el-date-picker
            v-model="form.date"
            type="date"
            placeholder="Sélectionner une date"
          />
        </el-form-item>

        <template v-if="form.absenceType === 'COURSE'">
          <el-form-item label="Horaires" required>
            <div class="flex gap-4">
              <el-time-picker
                v-model="form.startTime"
                placeholder="Début"
                format="HH:mm"
              />
              <el-time-picker
                v-model="form.endTime"
                placeholder="Fin"
                format="HH:mm"
              />
            </div>
          </el-form-item>
        </template>

        <el-form-item label="Justifiée">
          <el-switch v-model="form.justified" />
        </el-form-item>

        <template v-if="form.justified">
          <el-form-item label="Type de justification" prop="reasonType">
            <el-select v-model="form.reasonType">
              <el-option label="Médical" value="MEDICAL">
                <Icon icon="mdi:medical-bag" class="mr-2" />
                Médical
              </el-option>
              <el-option label="Familial" value="FAMILY">
                <Icon icon="mdi:account-group" class="mr-2" />
                Familial
              </el-option>
              <el-option label="Activité scolaire" value="SCHOOL_ACTIVITY">
                <Icon icon="mdi:school" class="mr-2" />
                Activité scolaire
              </el-option>
              <el-option label="Autre" value="OTHER">
                <Icon icon="mdi:dots-horizontal" class="mr-2" />
                Autre
              </el-option>
            </el-select>
          </el-form-item>

          <el-form-item label="Justificatif">
            <el-upload
              class="upload-demo"
              action="#"
              :auto-upload="false"
              :on-change="handleFileChange"
              :limit="1"
            >
              <template #trigger>
                <el-button type="primary">
                  <Icon icon="mdi:upload" class="mr-1" />
                  Sélectionner
                </el-button>
              </template>
              <template #tip>
                <div class="el-upload__tip">
                  PDF, JPG ou PNG (max. 5MB)
                </div>
              </template>
            </el-upload>
          </el-form-item>
        </template>

        <el-form-item label="Motif" required>
          <el-input
            v-model="form.reason"
            type="textarea"
            :rows="3"
            placeholder="Motif de l'absence..."
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">
          <Icon icon="mdi:close" class="mr-1" />
          Annuler
        </el-button>
        <el-button type="primary" @click="saveAbsence" :loading="saving">
          <Icon icon="mdi:content-save" class="mr-1" />
          {{ isEditing ? 'Modifier' : 'Enregistrer' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Dialog de visualisation du document -->
    <el-dialog
      v-if="currentDocument"
      v-model="documentDialogVisible"
      :title="currentDocument.name"
      width="80%"
      destroy-on-close
    >
      <div class="document-viewer">
        <template v-if="currentDocument.type === 'application/pdf'">
          <object
            :data="currentDocument.content"
            type="application/pdf"
            width="100%"
            height="600"
            frameborder="0"
          >
            <p>Ce navigateur ne supporte pas l'affichage des PDF.</p>
          </object>
        </template>
        
        <template v-else-if="currentDocument.type.startsWith('image/')">
          <img
            :src="currentDocument.content"
            style="max-width: 100%; max-height: 600px; object-fit: contain;"
          />
        </template>
        
        <template v-else>
          <div class="unsupported-format">
            <Icon icon="mdi:file-alert" style="font-size: 48px;" />
            <p>Format de fichier non supporté</p>
          </div>
        </template>
      </div>

      <template #footer>
        <el-button @click="documentDialogVisible = false">
          <Icon icon="mdi:close" class="mr-2" />
          Fermer
        </el-button>
        <el-button type="primary" @click="downloadDocument" v-if="currentDocument">
          <Icon icon="mdi:download" class="mr-2" />
          Télécharger
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import type { UploadFile } from 'element-plus';
import { Icon } from '@iconify/vue';

interface Professor {
  id: number;
  firstname: string;
  lastname: string;
  teaching?: Array<{
    course?: { name: string };
    class?: { name: string };
    grades?: Array<{ id: number; name: string }>;
    gradeNames?: string;
    gradeIds?: string;
    id?: number;
  }>;
}

interface Document {
  id: number;
  name: string;
  type: string;
  url: string;
  path: string;
}

interface Absence {
  id: number;
  date: string;
  absenceType: string;
  startTime?: string;
  endTime?: string;
  reason: string;
  reasonType: string;
  justified: boolean;
  professor: Professor;
  document?: Document;
}

interface DocumentInfo {
  blob: Blob;
  name: string;
  type: string;
}

// Définir un type pour les raisons d'absence
type ReasonType = 'MEDICAL' | 'FAMILY' | 'UNAUTHORIZED' | 'SCHOOL_ACTIVITY' | 'OTHER';

interface AbsenceForm {
  professorId: number | null;
  date: Date | null;
  absenceType: 'FULL_DAY' | 'COURSE';
  startTime: Date | null;
  endTime: Date | null;
  justified: boolean;
  reasonType: ReasonType | null;
  reason: string;
  document: DocumentInfo | null;
}

// Ajouter avec les autres interfaces
interface CurrentDocument {
  id: number;
  content: string;
  type: string;
  name: string;
  path: string;
}

// États
const loading = ref(false);
const saving = ref(false);
const dialogVisible = ref(false);
const documentDialogVisible = ref(false);
const isEditing = ref(false);
const searchQuery = ref('');
const dateRange = ref<[Date, Date] | null>(null);
const professors = ref<Professor[]>([]);
const absences = ref<Absence[]>([]);
const currentDocument = ref<CurrentDocument | null>(null);

const form = ref<AbsenceForm>({
  professorId: null,
  date: null,
  absenceType: 'FULL_DAY',
  startTime: null,
  endTime: null,
  justified: false,
  reasonType: null,
  reason: '',
  document: null
});

// Ajouter les règles de validation
const rules = {
  professorId: [
    { required: true, message: 'Veuillez sélectionner un professeur', trigger: 'change' }
  ],
  date: [
    { required: true, message: 'Veuillez sélectionner une date', trigger: 'change' }
  ],
  absenceType: [
    { required: true, message: 'Veuillez sélectionner un type d\'absence', trigger: 'change' }
  ],
  reasonType: [
    { required: true, message: 'Veuillez sélectionner un type de motif', trigger: 'change' }
  ]
};

// Ajouter la référence au formulaire
const formRef = ref();

// Computed
const filteredAbsences = computed(() => {
  let filtered = [...absences.value];

  // Filtre par recherche
  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(absence => {
      const fullName = `${absence.professor.firstname} ${absence.professor.lastname}`.toLowerCase();
      return fullName.includes(query);
    });
  }

  // Filtre par date
  if (dateRange.value) {
    const [start, end] = dateRange.value;
    filtered = filtered.filter(absence => {
      const absenceDate = new Date(absence.date);
      return absenceDate >= start && absenceDate <= end;
    });
  }

  return filtered;
});

// Méthodes
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR');
};

const getInitials = (professor: Professor): string => {
  return `${professor.firstname[0]}${professor.lastname[0]}`.toUpperCase();
};

const getTeachingInfo = (professor: Professor): string => {
  if (!professor?.teaching || !Array.isArray(professor.teaching) || professor.teaching.length === 0) {
    return 'Aucune affectation';
  }
  
  return professor.teaching.map(t => {
    const courseInfo = t.course?.name ? `${t.course.name}` : '';
    const classInfo = t.class?.name ? `${t.class.name}` : '';
    
    // Pour les données qui viennent des grades
    let gradesInfo = '';
    if (t.grades && Array.isArray(t.grades) && t.grades.length > 0) {
      // Utiliser un Set pour éviter les doublons
      const uniqueGradeNames = [...new Set(t.grades.map(g => g.name))];
      gradesInfo = uniqueGradeNames.join(', ');
    }
    
    // Utiliser aussi les champs gradeNames si disponible
    let gradeNamesInfo = '';
    if (t.gradeNames) {
      // Éviter les doublons dans gradeNames aussi
      const names = t.gradeNames.split(', ');
      const uniqueNames = [...new Set(names)];
      gradeNamesInfo = uniqueNames.join(', ');
    }
    
    // Éviter la duplication entre classInfo et gradesInfo/gradeNamesInfo
    let finalClassInfo = classInfo;
    const gradesOrNames = gradesInfo || gradeNamesInfo;
    
    if (finalClassInfo && gradesOrNames) {
      if (gradesOrNames.includes(finalClassInfo)) {
        finalClassInfo = ''; // Ne pas inclure si déjà dans grades
      }
    }
    
    const parts = [courseInfo, finalClassInfo, gradesOrNames].filter(Boolean);
    return parts.length > 0 ? parts.join(' - ') : 'Affectation sans détails';
  }).filter(Boolean).join(', ') || 'Affectation sans détails';
};

const loadProfessors = async () => {
  try {
    const result = await window.ipcRenderer.invoke('professor:all');
    console.log('=== Client - Résultat reçu ===', result);
    if (result.success) {
      professors.value = result.data;
    }
  } catch (error) {
    ElMessage.error('Erreur lors du chargement des professeurs');
  }
};

const loadAbsences = async () => {
  loading.value = true;
  try {
    console.log('=== Client - Début chargement absences professeurs ===');
    const result = await window.ipcRenderer.invoke('absence:allProfessor');
    console.log('=== Client - Résultat reçu ===', result);
    
    if (result?.success) {
      absences.value = result.data;
      console.log('=== Client - Nombre d\'absences chargées ===', absences.value.length);
    } else {
      console.error('=== Client - Erreur dans la réponse ===', result?.error);
    }
  } catch (error) {
    console.error("=== Client - Erreur lors du chargement des absences ===", error);
    ElMessage.error("Erreur lors du chargement des absences des professeurs");
  } finally {
    loading.value = false;
  }
};

const handleSearch = () => {
  // La recherche est gérée par le computed filteredAbsences
};

const handleFileChange = (uploadFile: UploadFile) => {
  const file = uploadFile.raw;
  if (!file) return;
  
  if (file.size / 1024 / 1024 > 5) {
    ElMessage.error('Le fichier ne doit pas dépasser 5MB');
    return;
  }

  form.value.document = {
    blob: new Blob([file], { type: file.type }),
    name: file.name,
    type: file.type
  };
};

const showAddDialog = () => {
  isEditing.value = false;
  form.value = {
    professorId: null,
    date: null,
    absenceType: 'FULL_DAY',
    startTime: null,
    endTime: null,
    justified: false,
    reasonType: null,
    reason: '',
    document: null
  };
  dialogVisible.value = true;
};

const editAbsence = (absence: Absence) => {
  isEditing.value = true;
  selectedAbsence.value = absence;
  form.value = {
    professorId: absence.professor.id,
    date: new Date(absence.date),
    absenceType: absence.absenceType as 'FULL_DAY' | 'COURSE',
    startTime: absence.startTime ? new Date(`1970-01-01T${absence.startTime}`) : null,
    endTime: absence.endTime ? new Date(`1970-01-01T${absence.endTime}`) : null,
    justified: absence.justified,
    reasonType: absence.reasonType as ReasonType,
    reason: absence.reason,
    document: null
  };
  dialogVisible.value = true;
};

const saveAbsence = async () => {
  if (!formRef.value || !form.value.date) return;
  
  try {
    await formRef.value.validate();
    saving.value = true;

    const formData = {
      id: isEditing.value ? selectedAbsence.value?.id : undefined,
      professorId: form.value.professorId,
      date: form.value.date.toISOString().split('T')[0],
      absenceType: form.value.absenceType,
      startTime: form.value.startTime ? form.value.startTime.toTimeString().slice(0, 5) : null,
      endTime: form.value.endTime ? form.value.endTime.toTimeString().slice(0, 5) : null,
      reason: form.value.reason || 'Non justifié',
      reasonType: form.value.justified ? form.value.reasonType : 'UNAUTHORIZED',
      justified: form.value.justified
    };

    // Gestion du document
    if (form.value.document?.blob) {
      const reader = new FileReader();
      const documentData = await new Promise<string>((resolve) => {
        reader.onload = () => resolve(reader.result as string);
        reader.readAsDataURL(form.value.document!.blob);
      });

      Object.assign(formData, { 
        document: {
          content: documentData,
          name: form.value.document.name,
          type: form.value.document.type
        }
      });
    }

    const result = await window.ipcRenderer.invoke(
      isEditing.value ? 'absence:updateProfessor' : 'absence:createProfessor',
      formData
    );

    if (result.success) {
      ElMessage.success(isEditing.value ? 'Absence modifiée' : 'Absence enregistrée');
      dialogVisible.value = false;
      await loadAbsences();
    } else {
      throw new Error(result.message || 'Erreur lors de la sauvegarde');
    }
  } catch (error) {
    console.error('Erreur de validation:', error);
    return;
  } finally {
    saving.value = false;
  }
};

const deleteAbsence = async (absence: Absence) => {
  try {
    await ElMessageBox.confirm(
      'Êtes-vous sûr de vouloir supprimer cette absence ?',
      'Confirmation',
      {
        type: 'warning'
      }
    );

    const result = await window.ipcRenderer.invoke('absence:deleteProfessor', absence.id);
    if (result.success) {
      ElMessage.success('Absence supprimée');
      loadAbsences();
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('Erreur lors de la suppression');
    }
  }
};

const viewDocument = async (document: any) => {
  try {
    console.log("Document à visualiser:", document);
    // Utiliser l'ID du document plutôt que le chemin
    const result = await window.ipcRenderer.invoke('file:getUrl', document.id);
    if (result.success) {
      console.log("Résultat du chargement:", result.data);
      const isPdf = result.data.type === 'application/pdf' || result.data.type.includes('pdf');
      
      currentDocument.value = {
        id: document.id,
        content: isPdf 
          ? `data:${result.data.type};base64,${result.data.content}`  // Ajouter le préfixe pour les PDFs
          : `data:${result.data.type};base64,${result.data.content}`,
        type: result.data.type,
        name: document.name || result.data.name,
        path: document.path || result.data.path
      };
      documentDialogVisible.value = true;
    } else {
      console.error("Erreur de chargement:", result.error);
      ElMessage.error("Erreur lors du chargement du document");
    }
  } catch (error) {
    console.error("Erreur lors du chargement du document:", error);
    ElMessage.error("Une erreur s'est produite lors du chargement du document");
  }
};

const downloadDocument = async () => {
  if (!currentDocument.value) return;
  
  try {
    const result = await window.ipcRenderer.invoke('file:download', {
      path: currentDocument.value.path,
      name: currentDocument.value.name
    });

    if (result.success) {
      ElMessage.success('Document téléchargé avec succès');
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    console.error('Erreur lors du téléchargement:', error);
    ElMessage.error('Erreur lors du téléchargement du document');
  }
};

// Initialisation
onMounted(async () => {
  await Promise.all([loadProfessors(), loadAbsences()]);
});

// Ajouter une ref pour stocker l'absence en cours d'édition
const selectedAbsence = ref<Absence | null>(null);
</script>

<style scoped>
.absence-view {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.filters {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.professor-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.professor-details {
  display: flex;
  flex-direction: column;
}

.professor-details small {
  color: var(--el-text-color-secondary);
}

.period-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.document-viewer {
  width: 100%;
  min-height: 400px;
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
  color: #909399;
}

:deep(.el-button.is-circle) {
  padding: 6px;
}

:deep(.el-button.is-circle .iconify) {
  font-size: 16px;
}

.el-button + .el-button {
  margin-left: 8px;
}

:deep(.el-dialog__body) {
  padding: 0;
  margin: 10px;
}

:deep(.el-select) {
  width: 100%;
}

:deep(.el-upload) {
  width: 100%;
}

.mr-1 {
  margin-right: 4px;
}

.mr-2 {
  margin-right: 8px;
}

:deep(.el-dialog__header) {
  margin-right: 0;
  padding: 10px;
}
</style> 