<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import ProfessorTable from '@/components/professor/professor-table.vue';

const router = useRouter();
const professors = ref([]);
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

const handleDetail = (professor: any) => {
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

const formatTeachingInfo = (professor: any) => {
  if (!professor.teaching || professor.teaching.length === 0) {
    return 'Non assigné';
  }

  return professor.teaching.map((teaching: any) => {
    if (teaching.schoolType === SCHOOL_TYPE.PRIMARY) {
      return `Instituteur - ${teaching.class?.name || 'N/A'}`;
    } else {
      const courseName = teaching.course?.name || 'N/A';
      const classes = teaching.gradeNames || 'Aucune classe';
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
  </div>
</template>

<style scoped>
.professor-list-view {
  height: 100vh;
  background-color: #f0f2f5;
  overflow-y: auto;
}
</style> 