<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import ProfessorTable from '@/components/professor/professor-table.vue';
import { SCHOOL_TYPE, type ITeachingAssignment } from '@/types/shared';
import type { IProfessorDetails } from '@/types/professor';
import { Icon } from '@iconify/vue';

const router = useRouter();
const professors = ref<IProfessorDetails[]>([]);
const loading = ref(false);

const loadProfessors = async () => {
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('professor:all');
    if (result.success) {
      professors.value = result.data;
    } else {
      throw new Error(result.message || 'Erreur lors du chargement des professeurs');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error("Erreur lors du chargement des professeurs");
  } finally {
    loading.value = false;
  }
};

const handleDetail = (professor: IProfessorDetails) => {
  router.push(`/professor/${professor.id}`);
};

const handleEdit = (id: number) => {
  router.push(`/professor/update/${id}`);
};

const handleDelete = async (id: number) => {
  try {
    const result = await window.ipcRenderer.invoke('professor:delete', id);
    if (result.success) {
      ElMessage.success('Professeur supprimé avec succès');
      await loadProfessors();
    } else {
      throw new Error(result.message || 'Erreur lors de la suppression');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error("Erreur lors de la suppression du professeur");
  }
};

const formatTeachingInfo = (professor: IProfessorDetails) => {
  if (!professor.teaching || professor.teaching.length === 0) {
    return 'Non assigné';
  }

  return professor.teaching.map((teaching: ITeachingAssignment) => {
    if (teaching.schoolType === SCHOOL_TYPE.PRIMARY) {
      return `Instituteur - ${teaching.class?.name || 'N/A'}`;
    } else {
      const courseName = teaching.course?.name || 'N/A';
      const gradeIds = Array.isArray(teaching.gradeIds) ? teaching.gradeIds : [];
      const classes = gradeIds.length > 0 ? gradeIds.join(', ') : 'Aucune classe';
      return `Professeur de ${courseName} - Classes: ${classes}`;
    }
  }).join(', ');
};

onMounted(loadProfessors);
</script>

<template>
  <div class="professor-list-view">
    <professor-table
      :professors="professors"
      :loading="loading"
      @detail="handleDetail"
      @edit="handleEdit"
      @delete="handleDelete"
      :format-teaching="formatTeachingInfo"
    />
    
    <el-button 
      type="primary" 
      class="floating-add-btn" 
      circle
      size="large"
      @click="router.push({ name: 'AddProfessor' })"
      title="Ajouter un professeur"
    >
      <Icon icon="mdi:account-plus" width="24" height="24" />
    </el-button>
  </div>
</template>

<style scoped>
.professor-list-view {
  height: 100vh;
  background-color: #f0f2f5;
  overflow-y: auto;
  padding-bottom: 80px;
}

.floating-add-btn {
  position: fixed;
  bottom: 30px;
  right: 30px;
  z-index: 100;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
</style> 