<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from "@iconify/vue";
import CourseForm from "@/components/course/course-form.vue";
import CourseTable from "@/components/course/course-table.vue";
import { Loader } from "@/components/util/AppLoader";
import { cloneDeep } from "lodash";
import type { CourseFormData, CourseGroupFormData } from '@/types/course';
import type { CourseEntity } from '#electron/backend/entities/course';

const newCourseFormRef = ref();
const updateCourseFormRef = ref();
const courses = ref<CourseEntity[]>([]);
const loading = ref(false);

function openNewCourseForm() {
  newCourseFormRef.value?.openDialog();
}

function openUpdateCourseForm(course: CourseEntity) {
  if (!course.name || !course.code) return;
  
  updateCourseFormRef.value?.openDialog({
    name: course.name,
    code: course.code,
    coefficient: course.coefficient || 1
  });
}

async function handleNewCourse(data: CourseFormData) {
  try {
    loading.value = true;
    Loader.showLoader("Ajout de la matière en cours");
    
    const result = await window.ipcRenderer.invoke("course:new", cloneDeep(data));
    
    if (result.success) {
      courses.value = result.data;
      ElMessage.success("Matière ajoutée avec succès");
      newCourseFormRef.value?.closeDialog();
    } else {
      throw new Error(result.message || "Échec de l'ajout de la matière");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue lors de l'ajout de la matière";
    ElMessage.error(errorMessage);
    console.error('Erreur lors de l\'ajout de la matière:', error);
  } finally {
    loading.value = false;
    Loader.hideLoader();
  }
}

async function handleUpdateCourse(data: CourseFormData) {
  try {
    loading.value = true;
    Loader.showLoader("Mise à jour de la matière en cours");
    
    const result = await window.ipcRenderer.invoke("course:update", cloneDeep(data));
    
    if (result.success) {
      courses.value = result.data;
      ElMessage.success("Matière mise à jour avec succès");
      updateCourseFormRef.value?.closeDialog();
    } else {
      throw new Error(result.message || "Échec de la mise à jour de la matière");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue lors de la mise à jour de la matière";
    ElMessage.error(errorMessage);
    console.error('Erreur lors de la mise à jour de la matière:', error);
  } finally {
    loading.value = false;
    Loader.hideLoader();
  }
}

async function handleAddToGroup(course: CourseEntity) {
  if (!course.name || !course.code) return;
  
  try {
    loading.value = true;
    Loader.showLoader("Ajout de la sous-matière en cours");
    
    const groupData: CourseGroupFormData = {
      name: course.name,
      code: course.code,
      coefficient: course.coefficient || 1
    };
    
    const result = await window.ipcRenderer.invoke("courseGroup:add", cloneDeep(groupData));
    
    if (result.success) {
      courses.value = result.data;
      ElMessage.success("Sous-matière ajoutée avec succès");
    } else {
      throw new Error(result.message || "Échec de l'ajout de la sous-matière");
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue lors de l'ajout de la sous-matière";
    ElMessage.error(errorMessage);
    console.error('Erreur lors de l\'ajout de la sous-matière:', error);
  } finally {
    loading.value = false;
    Loader.hideLoader();
  }
}

async function handleDeleteCourse(course: CourseEntity) {
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
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue lors de la suppression de la matière";
      ElMessage.error(errorMessage);
      console.error('Erreur lors de la suppression de la matière:', error);
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
    const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue lors de la récupération des matières";
    ElMessage.error(errorMessage);
    console.error('Erreur lors de la récupération des matières:', error);
  } finally {
    loading.value = false;
    Loader.hideLoader();
  }
}

onMounted(fetchCourses);
</script>

<template>
  <div class="course-view">
    <course-form
      ref="newCourseFormRef"
      form-title="Ajout d'une nouvelle matière"
      @submit="handleNewCourse"
    />
    <course-form
      ref="updateCourseFormRef"
      form-title="Modification de la matière"
      @submit="handleUpdateCourse"
    />
    
    <el-space direction="vertical" fill="fill" size="large">
      <el-row justify="center" class="title-row">
        <el-space size="large" class="title-space">
          <Icon width="25" icon="vscode-icons:folder-type-module" color="#32CD32"/>
          <el-text type="primary" class="title-text">Table des matières</el-text>
        </el-space>
      </el-row>
      
      <el-row justify="center">
        <el-button 
          type="primary" 
          @click="openNewCourseForm" 
          style="width: 200px; --el-button-text-color:var(--button-text-color); --el-button-hover-text-color: var(--button-hover-text-color); --el-button-hover-bg-color: var(--button-hover-bg-color)"
        >
          Ajouter
        </el-button>
      </el-row>
      
      <course-table
        :courses="courses"
        :loading="loading"
        @update="openUpdateCourseForm"
        @delete="handleDeleteCourse"
        @add-to-group="handleAddToGroup"
      />
    </el-space>
  </div>
</template>

<style scoped>
.course-view {
  padding: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  max-width: 1200px;
  margin: 0 auto;
  width: 100%;
}

.el-space {
  width: 100%;
}

.title-row {
  width: 100%;
  margin-bottom: 1rem;
}

.title-space {
  display: flex;
  align-items: center;
  justify-content: center;
}

.title-text {
  font-size: 20px;
  font-weight: 600;
}
</style>