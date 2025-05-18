<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import ProfessorForm from '@/components/professor/professor-form.vue';
import type { IProfessorServiceParams, IProfessorFile } from '@/types/professor';
import { SCHOOL_TYPE, type SchoolType, type CivilityType, type FamilySituationType } from '@/types/shared';

// Définition de l'interface des données du formulaire alignée avec les types
interface TeachingData {
  schoolType: SchoolType;
  classId?: number;
  courseId?: number | null;
  gradeIds?: string | number[];
  teachingType?: string;
  class?: {
    id: number;
    name: string;
  };
  selectedClasses?: number[];
}

interface ProfessorFormData {
  firstname: string;
  lastname: string;
  civility: CivilityType;
  nbr_child: number;
  family_situation: FamilySituationType;
  birth_date: Date | null;
  birth_town: string;
  address: string;
  town: string;
  cni_number: string;
  diploma: { name: string };
  qualification: { name: string };
  documents: IProfessorFile[];
  photo?: {
    content?: string;
    id?: number;
    name?: string;
    type?: string;
  };
  teaching?: TeachingData;
}

const router = useRouter();
const loading = ref(false);

const handleSave = async (professorData: ProfessorFormData) => {
  loading.value = true;
  try {
    // Validation des champs obligatoires
    if (!professorData.firstname?.trim()) {
      throw new Error("Le prénom est obligatoire");
    }
    if (!professorData.lastname?.trim()) {
      throw new Error("Le nom est obligatoire");
    }
    if (!professorData.civility) {
      throw new Error("La civilité est obligatoire");
    }
    if (!professorData.birth_date) {
      throw new Error("La date de naissance est obligatoire");
    }
    if (!professorData.cni_number?.trim()) {
      throw new Error("Le numéro CNI est obligatoire");
    }

    // Les champs suivants sont maintenant optionnels
    // - family_situation
    // - birth_town
    // - address
    // - town
    // - diploma
    // - qualification
    // - nbr_child

    // Validation des données d'enseignement
    if (professorData.teaching) {
      console.log("Données de teaching pour validation:", professorData.teaching);

      const teachingData = professorData.teaching;
      
      if (teachingData.schoolType === SCHOOL_TYPE.PRIMARY) {
        if (!teachingData.classId && (!Array.isArray(teachingData.selectedClasses) || teachingData.selectedClasses?.length === 0)) {
          throw new Error("La classe est requise pour l'enseignement primaire");
        }
        // Si selectedClasses existe, utiliser le premier élément pour classId
        if (Array.isArray(teachingData.selectedClasses) && teachingData.selectedClasses.length > 0 && !teachingData.classId) {
          teachingData.classId = teachingData.selectedClasses[0];
        }
      }
      
      if (teachingData.schoolType === SCHOOL_TYPE.SECONDARY) {
        if (!teachingData.courseId) {
          throw new Error("La matière est requise pour l'enseignement secondaire");
        }
        if (!Array.isArray(teachingData.selectedClasses) || teachingData.selectedClasses.length === 0) {
          throw new Error("Au moins une classe est requise pour l'enseignement secondaire");
        }
      }
    }

    console.log("Données avant construction :", professorData);

    // Conversion des données du formulaire au format attendu par le service
    const serviceData: IProfessorServiceParams['createProfessor'] = {
      firstname: professorData.firstname.trim(),
      lastname: professorData.lastname.trim(),
      civility: professorData.civility,
      nbr_child: professorData.nbr_child,
      family_situation: professorData.family_situation,
      birth_date: professorData.birth_date,
      birth_town: professorData.birth_town.trim(),
      address: professorData.address.trim(),
      town: professorData.town.trim(),
      cni_number: professorData.cni_number.trim(),
      diploma: professorData.diploma.name.trim(),
      qualification: professorData.qualification.name.trim(),
      photo: professorData.photo ? {
        name: professorData.photo.name || '',
        content: professorData.photo.content || '',
        type: professorData.photo.type || 'image/jpeg'
      } : undefined,
      documents: professorData.documents.map(doc => ({
        name: doc.name,
        content: doc.content,
        type: doc.type
      })),
      teaching: professorData.teaching ? {
        schoolType: professorData.teaching.schoolType,
        classId: professorData.teaching.classId,
        courseId: professorData.teaching.courseId || undefined,
        gradeIds: Array.isArray(professorData.teaching.selectedClasses) 
          ? professorData.teaching.selectedClasses
          : professorData.teaching.gradeIds 
            ? (Array.isArray(professorData.teaching.gradeIds) 
                ? professorData.teaching.gradeIds
                : professorData.teaching.gradeIds.split(',').map(Number)) 
            : undefined
      } : undefined
    };

    console.log("Données préparées pour le service :", serviceData);

    const result = await window.ipcRenderer.invoke('professor:create', serviceData);

    if (result.success) {
      ElMessage.success('Professeur créé avec succès');
      router.push('/professor');
      return true;
    } else {
      throw new Error(result.message || 'Erreur lors de la création');
    }
  } catch (error: any) {
    console.error('Erreur détaillée:', error);
    ElMessage.error(`Erreur: ${error?.message || 'Une erreur inconnue est survenue'}`);
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
