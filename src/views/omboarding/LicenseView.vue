<script setup lang="ts">
import { ref, onMounted } from "vue";
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';

/**
 * Réponse du canal IPC `license:getMachineId`.
 */
interface GetMachineIdResponse {
  success: boolean;
  data: { machineId: string };
}

/**
 * Réponse des canaux IPC `license:activateMaster` / `license:activateSub`.
 */
interface ActivateResponse {
  success: boolean;
  message?: string;
}

type LicenseType = 'master' | 'sub';

const emit = defineEmits(['license-activated']);

// --- Étape 1 : identifiant machine ---
const currentStep = ref<1 | 2>(1);
const machineId = ref('');
const isMachineIdLoading = ref(true);
const isCopying = ref(false);

// --- Étape 2 : activation ---
const licenseCode = ref('');
const licenseType = ref<LicenseType>('master');
const isActivating = ref(false);

onMounted(async () => {
  await loadMachineId();
});

/** Récupère l'identifiant machine via le backend (IPC). */
async function loadMachineId() {
  isMachineIdLoading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('license:getMachineId') as GetMachineIdResponse;

    if (result.success && result.data?.machineId) {
      machineId.value = result.data.machineId;
    } else {
      console.warn('[UI] Récupération de l\'ID machine infructueuse', result);
      ElMessage.error('Impossible de récupérer l\'identifiant de cette machine.');
    }
  } catch (error) {
    console.error('[UI] Erreur lors de la récupération de l\'ID machine :', error);
    ElMessage.error('Impossible de récupérer l\'identifiant de cette machine.');
  } finally {
    isMachineIdLoading.value = false;
  }
}

/** Copie l'identifiant machine dans le presse-papiers. */
async function copyMachineId() {
  if (!machineId.value) return;
  isCopying.value = true;
  try {
    await navigator.clipboard.writeText(machineId.value);
    ElMessage.success('Identifiant machine copié dans le presse-papiers !');
  } catch (error) {
    console.error('[UI] Erreur lors de la copie de l\'ID machine :', error);
    ElMessage.error('Impossible de copier l\'identifiant machine.');
  } finally {
    isCopying.value = false;
  }
}

/**
 * Active la licence (principale ou sous-licence) avec le code saisi.
 *
 * Le code est envoyé au backend tel quel (seul un `trim()` est appliqué) :
 * le jeton est un `base64url(JSON).signatureHex` sensible à la casse qui ne
 * doit JAMAIS être transformé (ni uppercase, ni nettoyage regex).
 */
async function activateLicense() {
  const code = licenseCode.value.trim();

  if (!code) {
    ElMessage.error('Veuillez entrer un code de licence.');
    return;
  }

  isActivating.value = true;

  try {
    const channel = licenseType.value === 'master' ? 'license:activateMaster' : 'license:activateSub';
    const result = await window.ipcRenderer.invoke(channel, code) as ActivateResponse;

    if (result.success) {
      ElMessage.success('Licence activée avec succès !');
      emit('license-activated');
    } else {
      ElMessageBox.alert(
        result.message || 'Échec de l\'activation de la licence. Veuillez vérifier le code et réessayer.',
        'Erreur d\'activation',
        { confirmButtonText: 'OK', type: 'error' }
      );
    }
  } catch (error) {
    console.error('[UI] Erreur inattendue lors de l\'activation :', error);
    ElMessage.error('Une erreur inattendue est survenue lors de l\'activation de la licence.');
  } finally {
    isActivating.value = false;
  }
}
</script>

