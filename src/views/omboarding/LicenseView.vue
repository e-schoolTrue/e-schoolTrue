<script setup lang="ts">
import { ref, inject } from "vue";
import { ElMessage, ElMessageBox } from 'element-plus';
import WizardViewBase from './WizardViewBase.vue';

inject('activeIndex', {
    activeIndex: ref(9),
    updateActiveIndex: (index: number) => { console.log('Update active index to:', index); }
});
const emit = defineEmits(['configuration-saved', 'go-back']);

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
     
      emit('configuration-saved', { licenseActivated: true, codeUsed: licenseCode.value.trim() });
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

function goBack() {
   
  emit('go-back');
}

</script>

<template>
  <wizard-view-base>
    <template #title>
      Activation de la Licence du Logiciel
    </template>
    <template #description>
      Veuillez entrer votre code de licence pour activer toutes les fonctionnalités du logiciel.
      Si vous ne possédez pas de code de licence, veuillez contacter notre support commercial.
    </template>

    <div class="license-form-container">
      <el-form @submit.prevent="activateLicense" class="license-form">
        <el-form-item label="Code de Licence" prop="licenseCode">
          <el-input
            v-model="licenseCode"
            placeholder="Ex: XXXX-XXXX-XXXX-XXXX"
            :disabled="isLoading"
            clearable
            size="large"
            class="license-input"
          />
        </el-form-item>
      </el-form>
      <div class="form-hint">
        Le code de licence est généralement fourni lors de l'achat du logiciel. Assurez-vous de le copier correctement.
      </div>
    </div>

    <template #actions>
      <el-button
        @click="goBack"
        :disabled="isLoading"
        class="action-button">
        Retour
      </el-button>
      <el-button
        type="primary"
        @click="activateLicense"
        :loading="isLoading"
        class="action-button">
        Activer la Licence
      </el-button>
    </template>
  </wizard-view-base>
</template>

<style scoped>
.license-form-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  height: calc(100% - 100px); /* Adjust based on title/description height */
  box-sizing: border-box;
}

.license-form {
  width: 100%;
  max-width: 480px; /* Increased max-width */
  background-color: #fff;
  padding: 30px; /* Increased padding */
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.license-input {
  margin-top: 8px;
}

.form-hint {
  font-size: 0.9em;
  color: #888;
  margin-top: 15px;
  max-width: 480px;
  text-align: center;
  line-height: 1.5;
}

.action-button {
  min-width: 160px; /* Increased min-width */
  padding: 12px 24px; /* Adjusted padding */
  font-size: 1em; /* Adjusted font size */
}

:deep(.el-form-item__label) {
  font-weight: 600;
  padding-bottom: 8px;
  color: #333; /* Darker label color */
  font-size: 1.05em; /* Slightly larger label */
}

/* Ensure WizardViewBase structure is respected for actions alignment */
:deep(.wizard-view-base__actions) {
  flex-shrink: 0;
  padding: 20px;
  background: white; /* Or inherit from wizard base */
  border-top: 1px solid #ebeef5; /* Consistent border */
  display: flex; /* Use flex for alignment */
  justify-content: flex-end; /* Align buttons to the right */
  gap: 10px; /* Space between buttons */
}
</style>
