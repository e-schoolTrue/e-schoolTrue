<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';

// États pour l'activation
const licenseCode = ref('');
const isLoading = ref(false);
const showActivationDialog = ref(false);

// États pour la gestion de licence
const licenseStatus = ref<any>(null);
const licenseDetails = ref<any>(null);
const isLoadingStatus = ref(true);
const isGenerating = ref(false);
const showGeneratedCode = ref(false);
const generatedLicenseCode = ref('');

// Propriétés calculées
const isLicenseValid = computed(() => licenseStatus.value?.isValid);
const daysRemaining = computed(() => {
  if (!licenseStatus.value?.expiryDate) return null;
  const expiry = new Date(licenseStatus.value.expiryDate);
  const now = new Date();
  const diffTime = expiry.getTime() - now.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
});
const statusColor = computed(() => {
  if (!isLicenseValid.value) return 'danger';
  if (daysRemaining.value !== null && daysRemaining.value < 30) return 'warning';
  return 'success';
});

// Charger le statut de la licence
async function loadLicenseStatus() {
  isLoadingStatus.value = true;
  try {
    const statusResult = await window.ipcRenderer.invoke('license:isValid');
    if (statusResult.success) {
      licenseStatus.value = statusResult.data;
    }

    // Charger les détails de la licence si elle est valide
    if (licenseStatus.value?.isValid) {
      const detailsResult = await window.ipcRenderer.invoke('license:getDetails');
      if (detailsResult.success) {
        licenseDetails.value = detailsResult.data;
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement du statut de la licence:', error);
  } finally {
    isLoadingStatus.value = false;
  }
}

// Ouvrir la dialog d'activation
function openActivationDialog() {
  showActivationDialog.value = true;
  licenseCode.value = '';
}

// Fermer la dialog d'activation
function closeActivationDialog() {
  showActivationDialog.value = false;
  licenseCode.value = '';
}

// Activer une licence
async function activateLicense() {
  if (!licenseCode.value.trim()) {
    ElMessage.error('Veuillez entrer un code de licence.');
    return;
  }
  isLoading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('license:activate', licenseCode.value.trim());
    if (result.success) {
      ElMessage.success('Licence activée avec succès !');
      closeActivationDialog();
      await loadLicenseStatus();
    } else {
      ElMessageBox.alert(
        result.message || 'Échec de l\'activation de la licence. Veuillez vérifier le code et réessayer.',
        'Erreur d\'activation',
        { confirmButtonText: 'OK', type: 'error' }
      );
    }
  } catch (error: any) {
    console.error('Erreur lors de l\'activation de la licence:', error);
    ElMessageBox.alert(
      error.message || 'Une erreur inattendue est survenue.',
      'Erreur critique',
      { confirmButtonText: 'OK', type: 'error' }
    );
  } finally {
    isLoading.value = false;
  }
}

// Générer une sous-licence
async function generateSubLicense() {
  try {
    await ElMessageBox.confirm(
      'Êtes-vous sûr de vouloir générer une nouvelle sous-licence ? Cette action utilisera un de vos postes disponibles.',
      'Générer une sous-licence',
      {
        confirmButtonText: 'Générer',
        cancelButtonText: 'Annuler',
        type: 'info',
      }
    );

    isGenerating.value = true;
    const result = await window.ipcRenderer.invoke('license:generateSub');
    
    if (result.success) {
      generatedLicenseCode.value = result.data.subLicenseCode;
      showGeneratedCode.value = true;
      await loadLicenseStatus();
      ElMessage.success('Sous-licence générée avec succès !');
    } else {
      ElMessage.error(result.error || 'Erreur lors de la génération de la sous-licence.');
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('Erreur lors de la génération de la sous-licence:', error);
      ElMessage.error('Une erreur inattendue est survenue.');
    }
  } finally {
    isGenerating.value = false;
  }
}

// Copier le code généré
async function copyGeneratedCode() {
  try {
    await navigator.clipboard.writeText(generatedLicenseCode.value);
    ElMessage.success('Code copié dans le presse-papiers !');
  } catch (error) {
    console.error('Erreur lors de la copie:', error);
    ElMessage.error('Impossible de copier le code.');
  }
}

// Fermer la boîte de dialogue
function closeGeneratedCodeDialog() {
  showGeneratedCode.value = false;
  generatedLicenseCode.value = '';
}

function handleInput(value: string) {
  licenseCode.value = value.toUpperCase();
}

onMounted(() => {
  loadLicenseStatus();
});
</script>

<template>
  <div class="license-status-view">
    <div class="license-container">
      <!-- En-tête avec bouton d'activation -->
      <div class="license-header">
        <Icon icon="mdi:key" class="header-icon" :width="40" :height="40" />
        <h1>Gestion des Licences</h1>
        <div class="header-actions">
          <el-button 
            type="primary" 
            @click="openActivationDialog"
            :icon="Icon"
            class="activation-button"
          >
            <Icon icon="mdi:key-plus" :width="16" :height="16" class="mr-2" />
            {{ isLicenseValid ? 'Changer de Licence' : 'Activer une Licence' }}
          </el-button>
        </div>
      </div>

      <!-- Contenu -->
      <div v-if="!isLoadingStatus" class="license-content">
        <!-- Alerte si pas de licence -->
        <el-alert 
          v-if="!isLicenseValid"
          title="Licence requise"
          description="Vous devez activer une licence pour utiliser pleinement cette application."
          type="warning"
          show-icon
          :closable="false"
          class="mb-4"
        />

        <!-- Statut et informations de la licence -->
        <el-card v-if="isLicenseValid" class="status-card">
          <template #header>
            <div class="card-header">
              <Icon icon="mdi:information" :width="20" :height="20" />
              <span>Statut de la Licence</span>
            </div>
          </template>
          
          <div class="status-content">
            <el-row :gutter="20">
              <el-col :span="12">
                <div class="status-item">
                  <el-tag :type="statusColor" size="large">
                    {{ isLicenseValid ? 'ACTIVE' : 'INACTIVE' }}
                  </el-tag>
                </div>
              </el-col>
              <el-col :span="12">
                <div class="status-item" v-if="daysRemaining !== null">
                  <Icon icon="mdi:calendar" :width="20" :height="20" />
                  <span>{{ daysRemaining }} jours restants</span>
                </div>
              </el-col>
            </el-row>

            <!-- Informations détaillées -->
            <div class="license-info" v-if="licenseStatus">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="Code de licence">
                  {{ licenseStatus.licenseCode || 'N/A' }}
                </el-descriptions-item>
                <el-descriptions-item label="Type">
                  {{ licenseStatus.licenseType || 'Standard' }}
                </el-descriptions-item>
                <el-descriptions-item label="Date d'expiration">
                  {{ licenseStatus.expiryDate ? new Date(licenseStatus.expiryDate).toLocaleDateString('fr-FR') : 'N/A' }}
                </el-descriptions-item>
                <el-descriptions-item label="Machine ID">
                  {{ licenseStatus.machineId || 'N/A' }}
                </el-descriptions-item>
              </el-descriptions>
            </div>

            <!-- Gestion des quotas et sous-licences -->
            <div v-if="licenseDetails" class="quota-section">
              <h3>
                <Icon icon="mdi:desktop-classic" :width="20" :height="20" />
                Postes Autorisés
              </h3>
              <div class="quota-display">
                <el-progress 
                  :percentage="(licenseDetails.usedActivations / licenseDetails.maxActivations) * 100"
                  :format="() => `${licenseDetails.usedActivations} / ${licenseDetails.maxActivations}`"
                  :status="licenseDetails.usedActivations >= licenseDetails.maxActivations ? 'exception' : 'success'"
                />
                <p class="quota-text">
                  {{ licenseDetails.usedActivations }} postes utilisés sur {{ licenseDetails.maxActivations }} autorisés
                </p>
              </div>

              <el-button 
                v-if="licenseDetails.usedActivations < licenseDetails.maxActivations"
                type="primary" 
                @click="generateSubLicense"
                :loading="isGenerating"
                class="generate-button"
              >
                <Icon icon="mdi:plus" :width="16" :height="16" class="mr-2" />
                Générer une licence pour un autre ordinateur
              </el-button>
              <el-alert 
                v-else
                title="Quota épuisé"
                description="Vous avez utilisé tous vos postes autorisés. Contactez votre fournisseur pour augmenter votre quota."
                type="warning"
                show-icon
                :closable="false"
              />
            </div>
          </div>
        </el-card>
      </div>

      <!-- Chargement -->
      <div v-else class="loading-container">
        <el-skeleton :rows="4" animated />
      </div>
    </div>

    <!-- Dialog d'activation de licence -->
    <el-dialog
      v-model="showActivationDialog"
      :title="isLicenseValid ? 'Changer de Licence' : 'Activer une Licence'"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="activation-dialog">
        <div class="dialog-icon">
          <Icon icon="mdi:key-variant" :width="48" :height="48" />
        </div>
        
        <p class="dialog-description">
          {{ isLicenseValid 
            ? 'Entrez un nouveau code de licence pour remplacer l\'actuelle.' 
            : 'Entrez votre code de licence pour activer l\'application.' 
          }}
        </p>
        
        <el-form @submit.prevent="activateLicense">
          <el-form-item>
            <el-input
              v-model="licenseCode"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              :disabled="isLoading"
              maxlength="19"
              class="license-input"
              @input="handleInput"
              size="large"
            >
              <template #prefix>
                <Icon icon="mdi:key" :width="16" :height="16" />
              </template>
            </el-input>
            <p class="input-hint">Format: XXXX-XXXX-XXXX-XXXX</p>
          </el-form-item>
        </el-form>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeActivationDialog" :disabled="isLoading">
            <Icon icon="mdi:close" :width="16" :height="16" class="mr-2" />
            Annuler
          </el-button>
          <el-button
            type="primary"
            @click="activateLicense"
            :loading="isLoading"
          >
            <Icon v-if="!isLoading" icon="mdi:check" :width="16" :height="16" class="mr-2" />
            {{ isLoading ? 'Activation en cours...' : 'Activer' }}
          </el-button>
        </div>
      </template>
    </el-dialog>

    <!-- Dialog code généré -->
    <el-dialog
      v-model="showGeneratedCode"
      title="Licence générée avec succès !"
      width="600px"
      :close-on-click-modal="false"
    >
      <div class="generated-code-dialog">
        <el-alert
          title="Nouvelle sous-licence créée"
          type="success"
          show-icon
          :closable="false"
          class="mb-4"
        />
        
        <p class="instruction">
          <Icon icon="mdi:account-multiple" :width="20" :height="20" class="mr-2" />
          Donnez ce code à votre collègue pour qu'il active le logiciel sur son ordinateur :
        </p>
        
        <div class="code-display">
          <el-input
            :value="generatedLicenseCode"
            readonly
            size="large"
            class="generated-code-input"
          >
            <template #append>
              <el-button @click="copyGeneratedCode" type="primary">
                <Icon icon="mdi:content-copy" :width="16" :height="16" class="mr-1" />
                Copier
              </el-button>
            </template>
          </el-input>
        </div>
        
        <el-alert
          title="Important"
          description="Ce code ne peut être utilisé qu'une seule fois. Assurez-vous de le transmettre correctement à la personne concernée."
          type="info"
          show-icon
          :closable="false"
          class="mt-4"
        />
      </div>
      
      <template #footer>
        <el-button @click="closeGeneratedCodeDialog" type="primary">
          <Icon icon="mdi:close" :width="16" :height="16" class="mr-2" />
          Fermer
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.license-status-view {
  padding: 2rem;
  max-width: 1000px;
  margin: 0 auto;
}

.license-container {
  width: 100%;
}

.license-header {
  text-align: center;
  margin-bottom: 2rem;
  position: relative;
}

.header-icon {
  color: #409EFF;
  background: rgba(64, 158, 255, 0.1);
  padding: 12px;
  border-radius: 12px;
  margin-bottom: 1rem;
}

.license-header h1 {
  font-size: 1.75rem;
  color: #2c3e50;
  margin: 0 0 1rem 0;
  font-weight: 600;
}

.header-actions {
  display: flex;
  justify-content: center;
  gap: 1rem;
}

.activation-button {
  height: 42px;
  font-size: 1rem;
  font-weight: 500;
  display: flex;
  align-items: center;
}

.status-card {
  margin-bottom: 1.5rem;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-weight: 600;
}

.status-content {
  padding: 0;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.license-info {
  margin: 1.5rem 0;
}

.quota-section {
  margin-top: 2rem;
  padding: 1.5rem;
  background: #f8f9fa;
  border-radius: 8px;
}

.quota-section h3 {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin: 0 0 1rem 0;
  color: #2c3e50;
}

.quota-display {
  margin-bottom: 1.5rem;
}

.quota-text {
  text-align: center;
  color: #666;
  margin: 0.5rem 0 0 0;
  font-size: 0.9rem;
}

.generate-button {
  width: 100%;
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.loading-container {
  padding: 2rem;
}

/* Styles pour les dialogs */
.activation-dialog {
  text-align: center;
  padding: 1rem 0;
}

.dialog-icon {
  color: #409EFF;
  margin-bottom: 1rem;
}

.dialog-description {
  color: #2c3e50;
  font-size: 1rem;
  margin-bottom: 1.5rem;
  line-height: 1.5;
}

.license-input {
  font-size: 1.125rem;
  letter-spacing: 1px;
}

.input-hint {
  color: #909399;
  font-size: 0.875rem;
  margin: 0.5rem 0 0 0;
  text-align: center;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 0.5rem;
}

.generated-code-dialog {
  text-align: center;
}

.instruction {
  color: #2c3e50;
  font-size: 1rem;
  margin-bottom: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
}

.code-display {
  margin: 1.5rem 0;
}

.generated-code-input {
  font-size: 1.25rem;
  font-weight: 600;
  letter-spacing: 2px;
}

/* Classes utilitaires */
.mb-4 { margin-bottom: 1rem; }
.mt-4 { margin-top: 1rem; }
.mr-1 { margin-right: 0.25rem; }
.mr-2 { margin-right: 0.5rem; }

/* Responsive */
@media (max-width: 768px) {
  .license-status-view {
    padding: 1rem;
  }

  .license-header h1 {
    font-size: 1.5rem;
  }

  .header-actions {
    flex-direction: column;
    align-items: center;
  }

  .activation-button {
    width: 100%;
    max-width: 280px;
  }

  .quota-section {
    padding: 1rem;
  }

  .generated-code-input {
    font-size: 1rem;
    letter-spacing: 1px;
  }

  .dialog-footer {
    flex-direction: column;
    gap: 0.5rem;
  }

  .dialog-footer .el-button {
    width: 100%;
  }
}

:deep(.el-input__wrapper) {
  padding: 0.75rem;
}

:deep(.el-input__prefix) {
  margin-right: 0.5rem;
}

:deep(.el-progress-bar__outer) {
  height: 12px;
}
</style> 