<template>
  <div class="license-view">
    <div class="license-container">
      <div class="license-header">
        <Icon icon="mdi:key" class="header-icon" :width="40" :height="40" />
        <h1>Activation de la Licence</h1>
        <p class="subtitle">
          {{ currentStep === 1
            ? 'Identifiez cette machine pour obtenir votre licence'
            : 'Saisissez votre code de licence pour activer l\'application' }}
        </p>
      </div>

      <!-- Étape 1 : identifiant machine -->
      <div v-if="currentStep === 1" class="license-content">
        <el-skeleton v-if="isMachineIdLoading" :rows="2" animated />

        <template v-else>
          <el-form label-position="top" @submit.prevent>
            <el-form-item label="Identifiant de la machine">
              <div class="machine-id-row">
                <el-input
                  :model-value="machineId"
                  readonly
                  placeholder="Chargement…"
                  class="machine-id-input"
                >
                  <template #prefix>
                    <Icon icon="mdi:desktop-classic" :width="16" :height="16" />
                  </template>
                </el-input>
                <el-button
                  :disabled="!machineId"
                  :loading="isCopying"
                  class="copy-button"
                  @click="copyMachineId"
                >
                  <Icon icon="mdi:content-copy" :width="16" :height="16" class="mr-1" />
                  Copier
                </el-button>
              </div>
            </el-form-item>
          </el-form>

          <p class="input-hint">
            Envoyez cet identifiant à votre revendeur pour obtenir votre licence.
          </p>

          <el-button
            type="primary"
            class="activate-button"
            :disabled="!machineId"
            @click="currentStep = 2"
          >
            J'ai ma licence
            <Icon icon="mdi:arrow-right" :width="16" :height="16" class="ml-1" />
          </el-button>
        </template>
      </div>

      <!-- Étape 2 : activation -->
      <div v-else class="license-content">
        <el-button
          text
          class="back-button"
          :disabled="isActivating"
          @click="currentStep = 1"
        >
          <Icon icon="mdi:arrow-left" :width="16" :height="16" class="mr-1" />
          Retour
        </el-button>

        <el-form label-position="top" @submit.prevent="activateLicense">
          <el-form-item label="Type de licence">
            <el-radio-group v-model="licenseType" class="license-type-group">
              <el-radio-button value="master">Licence principale</el-radio-button>
              <el-radio-button value="sub">Sous-licence (poste)</el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="Code de licence">
            <el-input
              v-model="licenseCode"
              type="textarea"
              :rows="licenseType === 'master' ? 3 : 4"
              :placeholder="licenseType === 'master'
                ? 'Collez le code signé fourni par le revendeur'
                : 'Collez le paquet de sous-licence (2 lignes) fourni par le poste principal'"
              :disabled="isActivating"
              class="license-input"
            />
            <p class="input-hint">
              {{ licenseType === 'master'
                ? 'Code à coller intégralement (sans modification).'
                : 'Ligne 1 = jeton, ligne 2 = clé publique.' }}
            </p>
          </el-form-item>

          <el-button
            type="primary"
            class="activate-button"
            :loading="isActivating"
            @click="activateLicense"
          >
            {{ isActivating ? 'Activation en cours...' : 'Activer la Licence' }}
          </el-button>
        </el-form>
      </div>
    </div>
  </div>
</template>


<style scoped>
.license-view {
  min-height: 50vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 1rem;
  background: transparent;
}

.license-container {
  background: white;
  border-radius: 12px;
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.08);
  width: 100%;
  max-width: 440px;
  padding: 2rem;
}

.license-header {
  text-align: center;
  margin-bottom: 2rem;
}

.header-icon {
  color: #409EFF;
  background: rgba(64, 158, 255, 0.1);
  padding: 12px;
  border-radius: 12px;
  margin-bottom: 1rem;
}

.license-header h1 {
  font-size: 1.5rem;
  color: #2c3e50;
  margin: 0 0 0.5rem 0;
  font-weight: 600;
}

.subtitle {
  color: #666;
  font-size: 0.9rem;
  margin: 0;
}

.license-content {
  margin-top: 1.5rem;
}

.machine-id-row {
  display: flex;
  gap: 0.5rem;
  width: 100%;
}

.machine-id-input {
  flex: 1;
  font-family: 'Courier New', monospace;
  letter-spacing: 1px;
}

.copy-button {
  height: 40px;
}

.license-type-group {
  display: flex;
  width: 100%;
}

.license-type-group :deep(.el-radio-button) {
  flex: 1;
}

.license-type-group :deep(.el-radio-button__inner) {
  width: 100%;
}

.back-button {
  margin-bottom: 0.5rem;
  padding: 0;
}

.license-input {
  font-family: 'Courier New', monospace;
  font-size: 1rem;
  line-height: 1.5;
}

.input-hint {
  color: #909399;
  font-size: 0.875rem;
  margin: 0.5rem 0 1.5rem;
  text-align: center;
}

.activate-button {
  width: 100%;
  height: 44px;
  font-size: 1rem;
  font-weight: 500;
}

:deep(.el-input__wrapper) {
  padding: 0.5rem;
}

:deep(.el-input__prefix) {
  margin-right: 0.5rem;
}

/* Classes utilitaires */
.mr-1 { margin-right: 0.25rem; }
.ml-1 { margin-left: 0.25rem; }
</style>
