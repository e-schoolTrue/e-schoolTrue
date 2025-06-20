<script setup lang="ts">
import { ref } from "vue";
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';

const emit = defineEmits(['license-activated']);

const licenseCode = ref('');
const isLoading = ref(false);

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
      emit('license-activated');
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
    licenseCode.value = '';
  }
}

function handleInput(value: string) {
  licenseCode.value = value.toUpperCase();
}
</script>

<template>
  <div class="license-view">
    <div class="license-container">
      <div class="license-header">
        <Icon icon="mdi:key" class="header-icon" :width="40" :height="40" />
        <h1>Activation de la Licence</h1>
        <p class="subtitle">Entrez votre code de licence pour commencer à utiliser l'application</p>
      </div>

      <div class="license-content">
        <el-form @submit.prevent="activateLicense">
          <el-form-item>
            <el-input
              v-model="licenseCode"
              placeholder="XXXX-XXXX-XXXX-XXXX"
              :disabled="isLoading"
              maxlength="19"
              class="license-input"
              @input="handleInput"
            >
              <template #prefix>
                <Icon icon="mdi:key" :width="16" :height="16" />
              </template>
            </el-input>
            <p class="input-hint">Format: XXXX-XXXX-XXXX-XXXX</p>
          </el-form-item>

          <el-button
            type="primary"
            @click="activateLicense"
            :loading="isLoading"
            class="activate-button"
          >
            {{ isLoading ? 'Activation en cours...' : 'Activer la Licence' }}
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

:deep(.el-input__wrapper) {
  padding: 0.5rem;
}

:deep(.el-input__prefix) {
  margin-right: 0.5rem;
}
</style>
