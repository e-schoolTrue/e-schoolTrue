<template>
  <div class="homework-view">
    <el-card class="homework-card">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <Icon icon="mdi:book-edit" class="header-icon" />
            <h2>Gestion des Devoirs</h2>
          </div>
          <el-button type="primary" @click="showAddDialog">
            <Icon icon="mdi:plus" />
            Nouveau Devoir
          </el-button>
        </div>
      </template>

      <!-- Filtres -->
      <div class="filters">
        <el-select 
          v-model="selectedGrade" 
          placeholder="Sélectionner une classe" 
          @change="loadHomework"
          class="filter-item"
        >
          <el-option
            v-for="grade in grades"
            :key="grade.id"
            :label="grade.name"
            :value="grade.id"
          >
            <Icon icon="mdi:school" class="option-icon" />
            {{ grade.name }}
          </el-option>
        </el-select>

        <el-select 
          v-model="selectedCourse" 
          placeholder="Filtrer par matière"
          class="filter-item"
        >
          <el-option
            v-for="course in courses"
            :key="course.id"
            :label="`${course.name} (${(course as any).type ? String((course as any).type).charAt(0).toUpperCase() + String((course as any).type).slice(1).toLowerCase() : 'Matière'}${(course as any).coefficient ? ', ' + (course as any).coefficient : ''})`"
            :value="course.id"
          >
            <Icon icon="mdi:book" class="option-icon" />
            {{ course.name }} ({{ (course as any).type ? String((course as any).type).charAt(0).toUpperCase() + String((course as any).type).slice(1).toLowerCase() : 'Matière' }}{{ (course as any).coefficient ? ', ' + (course as any).coefficient : '' }})
          </el-option>
        </el-select>
      </div>

      <!-- Liste des devoirs -->
      <el-table 
        :data="filteredHomework" 
        v-loading="loading"
        style="width: 100%"
        height="40vh"
      >
        <el-table-column prop="course.name" label="Matière">
          <template #default="{ row }">
            <div class="course-info">
              <Icon icon="mdi:book" class="course-icon" />
              {{ row.course.name }} ({{ (row.course as any).type ? String((row.course as any).type).charAt(0).toUpperCase() + String((row.course as any).type).slice(1).toLowerCase() : 'Matière' }}{{ (row.course as any).coefficient ? ', ' + (row.course as any).coefficient : '' }})
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="description" label="Description" show-overflow-tooltip />
        
        <el-table-column prop="dueDate" label="Date limite" width="150">
          <template #default="{ row }">
            <div class="due-date">
              <Icon icon="mdi:calendar" class="date-icon" />
              {{ formatDate(row.dueDate) }}
            </div>
          </template>
        </el-table-column>

        <el-table-column label="Actions" width="150" fixed="right" align="center">
          <template #default="{ row }">
            <el-tooltip content="Modifier" placement="top">
              <el-button type="primary" circle size="small" @click="editHomework(row)">
                <Icon icon="mdi:pencil" />
              </el-button>
            </el-tooltip>
            
            <el-tooltip content="Supprimer" placement="top">
              <el-button type="danger" circle size="small" @click="deleteHomework(row)">
                <Icon icon="mdi:delete" />
              </el-button>
            </el-tooltip>
            
            <el-tooltip content="Notifier les élèves" placement="top">
              <el-button type="success" circle size="small" @click="showNotifyDialog(row)">
                <Icon icon="mdi:bell" />
              </el-button>
            </el-tooltip>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Dialog d'ajout/modification -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? 'Modifier le devoir' : 'Nouveau devoir'"
    >
      <el-form :model="form" label-width="120px">
        <el-form-item label="Classe" required>
          <el-select v-model="form.gradeId" placeholder="Sélectionner une classe">
            <el-option
              v-for="grade in grades"
              :key="grade.id"
              :label="grade.name"
              :value="grade.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="Matière" required>
          <el-select v-model="form.courseId" placeholder="Sélectionner une matière">
            <el-option
              v-for="course in courses"
              :key="course.id"
              :label="course.name"
              :value="course.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="Professeur" required>
          <el-select
            v-model="form.professorId"
            placeholder="Sélectionner un professeur"
            filterable
            :loading="professorsLoading"
          >
            <el-option
              v-for="prof in professors"
              :key="prof.id"
              :label="`${prof.firstname} ${prof.lastname}`"
              :value="prof.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="Description" required>
          <el-input
            v-model="form.description"
            type="textarea"
            :rows="3"
          />
        </el-form-item>

        <el-form-item label="Date limite" required>
          <el-date-picker
            v-model="form.dueDate"
            type="date"
            placeholder="Sélectionner une date"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">Annuler</el-button>
        <el-button type="primary" @click="saveHomework">
          {{ isEditing ? 'Modifier' : 'Ajouter' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- Dialog de notification -->
    <el-dialog
      v-model="notifyDialogVisible"
      title="Notifier les étudiants"
      width="600px"
    >
      <el-form :model="notifyForm">
        <el-form-item label="Message">
          <el-input
            v-model="notifyForm.message"
            type="textarea"
            :rows="5"
            :placeholder="defaultMessage"
          />
          <div class="message-actions">
            <el-button type="text" @click="useDefaultMessage">
              Utiliser le message par défaut
            </el-button>
          </div>
        </el-form-item>

        <el-form-item label="Étudiants">
          <el-table
            :data="students"
            height="300"
            @selection-change="handleSelectionChange"
          >
            <el-table-column type="selection" width="55" />
            <el-table-column prop="firstname" label="Prénom" />
            <el-table-column prop="lastname" label="Nom" />
            <el-table-column prop="phone" label="Téléphone" />
          </el-table>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="notifyDialogVisible = false">Annuler</el-button>
        <el-button type="primary" @click="notifyStudents" :loading="sending">
          Envoyer
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import { useUserStore } from '@/stores/userStore';

interface Grade {
  id: number;
  name: string;
}

interface Course {
  id: number;
  name: string;
}

interface Homework {
  id: number;
  description: string;
  dueDate: string;
  course: Course;
  grade: Grade;
  professor: {
    id?: number;
    firstname: string;
    lastname: string;
  };
  professorId?: number;
  isCompleted: boolean;
}

interface Professor {
  id: number;
  firstname: string;
  lastname: string;
}

// États
const loading = ref(false);
const dialogVisible = ref(false);
const isEditing = ref(false);
const grades = ref<Grade[]>([]);
const courses = ref<Course[]>([]);
const professors = ref<Professor[]>([]);
const professorsLoading = ref(false);
const homework = ref<Homework[]>([]);
const selectedGrade = ref<number | null>(null);
const selectedCourse = ref<number | null>(null);
const notifyDialogVisible = ref(false);
const notifyForm = ref({
  message: '',
  selectedStudents: [] as any[]
});
const students = ref<any[]>([]);
const sending = ref(false);
const selectedHomework = ref<Homework | null>(null);

const form = ref({
  gradeId: null as number | null,
  courseId: null as number | null,
  professorId: null as number | null,
  description: '',
  dueDate: null as string | null
});

// Méthodes
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR');
};

const loadHomework = async () => {
  if (!selectedGrade.value) return;
  
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('homework:getByGrade', selectedGrade.value);
    
    if (result.success) {
      homework.value = result.data;
    } else {
      throw new Error(result.message || 'Erreur lors du chargement');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des devoirs:', error);
    ElMessage.error('Erreur lors du chargement des devoirs');
  } finally {
    loading.value = false;
  }
};

const loadProfessors = async () => {
  professorsLoading.value = true;
  try {
    const result: any = await window.ipcRenderer.invoke('professor:all');
    const list = Array.isArray(result) ? result : result?.data;
    if (Array.isArray(list)) {
      professors.value = list.filter((p: any) => Number(p?.id) > 0);
      return;
    }
    throw new Error(result?.message || 'Réponse professor:all inattendue');
  } catch (error) {
    // Fallback : professor:search (retourne un tableau brut, pas {success,data}).
    try {
      const res: any = await window.ipcRenderer.invoke('professor:search', '');
      const list = Array.isArray(res) ? res : res?.data;
      professors.value = Array.isArray(list) ? list.filter((p: any) => Number(p?.id) > 0) : [];
    } catch (fallbackError) {
      console.error('Erreur lors du chargement des professeurs:', fallbackError ?? error);
    }
  } finally {
    professorsLoading.value = false;
  }
};

const ensureProfessorsLoaded = async () => {
  if (professors.value.length === 0 && !professorsLoading.value) {
    await loadProfessors();
  }
};

const showAddDialog = async () => {
  isEditing.value = false;
  selectedHomework.value = null;
  await ensureProfessorsLoaded();
  // Suggestion par défaut (best-effort) — l'utilisateur reste libre de changer.
  const suggested = await resolveProfessorId();
  form.value = {
    gradeId: selectedGrade.value,
    courseId: null,
    professorId: suggested,
    description: '',
    dueDate: null
  };
  dialogVisible.value = true;
};

const editHomework = async (row: Homework) => {
  isEditing.value = true;
  // FIX bloquant : mémorise le devoir édité (id indispensable pour homework:update).
  selectedHomework.value = row;
  await ensureProfessorsLoaded();
  const existingProfId = Number((row as any)?.professor?.id ?? (row as any)?.professorId ?? NaN);
  form.value = {
    gradeId: row.grade.id,
    courseId: row.course.id,
    // En édition, pré-remplir avec le professeur existant, sinon suggestion.
    professorId: Number.isFinite(existingProfId) && existingProfId > 0
      ? existingProfId
      : await resolveProfessorId(),
    description: row.description,
    dueDate: row.dueDate
  };
  dialogVisible.value = true;
};

/**
 * Résout le professorId de l'utilisateur connecté (rétro-compatible, jamais de hardcode).
 * - Si le store user porte un professorId / professor_id (évolutions futures), l'utilise.
 * - Si l'utilisateur est admin/comptable et qu'on édite, conserve le professeur existant.
 * - Sinon tente une résolution best-effort via professor:search (displayName/username).
 * - Retourne null si introuvable (l'appelant affiche PROFESSOR_NOT_FOUND au lieu d'envoyer 1).
 */
const resolveProfessorId = async (): Promise<number | null> => {
  try {
    const store = useUserStore();
    const current = store.user ?? store.hydrate();
    const anyUser = current as any;
    const direct = Number(anyUser?.professorId ?? anyUser?.professor_id ?? anyUser?.professor?.id ?? NaN);
    if (Number.isFinite(direct) && direct > 0) return direct;
    // Édition : préserver le professeur d'origine (évite de réattribuer).
    const existingProfId = Number((selectedHomework.value as any)?.professor?.id ?? NaN);
    if (isEditing.value && Number.isFinite(existingProfId) && existingProfId > 0) return existingProfId;
    // Best-effort : cherche un professeur homonyme de l'utilisateur connecté.
    const needle = String(anyUser?.displayName ?? anyUser?.username ?? '').trim();
    if (needle && (window as any)?.ipcRenderer?.invoke) {
      try {
        const res: any = await (window as any).ipcRenderer.invoke('professor:search', needle);
        const list = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(list) && list.length > 0 && Number(list[0]?.id) > 0) return Number(list[0].id);
      } catch { /* best-effort : ignore */ }
    }
  } catch { /* ignore — fallback null ci-dessous */ }
  return null;
};

