<script setup lang="ts">
import { ref, onMounted, computed } from "vue";
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';

/**
 * Statut de licence retourné par le canal IPC `license:getStatus`.
 */
interface LicenseStatus {
  isValid: boolean;
  machineId: string;
  licenseType: 'master' | 'sub' | null;
  customer: string | null;
  expiryDate: string | null;
  daysRemaining: number | null;
  stationIndex: number | null;
  maxStations: number | null;
  /** true si un retour arrière d'horloge a été détecté. */
  clockError?: boolean;
}

/**
 * Détails de licence retournés par le canal IPC `license:getDetails`.
 */
interface LicenseDetails {
  isValid: boolean;
  maxStations: number | null;
  usedStations: number | null;
  customer: string | null;
  licenseType: string | null;
  expiresAt: string | null;
}

/**
 * Réponse du canal IPC `license:getStatus`.
 */
interface GetStatusResponse {
  success: boolean;
  data?: LicenseStatus;
  error?: string;
}

/**
 * Réponse du canal IPC `license:getDetails`.
 */
interface GetDetailsResponse {
  success: boolean;
  data?: LicenseDetails;
  error?: string;
}

/**
 * Réponse des canaux IPC `license:activateMaster` / `license:activateSub`.
 */
interface ActivateResponse {
  success: boolean;
  message?: string;
}

/**
 * Réponse du canal IPC `license:generateSub`.
 */
interface GenerateSubResponse {
  success: boolean;
  /**
   * Paquet de sous-licence sur 2 lignes (à transmettre tel quel) :
   * ligne 1 = jeton `base64url(JSON).signatureHex`, ligne 2 = clé publique.
   * Aucune transformation (uppercase, regex, maxlength) ne doit être appliquée.
   */
  data?: { subLicenseCode: string };
  error?: string;
}

type LicenseType = 'master' | 'sub';

// États pour l'activation
const licenseCode = ref('');
const activationType = ref<LicenseType>('master');
const isLoading = ref(false);
const showActivationDialog = ref(false);

// États pour la gestion de licence
const licenseStatus = ref<LicenseStatus | null>(null);
const licenseDetails = ref<LicenseDetails | null>(null);
const isLoadingStatus = ref(true);
const isGenerating = ref(false);
const showGeneratedCode = ref(false);
const generatedLicenseCode = ref('');

// États pour la génération de sous-licence
const showGenerateSubDialog = ref(false);
const targetMachineId = ref('');

// Propriétés calculées
const isLicenseValid = computed<boolean>(() => licenseStatus.value?.isValid === true);

const daysRemaining = computed<number | null>(() => {
  const days = licenseStatus.value?.daysRemaining;
  return days === null || days === undefined ? null : Math.max(days, 0);
});

const statusColor = computed<'success' | 'warning' | 'danger'>(() => {
  if (!isLicenseValid.value) return 'danger';
  if (daysRemaining.value !== null && daysRemaining.value < 30) return 'warning';
  return 'success';
});

const licenseTypeLabel = computed<string>(() => {
  const type = licenseStatus.value?.licenseType;
  if (type === 'master') return 'Licence principale';
  if (type === 'sub') return 'Sous-licence (poste)';
  return 'Aucune';
});

// Un poste secondaire (sous-licence) ne peut pas générer de sous-licences :
// seule la licence principale (poste maître) peut le faire.
const isSubLicense = computed<boolean>(() => licenseStatus.value?.licenseType === 'sub');

// Informations sur les postes utilisés / disponibles (uniquement pour les licences principales)
const quotaInfo = computed<{ used: number; max: number; exhausted: boolean } | null>(() => {
  const details = licenseDetails.value;
  if (!details || details.maxStations === null || details.maxStations === undefined) return null;
  const used = details.usedStations ?? 0;
  return { used, max: details.maxStations, exhausted: used >= details.maxStations };
});

const quotaPercentage = computed<number>(() => {
  if (!quotaInfo.value) return 0;
  return Math.min(Math.round((quotaInfo.value.used / quotaInfo.value.max) * 100), 100);
});

const quotaStatus = computed<'success' | 'exception'>(() =>
  quotaInfo.value?.exhausted ? 'exception' : 'success'
);

function quotaFormat(): string {
  if (!quotaInfo.value) return '0 / 0';
  return `${quotaInfo.value.used} / ${quotaInfo.value.max}`;
}

