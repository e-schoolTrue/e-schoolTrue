<script setup lang="ts">
import { ref, reactive } from 'vue';
import { CIVILITY, FAMILY_SITUATION } from "#electron/command";
import TeachingAssignment from './sections/TeachingAssignment.vue';
import type { FormRules } from 'element-plus';

// État du formulaire
const activeStep = ref(0);
type FileData = { name: string; url: string; type: string };

const form = reactive({
  firstname: '',
  lastname: '',
  civility: '',
  nbr_child: 0,
  family_situation: '',
  birth_date: null,
  birth_town: '',
  address: '',
  town: '',
  cni_number: '',
  diploma: { name: '' },
  qualification: { name: '' },
  documents: [] as FileData[], // Typage explicite pour documents
  photo: null as FileData | null, // Typage explicite pour photo
  teaching: {
    schoolType: null,
    selectedClasses: [],
    selectedCourse: null
  }
});


// Règles de validation
const rules = reactive<FormRules>({
  firstname: [
    { required: true, message: 'Le prénom est requis', trigger: 'blur' },
    { min: 2, message: 'Minimum 2 caractères', trigger: 'blur' }
  ],
  lastname: [
    { required: true, message: 'Le nom est requis', trigger: 'blur' },
    { min: 2, message: 'Minimum 2 caractères', trigger: 'blur' }
  ],
  civility: [
    { required: true, message: 'La civilité est requise', trigger: 'change' }
  ],
  family_situation: [
    { required: true, message: 'La situation familiale est requise', trigger: 'change' }
  ],
  birth_date: [
    { required: true, message: 'La date de naissance est requise', trigger: 'change' }
  ],
  birth_town: [
    { required: true, message: 'Le lieu de naissance est requis', trigger: 'blur' }
  ],
  address: [
    { required: true, message: "L'adresse est requise", trigger: 'blur' }
  ],
  cni_number: [
    { required: true, message: 'Le numéro CNI est requis', trigger: 'blur' }
  ],
  'teaching.schoolType': [
    { required: true, message: "Le type d'école est requis", trigger: 'change' }
  ]
});

const formRef = ref();
const loading = ref(false);

// Étapes du formulaire
const steps = [
  { title: 'Informations personnelles', icon: 'mdi:account' },
  { title: 'Documents', icon: 'mdi:file-document' },
  { title: 'Affectation', icon: 'mdi:school' }
];

// Validation de l'étape courante
const validateStep = async () => {
  if (!formRef.value) return false;
  
  try {
    await formRef.value.validate();
    return true;
  } catch (error) {
    return false;
  }
};

// Navigation entre les étapes
const nextStep = async () => {
  const isValid = await validateStep();
  if (isValid) {
    activeStep.value++;
  }
};

const prevStep = () => {
  activeStep.value--;
};

// Gestion des fichiers
// Prévisualisation des photos
const handlePhotoPreview = (file: File) => {
  const reader = new FileReader();
  reader.onload = () => {
    form.photo = {
      name: file.name,
      url: reader.result as string,
      type: file.type,
    };
  };
  reader.readAsDataURL(file);
  return false; // Empêche l'upload automatique
};

// Prévisualisation des documents
const handleDocumentPreview = (file: File) => {
  const reader = new FileReader();
  reader.onload = () => {
    form.documents.push({
      name: file.name,
      url: reader.result as string,
      type: file.type,
    });
  };
  reader.readAsDataURL(file);
  return false; // Empêche l'upload automatique
};

// Soumission du formulaire
const handleSubmit = async () => {
  const isValid = await validateStep();
  if (!isValid) return;

  loading.value = true;
  try {
    emit('save', form);
  } finally {
    loading.value = false;
  }
};

const emit = defineEmits<{
  (e: 'save', data: any): void;
}>();
</script>

<template>
  <div class="professor-form">
    <el-steps :active="activeStep" finish-status="success">
      <el-step 
        v-for="(step, index) in steps" 
        :key="index"
        :title="step.title"
      >
        <template #icon>
          <Icon :icon="step.icon" />
        </template>
      </el-step>
    </el-steps>

    <el-form 
      ref="formRef"
      :model="form"
      :rules="rules"
      label-position="top"
      class="mt-4"
    >
      <!-- Étape 1: Informations personnelles -->
      <div v-show="activeStep === 0">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item prop="firstname" label="Prénom">
              <el-input v-model="form.firstname" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item prop="lastname" label="Nom">
              <el-input v-model="form.lastname" />
            </el-form-item>
          </el-col>
        </el-row>
        <!-- Ajout des champs nécessaires -->
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item prop="civility" label="Civilité">
              <el-select v-model="form.civility" placeholder="Sélectionnez une civilité">
                <el-option v-for="option in CIVILITY" :key="option" :label="option" :value="option" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item prop="family_situation" label="Situation familiale">
              <el-select v-model="form.family_situation" placeholder="Sélectionnez une situation">
                <el-option v-for="option in FAMILY_SITUATION" :key="option" :label="option" :value="option" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <!-- Étape 2: Documents -->
      <div v-show="activeStep === 1">
        <!-- Téléchargement photo -->
        <el-upload
          class="avatar-uploader"
          :before-upload="handlePhotoPreview"
          :show-file-list="false"
        >
          <img v-if="form.photo?.url" :src="form.photo.url" class="avatar" />
          <el-icon v-else class="avatar-uploader-icon"><Plus /></el-icon>
        </el-upload>

        <!-- Téléchargement documents -->
        <el-upload
          :before-upload="handleDocumentPreview"
          multiple
          :show-file-list="false"
        >
          <el-button type="primary">Ajouter des documents</el-button>
        </el-upload>
        <ul>
          <li v-for="(doc, index) in form.documents" :key="index">
            <a :href="doc.url" target="_blank">{{ doc.name }}</a>
          </li>
        </ul>
      </div>

      <!-- Étape 3: Affectation -->
      <div v-show="activeStep === 2">
        <TeachingAssignment v-model="form.teaching" />
      </div>

      <!-- Navigation entre les étapes -->
      <div class="form-actions">
        <el-button 
          v-if="activeStep > 0" 
          @click="prevStep"
        >
          Précédent
        </el-button>
        
        <el-button 
          v-if="activeStep < steps.length - 1" 
          type="primary" 
          @click="nextStep"
        >
          Suivant
        </el-button>
        
        <el-button 
          v-else 
          type="primary" 
          @click="handleSubmit"
          :loading="loading"
        >
          Enregistrer
        </el-button>
      </div>
    </el-form>
  </div>
</template>

<style scoped>
.professor-form {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.form-actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.avatar-uploader {
  border: 1px dashed var(--el-border-color);
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
}

.avatar-uploader:hover {
  border-color: var(--el-color-primary);
}

.avatar {
  width: 178px;
  height: 178px;
  display: block;
}

:deep(.el-form-item.is-error .el-input__wrapper) {
  box-shadow: 0 0 0 1px var(--el-color-danger) inset;
}

:deep(.el-form-item.is-error .el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-color-danger) inset;
}

:deep(.el-radio-group) {
  display: flex;
  gap: 20px;
}

:deep(.el-radio) {
  margin-right: 0;
}
</style>