<template>
  <wizard-view-base>
    <template #title>
      Veuillez sélectionner l'emplacement de stockage des données de votre établissement.
    </template>

    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-position="top"
      class="data-location-form"
    >
      <el-form-item label="Dossier de stockage" prop="localPath" required>
        <el-input v-model="formData.localPath" placeholder="Chemin du dossier de stockage">
          <template #append>
            <el-button @click="selectFolder">Parcourir</el-button>
          </template>
        </el-input>
      </el-form-item>
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
        class="action-button">
        Continuer
      </el-button>
    </template>
  </wizard-view-base>
</template>

<script setup lang="ts">
import { ref, defineEmits } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import WizardViewBase from './WizardViewBase.vue';

const emit = defineEmits(['configuration-saved', 'go-back']);
const formRef = ref<FormInstance>();

const formData = ref({
  localPath: ''
});

const rules: FormRules = {
  localPath: [{ required: true, message: 'Veuillez sélectionner un dossier de stockage', trigger: 'blur' }]
};

const selectFolder = async () => {
  try {
    const result = await window.ipcRenderer.invoke('open-file-dialog');
    if (result) {
      formData.value.localPath = result;
    }
  } catch (error) {
    console.error('Erreur lors de la sélection du dossier:', error);
  }
};

const goNext = async () => {
  if (!formRef.value) return;
  
  try {
    await formRef.value.validate();
    emit('configuration-saved', formData.value);
  } catch (error) {
    console.error('Erreur de validation:', error);
  }
};

const goBack = () => {
  emit('go-back');
};
</script>

<style scoped>
.data-location-form {
  width: 100%;
  max-width: 600px;
  margin: 0 auto;
  height: calc(100vh - 200px);
  overflow-y: auto;
  margin-bottom: 20px;
  padding: 20px;
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

:deep(.el-form-item__label) {
  font-weight: 600;
  color: #606266;
  padding-bottom: 4px;
  line-height: 1.4;
}

:deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #dcdfe6 inset;
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

.action-button {
  min-width: 200px;
}
</style>