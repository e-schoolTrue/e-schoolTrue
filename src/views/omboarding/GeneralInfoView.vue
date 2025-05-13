<script setup lang="ts">
// @ts-nocheck
import { ref, defineEmits, computed } from "vue";

import { ElMessage } from 'element-plus'
import type { UploadProps, FormInstance, FormRules } from 'element-plus' 
import { Plus, Picture, Delete } from '@element-plus/icons-vue' 
import WizardViewBase from './WizardViewBase.vue'


const countries = [
  { code: 'MAR', name: 'Maroc', currency: 'MAD' },
  { code: 'SEN', name: 'Sénégal', currency: 'FCFA' },
  { code: 'CAF', name: 'Centrafrique', currency: 'FCFA' },
  { code: 'GIN', name: 'Guinée', currency: 'GNF' }
];

const foundationYears = Array.from(
  { length: 100 },
  (_, i) => new Date().getFullYear() - i
);


interface SchoolFormData {
  name: string;
  address: string;
  town: string; 
  country: string;
  phone: string;
  email: string;
  type: 'publique' | 'privée' | '';
  foundationYear: number | null;
  logoFile: File | null; 
}


const emit = defineEmits(['configuration-saved', 'go-back']); 
const formRef = ref<FormInstance>(); 
const formData = ref<SchoolFormData>({
  name: '',
  address: '',
  town: '',
  country: 'SEN',
  phone: '',
  email: '', 
  foundationYear: new Date().getFullYear(), 
  logoFile: null
});
const logoPreview = ref<string>(''); 
const fileInput = ref<HTMLInputElement | null>(null);
const isSaving = ref(false);


const rules = computed<FormRules<SchoolFormData>>(() => ({
  name: [{ required: true, message: 'Le nom de l\'établissement est requis', trigger: 'blur' }],
  address: [{ required: true, message: 'L\'adresse est requise', trigger: 'blur' }],
  town: [{ required: true, message: 'La ville est requise', trigger: 'blur' }],
  country: [{ required: true, message: 'Le pays est requis', trigger: 'change' }],
  type: [{ required: true, message: 'Le type d\'établissement est requis', trigger: 'change' }],
  phone: [{ required: false }], 
  email: [
    { required: false }, 
    { type: 'email', message: 'Veuillez entrer une adresse email valide', trigger: ['blur', 'change'] }
  ],
  foundationYear: [{ required: true, message: 'L\'année de fondation est requise', trigger: 'change' }],
}));


// --- Logique du composant ---