/** Messages d'erreur distincts selon le code backend (COURSE/GRADE/PROFESSOR_NOT_FOUND). */
const homeworkErrorMessage = (result: any, fallback: string): string => {
  const code = String(result?.error ?? '');
  if (code.includes('COURSE_NOT_FOUND')) return "Matière introuvable — vérifiez la matière sélectionnée.";
  if (code.includes('GRADE_NOT_FOUND')) return "Classe introuvable — vérifiez la classe sélectionnée.";
  if (code.includes('PROFESSOR_NOT_FOUND')) return "Professeur introuvable — reconnectez-vous ou contactez un administrateur.";
  return (result?.message as string) || fallback;
};

const saveHomework = async () => {
  await ensureProfessorsLoaded();
  if (!form.value.gradeId || !form.value.courseId || !form.value.description || !form.value.dueDate) {
    ElMessage.warning('Veuillez remplir tous les champs');
    return;
  }
  // Professeur requis (même UX que Classe/Matière). PROFESSOR_NOT_FOUND
  // seulement si aucun professeur sélectionnable.
  if (!form.value.professorId) {
    if (professors.value.length === 0) {
      const fallbackId = await resolveProfessorId();
      if (!fallbackId) {
        console.error('[homework] aucun professeur sélectionnable, resolveProfessorId()=null');
        ElMessage.error('Professeur introuvable — reconnectez-vous ou contactez un administrateur. (PROFESSOR_NOT_FOUND)');
        return;
      }
      form.value.professorId = fallbackId;
    } else {
      ElMessage.warning('Veuillez sélectionner un professeur');
      return;
    }
  }

  try {
    const professorId = form.value.professorId ?? await resolveProfessorId();
    if (!professorId) {
      console.error('[homework] professorId introuvable pour utilisateur connecté:', JSON.stringify(useUserStore().user ?? null));
      ElMessage.error('Professeur introuvable — reconnectez-vous ou contactez un administrateur. (PROFESSOR_NOT_FOUND)');
      return;
    }
    if (isEditing.value && !selectedHomework.value?.id) {
      console.error('[homework] édition sans selectedHomework.id — annulation.');
      ElMessage.error('Devoir à modifier introuvable — rouvrez la liste et réessayez.');
      return;
    }

    const data = {
      gradeId: form.value.gradeId,
      courseId: form.value.courseId,
      description: form.value.description,
      dueDate: form.value.dueDate,
      professorId
    };

    const result = await window.ipcRenderer.invoke(
      isEditing.value ? 'homework:update' : 'homework:create',
      isEditing.value ? { id: selectedHomework.value?.id, ...data } : data
    );

    if (result.success) {
      ElMessage.success(isEditing.value ? 'Devoir modifié avec succès' : 'Devoir créé avec succès');
      dialogVisible.value = false;
      // Reset du pointeur d'édition pour éviter un rejeu sur un autre devoir.
      if (isEditing.value) selectedHomework.value = null;
      if (!selectedGrade.value) {
        selectedGrade.value = form.value.gradeId;
      }
      await loadHomework();
    } else {
      const msg = homeworkErrorMessage(result, 'Erreur lors de la sauvegarde');
      console.error('[homework] échec sauvegarde:', { code: result?.error, message: result?.message, data });
      ElMessage.error(msg);
    }
  } catch (error) {
    console.error('[homework] Erreur détaillée:', error);
    const raw = error instanceof Error ? error.message : String(error ?? '');
    if (raw.includes('COURSE_NOT_FOUND')) ElMessage.error("Matière introuvable — vérifiez la matière sélectionnée.");
    else if (raw.includes('GRADE_NOT_FOUND')) ElMessage.error("Classe introuvable — vérifiez la classe sélectionnée.");
    else if (raw.includes('PROFESSOR_NOT_FOUND')) ElMessage.error("Professeur introuvable — reconnectez-vous ou contactez un administrateur.");
    else ElMessage.error('Erreur lors de la sauvegarde du devoir');
  }
};

