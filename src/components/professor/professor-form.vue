<script setup lang="ts">
import { ref, reactive } from 'vue';
import { CIVILITY, FAMILY_SITUATION } from "#electron/command";
import TeachingAssignment from './sections/TeachingAssignment.vue';
import type { FormRules } from 'element-plus';

const activeStep = ref(0);
type FileData = {
  name: string;
  type: string;
  size: number;
  content: string;
  url: string; 
};

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
  documents: [] as FileData[],
  photo: null as FileData | null,
  teaching: {
    schoolType: null,
    selectedClasses: [],
    selectedCourse: null
  }
});

// Mise à jour des règles pour inclure toutes les validations nécessaires
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
  town: [
    { required: true, message: 'La ville est requise', trigger: 'blur' }
  ],
  cni_number: [
    { required: true, message: 'Le numéro CNI est requis', trigger: 'blur' }
  ],
  'diploma.name': [
    { required: true, message: 'Le diplôme est requis', trigger: 'blur' }
  ],
  'qualification.name': [
    { required: true, message: 'La qualification est requise', trigger: 'blur' }
  ],
});

const formRef = ref();
const loading = ref(false);

// Mise à jour des étapes avec les 4 sections distinctes
const steps = [
  { title: 'Informations personnelles', icon: 'mdi:account' },
  { title: 'Diplômes et qualifications', icon: 'mdi:school' },
  { title: 'Documents', icon: 'mdi:file-document' },
  { title: 'Affectation', icon: 'mdi:teach' }
];

// Validation spécifique pour chaque étape
const validateCurrentStep = async () => {
  if (!formRef.value) {
    console.error('Le formulaire (formRef) est introuvable.');
    return false;
  }

  const stepValidationFields = {
    0: ['firstname', 'lastname', 'civility', 'birth_date', 'birth_town', 'address', 'town', 'cni_number', 'family_situation'],
    1: ['diploma.name', 'qualification.name'],
    2: [], // Étape documents - pas de validation obligatoire
    3: ['teaching.schoolType']
  };

  try {
    const fields = stepValidationFields[activeStep.value as keyof typeof stepValidationFields];
    if (!fields || fields.length === 0) {
      console.warn('Aucun champ à valider pour cette étape.');
      return true; // Si aucun champ n'est requis, retournez "validé".
    }
    console.log('Validation des champs pour cette étape :', fields);
    // Appel à validate avec des champs spécifiques.
    await formRef.value.validate((valid: any, invalidFields: any) => {
      if (valid) {
        console.log('Validation réussie.');
      } else {
        console.error('Erreurs de validation :', invalidFields);
      }
    });
    return true;
  } catch (error) {
    console.error('Erreur lors de la validation de l’étape :', error);
    return false;
  }
};



// Navigation entre les étapes avec validation
const nextStep = async () => {
  console.log('Tentative de passer à l’étape suivante depuis l’étape', activeStep.value);
  const isValid = await validateCurrentStep();
  if (isValid && activeStep.value < steps.length - 1) {
    activeStep.value++;
    console.log('Étape suivante :', activeStep.value);
  } else {
    console.warn('Validation échouée ou dernière étape atteinte.');
  }
};


const prevStep = () => {
  if (activeStep.value > 0) {
    activeStep.value--;
  }
};

// Gestion améliorée des fichiers
const handlePhotoPreview = (file: File) => {
  if (file.size > 5000000) { // 5MB limit
    ElMessage.error('La photo ne doit pas dépasser 5MB');
    return false;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    form.photo = {
      name: file.name,
      url: result,
      type: file.type,
      size: file.size,
      content: result.split(',')[1]
    };
  };
  reader.readAsDataURL(file);
  return false;
};

const handleDocumentPreview = (file: File) => {
  if (file.size > 10000000) { // 10MB limit
    ElMessage.error('Le document ne doit pas dépasser 10MB');
    return false;
  }

  const reader = new FileReader();
  reader.onload = () => {
    const result = reader.result as string;
    form.documents.push({
      name: file.name,
      url: result,
      type: file.type,
      size: file.size,
      content: result.split(',')[1]
    });
  };
  reader.readAsDataURL(file);
  return false;
};

