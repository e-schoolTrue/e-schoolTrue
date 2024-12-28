<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import ProfessorForm from '@/components/professor/professor-form.vue';
import { SCHOOL_TYPE } from "#electron/command";

// Définition de l'interface des données du formulaire
interface TeachingData {
  schoolType: SCHOOL_TYPE;
  selectedClasses: number[];
  selectedCourse: number;
}

interface ProfessorFormData {
  firstname: string;
  lastname: string;
  civility: string;
  nbr_child: number;
  family_situation: string;
  birth_date: Date | null;
  birth_town: string;
  address: string;
  town: string;
  cni_number: string;
  diploma?: { name: string };
  qualification?: { name: string };
  documents: Array<{
    name: string;
    content: string;
    type: string;
  }>;
  photo?: {
    name: string;
    content: string;
    type: string;
  };
  teaching: TeachingData;
}

const router = useRouter();
const loading = ref(false);

const handleSave = async (professorData: ProfessorFormData) => {
  loading.value = true;
  try {
    console.log("Données avant construction :", professorData);

    const serializedData = JSON.parse(JSON.stringify({
      firstname: professorData.firstname,
      lastname: professorData.lastname,
      civility: professorData.civility,
      nbr_child: professorData.nbr_child,
      family_situation: professorData.family_situation,
      birth_date: professorData.birth_date ? new Date(professorData.birth_date).toISOString() : null,
      birth_town: professorData.birth_town,
      address: professorData.address,
      town: professorData.town,
      cni_number: professorData.cni_number,
      diploma: professorData.diploma?.name,
      qualification: professorData.qualification?.name,
      photo: professorData.photo ? {
        name: professorData.photo.name,
        content: professorData.photo.content,
        type: professorData.photo.type,
      } : null,
      documents: Array.isArray(professorData.documents)
        ? professorData.documents.map(doc => ({
            name: doc.name,
            content: doc.content,
            type: doc.type,
          }))
        : [],
      teaching: {
        schoolType: professorData.teaching.schoolType,
        classId: professorData.teaching.schoolType === SCHOOL_TYPE.PRIMARY 
          ? professorData.teaching.selectedClasses[0] 
          : null,
        courseId: professorData.teaching.schoolType === SCHOOL_TYPE.SECONDARY 
          ? professorData.teaching.selectedCourse 
          : null,
        gradeIds: professorData.teaching.schoolType === SCHOOL_TYPE.SECONDARY 
          ? professorData.teaching.selectedClasses 
          : [],
      }
    }));

    console.log("Données après sérialisation :", serializedData);

    const result = await window.ipcRenderer.invoke('professor:create', serializedData);

    if (result.success) {
      ElMessage.success('Professeur créé avec succès');
      router.push('/professor');
      return true;
    } else {
      throw new Error(result.message || 'Erreur lors de la création');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error("Erreur lors de la création du professeur");
    return false;
  } finally {
    loading.value = false;
  }
};
</script>


<template>
  <div class="new-professor-view">
    <professor-form
      @save="handleSave"
      :disabled="loading"
    />
  </div>
</template>

<style scoped>
.new-professor-view {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100vh;
}
</style>