const deleteHomework = async (row: Homework) => {
  try {
    const result = await window.ipcRenderer.invoke('homework:delete', row.id);
    if (result.success) {
      ElMessage.success('Devoir supprimé avec succès');
      loadHomework();
    }
  } catch (error) {
    ElMessage.error('Erreur lors de la suppression du devoir');
  }
};

const showNotifyDialog = async (homework: Homework) => {
  selectedHomework.value = homework;
  notifyDialogVisible.value = true;
  
  try {
    // Charger les étudiants de la classe
    const result = await window.ipcRenderer.invoke('student:getByGrade', homework.grade.id);
    if (result.success) {
      students.value = result.data;
    }
  } catch (error) {
    ElMessage.error('Erreur lors du chargement des étudiants');
  }
};

const handleSelectionChange = (selection: any[]) => {
  notifyForm.value.selectedStudents = selection;
};

// Computed pour filtrer les devoirs
const filteredHomework = computed(() => {
  let filtered = [...homework.value];
  
  if (selectedCourse.value) {
    filtered = filtered.filter(hw => hw.course.id === selectedCourse.value);
  }
  
  return filtered;
});

// Initialisation
onMounted(async () => {
  try {
    // Charger d'abord les grades et les cours
    const [gradesResult, coursesResult] = await Promise.all([
      window.ipcRenderer.invoke('grade:all'),
      window.ipcRenderer.invoke('course:all')
    ]);
    await loadProfessors();
    if (gradesResult.success) {
      grades.value = gradesResult.data;
      // Sélectionner automatiquement la première classe
      if (grades.value.length > 0) {
        selectedGrade.value = grades.value[0].id;
      }
    }

    if (coursesResult.success) {
      courses.value = coursesResult.data;
    }

    // Charger les devoirs si une classe est sélectionnée
    if (selectedGrade.value) {
      await loadHomework();
    }

    // Charger les informations de l'école pour le message prédéfini
    const schoolResult = await window.ipcRenderer.invoke('school:get');
    if (schoolResult.success) {
      schoolInfo.value = schoolResult.data;
    }
  } catch (error) {
    console.error('Erreur lors de l\'initialisation:', error);
    ElMessage.error('Erreur lors du chargement des données');
  }
});

