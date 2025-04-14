<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { ISchoolData, ISchoolServiceParams } from '@/types/school'
import { IFileUpload } from '@/types/file'

// Constantes pour les pays
const countries = [
  { code: 'MAR', name: 'Maroc', currency: 'MAD' },
  { code: 'SEN', name: 'Sénégal', currency: 'FCFA' },
  { code: 'CAF', name: 'Centrafrique', currency: 'FCFA' },
  { code: 'GIN', name: 'Guinée', currency: 'GNF' }
];

// État initial avec valeurs par défaut
const initialSchoolInfo: ISchoolData = {
  id: undefined,
  name: '',
  address: '',
  town: '',
  country: 'SEN',
  phone: '',
  email: '',
  type: 'publique',
  foundationYear: new Date().getFullYear(),
  logo: null
};

// États
const schoolInfo = ref<ISchoolData>({ ...initialSchoolInfo })
const fileInput = ref<HTMLInputElement | null>(null)
const logoPreview = ref<string>('')
const isLoading = ref(false)
const isSaving = ref(false)
const hasChanges = ref(false)
const isEditMode = ref(false)

// Années pour le sélecteur
const foundationYears = Array.from(
  { length: 100 }, 
  (_, i) => new Date().getFullYear() - i
)



// Surveiller les changements
watch(schoolInfo, () => {
  hasChanges.value = true
}, { deep: true })

// Gestion du logo
const handleLogoChange = async (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) return

  if (!file.type.startsWith('image/')) {
    ElMessage.error('Veuillez sélectionner une image valide')
    return
  }

  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('L\'image ne doit pas dépasser 5MB')
    return
  }

  // Stocker le fichier pour l'envoi ultérieur
  schoolInfo.value.logoFile = file
  logoPreview.value = URL.createObjectURL(file)
  hasChanges.value = true
}

const removeLogo = () => {
  schoolInfo.value.logo = null
  schoolInfo.value.logoFile = null
  logoPreview.value = ''
  if (fileInput.value) {
    fileInput.value.value = ''
  }
  hasChanges.value = true
}

