<script setup lang="ts">
import { ref, reactive, watch, defineProps, defineEmits } from 'vue';
import TeachingAssignment from './sections/TeachingAssignment.vue';
import type { FormRules } from 'element-plus';
import type { IProfessorFile, IProfessorDetails } from '@/types/professor';
import { CIVILITY, FAMILY_SITUATION, type CivilityType, type FamilySituationType, SCHOOL_TYPE, type SchoolType } from '@/types/shared';

// Définir les props pour recevoir des données initiales
const props = defineProps<{
  initialData?: IProfessorDetails;
  disabled?: boolean;
}>();

const activeStep = ref(0);

const form = reactive({
  firstname: '',
  lastname: '',
  civility: '' as CivilityType,
  nbr_child: 0,
  family_situation: '' as FamilySituationType,
  birth_date: null as Date | null,
  birth_town: '',
  address: '',
  town: '',
  cni_number: '',
  diploma: { name: '' },
  qualification: { name: '' },
  documents: [] as IProfessorFile[],
  photo: null as IProfessorFile | null,
  teaching: {
    schoolType: null as SchoolType | null,
    classId: undefined as number | undefined,
    courseId: undefined as number | undefined,
    gradeIds: undefined as number[] | undefined,
    teachingType: 'CLASS',
    selectedClasses: [] as number[],
    selectedCourse: undefined as number | undefined
  }
});

// Observer les changements de props.initialData et mettre à jour le formulaire
watch(
  () => props.initialData,
  (newData) => {
    if (newData) {
      console.log('Mise à jour du formulaire professeur avec les données:', newData);
      
      // Mettre à jour les champs principaux
      if (newData.firstname) form.firstname = newData.firstname;
      if (newData.lastname) form.lastname = newData.lastname;
      if (newData.civility) form.civility = newData.civility;
      if (newData.nbr_child !== undefined) form.nbr_child = newData.nbr_child;
      if (newData.family_situation) form.family_situation = newData.family_situation;
      if (newData.birth_date) form.birth_date = newData.birth_date as Date;
      if (newData.birth_town) form.birth_town = newData.birth_town;
      if (newData.address) form.address = newData.address;
      if (newData.town) form.town = newData.town;
      if (newData.cni_number) form.cni_number = newData.cni_number;
      
      // Mettre à jour les objets imbriqués
      if (newData.diploma) {
        form.diploma.name = newData.diploma.name || '';
      }
      
      if (newData.qualification) {
        form.qualification.name = newData.qualification.name || '';
      }
      
      // Mettre à jour la photo et les documents
      if (newData.photo) {
        // S'assurer que la propriété url est présente pour l'affichage de l'image
        const photoWithUrl = {
          ...newData.photo
        };
        
        // Générer l'URL à partir du contenu base64 si elle n'existe pas
        if (!photoWithUrl.url && photoWithUrl.content) {
          photoWithUrl.url = `data:${photoWithUrl.type || 'image/jpeg'};base64,${photoWithUrl.content}`;
        }
        
        form.photo = photoWithUrl;
        console.log("Photo mise à jour:", form.photo);
      }
      
      if (newData.documents && newData.documents.length > 0) {
        form.documents = [...newData.documents];
      }
      
      // Mettre à jour les données d'enseignement si disponibles
      if (newData.teaching && newData.teaching.length > 0) {
        const teachingAssignment = newData.teaching[0];
        
        if (teachingAssignment.schoolType) {
          form.teaching.schoolType = teachingAssignment.schoolType === SCHOOL_TYPE.PRIMARY 
            ? SCHOOL_TYPE.PRIMARY 
            : SCHOOL_TYPE.SECONDARY;
        }
        
        if (teachingAssignment.class?.id) {
          form.teaching.classId = teachingAssignment.class.id;
        }
        
        if (teachingAssignment.course?.id) {
          form.teaching.courseId = teachingAssignment.course.id;
        }
        
        if (teachingAssignment.gradeIds) {
          form.teaching.gradeIds = Array.isArray(teachingAssignment.gradeIds) 
            ? teachingAssignment.gradeIds 
            : teachingAssignment.gradeIds.split(',').map(Number);
        }
      }
    }
  },
  { immediate: true, deep: true }
);

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
  birth_date: [
    { required: true, message: 'La date de naissance est requise', trigger: 'change' }
  ],
  cni_number: [
    { required: true, message: 'Le numéro CNI est requis', trigger: 'blur' }
  ]
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
    console.error("Erreur lors de la validation de l\'étape :", error);
    return false;
  }
};



