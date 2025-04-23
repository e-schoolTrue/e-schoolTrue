<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import ProfessorForm from '@/components/professor/professor-form.vue';
import { SCHOOL_TYPE } from "#electron/command";
import type { IProfessorDetails, IProfessorFile } from '@/types/professor';

type ProfessorFormData = {
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
  documents?: IProfessorFile[];
  photo?: IProfessorFile;
  teaching?: {
    teachingType: string;
    schoolType: SCHOOL_TYPE | null;
    classId?: number;
    courseId?: number | null;
    gradeIds?: string;
  };
};


// Structure de données exactement comme attendue par le backend
interface ProfessorUpdateData {
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
    diploma: { name: string };
    qualification: { name: string };
    documents?: IProfessorFile[];
    photo?: any;
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
const professorData = ref<IProfessorDetails | null>(null);

const loadProfessor = async () => {
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('professor:getById', Number(route.params.id));
    if (result.success) {
      // Vérifier si une photo existe et ajouter une URL pour l'affichage si nécessaire
      if (result.data && result.data.photo) {
        // Si la photo a un contenu mais pas d'URL, générer l'URL
        if (result.data.photo.content && !result.data.photo.url) {
          result.data.photo.url = `data:${result.data.photo.type || 'image/jpeg'};base64,${result.data.photo.content}`;
          console.log("URL de photo générée:", result.data.photo.url.substring(0, 50) + "...");
        } 
        // Si la photo a un ID mais pas de contenu ni d'URL, récupérer le contenu
        else if (result.data.photo.id && !result.data.photo.content && !result.data.photo.url) {
          try {
            console.log("Tentative de récupération du contenu de la photo avec ID:", result.data.photo.id);
            const photoResult = await window.ipcRenderer.invoke('getProfessorPhoto', result.data.photo.id);
            if (photoResult && photoResult.success && photoResult.data && photoResult.data.content) {
              result.data.photo.content = photoResult.data.content;
              result.data.photo.url = `data:${result.data.photo.type || 'image/jpeg'};base64,${photoResult.data.content}`;
              console.log("Contenu de photo récupéré et URL générée");
            } else {
              console.warn("Impossible de récupérer le contenu de la photo:", photoResult?.message);
            }
          } catch (photoError) {
            console.error("Erreur lors de la récupération de la photo:", photoError);
          }
        }
      }
      
      professorData.value = result.data;
      console.log("Données du professeur chargées avec succès:", professorData.value);
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

const handleUpdate = async (formData: ProfessorFormData) => {
    loading.value = true;
    
    try {
        // Vérifications de sécurité
        if (!formData) {
            throw new Error("Les données du formulaire sont manquantes ou invalides");
        }
        
        console.log("Données reçues du formulaire:", JSON.stringify(formData, null, 2));
        
        // Vérifications obligatoires avec des messages d'erreur explicites
        if (!formData.firstname) {
            throw new Error("Le prénom est obligatoire");
        }
        
        if (!formData.lastname) {
            throw new Error("Le nom est obligatoire");
        }
        
        // Vérification et conversion de l'ID du professeur
        const professorId = Number(route.params.id);
        if (isNaN(professorId) || professorId <= 0) {
            throw new Error("ID du professeur invalide ou manquant");
        }
        
        // Structure de données exactement comme attendue par le backend
        const professorData: ProfessorUpdateData = {
            // Champs de base obligatoires
            firstname: formData.firstname.trim(),
            lastname: formData.lastname.trim(),
            civility: formData.civility || 'MR',
            nbr_child: typeof formData.nbr_child === 'number' ? formData.nbr_child : 0,
            family_situation: formData.family_situation || 'CÉLIBATAIRE',
            
            // Champs facultatifs mais formatés correctement
            birth_date: formData.birth_date || null,
            birth_town: formData.birth_town || '',
            address: formData.address || '',
            town: formData.town || '',
            cni_number: formData.cni_number || '',
            
            // Objets imbriqués avec vérification
            diploma: formData.diploma && typeof formData.diploma === 'object' 
                ? { name: formData.diploma.name || '' } 
                : { name: '' },
                
            qualification: formData.qualification && typeof formData.qualification === 'object' 
                ? { name: formData.qualification.name || '' } 
                : { name: '' }
        };
        
        // Gestion des documents avec filtrage
        if (formData.documents && Array.isArray(formData.documents)) {
            const validDocuments = formData.documents.filter(doc => 
                doc && (doc.content || doc.id)
            );
            
            if (validDocuments.length > 0) {
                professorData.documents = validDocuments;
            }
        }
        
        // Gestion de la photo
        if (formData.photo && (formData.photo.content || formData.photo.id)) {
            const photoData: any = {
                name: formData.photo.name || 'photo.jpg',
                type: formData.photo.type || 'image/jpeg'
            };
            
            if (formData.photo.content) {
                photoData.content = formData.photo.content;
            }
            
            if (formData.photo.id) {
                photoData.id = formData.photo.id;
            }
            
            professorData.photo = photoData;
        }
        
        // Gestion des données d'enseignement
        if (formData.teaching) {
            professorData.teaching = {
                teachingType: formData.teaching.teachingType || 'CLASS',
                schoolType: formData.teaching.schoolType
            };
            
            // Ajout des propriétés optionnelles seulement si elles existent
            if (formData.teaching.classId !== undefined) {
                professorData.teaching.classId = formData.teaching.classId;
            }
            
            if (formData.teaching.courseId !== undefined && formData.teaching.courseId !== null) {
                professorData.teaching.courseId = formData.teaching.courseId;
            }
            
            if (formData.teaching.gradeIds) {
                professorData.teaching.gradeIds = formData.teaching.gradeIds;
            }
        }
        
        // Affichage des données finales pour debugging
        console.log("Données à envoyer:", JSON.stringify(professorData, null, 2));
        console.log("ID du professeur:", professorId);
        
        // Appel API
        try {
            // L'API attend un objet avec les propriétés id et data
            const result = await window.ipcRenderer.invoke('professor:update', {
                id: professorId,
                data: professorData
            });
            
            console.log("Résultat de l'API:", result);
            
            if (result && result.success) {
                ElMessage.success('Professeur mis à jour avec succès');
                router.push('/professor');
            } else {
                const errorMessage = result?.message || 'Erreur inconnue lors de la mise à jour';
                throw new Error(errorMessage);
            }
        } catch (apiError: any) {
            console.error("Erreur lors de l'appel à l'API:", apiError);
            throw new Error(`Erreur API: ${apiError?.message || 'Erreur de communication avec le serveur'}`);
        }
    } catch (error: any) {
        console.error('Erreur détaillée:', error);
        ElMessage.error(`Erreur: ${error?.message || 'Une erreur inconnue est survenue'}`);
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