// Gestion du logo (similaire à SchoolInfoView)
const handleLogoChange = (event: Event) => {
  const target = event.target as HTMLInputElement;
  const file = target.files?.[0];

  if (!file) return;

  // Validation du type et de la taille (peut être ajustée)
  if (!file.type.startsWith('image/')) {
    ElMessage.error('Veuillez sélectionner un fichier image (JPG, PNG, GIF, etc.).');
    return;
  }
  if (file.size > 2 * 1024 * 1024) { // Limite à 2MB comme dans le code original
    ElMessage.error('La taille de l\'image ne doit pas dépasser 2MB.');
    return;
  }

  formData.value.logoFile = file;
  logoPreview.value = URL.createObjectURL(file);

  // Effacer la valeur de l'input pour permettre de resélectionner le même fichier
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const removeLogo = () => {
  formData.value.logoFile = null;
  logoPreview.value = '';
  if (fileInput.value) {
    fileInput.value.value = '';
  }
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

const saveSchoolInfo = async () => {
  try {
    isSaving.value = true;

    const payload = {
      name: formData.value.name,
      address: formData.value.address,
      town: formData.value.town,
      country: formData.value.country,
      phone: formData.value.phone,
      email: formData.value.email,
      type: formData.value.type,
      foundationYear: formData.value.foundationYear,
      logo: undefined
    };

    if (formData.value.logoFile) {
      const reader = new FileReader();
      const file = formData.value.logoFile;
      
      const logoData = await new Promise<{ content: string; name: string; type: string }>((resolve) => {
        reader.onload = (e) => {
          resolve({
            content: e.target?.result as string,
            name: file.name,
            type: file.type
          });
        };
        reader.readAsDataURL(file);
      });

      payload.logo = logoData;
    }

    const result = await window.ipcRenderer.invoke('school:save', payload);

    if (result.success) {
      ElMessage.success('Informations sauvegardées avec succès');
      return true;
    } else {
      throw new Error(result.message || 'Erreur lors de la sauvegarde');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error('Erreur lors de la sauvegarde');
    return false;
  } finally {
    isSaving.value = false;
  }
};

async function goNext() {
  if (!formRef.value) return;
  try {
    // Valider le formulaire
    const valid = await formRef.value.validate();
    if (valid) {
      const saved = await saveSchoolInfo();
      if (saved) {
        console.log('Formulaire valide, émission des données:', formData.value);
        // Émettre les données du formulaire (y compris logoFile)
        // Le composant parent se chargera de la sauvegarde via IPC
        emit('configuration-saved', { ...formData.value });
      }
    } else {
      console.log('Formulaire invalide');
      ElMessage.error('Veuillez corriger les erreurs dans le formulaire.');
      return false;
    }
  } catch (error) {
    console.error('Erreur de validation:', error);
  }
}

function goBack() {
  // Émettre un événement pour que le parent gère le retour
  emit('go-back');
  // router.push({ name: 'data-location' }); // Ancienne méthode
}

</script>

<template>
  <wizard-view-base>
    <template #title>
      Veuillez fournir les informations concernant votre établissement.
    </template>

    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-position="top"
      class="general-info-form"
      @submit.prevent="goNext"
    >
      <el-row :gutter="30">
        <!-- Colonne Gauche: Logo -->
        <el-col :xs="24" :sm="8" :md="6" class="logo-column">
          <el-form-item label="Logo de l'établissement" prop="logoFile">
            <div class="logo-upload-area">
              <div class="logo-preview" :class="{ 'has-logo': logoPreview }">
                <el-image
                  v-if="logoPreview"
                  :src="logoPreview"
                  fit="contain"
                  class="logo-image"
                />
                <el-icon v-else><Picture /></el-icon>
              </div>
              <div class="logo-actions">
                <el-button
                  type="primary"
                  size="small"
                  @click="triggerFileInput"
                  :icon="Plus"
                >
                  {{ logoPreview ? 'Changer' : 'Ajouter' }}
                </el-button>
                <el-button
                  v-if="logoPreview"
                  type="danger"
                  size="small"
                  @click="removeLogo"
                  :icon="Delete"
                  text
                  circle
                />
              </div>
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                class="hidden-input"
                @change="handleLogoChange"
              />
            </div>
          </el-form-item>
        </el-col>

        <!-- Colonne Droite: Champs d'information -->
        <el-col :xs="24" :sm="16" :md="18">
          <el-row :gutter="20">
            <el-col :xs="24" :md="12">
              <el-form-item label="Nom de l'établissement" prop="name" required>
                <el-input v-model="formData.name" placeholder="Nom complet" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-form-item label="Type d'établissement" prop="type" required>
                <el-select v-model="formData.type" placeholder="Sélectionner le type" class="full-width">
                  <el-option label="Public" value="publique" />
                  <el-option label="Privé" value="privée" />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="20">
            <el-col :xs="24" :md="12">
              <el-form-item label="Adresse" prop="address" required>
                <el-input v-model="formData.address" type="textarea" :rows="2" placeholder="Numéro, rue, quartier..." />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-form-item label="Ville" prop="town" required>
                <el-input v-model="formData.town" placeholder="Ville" />
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="20">
            <el-col :xs="24" :md="12">
              <el-form-item label="Pays" prop="country" required>
                <el-select v-model="formData.country" placeholder="Sélectionner le pays" class="full-width">
                  <el-option
                    v-for="country in countries"
                    :key="country.code"
                    :label="`${country.name} (${country.currency})`"
                    :value="country.code"
                  />
                </el-select>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-form-item label="Année de fondation" prop="foundationYear" required>
                <el-select v-model="formData.foundationYear" placeholder="Sélectionner l'année" class="full-width" filterable>
                  <el-option
                    v-for="year in foundationYears"
                    :key="year"
                    :label="year"
                    :value="year"
                  />
                </el-select>
              </el-form-item>
            </el-col>
          </el-row>

          <el-row :gutter="20">
            <el-col :xs="24" :md="12">
              <el-form-item label="Téléphone" prop="phone">
                <el-input v-model="formData.phone" placeholder="Numéro de téléphone" />
              </el-form-item>
            </el-col>
            <el-col :xs="24" :md="12">
              <el-form-item label="Email" prop="email">
                <el-input v-model="formData.email" placeholder="Adresse e-mail" />
              </el-form-item>
            </el-col>
          </el-row>
        </el-col>
      </el-row>
    </el-form>

    <template #actions>
      <el-button
        type="info"
        @click="goBack"
        class="action-button">
        Retourner
      </el-button>
      <el-button
        type="primary"
        @click="goNext"
        :loading="isSaving"
        class="action-button">
        Continuer
      </el-button>
    </template>
  </wizard-view-base>
</template>

<style scoped>
.general-info-container {
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  height: calc(100vh - 150px);
  max-height: 700px;
  overflow: hidden;
  background-color: #f5f7fa;
}

.info-text {
  text-align: center;
  margin-bottom: 15px;
  display: block;
  width: 100%;
  flex-shrink: 0; /* Ne pas réduire cet élément */
}

.title-warning {
    font-family: 'cursive', sans-serif; /* Attention: 'cursive' est très générique, préférez une police spécifique */
    font-size: 1.1em;
}

.form-scroll-area {
  width: 100%;
  max-width: 900px;
  flex: 1;
  min-height: 0;
  margin-bottom: 15px;
  overflow-y: auto;
  background-color: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

.general-info-form {
  width: 100%;
  padding: 25px;
  box-sizing: border-box;
  height: calc(100vh - 200px);
  overflow-y: auto;
  margin-bottom: 20px;
}

.el-row {
  margin-bottom: 20px;
  background-color: #fff;
  border-radius: 4px;
  padding: 15px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.full-width {
  width: 100%;
}

/* --- Styles Logo --- */
.logo-column {
    display: flex;
    flex-direction: column;
    align-items: center;
    /* justify-content: flex-start; -- S'assurer qu'il commence en haut si la colonne est plus haute */
    padding-top: 0; /* S'assurer que le label est aligné en haut */
}

/* Cibler spécifiquement le el-form-item du logo pour aligner son contenu */
.logo-column > .el-form-item {
  width: 100%; /* S'assurer que el-form-item prend la largeur pour centrer son contenu */
  display: flex;
  flex-direction: column;
  align-items: center; /* Centre le contenu du form-item (label + upload-area) */
}

/* Zone de téléchargement du logo */
.logo-upload-area {
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  max-width: 200px;
  border: 2px dashed var(--el-border-color);
  border-radius: 8px;
  padding: 20px;
  box-sizing: border-box;
  transition: all 0.3s ease;
  background-color: #fafafa;
}

.logo-upload-area:hover {
  border-color: var(--el-color-primary);
  background-color: #f0f7ff;
}

/* Prévisualisation du logo */
.logo-preview {
  width: 150px;
  height: 150px;
  border-radius: 8px;
  background-color: #fff;
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
  margin-bottom: 20px;
  border: 1px solid var(--el-border-color-lighter);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.logo-preview .el-icon {
  font-size: 35px;
  color: #c0c4cc;
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.logo-actions {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 10px;
}

.hidden-input {
  display: none;
}

/* Boutons d'action */
.action-buttons {
  display: flex;
  flex-direction: row;
  justify-content: center;
  width: 100%;
  max-width: 900px;
  gap: 20px;
  padding: 20px 0;
  background-color: #fff;
  border-top: 1px solid #ebeef5;
  position: sticky;
  bottom: 0;
  z-index: 10;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.05);
}

.action-button {
  min-width: 160px;
  padding: 12px 24px;
  font-size: 1rem;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.action-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

/* Styles des éléments de formulaire */
:deep(.el-form-item) {
  margin-bottom: 22px;
}

:deep(.el-form-item__label) {
  font-weight: 600;
  color: #606266;
  padding-bottom: 4px;
  line-height: 1.4;
}

:deep(.el-input__wrapper),
:deep(.el-textarea__wrapper) {
  box-shadow: 0 0 0 1px #dcdfe6 inset;
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover),
:deep(.el-textarea__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

:deep(.el-select) {
  width: 100%;
}

/* --- Media Queries --- */
@media (min-width: 768px) { /* md et plus */
  .action-buttons {
    flex-direction: row-reverse;
    justify-content: center; /* Centre les boutons horizontalement en mode ligne */
    /* max-width: 600px; -- Peut être retiré si vous voulez que les boutons déterminent la largeur */
    gap: 20px;
    padding: 15px 20px; /* Ajuster le padding pour desktop */
  }

  .action-button {
    width: auto; /* Largeur basée sur le contenu */
    min-width: 140px;
    max-width: none; /* Retirer la limite mobile */
  }
}

/* --- El-Scrollbar Internals --- */
:deep(.el-scrollbar__wrap) {
  overflow-x: hidden;
}



:deep(.el-scrollbar__view) {
  height: 100%;
}
.general-info-form {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.general-info-form > .el-row {
  flex-shrink: 0;
}

/* Assure que les boutons restent en bas */
:deep(.wizard-view-base) {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
}

:deep(.wizard-view-base__content) {
  flex: 1;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

:deep(.wizard-view-base__actions) {
  flex-shrink: 0;
  padding: 20px;
  background: white;
  border-top: 1px solid #ebeef5;
  position: sticky;
  bottom: 0;
  z-index: 10;
}
</style>