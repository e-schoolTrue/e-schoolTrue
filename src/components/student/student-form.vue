<script setup lang="ts">
import { ref, reactive, defineAsyncComponent, PropType, defineEmits, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

interface ClassItem {
  id: number;
  name: string;
}

interface StudentData {
  firstname: string;
  lastname: string;
  birthDay: Date | null;
  birthPlace: string;
  address: string;
  classId: number | null;
  fatherFirstname: string;
  fatherLastname: string;
  motherFirstname: string;
  motherLastname: string;
  famillyPhone: string;
  personalPhone: string;
  photo: StudentFile | null;
  documents: StudentFile[];
  sex: 'male' | 'female';
  schoolYear: string;
}

interface StudentFile {
  name: string;
  type: string;
  size: number;
  content: string;
}

const props = defineProps({
  studentData: {
    type: Object as PropType<Partial<StudentData>>,
    default: () => ({})
  },
  disabled: {
    type: Boolean,
    default: false
  }
});

// État pour stocker les classes
const classes = ref<ClassItem[]>([]);
const loading = ref(false);

// Fonction pour charger les classes
const loadClasses = async () => {
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke("grade:all");
    console.log("Classes reçues:", result);
    
    if (result?.success && Array.isArray(result.data)) {
      classes.value = result.data.map((grade: { id: number; name: string; }) => ({
        id: grade.id,
        name: grade.name
      }));
    } else {
      console.error("Format de données invalide pour les classes:", result);
      ElMessage.error("Erreur lors du chargement des classes");
    }
  } catch (error) {
    console.error("Erreur lors du chargement des classes:", error);
    ElMessage.error("Erreur lors du chargement des classes");
    classes.value = [];
  } finally {
    loading.value = false;
  }
};

// Charger les classes au montage du composant
onMounted(() => {
  loadClasses();
});

const currentStep = ref(0);

const formData = reactive<StudentData>({
  firstname: '',
  lastname: '',
  birthDay: null,
  birthPlace: '',
  address: '',
  classId: null,
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
  ...props.studentData,
});

const emit = defineEmits<{
  (e: 'save', data: StudentData): void
}>();

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

const saveData = () => {
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
  try {
    emit("save", dataToSave);
  } catch (error) {
    console.error("Erreur lors de l'émission de l'événement save:", error);
    ElMessage.error("Erreur lors de la sauvegarde");
  }
};

const PersonalInfo = defineAsyncComponent(() => import('./sections/PersonalInfo.vue'));
const ParentInfo = defineAsyncComponent(() => import('./sections/ParentInfo.vue'));
const SchoolInfo = defineAsyncComponent(() => import('./sections/SchoolInfo.vue'));
const Attachments = defineAsyncComponent(() => import('./sections/Attachments.vue'));

const sections = [
  PersonalInfo,
  ParentInfo,
  SchoolInfo,
  Attachments,
];
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
          :classes="classes"
          :loading="loading"
        />

        <div class="step-actions">
          <el-button v-if="currentStep > 0" @click="previousStep" :disabled="props.disabled">Précédent</el-button>
          <el-button v-if="currentStep < 4" type="primary" @click="nextStep" :disabled="props.disabled">Suivant</el-button>
          <el-button v-if="currentStep === 4" type="primary" @click="saveData" :disabled="props.disabled || loading">
            <el-icon class="el-icon-loading" v-if="loading || props.disabled"></el-icon>
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