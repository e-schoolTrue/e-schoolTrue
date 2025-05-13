<script setup lang="ts">
import { ref, onMounted, defineEmits, computed } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Loader } from "@/components/util/AppLoader";
import { cloneDeep } from "lodash";
import type { Course, CourseFormData } from '@/types/course';
import WizardViewBase from './WizardViewBase.vue';

// Étendre l'interface CourseFormData pour inclure les propriétés manquantes
interface ExtendedCourseFormData extends CourseFormData {
  description?: string;
  weeklyHours?: number;
}

const emit = defineEmits(['configuration-saved', 'go-back']);
const courses = ref<Course[]>([]);
const loading = ref(false);
const showModal = ref(false);
const currentCourse = ref<ExtendedCourseFormData>({
  name: '',
  code: '',
  coefficient: 1,
  weeklyHours: 1
});
const isEditing = ref(false);

const modalTitle = computed(() => 
  isEditing.value ? 'Modifier la matière' : 'Ajouter une matière'
);

function openCreateModal() {
  isEditing.value = false;
  currentCourse.value = {
    name: '',
    code: '',
    coefficient: 1,
    weeklyHours: 1
  };
  showModal.value = true;
}

function editCourse(course: Course) {
  isEditing.value = true;
  currentCourse.value = {
    id: course.id,
    name: course.name,
    code: course.code,
    coefficient: course.coefficient || 1,
    weeklyHours: (course as any).weeklyHours || 1
  };
  showModal.value = true;
}

