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
            :label="course.name"
            :value="course.id"
          >
            <Icon icon="mdi:book" class="option-icon" />
            {{ course.name }}
          </el-option>
        </el-select>
      </div>

      <!-- Liste des devoirs -->
      <el-table 
        :data="filteredHomework" 
        v-loading="loading"
        style="width: 100%"
      >
        <el-table-column prop="course.name" label="Matière">
          <template #default="{ row }">
            <div class="course-info">
              <Icon icon="mdi:book" class="course-icon" />
              {{ row.course.name }}
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
        <el-button type="primary" @click="sendNotification" :loading="sending">
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
    firstname: string;
    lastname: string;
  };
  isCompleted: boolean;
}

// États
const loading = ref(false);
const dialogVisible = ref(false);
const isEditing = ref(false);
const grades = ref<Grade[]>([]);
const courses = ref<Course[]>([]);
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
  description: '',
  dueDate: null as string | null
});

// Méthodes
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR');
};

const loadGrades = async () => {
  try {
    const result = await window.ipcRenderer.invoke('grade:all');
    if (result.success) {
      grades.value = result.data;
    }
  } catch (error) {
    ElMessage.error('Erreur lors du chargement des classes');
  }
};

const loadCourses = async () => {
  try {
    const result = await window.ipcRenderer.invoke('course:all');
    if (result.success) {
      courses.value = result.data;
    }
  } catch (error) {
    ElMessage.error('Erreur lors du chargement des matières');
  }
};

const loadHomework = async () => {
  if (!selectedGrade.value) return;
  
  loading.value = true;
  try {
    console.log("Chargement des devoirs pour la classe:", selectedGrade.value);
    const result = await window.ipcRenderer.invoke('homework:getByGrade', selectedGrade.value);
    console.log("Résultat du chargement:", result);
    
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

const showAddDialog = () => {
  isEditing.value = false;
  form.value = {
    gradeId: selectedGrade.value,
    courseId: null,
    description: '',
    dueDate: null
  };
  dialogVisible.value = true;
};

const editHomework = (row: Homework) => {
  isEditing.value = true;
  form.value = {
    gradeId: row.grade.id,
    courseId: row.course.id,
    description: row.description,
    dueDate: row.dueDate
  };
  dialogVisible.value = true;
};

const saveHomework = async () => {
  if (!form.value.gradeId || !form.value.courseId || !form.value.description || !form.value.dueDate) {
    ElMessage.warning('Veuillez remplir tous les champs');
    return;
  }

  try {
    const data = {
      gradeId: form.value.gradeId,
      courseId: form.value.courseId,
      description: form.value.description,
      dueDate: form.value.dueDate,
      professorId: 1
    };

    const result = await window.ipcRenderer.invoke(
      isEditing.value ? 'homework:update' : 'homework:create',
      isEditing.value ? { id: selectedHomework.value?.id, ...data } : data
    );

    if (result.success) {
      ElMessage.success(isEditing.value ? 'Devoir modifié avec succès' : 'Devoir créé avec succès');
      dialogVisible.value = false;
      if (!selectedGrade.value) {
        selectedGrade.value = form.value.gradeId;
      }
      await loadHomework();
    } else {
      throw new Error(result.message || 'Erreur lors de la sauvegarde');
    }
  } catch (error) {
    console.error('Erreur détaillée:', error);
    ElMessage.error('Erreur lors de la sauvegarde du devoir');
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

const sendNotification = async () => {
  if (!notifyForm.value.message || notifyForm.value.selectedStudents.length === 0) {
    ElMessage.warning('Veuillez sélectionner des étudiants et saisir un message');
    return;
  }

  sending.value = true;
  try {
    const result = await window.ipcRenderer.invoke('homework:notify', {
      homeworkId: selectedHomework.value?.id,
      message: notifyForm.value.message,
      students: notifyForm.value.selectedStudents.map(s => ({
        id: s.id,
        phone: s.phone
      }))
    });

    if (result.success) {
      ElMessage.success('Notifications envoyées avec succès');
      notifyDialogVisible.value = false;
    }
  } catch (error) {
    ElMessage.error('Erreur lors de l\'envoi des notifications');
  } finally {
    sending.value = false;
  }
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
  
  return `${schoolInfo.value?.name || 'École'}\n\n` +
    `Cher parent,\n\n` +
    `Un devoir a été assigné en ${selectedHomework.value.course.name} ` +
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