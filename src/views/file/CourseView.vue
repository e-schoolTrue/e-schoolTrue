<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from "@iconify/vue";
import CourseForm from "@/components/course/course-form.vue";
import CourseTable from "@/components/course/course-table.vue";
import { Loader } from "@/components/util/AppLoader";
import { cloneDeep } from "lodash";
import type { Course, CourseFormData } from '@/types/course';

const newCourseFormRef = ref();
const updateCourseFormRef = ref();
const courses = ref<Course[]>([]);
const loading = ref(false);

function openNewCourseForm() {
  newCourseFormRef.value?.openDialog();
}

function openUpdateCourseForm(course: Course) {
  if (!course.name || !course.code) return;
  
  updateCourseFormRef.value?.openDialog({
    id: course.id,
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
    if (!data.id) {
      throw new Error("ID de la matière manquant");
    }
    
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

async function handleAddToGroup(course: Course) {
  try {
    // Cas 1: Le cours a un groupement ou est une sous-matière à créer
    if ((course as any).groupementId || course.isInGroupement) {
      // C'est une sous-matière à ajouter à une matière existante
      console.log('Ajout de sous-matière avec ID:', (course as any).groupementId);
      
      loading.value = true;
      Loader.showLoader("Ajout de la sous-matière en cours");
      
      const groupData = {
        name: course.name,
        code: course.code,
        coefficient: course.coefficient || 1,
        groupementId: (course as any).groupementId,
        isInGroupement: true
      };
      
      console.log('Données envoyées au serveur:', groupData);
      
      const result = await window.ipcRenderer.invoke("courseGroup:add", cloneDeep(groupData));
      console.log('Résultat reçu du serveur:', result);
      
      if (result.success) {
        const updatedResult = await window.ipcRenderer.invoke("course:all");
        if (updatedResult.success) {
          courses.value = updatedResult.data;
          ElMessage.success("Sous-matière ajoutée avec succès");
        }
      } else {
        throw new Error(result.message || "Échec de l'ajout de la sous-matière");
      }
      
      loading.value = false;
      Loader.hideLoader();
    } else {
      // Cas 2: Ajout d'une matière existante à un groupement (temporairement désactivé)
      await ElMessageBox.alert(
        'Cette fonctionnalité est en cours de développement. Elle sera disponible prochainement.',
        'Fonctionnalité non disponible',
        {
          confirmButtonText: 'OK',
          type: 'info'
        }
      );
    }
  } catch (error) {
    if (error !== 'cancel') {
      const errorMessage = error instanceof Error ? error.message : "Une erreur est survenue";
      ElMessage.error(errorMessage);
      console.error('Erreur:', error);
    }
  } finally {
    if (loading.value) {
      loading.value = false;
      Loader.hideLoader();
    }
  }
}

async function handleDeleteCourse(course: Course) {
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