async function saveCourse() {
  try {
    loading.value = true;
    Loader.showLoader(isEditing.value ? "Mise à jour de la matière en cours" : "Ajout de la matière en cours");
    
    const apiCall = isEditing.value ? "course:update" : "course:new";
    const result = await window.ipcRenderer.invoke(apiCall, cloneDeep(currentCourse.value));
    
    if (result.success) {
      courses.value = result.data;
      ElMessage.success(isEditing.value ? "Matière mise à jour avec succès" : "Matière ajoutée avec succès");
      showModal.value = false;
    } else {
      throw new Error(result.message || `Échec de ${isEditing.value ? 'la mise à jour' : 'l\'ajout'} de la matière`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
    ElMessage.error(errorMessage);
    console.error('Erreur:', error);
  } finally {
    loading.value = false;
    Loader.hideLoader();
  }
}

async function deleteCourse(course: Course) {
  if (!course.name) return;
  
  try {
    await ElMessageBox.confirm(
      `Êtes-vous sûr de vouloir supprimer la matière "${course.name}" ?`,
      'Attention',
      {
        confirmButtonText: 'Supprimer',
        cancelButtonText: 'Annuler',
        type: 'warning'
      }
    );

    loading.value = true;
    Loader.showLoader("Suppression de la matière en cours");
    
    const result = await window.ipcRenderer.invoke('course:delete', course.id);
    
    if (result.success) {
      courses.value = result.data;
      ElMessage.success("Matière supprimée avec succès");
    } else {
      throw new Error(result.message || "Échec de la suppression de la matière");
    }
  } catch (error) {
    if (error !== 'cancel') {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      ElMessage.error(errorMessage);
      console.error('Erreur:', error);
    }
  } finally {
    loading.value = false;
    Loader.hideLoader();
  }
}

async function fetchCourses() {
  try {
    loading.value = true;
    Loader.showLoader();
    
    const result = await window.ipcRenderer.invoke("course:all");
    
    if (result.success) {
      courses.value = result.data;
    } else {
      throw new Error(result.message || "Échec de la récupération des matières");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
    ElMessage.error(errorMessage);
    console.error('Erreur:', error);
  } finally {
    loading.value = false;
    Loader.hideLoader();
  }
}

const goNext = async () => {
  if (courses.value.length === 0) {
    ElMessage.warning('Veuillez ajouter au moins une matière');
    return;
  }
  emit('configuration-saved', courses.value);
};

const goBack = () => {
  emit('go-back');
};

onMounted(fetchCourses);

</script>

<template>
  <wizard-view-base>
    <template #title>
      Configurez les matières de votre établissement.
    </template>

    <div class="course-container">
      <el-button type="primary" @click="openCreateModal" class="create-btn">
        Ajouter une matière
      </el-button>

      <el-table 
        :data="courses" 
        class="course-table" 
        row-key="id"
        v-loading="loading"
      >
        <el-table-column prop="name" label="Matière" />
        <el-table-column prop="code" label="Code" width="120" />
        <el-table-column prop="coefficient" label="Coefficient" width="120" />
        <el-table-column prop="weeklyHours" label="Heures/Semaine" width="150" />
        <el-table-column label="Actions" width="200">
          <template #default="scope">
            <el-button 
              size="small" 
              type="primary"
              @click="editCourse(scope.row)"
            >
              Modifier
            </el-button>
            <el-button 
              size="small" 
              type="danger"
              @click="deleteCourse(scope.row)"
            >
              Supprimer
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog 
        v-model="showModal" 
        :title="modalTitle" 
        width="500px"
        destroy-on-close
      >
        <el-form 
          ref="formRef"
          :model="currentCourse"
          label-position="top"
        >
          <el-form-item label="Nom de la matière" required>
            <el-input 
              v-model="currentCourse.name" 
              placeholder="Ex: Mathématiques"
            />
          </el-form-item>

          <el-form-item label="Code de la matière" required>
            <el-input 
              v-model="currentCourse.code" 
              placeholder="Ex: MATH"
            />
          </el-form-item>

          <el-form-item label="Description">
            <el-input
              v-model="currentCourse.description"
              type="textarea"
              :rows="3"
              placeholder="Description de la matière"
            />
          </el-form-item>

          <el-form-item label="Coefficient" required>
            <el-input-number
              v-model="currentCourse.coefficient"
              :min="1"
              :max="10"
              :step="0.5"
              class="full-width"
            />
          </el-form-item>

          <el-form-item label="Volume horaire (heures/semaine)" required>
            <el-input-number
              v-model="currentCourse.weeklyHours"
              :min="1"
              :max="40"
              :step="1"
              class="full-width"
            />
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="showModal = false">Annuler</el-button>
          <el-button 
            type="primary" 
            @click="saveCourse"
            :loading="loading"
          >
            Enregistrer
          </el-button>
        </template>
      </el-dialog>
    </div>

    <template #actions>
      <el-button
        type="info"
        @click="goBack"
        class="action-button">
        Retourner
      </el-button>
      <el-button
        type="primary"
        @click="goNext"
        class="action-button">
        Continuer
      </el-button>
    </template>
  </wizard-view-base>
</template>

<style scoped>
.course-container {
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
  height: calc(100vh - 200px);
  overflow-y: auto;
  margin-bottom: 20px;
}

.create-btn {
  margin-bottom: 20px;
}

.course-table {
  width: 100%;
  margin-bottom: 20px;
}

.full-width {
  width: 100%;
}

/* Assure que les boutons restent en bas */
:deep(.wizard-view-base) {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

:deep(.wizard-view-base__content) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.wizard-view-base__actions) {
  flex-shrink: 0;
  padding: 20px;
  background: white;
  border-top: 1px solid #ebeef5;
  position: sticky;
  bottom: 0;
  z-index: 10;
}

:deep(.el-form-item__label) {
  font-weight: 600;
  color: #606266;
  padding-bottom: 4px;
  line-height: 1.4;
}

:deep(.el-input__wrapper),
:deep(.el-textarea__wrapper),
:deep(.el-input-number) {
  box-shadow: 0 0 0 1px #dcdfe6 inset;
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover),
:deep(.el-textarea__wrapper:hover),
:deep(.el-input-number:hover) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

/* Responsive styles */
@media (max-width: 768px) {
  .course-container {
    padding: 10px;
  }

  :deep(.el-table) {
    font-size: 14px;
  }

  :deep(.el-button--small) {
    padding: 8px 12px;
  }
}
</style>