// Charger le statut de la licence
async function loadLicenseStatus() {
  isLoadingStatus.value = true;
  try {
    const statusResult = await window.ipcRenderer.invoke('license:getStatus') as GetStatusResponse;
    if (statusResult.success && statusResult.data) {
      licenseStatus.value = statusResult.data;
    } else {
      console.error('Erreur de chargement du statut :', statusResult.error);
      ElMessage.error('Erreur lors du chargement du statut de la licence.');
    }

    // Charger les détails de la licence si elle est valide
    if (licenseStatus.value?.isValid) {
      const detailsResult = await window.ipcRenderer.invoke('license:getDetails') as GetDetailsResponse;
      if (detailsResult.success && detailsResult.data) {
        licenseDetails.value = detailsResult.data;
      } else {
        console.error('Erreur de chargement des détails :', detailsResult.error);
        ElMessage.error('Erreur lors du chargement des détails de la licence.');
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement du statut de la licence:', error);
    ElMessage.error('Erreur lors du chargement du statut de la licence.');
  } finally {
    isLoadingStatus.value = false;
  }
}

// Ouvrir la dialog d'activation
function openActivationDialog() {
  showActivationDialog.value = true;
  licenseCode.value = '';
  activationType.value = 'master';
}

// Fermer la dialog d'activation
function closeActivationDialog() {
  showActivationDialog.value = false;
  licenseCode.value = '';
}

// Activer une licence (principale ou sous-licence)
async function activateLicense() {
  // Le code est envoyé tel quel (seul un trim() est appliqué) : le jeton est un
  // base64url(JSON).signatureHex sensible à la casse, à ne jamais transformer.
  const code = licenseCode.value.trim();
  if (!code) {
    ElMessage.error('Veuillez entrer un code de licence.');
    return;
  }

  isLoading.value = true;
  try {
    const channel = activationType.value === 'master' ? 'license:activateMaster' : 'license:activateSub';
    const result = await window.ipcRenderer.invoke(channel, code) as ActivateResponse;

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
  } catch (error) {
    console.error('Erreur lors de l\'activation de la licence:', error);
    ElMessage.error('Une erreur inattendue est survenue lors de l\'activation de la licence.');
  } finally {
    isLoading.value = false;
  }
}

// Ouvrir la dialog de génération de sous-licence
function openGenerateSubDialog() {
  targetMachineId.value = '';
  showGenerateSubDialog.value = true;
}

// Fermer la dialog de génération de sous-licence
function closeGenerateSubDialog() {
  showGenerateSubDialog.value = false;
  targetMachineId.value = '';
}

// Générer une sous-licence
async function generateSubLicense() {
  isGenerating.value = true;
  try {
    // Identifiant machine cible (optionnel) : on passe undefined si vide
    const machineId = targetMachineId.value.trim();
    const result = await window.ipcRenderer.invoke('license:generateSub', machineId || undefined) as GenerateSubResponse;

    if (result.success && result.data?.subLicenseCode) {
      generatedLicenseCode.value = result.data.subLicenseCode;
      showGeneratedCode.value = true;
      closeGenerateSubDialog();
      await loadLicenseStatus();
      ElMessage.success('Sous-licence générée avec succès !');
    } else {
      ElMessage.error(result.error || 'Erreur lors de la génération de la sous-licence.');
    }
  } catch (error) {
    console.error('Erreur lors de la génération de la sous-licence:', error);
    ElMessage.error('Une erreur inattendue est survenue.');
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
                <div class="status-item" v-else>
                  <Icon icon="mdi:infinity" :width="20" :height="20" />
                  <span>Illimitée</span>
                </div>
              </el-col>
            </el-row>

            <!-- Informations détaillées -->
            <div class="license-info" v-if="licenseStatus">
              <el-descriptions :column="2" border>
                <el-descriptions-item label="Client">
                  {{ licenseStatus.customer || 'N/A' }}
                </el-descriptions-item>
                <el-descriptions-item label="Type">
                  {{ licenseTypeLabel }}
                </el-descriptions-item>
                <el-descriptions-item label="Date d'expiration">
                  {{ licenseStatus.expiryDate ? new Date(licenseStatus.expiryDate).toLocaleDateString('fr-FR') : 'N/A' }}
                </el-descriptions-item>
                <el-descriptions-item label="Identifiant machine">
                  {{ licenseStatus.machineId || 'N/A' }}
                </el-descriptions-item>
              </el-descriptions>
            </div>

            <!-- Gestion des quotas et sous-licences -->
            <div v-if="quotaInfo" class="quota-section">
              <h3>
                <Icon icon="mdi:desktop-classic" :width="20" :height="20" />
                Postes Autorisés
              </h3>
              <div class="quota-display">
                <el-progress 
                  :percentage="quotaPercentage"
                  :format="quotaFormat"
                  :status="quotaStatus"
                />
                <p class="quota-text">
                  {{ quotaInfo.used }} postes utilisés sur {{ quotaInfo.max }} autorisés
                </p>
              </div>

              <el-button 
                v-if="!quotaInfo.exhausted && !isSubLicense"
                type="primary" 
                @click="openGenerateSubDialog"
                class="generate-button"
              >
                <Icon icon="mdi:plus" :width="16" :height="16" class="mr-2" />
                Générer une licence pour un autre ordinateur
              </el-button>
              <el-alert 
                v-else-if="quotaInfo.exhausted"
                title="Quota épuisé"
                description="Vous avez utilisé tous vos postes autorisés. Contactez votre fournisseur pour augmenter votre quota."
                type="warning"
                show-icon
                :closable="false"
              />
              <el-alert 
                v-else
                title="Poste secondaire"
                description="Seul le poste principal peut générer des sous-licences."
                type="info"
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
        
        <el-form label-position="top" @submit.prevent="activateLicense">
          <el-form-item label="Type de licence">
            <el-radio-group v-model="activationType" :disabled="isLoading" class="activation-type-group">
              <el-radio-button value="master">Licence principale</el-radio-button>
              <el-radio-button value="sub">Sous-licence (poste)</el-radio-button>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="Code de licence">
            <el-input
              v-model="licenseCode"
              type="textarea"
              :rows="activationType === 'master' ? 3 : 4"
              :placeholder="activationType === 'master'
                ? 'Collez le code signé fourni par le revendeur'
                : 'Collez le paquet de sous-licence (2 lignes) fourni par le poste principal'"
              :disabled="isLoading"
              class="license-input"
              size="large"
            />
            <p class="input-hint">
              {{ activationType === 'master'
                ? 'Code à coller intégralement (sans modification).'
                : 'Paquet à coller intégralement : ligne 1 = jeton, ligne 2 = clé publique.' }}
            </p>
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

    <!-- Dialog de génération de sous-licence -->
    <el-dialog
      v-model="showGenerateSubDialog"
      title="Générer une sous-licence"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="generate-sub-dialog">
        <el-alert
          title="Poste disponible requis"
          description="La génération utilisera un de vos postes disponibles."
          type="info"
          show-icon
          :closable="false"
          class="mb-4"
        />

        <el-form label-position="top" @submit.prevent="generateSubLicense">
          <el-form-item label="Identifiant machine cible (optionnel)">
            <el-input
              v-model="targetMachineId"
              placeholder="Laisser vide pour ce poste"
              :disabled="isGenerating"
              size="large"
              clearable
            >
              <template #prefix>
                <Icon icon="mdi:desktop-classic" :width="16" :height="16" />
              </template>
            </el-input>
            <p class="target-hint">
              L'identifiant machine s'affiche dans le menu de gestion des licences de chaque poste.
            </p>
          </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <div class="dialog-footer">
          <el-button @click="closeGenerateSubDialog" :disabled="isGenerating">
            <Icon icon="mdi:close" :width="16" :height="16" class="mr-2" />
            Annuler
          </el-button>
          <el-button
            type="primary"
            @click="generateSubLicense"
            :loading="isGenerating"
          >
            <Icon v-if="!isGenerating" icon="mdi:check" :width="16" :height="16" class="mr-2" />
            {{ isGenerating ? 'Génération en cours...' : 'Générer' }}
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
          description="Paquet de 2 lignes : ligne 1 = jeton, ligne 2 = clé publique. À transmettre intégralement, sans modification."
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
            :model-value="generatedLicenseCode"
            type="textarea"
            :rows="4"
            readonly
            class="generated-code-input"
          />
          <el-button @click="copyGeneratedCode" type="primary" class="copy-code-button">
            <Icon icon="mdi:content-copy" :width="16" :height="16" class="mr-1" />
            Copier
          </el-button>
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

.generate-sub-dialog {
  padding: 1rem 0;
}

.target-hint {
  color: #909399;
  font-size: 0.875rem;
  line-height: 1.5;
  margin: 0.5rem 0 0 0;
  text-align: left;
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

.activation-type-group {
  display: flex;
  width: 100%;
}

.activation-type-group :deep(.el-radio-button) {
  flex: 1;
}

.activation-type-group :deep(.el-radio-button__inner) {
  width: 100%;
}

.license-input {
  font-family: 'Courier New', monospace;
  font-size: 1rem;
  line-height: 1.5;
  text-align: left;
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
  font-family: 'Courier New', monospace;
  font-size: 0.95rem;
  line-height: 1.5;
  text-align: left;
}

.copy-code-button {
  margin-top: 1rem;
  width: 100%;
  height: 40px;
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
    font-size: 0.85rem;
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