// Soumission du formulaire avec validation complète
const handleSubmit = async () => {
  try {
    loading.value = true;
    const isValid = await formRef.value.validate();
    if (!isValid) {
      ElMessage.error('Veuillez remplir tous les champs obligatoires');
      return;
    }
    emit('save', form);
    ElMessage.success('Formulaire enregistré avec succès');
  } catch (error) {
    ElMessage.error("Une erreur s'est produite lors de l'enregistrement");
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
    <!-- Stepper avec indicateur de progression -->
    <el-steps :active="activeStep" finish-status="success" class="mb-8">
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

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item prop="civility" label="Civilité">
              <el-select v-model="form.civility" placeholder="Sélectionnez une civilité">
                <el-option 
                  v-for="option in CIVILITY" 
                  :key="option" 
                  :label="option" 
                  :value="option" 
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item prop="family_situation" label="Situation familiale">
              <el-select v-model="form.family_situation" placeholder="Sélectionnez une situation">
                <el-option 
                  v-for="option in FAMILY_SITUATION" 
                  :key="option" 
                  :label="option" 
                  :value="option" 
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item prop="birth_date" label="Date de naissance">
              <el-date-picker 
                v-model="form.birth_date" 
                type="date"
                placeholder="Sélectionnez une date" 
              />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item prop="birth_town" label="Ville de naissance">
              <el-input v-model="form.birth_town" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item prop="address" label="Adresse">
              <el-input v-model="form.address" type="textarea" :rows="2" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item prop="town" label="Ville">
              <el-input v-model="form.town" />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item prop="nbr_child" label="Nombre d'enfants">
              <el-input-number v-model="form.nbr_child" :min="0" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item prop="cni_number" label="Numéro CNI">
              <el-input v-model="form.cni_number" />
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <!-- Étape 2: Diplômes et qualifications -->
      <div v-show="activeStep === 1">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item prop="diploma.name" label="Diplôme">
              <el-input v-model="form.diploma.name" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item prop="qualification.name" label="Qualification">
              <el-input v-model="form.qualification.name" />
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <!-- Étape 3: Documents -->
      <div v-show="activeStep === 2">
        <el-row :gutter="20">
          <el-col :span="24">
            <h3>Photo d'identité</h3>
            <el-upload
              class="avatar-uploader"
              :before-upload="handlePhotoPreview"
              :show-file-list="false"
              accept="image/*"
            >
              <img 
                v-if="form.photo?.url" 
                :src="form.photo.url" 
                class="avatar"
              />
              <el-icon v-else class="avatar-uploader-icon">
                <Plus />
              </el-icon>
            </el-upload>
          </el-col>
        </el-row>

        <el-row :gutter="20" class="mt-4">
          <el-col :span="24">
            <h3>Documents justificatifs</h3>
            <el-upload
              :before-upload="handleDocumentPreview"
              multiple
              :show-file-list="false"
              accept=".pdf,.doc,.docx"
            >
              <el-button type="primary">
                <el-icon class="mr-2"><Upload /></el-icon>
                Ajouter des documents
              </el-button>
            </el-upload>

            <div v-if="form.documents.length > 0" class="mt-4">
              <el-table :data="form.documents" style="width: 100%">
                <el-table-column prop="name" label="Nom du fichier" />
                <el-table-column prop="type" label="Type" width="180" />
                <el-table-column label="Actions" width="120">
                  <template #default="{ $index }">
                    <el-button 
                      type="danger" 
                      size="small" 
                      @click="form.documents.splice($index, 1)"
                    >
                      Supprimer
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- Étape 4: Affectation -->
      <div v-show="activeStep === 3">
        <TeachingAssignment
          v-model="form.teaching"
        />
      </div>

      <!-- Boutons de navigation -->
      <div class="form-actions mt-8 flex justify-between">
        <el-button 
          v-if="activeStep > 0" 
          @click="prevStep"
        >
          <el-icon class="mr-2"><ArrowLeft /></el-icon>
          Précédent
        </el-button>
        
        <div class="flex gap-4">
          <el-button 
            v-if="activeStep < steps.length - 1" 
            type="primary" 
            @click="nextStep"
          >
            Suivant
            <el-icon class="ml-2"><ArrowRight /></el-icon>
          </el-button>

          <el-button 
            v-if="activeStep === steps.length - 1" 
            type="success" 
            @click="handleSubmit" 
            :loading="loading"
          >
            <el-icon class="mr-2"><Check /></el-icon>
            Enregistrer
          </el-button>
        </div>
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