// Sauvegarde
const saveSchoolInfo = async () => {
  try {
    isSaving.value = true;

    // Préparer les données à envoyer
    const payload: ISchoolServiceParams['saveOrUpdateSchool'] = {
      name: schoolInfo.value.name,
      address: schoolInfo.value.address,
      town: schoolInfo.value.town,
      country: schoolInfo.value.country,
      phone: schoolInfo.value.phone,
      email: schoolInfo.value.email,
      type: schoolInfo.value.type,
      foundationYear: schoolInfo.value.foundationYear,
      logo: undefined
    };

    // Gérer le logo séparément si un nouveau fichier a été sélectionné
    if (schoolInfo.value.logoFile) {
      const reader = new FileReader();
      const file = schoolInfo.value.logoFile;
      
      const logoData = await new Promise<IFileUpload>((resolve) => {
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

    // Envoyer directement le payload sans l'envelopper dans un objet data
    const result = await window.ipcRenderer.invoke('school:save', payload);
    console.log(result);

    if (result.success) {
      ElMessage.success('Informations sauvegardées avec succès');
      isEditMode.value = false;
      await loadSchoolInfo(); // Recharger les données
    } else {
      throw new Error(result.message || 'Erreur lors de la sauvegarde');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error('Erreur lors de la sauvegarde');
  } finally {
    isSaving.value = false;
  }
};

// Ajout de la méthode loadLogo similaire à loadPhoto dans StudentDetailsView
const loadLogo = async (logo?: { id: number; name: string; type: string; path?: string; content?: string }) => {
  if (!logo) {
    logoPreview.value = '';
    return;
  }

  try {
    const logoResult = await window.ipcRenderer.invoke('school:getLogo', logo.id);
    console.log("Résultat du chargement du logo:", logoResult);
    
    if (logoResult.success && logoResult.data) {
      // Vérifier si le contenu est déjà en base64 ou s'il faut le convertir
      if (logoResult.data.content) {
        logoPreview.value = `data:${logoResult.data.type};base64,${logoResult.data.content}`;
      } else {
        console.error("Le contenu du logo est manquant");
        logoPreview.value = '';
      }
    } else {
      console.error("Erreur lors du chargement du logo:", logoResult.error);
      logoPreview.value = '';
    }
  } catch (error) {
    console.error("Erreur lors du chargement du logo:", error);
    logoPreview.value = '';
  }
};

// Modifier loadSchoolInfo pour utiliser loadLogo
const loadSchoolInfo = async () => {
  try {
    isLoading.value = true;
    const result = await window.ipcRenderer.invoke('school:get');
    console.log(result);
    if (result?.success && result.data) {
      schoolInfo.value = {
        ...initialSchoolInfo,
        ...result.data
      };
      
      // Charger le logo si présent
      if (schoolInfo.value.logo?.id) {
        await loadLogo(schoolInfo.value.logo);
      }
    } else {
      ElMessage.warning('Aucune information d\'école trouvée');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error('Erreur lors du chargement des informations');
  } finally {
    isLoading.value = false;
  }
};

const toggleEditMode = async () => {
  try {
    if (isEditMode.value) {
      await saveSchoolInfo();
      isEditMode.value = false;
    } else {
      isEditMode.value = true;
    }
  } catch (error) {
    console.error('Erreur lors du basculement du mode édition:', error);
    ElMessage.error('Une erreur est survenue');
  }
};

const triggerFileInput = () => {
  fileInput.value?.click();
};

onMounted(loadSchoolInfo)
</script>
<template>
  <div class="school-info-container">
    <el-card class="school-info-card">
      <template #header>
        <div class="card-header">
          <div class="card-title">
            <el-icon class="card-icon"><School /></el-icon>
            Informations de l'école
          </div>
          <el-button
            type="primary"
            @click="toggleEditMode"
            class="edit-button"
          >
            {{ isEditMode ? 'Enregistrer' : 'Modifier' }}
          </el-button>
        </div>
      </template>

      <el-form
        ref="formRef"
        :model="schoolInfo"
        label-position="top"
        class="school-info-form"
      >
        <el-row :gutter="20">
          <!-- Colonne de gauche avec le logo -->
          <el-col :span="8">
            <div class="logo-container">
              <div 
                class="logo-preview" 
                :class="{ 'has-logo': logoPreview }"
              >
                <el-image 
                  v-if="logoPreview" 
                  :src="logoPreview" 
                  fit="cover" 
                  class="logo-image" 
                  :preview-src-list="logoPreview ? [logoPreview] : []"
                  @error="(e: any) => {
                    console.error('Erreur de chargement de l\'image:', e);
                    console.log('URL de l\'image:', logoPreview);
                  }"
                >
                  <template #error>
                    <div class="image-slot">
                      <el-icon><i-mdi-image-broken /></el-icon>
                      <span>Erreur de chargement</span>
                      <small>{{ logoPreview ? 'URL invalide' : 'Pas d\'URL' }}</small>
                    </div>
                  </template>
                </el-image>
                <el-icon v-else><Picture /></el-icon>
              </div>

              <div class="logo-actions" v-if="isEditMode">
                <el-button 
                  type="primary" 
                  size="small"
                  @click="triggerFileInput"
                >
                  {{ logoPreview ? 'Changer' : 'Ajouter' }}
                </el-button>
                <el-button 
                  v-if="logoPreview || schoolInfo.logo" 
                  type="danger"
                  size="small"
                  @click="removeLogo"
                >
                  Supprimer
                </el-button>
              </div>
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                class="hidden-input"
                @change="handleLogoChange"
              >
            </div>
          </el-col>

          <!-- Colonne de droite avec les informations -->
          <el-col :span="16">
            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="Nom de l'école" required>
                  <el-input
                    v-model="schoolInfo.name"
                    :disabled="!isEditMode"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="Type d'établissement">
                  <el-select 
                    v-model="schoolInfo.type"
                    :disabled="!isEditMode"
                    class="full-width"
                  >
                    <el-option label="Public" value="publique" />
                    <el-option label="Privé" value="privée" />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="20">
              <el-col :span="12">
                <el-form-item label="Adresse" required>
                  <el-input
                    v-model="schoolInfo.address"
                    type="textarea"
                    :rows="2"
                    :disabled="!isEditMode"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="Ville" required>
                  <el-input
                    v-model="schoolInfo.town"
                    :disabled="!isEditMode"
                  />
                </el-form-item>
              </el-col>
            </el-row>

            <el-row :gutter="20">
              <el-col :span="8">
                <el-form-item label="Téléphone" required>
                  <el-input
                    v-model="schoolInfo.phone"
                    :disabled="!isEditMode"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="Email" required>
                  <el-input
                    v-model="schoolInfo.email"
                    :disabled="!isEditMode"
                  />
                </el-form-item>
              </el-col>
              <el-col :span="8">
                <el-form-item label="Année de fondation">
                  <el-select
                    v-model="schoolInfo.foundationYear"
                    :disabled="!isEditMode"
                    class="full-width"
                  >
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
              <el-col :span="12">
                <el-form-item label="Pays" required>
                  <el-select 
                    v-model="schoolInfo.country"
                    :disabled="!isEditMode"
                    class="full-width"
                  >
                    <el-option
                      v-for="country in countries"
                      :key="country.code"
                      :label="`${country.name} (${country.currency})`"
                      :value="country.code"
                    />
                  </el-select>
                </el-form-item>
              </el-col>
            </el-row>
          </el-col>
        </el-row>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.school-info-container {
  padding: 20px;
  height: 100%;
}

.school-info-card {
  height: calc(100vh - 100px);
  display: flex;
  flex-direction: column;
}

.school-info-form {
  height: 100%;
  padding: 20px;
}

.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.logo-preview {
  width: 150px;
  height: 150px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  overflow: hidden;
}

.logo-preview.has-logo {
  border-style: solid;
  border-color: #409EFF;
}

.logo-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 15px 20px;
}

.card-title {
  display: flex;
  align-items: center;
  font-size: 16px;
  font-weight: 600;
}

.hidden-input {
  display: none;
}

.full-width {
  width: 100%;
}

@media (max-width: 768px) {
  .school-info-container {
    padding: 10px;
  }
  
  .logo-preview {
    width: 120px;
    height: 120px;
  }
}
</style>