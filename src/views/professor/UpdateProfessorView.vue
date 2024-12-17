<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import ProfessorForm from '@/components/professor/professor-form.vue';
import { SCHOOL_TYPE } from "#electron/command";

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
  documents?: Array<{ name: string; content?: string; type: string }>;
  photo?: { name: string; content?: string; type: string };
  teaching?: {
    teachingType: string;
    schoolType: SCHOOL_TYPE | null;
    classId?: number;
    courseId?: number | null;
    gradeIds?: string;
  };
}

const route = useRoute();
const router = useRouter();
const loading = ref(false);
const professorData = ref(null);

const loadProfessor = async () => {
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('professor:getById', Number(route.params.id));
    if (result.success) {
      professorData.value = result.data;
    } else {
      throw new Error(result.message || 'Erreur lors du chargement du professeur');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error("Erreur lors du chargement du professeur");
    router.push('/professor');
  } finally {
    loading.value = false;
  }
};

const handleUpdate = async (professorData: ProfessorFormData) => {
    loading.value = true;
    try {
        // Nettoyer les données avant l'envoi
        const cleanedData = {
            firstname: professorData.firstname,
            lastname: professorData.lastname,
            civility: professorData.civility,
            nbr_child: professorData.nbr_child,
            family_situation: professorData.family_situation,
            birth_date: professorData.birth_date,
            birth_town: professorData.birth_town,
            address: professorData.address,
            town: professorData.town,
            cni_number: professorData.cni_number,
            
            diploma: professorData.diploma ? {
                name: professorData.diploma.name
            } : undefined,
            
            qualification: professorData.qualification ? {
                name: professorData.qualification.name
            } : undefined,
            
            // Ne pas inclure les documents existants, seulement les nouveaux
            documents: professorData.documents?.filter(doc => doc.content)?.map(doc => ({
                name: doc.name,
                content: doc.content,
                type: doc.type
            })),
            
            // Gérer la photo si elle a été modifiée
            photo: professorData.photo?.content ? {
                name: professorData.photo.name,
                content: professorData.photo.content,
                type: professorData.photo.type
            } : undefined,

            // Données d'affectation
            teaching: professorData.teaching ? {
                teachingType: professorData.teaching.teachingType,
                schoolType: professorData.teaching.schoolType,
                classId: professorData.teaching.classId,
                courseId: professorData.teaching.courseId,
                gradeIds: professorData.teaching.gradeIds
            } : undefined
        };

        const result = await window.ipcRenderer.invoke(
            'professor:update', 
            Number(route.params.id), 
            cleanedData
        );

        if (result.success) {
            ElMessage.success('Professeur mis à jour avec succès');
            router.push('/professor');
        } else {
            throw new Error(result.message || 'Erreur lors de la mise à jour');
        }
    } catch (error) {
        console.error('Erreur:', error);
        ElMessage.error("Erreur lors de la mise à jour du professeur");
    } finally {
        loading.value = false;
    }
};

onMounted(loadProfessor);
</script>

<template>
  <div class="update-professor-view">
    <professor-form
      v-if="professorData"
      :initial-data="professorData"
      @save="handleUpdate"
      :disabled="loading"
    />
    <el-empty v-else description="Chargement..." />
  </div>
</template>

<style scoped>
.update-professor-view {
  padding: 20px;
  background-color: #f5f7fa;
  min-height: 100vh;
}
</style> 