<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { Icon } from '@iconify/vue'
import { ElMessage } from 'element-plus'

// Interfaces
interface FileInfo {
  id?: number
  path: string
  originalName: string
}

interface SchoolInfo {
  id?: number
  name: string
  address: string
  phoneNumber: string
  email: string
  type: 'publique' | 'privée'
  foundationYear: number
  logo?: FileInfo | null
  logoFile?: File | null
}

// État initial avec valeurs par défaut
const initialSchoolInfo: SchoolInfo = {
  id: undefined,
  name: '',
  address: '',
  phoneNumber: '',
  email: '',
  type: 'publique',
  foundationYear: new Date().getFullYear(),
  logo: null,
  logoFile: null
}

// États
const schoolInfo = ref<SchoolInfo>({ ...initialSchoolInfo })
const previousData = ref<SchoolInfo | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const logoPreview = ref<string>('')
const isLoading = ref(false)
const isSaving = ref(false)
const hasChanges = ref(false)

// Années pour le sélecteur
const foundationYears = Array.from(
  { length: 100 }, 
  (_, i) => new Date().getFullYear() - i
)

// Surveiller les changements
watch(schoolInfo, () => {
  hasChanges.value = true
}, { deep: true })

// Validation
const validateForm = (): boolean => {
  const { name, address, phoneNumber, email } = schoolInfo.value

  if (!name?.trim()) {
    ElMessage.error('Le nom de l\'école est obligatoire')
    return false
  }

  if (!address?.trim()) {
    ElMessage.error('L\'adresse est obligatoire')
    return false
  }

  const phoneRegex = /^[+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}$/
  if (!phoneNumber || !phoneRegex.test(phoneNumber)) {
    ElMessage.error('Numéro de téléphone invalide')
    return false
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!email || !emailRegex.test(email)) {
    ElMessage.error('Adresse email invalide')
    return false
  }

  return true
}

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
  if (!validateForm()) return

  try {
    isSaving.value = true
    previousData.value = { ...schoolInfo.value }

    let payload: any = {
      data: {
        id: schoolInfo.value.id,
        name: schoolInfo.value.name.trim(),
        address: schoolInfo.value.address.trim(),
        phoneNumber: schoolInfo.value.phoneNumber.trim(),
        email: schoolInfo.value.email.trim(),
        type: schoolInfo.value.type,
        foundationYear: schoolInfo.value.foundationYear,
        logo: schoolInfo.value.logo?.id
      }
    }

    const logoFile = schoolInfo.value.logoFile
    if (logoFile && logoFile instanceof Blob) {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          const base64Content = result.split(',')[1]
          resolve(base64Content)
        }
        reader.onerror = reject
        reader.readAsDataURL(logoFile)
      })
      
      payload.logo = {
        content: base64,
        name: logoFile.name,
        type: logoFile.type
      }
    }

    const result = await window.ipcRenderer.invoke('school:save', payload)
    console.log("informations reçues :",result )
    
    if (result.success && result.data) {
      const { logo, ...otherData } = result.data
      
      // Mettre à jour les informations de l'école
      schoolInfo.value = {
        ...otherData,
        logo: logo || null,
        logoFile: null
      }
      
      // Mettre à jour la prévisualisation du logo
      if (logo?.content) {
        // Créer une URL de données à partir du contenu base64
        logoPreview.value = `data:${logo.type};base64,${logo.content}`
      } else {
        logoPreview.value = ''
      }
      
      hasChanges.value = false
      ElMessage.success(result.message || 'Informations sauvegardées avec succès')
    } else {
      throw new Error(result.message || 'Erreur de sauvegarde')
    }
  } catch (error) {
    console.error('Erreur sauvegarde:', error)
    if (previousData.value) {
      schoolInfo.value = { ...previousData.value }
    }
    ElMessage.error('Impossible de sauvegarder les informations')
  } finally {
    isSaving.value = false
  }
}
// Chargement initial
const loadSchoolInfo = async () => {
  try {
    isLoading.value = true
    console.log('Chargement des données...')
    
    const result = await window.ipcRenderer.invoke('school:get')
    console.log('Données reçues:', result)
    
    if (result.success && result.data) {
      const { logo, ...otherData } = result.data
      
      // Vérifier si les données sont vides
      const isDataEmpty = !otherData.name && !otherData.address && !otherData.email;
      
      if (!isDataEmpty) {
        schoolInfo.value = {
          ...initialSchoolInfo,
          ...otherData,
          logo: logo || null,
          logoFile: null
        }

        if (schoolInfo.value.logo?.path) {
          logoPreview.value = await window.ipcRenderer.invoke('file:getUrl', schoolInfo.value.logo.path)
        }
      }
      
      // Sauvegarder une copie des données initiales
      previousData.value = { ...schoolInfo.value }
      hasChanges.value = false
    }
  } catch (error) {
    console.error('Erreur chargement:', error)
    ElMessage.error('Impossible de charger les données')
  } finally {
    isLoading.value = false
  }
}

