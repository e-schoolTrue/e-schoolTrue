// @ts-nocheck
<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import WizardViewBase from './WizardViewBase.vue';
import { ElMessage } from 'element-plus';
import type { FormInstance } from 'element-plus';

interface LanguageFormData {
  schoolCode: string;
  inspectionZone: string;
  departmentCode: string;
}

const emit = defineEmits<{
  'configuration-saved': [data: LanguageFormData];
  'go-back': [];
}>();

const router = useRouter();
const formRef = ref<FormInstance>();

const formData = ref<LanguageFormData>({
  schoolCode: '',
  inspectionZone: '',
  departmentCode: ''
});

function goNext() {
  try {
    // Validation des champs requis
    if (!formData.value.schoolCode || !formData.value.inspectionZone || !formData.value.departmentCode) {
      ElMessage.warning('Veuillez remplir tous les champs requis');
      return;
    }

    // Émettre les données et naviguer
    emit('configuration-saved', formData.value);
    router.push({ name: 'general-info' });
  } catch (error) {
    console.error('Erreur lors de la navigation:', error);
    ElMessage.error('Une erreur est survenue');
  }
}

function goBack() {
  try {
    emit('go-back');
    router.push({ name: 'data-location' });
  } catch (error) {
    console.error('Erreur lors du retour:', error);
    ElMessage.error('Une erreur est survenue');
  }
}
</script>

<template>
  <wizard-view-base>
    <template #title>
      Veillez renseigner les paramètres de connexion
    </template>

    <el-form 
      ref="formRef"
      class="language-form" 
      :model="formData"
    >
      <el-form-item label="Code de l'établissement" required>
        <el-input 
          v-model="formData.schoolCode"
          placeholder="Code de l'établissement" 
        />
      </el-form-item>
      <el-form-item label="Zone d'inspection" required>
        <el-input 
          v-model="formData.inspectionZone"
          placeholder="Zone d'inspection" 
        />
      </el-form-item>
      <el-form-item label="Code de département" required>
        <el-input 
          v-model="formData.departmentCode"
          placeholder="Code de département" 
        />
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

<style scoped>
.language-form {
  width: 100%;
  max-width: 500px;
  margin: 0 auto;
  height: calc(100vh - 200px);
  overflow-y: auto;
  margin-bottom: 20px;
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
</style>