watch(selectedGrade, async (newValue) => {
  if (newValue) {
    await loadHomework();
  } else {
    homework.value = [];
  }
});

const defaultMessage = computed(() => {
  if (!selectedHomework.value) return '';
  
  const hwCourse = selectedHomework.value.course as any;
  const hwType = hwCourse?.type ? String(hwCourse.type).charAt(0).toUpperCase() + String(hwCourse.type).slice(1).toLowerCase() : 'Matière';
  const hwCoeff = hwCourse?.coefficient ? `, ${hwCourse.coefficient}` : '';
  return `${schoolInfo.value?.name || 'École'}\n\n` +
    `Cher parent,\n\n` +
    `Un devoir a été assigné en ${selectedHomework.value.course.name} (${hwType}${hwCoeff}) ` +
    `pour la classe de ${selectedHomework.value.grade.name}.\n\n` +
    `Description: ${selectedHomework.value.description}\n` +
    `Date limite: ${formatDate(selectedHomework.value.dueDate)}\n\n` +
    `Cordialement,\n` +
    `L'administration`;
});

const schoolInfo = ref<any>(null);

const useDefaultMessage = () => {
  notifyForm.value.message = defaultMessage.value;
};

const notifyStudents = async () => {
  try {
    // Afficher le message de version ultérieure
    ElMessage({
      message: 'Cette fonctionnalité sera disponible dans une version ultérieure',
      type: 'info',
      duration: 3000,
      showClose: true
    });
    
    // Fermer le dialogue
    notifyDialogVisible.value = false;
    
    // Pour la démo, on peut quand même simuler un succès
    // Créer une version simplifiée des objets à envoyer pour éviter l'erreur de clonage
    const simplifiedStudents = notifyForm.value.selectedStudents.map(student => ({
      id: student.id,
      firstname: student.firstname,
      lastname: student.lastname,
      phone: student.phone,
      // Inclure uniquement les propriétés nécessaires
    }));
    
    await window.ipcRenderer.invoke('homework:notify', {
      homeworkId: selectedHomework.value?.id,
      students: simplifiedStudents,
      message: notifyForm.value.message
    });
    
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error('Une erreur est survenue: ' + (error instanceof Error ? error.message : 'Erreur inconnue'));
  }
};
</script>

<style scoped>
.homework-view {
  padding: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-icon {
  font-size: 24px;
  color: var(--el-color-primary);
}

.filters {
  display: flex;
  gap: 20px;
  margin-bottom: 20px;
}

.filter-item {
  min-width: 200px;
}

.option-icon {
  margin-right: 8px;
  vertical-align: middle;
}

.course-info, .due-date {
  display: flex;
  align-items: center;
  gap: 8px;
}

.course-icon, .date-icon {
  font-size: 18px;
  color: var(--el-text-color-secondary);
}

:deep(.el-button) {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

:deep(.el-select) {
  width: 100%;
}

.message-actions {
  margin-top: 8px;
  display: flex;
  justify-content: flex-end;
}

:deep(.el-button-group) {
  display: flex;
  gap: 8px;
}

:deep(.el-button.is-circle) {
  padding: 8px;
}

:deep(.el-button.is-circle .iconify) {
  font-size: 16px;
}
</style> 