onMounted(loadSchoolInfo)
</script>
<template>
  <div class="school-info-container">
    <el-card v-loading="isLoading" shadow="hover" class="school-info-card">
      <template #header>
        <div class="card-header">
          <Icon 
            icon="mdi:school" 
            width="24" 
            height="24" 
            color="#32CD32" 
            class="card-icon"
          />
          <span class="card-title">Configuration de l'École</span>
        </div>
      </template>

      <el-form 
        v-if="!isLoading"
        :model="schoolInfo" 
        label-position="top" 
        class="school-info-form"
        :label-width="'120px'"
      >
        <!-- Logo et informations principales -->
        <div class="form-section">
          <el-row :gutter="20">
            <!-- Logo Section -->
            <el-col :xs="24" :sm="8">
              <el-form-item label="Logo de l'École">
                <div class="logo-container">
                  <div 
                    class="logo-preview" 
                    :class="{ 'has-logo': logoPreview }"
                  >
                    <img 
                      v-if="logoPreview" 
                      :src="logoPreview" 
                      alt="Logo de l'école"
                      class="logo-image" 
                    />
                    <Icon 
                      v-else 
                      icon="mdi:image-outline" 
                      width="40" 
                      height="40" 
                      color="#32CD32" 
                    />
                  </div>
                  
                  <div class="logo-actions">
                    <input
                      ref="fileInput"
                      type="file"
                      accept="image/*"
                      class="hidden-input"
                      @change="handleLogoChange"
                    />
                    <el-button 
                      type="primary" 
                      @click="fileInput?.click()"
                      size="small"
                    >
                      <template #icon>
                        <Icon 
                          icon="mdi:image-plus" 
                          width="16" 
                          height="16" 
                        />
                      </template>
                      {{ logoPreview ? 'Modifier' : 'Ajouter' }}
                    </el-button>
                    <el-button 
                      v-if="logoPreview"
                      type="danger" 
                      @click="removeLogo"
                      size="small"
                    >
                      <template #icon>
                        <Icon 
                          icon="mdi:delete" 
                          width="16" 
                          height="16" 
                        />
                      </template>
                      Supprimer
                    </el-button>
                  </div>
                </div>
              </el-form-item>
            </el-col>

            <!-- Informations principales à droite du logo -->
            <el-col :xs="24" :sm="16">
              <el-row :gutter="20">
                <el-col :span="24">
                  <el-form-item label="Nom de l'École" required>
                    <el-input 
                      v-model="schoolInfo.name" 
                      placeholder="Nom de l'établissement"
                    >
                      <template #prefix>
                        <Icon 
                          icon="mdi:school" 
                          width="20" 
                          height="20" 
                          color="#32CD32" 
                        />
                      </template>
                    </el-input>
                  </el-form-item>
                </el-col>
                <el-col :span="24">
                  <el-form-item label="Type d'École" required>
                    <el-select 
                      v-model="schoolInfo.type" 
                      class="full-width"
                    >
                      <el-option label="Publique" value="publique" />
                      <el-option label="Privée" value="privée" />
                    </el-select>
                  </el-form-item>
                </el-col>
              </el-row>
            </el-col>
          </el-row>
        </div>

        <!-- Autres informations -->
        <div class="form-section">
          <el-row :gutter="20">
            <el-col :xs="24" :sm="12">
              <el-form-item label="Adresse" required>
                <el-input 
                  v-model="schoolInfo.address" 
                  type="textarea"
                  :rows="2"
                  placeholder="Adresse complète"
                >
                  <template #prefix>
                    <Icon 
                      icon="mdi:map-marker" 
                      width="20" 
                      height="20" 
                      color="#32CD32" 
                    />
                  </template>
                </el-input>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="Année de Fondation" required>
                <el-select 
                  v-model="schoolInfo.foundationYear" 
                  class="full-width"
                  filterable
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
            <el-col :xs="24" :sm="12">
              <el-form-item label="Téléphone" required>
                <el-input 
                  v-model="schoolInfo.phoneNumber" 
                  placeholder="+XXX XXX XXXX"
                >
                  <template #prefix>
                    <Icon 
                      icon="mdi:phone" 
                      width="20" 
                      height="20" 
                      color="#32CD32" 
                    />
                  </template>
                </el-input>
              </el-form-item>
            </el-col>
            <el-col :xs="24" :sm="12">
              <el-form-item label="Email" required>
                <el-input 
                  v-model="schoolInfo.email" 
                  placeholder="contact@ecole.fr"
                >
                  <template #prefix>
                    <Icon 
                      icon="mdi:email" 
                      width="20" 
                      height="20" 
                      color="#32CD32" 
                    />
                  </template>
                </el-input>
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- Actions -->
        <div class="form-actions">
          <el-button 
            type="primary" 
            :loading="isSaving"
            @click="saveSchoolInfo"
          >
            {{ isSaving ? 'Sauvegarde en cours...' : 'Sauvegarder' }}
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<style scoped>
.school-info-container {
  max-width: 900px;
  margin: 2rem auto;
  padding: 0 1rem;
  min-height: calc(100vh - 4rem);
  display: flex;
  flex-direction: column;
}