// Navigation entre les étapes avec validation
const nextStep = async () => {
  console.log("Tentative de passer à l\'étape suivante depuis l\'étape", activeStep.value);
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
  // Vérification du type de fichier
  const acceptedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (!acceptedTypes.includes(file.type)) {
    ElMessage.error('Seuls les formats JPG et PNG sont acceptés');
    return false;
  }

  // Vérification de la taille (5MB)
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('La photo ne doit pas dépasser 5MB');
    return false;
  }

  // Créer un canvas pour compresser l'image
  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const reader = new FileReader();
      
      reader.onload = (e) => {
        if (!e.target?.result) {
          reject(new Error("Échec de la lecture du fichier"));
          return;
        }

        img.src = e.target.result as string;
        img.onload = () => {
          // Dimensions maximales pour la photo
          const MAX_WIDTH = 500;
          const MAX_HEIGHT = 500;
          
          let width = img.width;
          let height = img.height;
          
          // Calculer les nouvelles dimensions en gardant le ratio
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round(height * (MAX_WIDTH / width));
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round(width * (MAX_HEIGHT / height));
              height = MAX_HEIGHT;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Dessiner l'image redimensionnée avec un fond blanc
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);
            
            // Obtenir l'URL de données avec une qualité optimisée (0.8 = 80%)
            const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
            resolve(dataUrl);
          } else {
            reject(new Error("Impossible de créer le contexte du canvas"));
          }
        };
        img.onerror = () => {
          reject(new Error("Échec du chargement de l'image"));
        };
      };
      reader.onerror = () => {
        reject(new Error("Échec de la lecture du fichier"));
      };
      reader.readAsDataURL(file);
    });
  };

  // Utiliser la compression avec gestion des erreurs
  compressImage(file)
    .then(dataUrl => {
      const base64Content = dataUrl.split(',')[1];
      
      form.photo = {
        name: file.name,
        type: 'image/jpeg',
        content: base64Content,
        url: dataUrl
      };

      ElMessage.success('Photo chargée avec succès');
    })
    .catch(error => {
      console.error("Erreur lors de la compression de l'image:", error);
      ElMessage.error("Erreur lors du traitement de l'image: " + error.message);
    });
    
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
      type: file.type,
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

    // Vérifications pour l'enseignement primaire
    if (form.teaching.schoolType === SCHOOL_TYPE.PRIMARY && (!Array.isArray(form.teaching.selectedClasses) || form.teaching.selectedClasses.length === 0)) {
      // Si classId est défini mais selectedClasses est vide, initialiser selectedClasses avec classId
      if (form.teaching.classId) {
        console.log("classId existe mais selectedClasses est vide, on utilise classId");
        form.teaching.selectedClasses = [form.teaching.classId];
      } else {
        ElMessage.error("Veuillez sélectionner une classe pour l'enseignement primaire");
        return;
      }
    }
    
    // Vérifications pour l'enseignement secondaire
    if (form.teaching.schoolType === SCHOOL_TYPE.SECONDARY) {
      // Vérifier les classes
      if (!Array.isArray(form.teaching.selectedClasses) || form.teaching.selectedClasses.length === 0) {
        if (form.teaching.classId) {
          console.log("classId existe mais selectedClasses est vide, on utilise classId");
          form.teaching.selectedClasses = [form.teaching.classId];
        } else {
          ElMessage.error("Veuillez sélectionner au moins une classe pour l'enseignement secondaire");
          return;
        }
      }
      
      // Vérifier la matière
      if (!form.teaching.selectedCourse) {
        if (form.teaching.courseId) {
          console.log("courseId existe mais selectedCourse est vide, on utilise courseId");
          form.teaching.selectedCourse = form.teaching.courseId;
        } else {
          ElMessage.error("Veuillez sélectionner une matière pour l'enseignement secondaire");
          return;
        }
      }
    }

    // Log pour déboguer
    console.log("Données de teaching avant soumission:", {
      schoolType: form.teaching.schoolType,
      selectedClasses: form.teaching.selectedClasses,
      selectedCourse: form.teaching.selectedCourse,
      classId: form.teaching.classId,
      courseId: form.teaching.courseId
    });

    // Préparer une copie propre des données
    const formDataToSubmit = {
      firstname: form.firstname,
      lastname: form.lastname,
      civility: form.civility,
      nbr_child: form.nbr_child,
      family_situation: form.family_situation,
      birth_date: form.birth_date,
      birth_town: form.birth_town,
      address: form.address,
      town: form.town,
      cni_number: form.cni_number,
      diploma: form.diploma ? { ...form.diploma } : { name: '' },
      qualification: form.qualification ? { ...form.qualification } : { name: '' },
      documents: form.documents.map(doc => ({ ...doc })),
      photo: form.photo ? { ...form.photo } : null,
      teaching: {
        teachingType: form.teaching.schoolType === SCHOOL_TYPE.PRIMARY 
          ? 'CLASS_TEACHER' 
          : (form.teaching.selectedCourse ? 'SUBJECT_TEACHER' : 'CLASS_TEACHER'),
        schoolType: form.teaching.schoolType,
        classId: Array.isArray(form.teaching.selectedClasses) && form.teaching.selectedClasses.length > 0 ? form.teaching.selectedClasses[0] : undefined,
        courseId: form.teaching.schoolType === SCHOOL_TYPE.PRIMARY ? undefined : form.teaching.selectedCourse,
        gradeIds: Array.isArray(form.teaching.selectedClasses) ? form.teaching.selectedClasses.join(',') : undefined,
        selectedClasses: Array.isArray(form.teaching.selectedClasses) ? [...form.teaching.selectedClasses] : [],
        selectedCourse: form.teaching.selectedCourse,
        class: Array.isArray(form.teaching.selectedClasses) && form.teaching.selectedClasses.length > 0 
          ? { id: form.teaching.selectedClasses[0], name: '' } 
          : undefined
      }
    };

    console.log("Données à émettre:", formDataToSubmit);
    emit('save', formDataToSubmit);
    
    ElMessage.success('Formulaire enregistré avec succès');
  } catch (error) {
    console.error("Une erreur s'est produite lors de l'enregistrement:", error);
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
            <div class="photo-upload-container">
              <el-upload
                class="avatar-uploader"
                :before-upload="handlePhotoPreview"
                :show-file-list="false"
                accept="image/jpeg,image/png,image/jpg"
                drag
              >
                <template v-if="form.photo?.url">
                  <div class="photo-preview">
                    <img 
                      :src="form.photo.url" 
                      class="avatar"
                      alt="Photo du professeur"
                    />
                    <div class="photo-overlay">
                      <el-icon><Edit /></el-icon>
                      <span>Modifier</span>
                    </div>
                  </div>
                </template>
                <template v-else>
                  <el-icon class="avatar-uploader-icon"><Plus /></el-icon>
                  <div class="el-upload__text">
                    Déposez votre photo ici ou <em>cliquez pour sélectionner</em>
                  </div>
                </template>
              </el-upload>
              <div v-if="form.photo" class="photo-actions">
                <el-button 
                  type="danger" 
                  size="small" 
                  @click="form.photo = null"
                >
                  Supprimer la photo
                </el-button>
              </div>
            </div>
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
          :disabled="props.disabled"
        >
          <el-icon class="mr-2"><ArrowLeft /></el-icon>
          Précédent
        </el-button>
        
        <div class="flex gap-4">
          <el-button 
            v-if="activeStep < steps.length - 1" 
            type="primary" 
            @click="nextStep"
            :disabled="props.disabled"
          >
            Suivant
            <el-icon class="ml-2"><ArrowRight /></el-icon>
          </el-button>

          <el-button 
            v-if="activeStep === steps.length - 1" 
            type="success" 
            @click="handleSubmit" 
            :loading="loading || props.disabled"
            :disabled="props.disabled"
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

.photo-upload-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
  margin-bottom: 20px;
}

.avatar-uploader {
  border: 2px dashed var(--el-border-color);
  border-radius: 8px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: var(--el-transition-duration-fast);
  width: 200px;
  height: 200px;
}

.avatar-uploader:hover {
  border-color: var(--el-color-primary);
}

.avatar-uploader-icon {
  font-size: 28px;
  color: #8c939d;
  width: 100%;
  height: 100%;
  text-align: center;
  display: flex;
  justify-content: center;
  align-items: center;
}

.photo-preview {
  position: relative;
  width: 100%;
  height: 100%;
}

.avatar {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  opacity: 0;
  transition: opacity 0.3s;
  color: white;
}

.photo-preview:hover .photo-overlay {
  opacity: 1;
}

.el-upload__text {
  color: #8c939d;
  font-size: 14px;
  text-align: center;
  margin: 10px 0;
}

.el-upload__text em {
  color: var(--el-color-primary);
  font-style: normal;
}

.photo-actions {
  margin-top: 8px;
}

:deep(.el-empty) {
  padding: 20px;
  width: 100%;
  height: 100%;
}

:deep(.el-empty__image) {
  width: 60px;
  height: 60px;
}

:deep(.el-empty__description) {
  margin-top: 10px;
  font-size: 14px;
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