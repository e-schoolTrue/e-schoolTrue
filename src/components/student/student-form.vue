<script lang="ts">

export interface StudentFormInstance {
  resetForm: () => void;
}
</script>

<script setup lang="ts">
import { ref, reactive, defineAsyncComponent, PropType, defineEmits, onMounted, watch} from 'vue';
import { ElMessage } from 'element-plus';
import type { IStudentData } from '@/types/student';

export interface StudentFormInstance {
  resetForm: () => void;
}

interface ClassItem {
  id: number;
  name: string;
}

const props = defineProps({
  classes: {
    type: Array as PropType<ClassItem[]>,
    required: true
  },
  studentData: {
    type: Object as PropType<Partial<IStudentData>>,
    default: () => ({})
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

// État de l'étape actuelle
const currentStep = ref(0);

// État des données de formulaire
const formData = reactive<IStudentData>({
  firstname: '',
  lastname: '',
  birthDay: null,
  birthPlace: '',
  address: '',
  gradeId: undefined,
  fatherFirstname: '',
  fatherLastname: '',
  motherFirstname: '',
  motherLastname: '',
  famillyPhone: '',
  personalPhone: '',
  photo: null,
  documents: [],
  sex: 'male',
  schoolYear: '',
});

// Observer les changements de props.studentData et mettre à jour formData en conséquence
watch(
  () => props.studentData,
  (newData) => {
    if (newData && Object.keys(newData).length > 0) {
      console.log('Mise à jour formData avec:', newData);
      // Mettre à jour formData avec les nouvelles données
      Object.keys(newData).forEach(key => {
        if (key in formData) {
          if (key === 'grade' && newData.grade?.id) {
            formData.gradeId = newData.grade.id;
          } else {
            // @ts-ignore - Ignorer les erreurs de type ici car nous vérifions que la clé existe
            formData[key] = newData[key] || ''; // Utiliser une chaîne vide comme valeur par défaut pour les champs optionnels
          }
        }
      });
      console.log('formData après mise à jour:', formData);
    }
  },
  { immediate: true, deep: true }
);

const emit = defineEmits<{
  (e: 'save', data: IStudentData): void
}>();

// Gérer les étapes "Suivant" et "Précédent"
const nextStep = () => {
  if (currentStep.value < 5) {
    currentStep.value += 1;
  }
};

const previousStep = () => {
  if (currentStep.value > 0) {
    currentStep.value -= 1;
  }
};

// Validation des champs obligatoires uniquement
const validateRequiredFields = () => {
  if (!formData.firstname?.trim()) {
    ElMessage.error('Le prénom est obligatoire');
    return false;
  }
  if (!formData.lastname?.trim()) {
    ElMessage.error('Le nom est obligatoire');
    return false;
  }
  if (!formData.gradeId) {
    ElMessage.error('La classe est obligatoire');
    return false;
  }
  return true;
};

// Mise à jour de la fonction saveData pour utiliser la nouvelle validation
const saveData = () => {
  console.log("Données brutes à sauvegarder:", formData);
  
  if (!validateRequiredFields()) {
    return;
  }
  
  // Fonction pour nettoyer l'objet
  const cleanObject = (obj: any) => {
    const cleanedObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (value instanceof Date) {
        cleanedObj[key] = value.toISOString();
      } else if (Array.isArray(value)) {
        cleanedObj[key] = value.map(item => {
          if (typeof item === 'object' && item !== null) {
            return cleanObject(item);
          }
          return item;
        });
      } else if (typeof value === 'object' && value !== null) {
        cleanedObj[key] = cleanObject(value);
      } else if (value !== undefined) {
        cleanedObj[key] = value;
      }
    }
    return cleanedObj;
  };

  const dataToSave = cleanObject(formData);
  console.log("Données nettoyées à sauvegarder:", dataToSave);

  try {
    emit("save", dataToSave);
  } catch (error) {
    console.error("Erreur lors de l'émission de l'événement save:", error);
  }
};

// Importez les composants de section de manière asynchrone
const PersonalInfo = defineAsyncComponent(() => import('./sections/PersonalInfo.vue'));
const ParentInfo = defineAsyncComponent(() => import('./sections/ParentInfo.vue'));
const SchoolInfo = defineAsyncComponent(() => import('./sections/SchoolInfo.vue'));
const Attachments = defineAsyncComponent(() => import('./sections/Attachments.vue'));

// Définissez un tableau de sections
const sections = [
  PersonalInfo,
  ParentInfo,
  SchoolInfo,
  Attachments,
];

onMounted(async () => {
  try {
    const result = await window.ipcRenderer.invoke("yearRepartition:getCurrent");
    if (result.success && result.data) {
      formData.schoolYear = result.data.schoolYear;
    } else {
      ElMessage.warning("Aucune année scolaire active n'a été trouvée. Veuillez en configurer une.");
    }
  } catch (error) {
    console.error("Erreur lors de la récupération de l'année scolaire:", error);
    ElMessage.error("Erreur lors de la récupération de l'année scolaire");
  }
});

// Ajouter la méthode resetForm
const resetForm = () => {
  // Réinitialiser les données du formulaire
  Object.assign(formData, {
    firstname: '',
    lastname: '',
    birthDay: null,
    birthPlace: '',
    address: '',
    gradeId: undefined,
    fatherFirstname: '',
    fatherLastname: '',
    motherFirstname: '',
    motherLastname: '',
    famillyPhone: '',
    personalPhone: '',
    photo: null,
    documents: [],
    sex: 'male',
    schoolYear: formData.schoolYear // Garder l'année scolaire actuelle
  });
  
  // Réinitialiser l'étape courante
  currentStep.value = 0;
};

// Exposer la méthode pour le composant parent
defineExpose<StudentFormInstance>({
  resetForm
});
</script>

<template>
  <el-card class="student-form">
    <el-steps :active="currentStep" finish-status="success" align-center class="mb-4">
      <el-step title="Informations personnelles" icon="el-icon-user" />
      <el-step title="Informations des Parents" icon="el-icon-user-solid" />
      <el-step title="Informations Scolaires" icon="el-icon-school" />
      <el-step title="Pièces jointes" icon="el-icon-document" />
    </el-steps>

    <div class="form-container">
      <el-form :model="formData" label-position="top" class="mt-4">
        <component 
          :is="sections[currentStep]" 
          :formData="formData" 
          :classes="props.classes"
        />

        <div class="step-actions">
          <el-button v-if="currentStep > 0" @click="previousStep" :disabled="props.disabled">Précédent</el-button>
          <el-button v-if="currentStep < 4" type="primary" @click="nextStep" :disabled="props.disabled">Suivant</el-button>
          <el-button v-if="currentStep === 4" type="primary" @click="saveData" :disabled="props.disabled">
            <el-icon class="el-icon-loading" v-if="props.disabled"></el-icon>
            Sauvegarder
          </el-button>
        </div>
      </el-form>
    </div>
  </el-card>
</template>

<style scoped>
.student-form {
  max-width: 800px;
  margin: 0 auto;
}

.form-container {
  max-height: 500px;
  overflow-y: auto;
  padding-right: 20px;
}

.form-section {
  padding: 20px;
  background-color: #f8f9fa;
  border-radius: 8px;
  margin-bottom: 20px;
}

.step-actions {
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
  position: sticky;
  bottom: 0;
  background-color: white;
  padding: 10px 0;
}

/* Styles pour la barre de défilement */
.form-container::-webkit-scrollbar {
  width: 8px;
}

.form-container::-webkit-scrollbar-track {
  background: #f1f1f1;
}

.form-container::-webkit-scrollbar-thumb {
  background: #888;
  border-radius: 4px;
}

.form-container::-webkit-scrollbar-thumb:hover {
  background: #555;
}

.mb-4 {
  margin-bottom: 1rem;
}
</style>