.school-info-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-height: 500px; /* Hauteur minimale pour assurer l'espace */
}

.form-section {
  margin-bottom: 1.5rem;
}

.form-actions {
  margin-top: auto;
  padding-top: 1rem;
  border-top: 1px solid #ebeef5;
  text-align: right;
}

.full-width {
  width: 100%;
}

.logo-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.logo-preview {
  width: 120px; /* Réduit la taille du logo */
  height: 120px;
  border: 2px dashed #dcdfe6;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f7fa;
  overflow: hidden;
  transition: all 0.3s ease;
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

.logo-actions {
  display: flex;
  gap: 0.5rem;
}

.card-icon {
  margin-right: 12px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0.5rem 0;
}

.card-title {
  font-size: 1rem;
  font-weight: 600;
  text-align: center;
}

.hidden-input {
  display: none;
}

:deep(.el-form-item__label) {
  font-weight: 500;
}

:deep(.el-input__wrapper),
:deep(.el-select),
:deep(.el-textarea__inner) {
  box-shadow: none;
  border: 1px solid #dcdfe6;
  transition: all 0.3s ease;
}

:deep(.el-button) {
  padding: 8px 16px;
  font-weight: 500;
}

@media (max-width: 768px) {
  .school-info-container {
    margin: 1rem auto;
    padding: 0 0.5rem;
  }
  

  
  .form-actions {
    padding: 1rem 0.5rem;
  }
  
  .logo-preview {
    width: 100px;
    height: 100px;
  }
}
</style>