<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Key, Calendar, Warning } from '@element-plus/icons-vue'

interface LicenseStatus {
  isValid: boolean
  daysRemaining: number | null
}

const licenseStatus = ref<LicenseStatus | null>(null)
const loading = ref(true)
const licenseCode = ref('')
const isActivating = ref(false)

const checkLicenseStatus = async () => {
  try {
    const result = await window.ipcRenderer.invoke('license:isValid')
    if (result.success) {
      licenseStatus.value = result.data
    } else {
      ElMessage.error('Erreur lors de la vérification de la licence')
    }
  } catch (error) {
    console.error('Erreur:', error)
    ElMessage.error('Une erreur est survenue lors de la vérification de la licence')
  } finally {
    loading.value = false
  }
}

async function activateLicense() {
  if (!licenseCode.value.trim()) {
    ElMessage.error('Veuillez entrer un code de licence.')
    return
  }
  isActivating.value = true
  try {
    const result = await window.ipcRenderer.invoke('license:activate', licenseCode.value.trim())
    if (result.success) {
      ElMessage.success('Licence activée avec succès !')
      await checkLicenseStatus() // Rafraîchir le statut après activation
      licenseCode.value = '' // Réinitialiser le champ
    } else {
      ElMessageBox.alert(
        result.message || 'Échec de l\'activation de la licence. Veuillez vérifier le code et réessayer.',
        'Erreur d\'activation',
        { confirmButtonText: 'OK', type: 'error' }
      )
    }
  } catch (error: any) {
    console.error('Erreur lors de l\'activation de la licence:', error)
    ElMessageBox.alert(
      error.message || 'Une erreur inattendue est survenue.',
      'Erreur critique',
      { confirmButtonText: 'OK', type: 'error' }
    )
  } finally {
    isActivating.value = false
  }
}

function handleInput(value: string) {
  licenseCode.value = value.toUpperCase()
}

onMounted(() => {
  checkLicenseStatus()
})

const getStatusColor = () => {
  if (!licenseStatus.value?.isValid) return '#F56C6C' // Rouge pour licence invalide
  if (licenseStatus.value.daysRemaining === null) return '#67C23A' // Vert pour licence à vie
  if (licenseStatus.value.daysRemaining <= 7) return '#F56C6C' // Rouge pour moins de 7 jours
  if (licenseStatus.value.daysRemaining <= 30) return '#E6A23C' // Orange pour moins de 30 jours
  return '#67C23A' // Vert pour le reste
}

const getStatusMessage = () => {
  if (!licenseStatus.value?.isValid) return 'Licence invalide'
  if (licenseStatus.value.daysRemaining === null) return 'Licence à vie'
  return `${licenseStatus.value.daysRemaining} jours restants`
}

const getStatusIcon = () => {
  if (!licenseStatus.value?.isValid) return Warning
  if (licenseStatus.value.daysRemaining === null) return Key
  if (licenseStatus.value.daysRemaining <= 30) return Warning
  return Calendar
}
</script>

<template>
  <div class="license-status-view">
    <el-card class="license-card">
      <template #header>
        <div class="card-header">
          <el-icon :size="32" class="header-icon">
            <Key />
          </el-icon>
          <h2>Gestion de la Licence</h2>
        </div>
      </template>

      <el-skeleton :loading="loading" animated>
        <template #default>
          <div class="status-content">
            <!-- Section Statut -->
            <div class="status-section">
              <div class="status-indicator" :style="{ backgroundColor: getStatusColor() }">
                <el-icon :size="24" color="white">
                  <component :is="getStatusIcon()" />
                </el-icon>
              </div>

              <div class="status-details">
                <h3>État actuel</h3>
                <p :style="{ color: getStatusColor() }" class="status-message">
                  {{ getStatusMessage() }}
                </p>

                <template v-if="licenseStatus?.isValid && licenseStatus.daysRemaining !== null">
                  <div class="expiration-warning" v-if="licenseStatus.daysRemaining <= 30">
                    <el-alert
                      :title="licenseStatus.daysRemaining <= 7 ? 'Action requise immédiatement' : 'Attention'"
                      :type="licenseStatus.daysRemaining <= 7 ? 'error' : 'warning'"
                      :description="
                        licenseStatus.daysRemaining <= 7
                          ? 'Votre licence expire très bientôt. Veuillez la renouveler immédiatement pour éviter toute interruption.'
                          : 'Votre licence expirera bientôt. Pensez à la renouveler.'
                      "
                      show-icon
                    />
                  </div>
                </template>
              </div>
            </div>

            <!-- Section Activation -->
            <div class="activation-section" v-if="!licenseStatus?.isValid || (licenseStatus?.daysRemaining !== null && licenseStatus.daysRemaining <= 30)">
              <h3>Activation / Renouvellement de licence</h3>
              <el-form @submit.prevent="activateLicense" class="license-form">
                <el-form-item>
                  <el-input
                    v-model="licenseCode"
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    :disabled="isActivating"
                    maxlength="19"
                    class="license-input"
                    @input="handleInput"
                  >
                    <template #prefix>
                      <el-icon><Key /></el-icon>
                    </template>
                  </el-input>
                  <p class="input-hint">Format: XXXX-XXXX-XXXX-XXXX</p>
                </el-form-item>

                <el-button
                  type="primary"
                  @click="activateLicense"
                  :loading="isActivating"
                  class="activate-button"
                >
                  {{ isActivating ? 'Activation en cours...' : 'Activer la Licence' }}
                </el-button>
              </el-form>
            </div>
          </div>
        </template>
      </el-skeleton>
    </el-card>
  </div>
</template>

<style scoped>
.license-status-view {
  padding: 2rem;
  max-width: 800px;
  margin: 0 auto;
}

.license-card {
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.header-icon {
  color: #409EFF;
  background-color: rgba(64, 158, 255, 0.1);
  padding: 8px;
  border-radius: 8px;
}

.card-header h2 {
  margin: 0;
  font-size: 1.5rem;
  color: #303133;
}

.status-content {
  display: flex;
  flex-direction: column;
  gap: 2rem;
  padding: 1rem 0;
}

.status-section {
  display: flex;
  gap: 2rem;
  padding: 1rem;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.status-indicator {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-details {
  flex-grow: 1;
}

.status-details h3 {
  margin: 0 0 0.5rem 0;
  color: #606266;
  font-size: 1.1rem;
}

.status-message {
  font-size: 1.5rem;
  font-weight: 600;
  margin: 0.5rem 0 1rem 0;
}

.activation-section {
  padding: 1.5rem;
  background-color: #f8f9fa;
  border-radius: 8px;
}

.activation-section h3 {
  margin: 0 0 1.5rem 0;
  color: #606266;
  font-size: 1.1rem;
}

.license-form {
  max-width: 440px;
  margin: 0 auto;
}

.license-input {
  font-size: 1.125rem;
  letter-spacing: 1px;
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

.expiration-warning {
  margin: 1rem 0;
}

:deep(.el-alert) {
  margin: 1rem 0;
}

:deep(.el-input__wrapper) {
  padding: 0.5rem;
}

:deep(.el-input__prefix) {
  margin-right: 0.5rem;
}

@media (max-width: 640px) {
  .license-status-view {
    padding: 1rem;
  }

  .status-section {
    flex-direction: column;
    align-items: center;
    text-align: center;
    gap: 1rem;
  }

  .status-indicator {
    width: 48px;
    height: 48px;
  }

  .status-message {
    font-size: 1.25rem;
  }

  .activation-section {
    padding: 1rem;
  }

  .activate-button {
    height: 40px;
  }
}
</style> 