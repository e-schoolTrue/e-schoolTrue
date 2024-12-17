<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import ProfessorForm from '@/components/professor/professor-form.vue';
import { ROLE, SCHOOL_TYPE } from "#electron/command";

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
  user: {
    username: string;
    password: string;
    role: string;
  };
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
  teaching?: {
    teachingType: string;
    schoolType: SCHOOL_TYPE | null;
    classId?: number;
    courseId?: number | null;
    gradeIds?: string;
  };
  schoolType: SCHOOL_TYPE | null;
  selectedClasses: number[];
  selectedCourse: number | null;
}

const router = useRouter();
const loading = ref(false);

const handleSave = async (professorData: ProfessorFormData): Promise<boolean> => {
  loading.value = true;
  try {
    const { schoolType, selectedClasses, selectedCourse, ...otherData } = professorData;

    console.log("Données reçues du formulaire:", professorData); // Log de debug

    const serializedData = {
      firstname: otherData.firstname || '',
      lastname: otherData.lastname || '',
      civility: otherData.civility,
      nbr_child: otherData.nbr_child || 0,
      family_situation: otherData.family_situation,
      birth_date: otherData.birth_date ? new Date(otherData.birth_date).toISOString() : null,
      birth_town: otherData.birth_town || '',
      address: otherData.address || '',
      town: otherData.town || '',
      cni_number: otherData.cni_number || '',
      
      diploma: otherData.diploma?.name ? {
        name: otherData.diploma.name
      } : null,
      
      qualification: otherData.qualification?.name ? {
        name: otherData.qualification.name
      } : null,
      
      user: {
        username: otherData.user?.username || '',
        password: otherData.user?.password || '',
        role: ROLE.professor
      },
      
      documents: Array.isArray(otherData.documents) ? 
        otherData.documents.map(doc => ({
          name: doc.name || '',
          content: doc.content || '',
          type: doc.type || ''
        })) : [],
      
      photo: otherData.photo ? {
        name: otherData.photo.name || '',
        content: otherData.photo.content || '',
        type: otherData.photo.type || ''
      } : null,

      teaching: schoolType ? {
        teachingType: schoolType === SCHOOL_TYPE.PRIMARY ? 'CLASS_TEACHER' : 'SUBJECT_TEACHER',
        schoolType,
        classId: schoolType === SCHOOL_TYPE.PRIMARY ? selectedClasses?.[0] : undefined,
        courseId: schoolType === SCHOOL_TYPE.SECONDARY ? selectedCourse : undefined,
        gradeIds: schoolType === SCHOOL_TYPE.SECONDARY ? selectedClasses?.join(',') : undefined
      } : undefined
    };

    console.log("Données à envoyer au backend:", serializedData); // Log de debug

    const result = await window.ipcRenderer.invoke('professor:create', serializedData);
    console.log("Résultat de la création du professeur:", result);
    
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
