// @ts-nocheck
<script setup lang="ts">
import { ref } from "vue";
import { useRouter } from "vue-router";
import WizardViewBase from './WizardViewBase.vue';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { School, Location, OfficeBuilding } from '@element-plus/icons-vue';

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
const isSaving = ref(false);

const formData = ref<LanguageFormData>({
  schoolCode: '',
  inspectionZone: '',
  departmentCode: ''
});

const rules: FormRules = {
  schoolCode: [
    { required: true, message: 'Le code de l\'établissement est requis', trigger: 'blur' },
    { min: 3, message: 'Le code doit contenir au moins 3 caractères', trigger: 'blur' }
  ],
  inspectionZone: [
    { required: true, message: 'La zone d\'inspection est requise', trigger: 'blur' }
  ],
  departmentCode: [
    { required: true, message: 'Le code de département est requis', trigger: 'blur' }
  ]
};

async function goNext() {
  if (!formRef.value) return;
  
  try {
    const valid = await formRef.value.validate();
    if (!valid) {
      ElMessage.error('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    isSaving.value = true;

    // Sauvegarder les paramètres de l'école
    const result = await window.ipcRenderer.invoke('school:saveSettings', {
      schoolCode: formData.value.schoolCode,
      inspectionZone: formData.value.inspectionZone,
      departmentCode: formData.value.departmentCode
    });

    if (result.success) {
      ElMessage.success('Paramètres sauvegardés avec succès');
      emit('configuration-saved', formData.value);
      router.push({ name: 'general-info' });
    } else {
      throw new Error(result.message || 'Erreur lors de la sauvegarde des paramètres');
    }
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    ElMessage.error('Une erreur est survenue lors de la sauvegarde des paramètres');
  } finally {
    isSaving.value = false;
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
      Veuillez renseigner les paramètres de connexion
    </template>

    <div class="form-container">
      <el-form 
        ref="formRef"
        class="language-form" 
        :model="formData"
        :rules="rules"
        label-position="top"
      >
        <el-form-item label="Code de l'établissement" prop="schoolCode" required>
          <el-input 
            v-model="formData.schoolCode"
            placeholder="000 si aucun code d'établissement"
            :prefix-icon="School"
            :disabled="isSaving"
          />
        </el-form-item>

        <el-form-item label="Zone d'inspection" prop="inspectionZone" required>
          <el-input 
            v-model="formData.inspectionZone"
            placeholder="000 si aucune zone d'inspection"
            :prefix-icon="Location"
            :disabled="isSaving"
          />
        </el-form-item>

        <el-form-item label="Code de département" prop="departmentCode" required>
          <el-input 
            v-model="formData.departmentCode"
            placeholder="000 si aucun code de département"
            :prefix-icon="OfficeBuilding"
            :disabled="isSaving"
          />
        </el-form-item>
      </el-form>
    </div>

    <template #actions>
      <el-button
        type="info"
        @click="goBack"
        :disabled="isSaving"
        class="action-button">
        Retourner
      </el-button>
      <el-button
        type="primary"
        @click="goNext"
        :loading="isSaving"
        class="action-button">
        Continuer
      </el-button>
    </template>
  </wizard-view-base>
</template>

<style scoped>
.form-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  width: 100%;
  padding: 20px;
  box-sizing: border-box;
}

.language-form {
  width: 100%;
  max-width: 500px;
  background: white;
  padding: 30px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}

:deep(.el-form-item) {
  margin-bottom: 25px;
}

:deep(.el-form-item__label) {
  font-weight: 600;
  color: #606266;
  padding-bottom: 8px;
  line-height: 1.4;
}

:deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #dcdfe6 inset;
  transition: all 0.3s ease;
  padding: 0 15px;
}

:deep(.el-input__wrapper:hover) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 1px var(--el-color-primary) inset;
}

:deep(.el-input__prefix-icon) {
  font-size: 18px;
  color: #909399;
}

.action-button {
  min-width: 200px;
  padding: 12px 24px;
  font-size: 1rem;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.action-button:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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

/* Animation de transition */
.language-form {
  animation: fadeIn 0.3s ease-in-out;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive design */
@media (max-width: 768px) {
  .language-form {
    padding: 20px;
  }

  .action-button {
    min-width: 160px;
  }
}
</style>