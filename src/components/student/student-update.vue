<template>
  <student-form
    v-if="studentData"
    :studentData="studentData"
    :classes="classes"
    @save="updateStudent"
    :disabled="isLoading"
  />
</template>

<script lang="ts" setup>
import { ref, onMounted, watch } from 'vue';
import StudentForm from '@/components/student/student-form.vue';
import { ElMessage, ElLoading } from 'element-plus';


const props = defineProps<{
  studentId: number
}>();

const emit = defineEmits(['update-complete']);

const studentData = ref(null);
const classes = ref([]);
const isLoading = ref(false);

onMounted(async () => {
  await loadStudentData();
  await loadClasses();
});

const loadStudentData = async () => {
  try {
    isLoading.value = true;
    const result = await window.ipcRenderer.invoke('student:getDetails', props.studentId);
    if (result.success) {
      const mappedData = {
        ...result.data,
        gradeId: result.data.grade?.id || null
      };
      studentData.value = mappedData;
      console.log('Données de l\'étudiant chargées:', mappedData);
    } else {
      ElMessage.error('Erreur lors de la récupération des détails de l\'étudiant');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error('Une erreur s\'est produite lors du chargement des données de l\'étudiant');
  } finally {
    isLoading.value = false;
  }
};

const loadClasses = async () => {
  try {
    const classesResult = await window.ipcRenderer.invoke('grade:all');
    if (classesResult.success) {
      classes.value = classesResult.data;
    } else {
      console.error('Erreur lors de la récupération des classes:', classesResult.error);
    }
  } catch (error) {
    console.error('Erreur lors du chargement des classes:', error);
  }
};

const updateStudent = async (data: any) => {
  isLoading.value = true;
  const loadingInstance = ElLoading.service({
    fullscreen: true,
    text: 'Mise à jour en cours...',
    background: 'rgba(0, 0, 0, 0.7)'
  });

  try {
    const updateData = {
      ...data,
      id: props.studentId,
      photo: data.photo || null,
      documents: Array.isArray(data.documents) ? data.documents : []
    };

    const result = await window.ipcRenderer.invoke('update-student', {
      studentId: props.studentId,
      studentData: updateData
    });

    if (result.success) {
      ElMessage.success('Étudiant mis à jour avec succès');
      emit('update-complete');
    } else {
      ElMessage.error(result.message ? atob(result.message) : 'Échec de la mise à jour');
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour:', error);
    ElMessage.error('Une erreur s\'est produite lors de la mise à jour');
  } finally {
    loadingInstance.close();
    isLoading.value = false;
  }
};

// Ajoutez un watcher pour recharger les données si l'ID change
watch(() => props.studentId, async (newStudentId) => {
  if (newStudentId) {
    await loadStudentData();
  }
});
</script>
