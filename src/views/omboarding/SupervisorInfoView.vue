<script setup lang="ts">
// @ts-nocheck
import { ref, inject } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from 'element-plus';
import WizardViewBase from './WizardViewBase.vue';

const { activeIndex, updateActiveIndex } = inject('activeIndex');
const router = useRouter();

const formRef = ref();
const isSaving = ref(false);

const formData = ref({
  username: '',
  password: '',
  confirmPassword: ''
});

const rules = {
  username: [
    { required: true, message: 'Le nom d\'utilisateur est requis', trigger: 'blur' },
    { min: 3, message: 'Le nom d\'utilisateur doit contenir au moins 3 caractères', trigger: 'blur' }
  ],
  password: [
    { required: true, message: 'Le mot de passe est requis', trigger: 'blur' },
    { min: 6, message: 'Le mot de passe doit contenir au moins 6 caractères', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: true, message: 'La confirmation du mot de passe est requise', trigger: 'blur' },
    {
      validator: (rule: any, value: string, callback: Function) => {
        if (value !== formData.value.password) {
          callback(new Error('Les mots de passe ne correspondent pas'));
        } else {
          callback();
        }
      },
      trigger: 'blur'
    }
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
    const result = await window.ipcRenderer.invoke('supervisor:create', {
      username: formData.value.username,
      password: formData.value.password
    });

    if (result.success) {
      ElMessage.success('Superviseur créé avec succès');
      router.push({ name: 'home' });
    } else {
      ElMessage.error(result.message || 'Erreur lors de la création du superviseur');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error('Une erreur est survenue');
  } finally {
    isSaving.value = false;
  }
}

function goBack() {
  updateActiveIndex(3);
  router.push({ name: 'general-info' });
}
</script>

<template>
  <wizard-view-base>
    <template #title>
      Veuillez renseigner les informations de connexion du superviseur
    </template>

    <el-form
      ref="formRef"
      :model="formData"
      :rules="rules"
      label-position="top"
      class="supervisor-form"
    >
      <el-form-item label="Nom utilisateur" prop="username">
        <el-input 
          v-model="formData.username" 
          placeholder="Nom utilisateur"
          :disabled="isSaving"
        />
      </el-form-item>
      
      <el-form-item label="Mot de passe" prop="password">
        <el-input 
          v-model="formData.password" 
          type="password" 
          placeholder="Mot de passe"
          :disabled="isSaving"
          show-password
        />
      </el-form-item>
      
      <el-form-item label="Confirmation de mot de passe" prop="confirmPassword">
        <el-input 
          v-model="formData.confirmPassword" 
          type="password" 
          placeholder="Confirmation de mot de passe"
          :disabled="isSaving"
          show-password
        />
      </el-form-item>
    </el-form>

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
        Valider
      </el-button>
    </template>
  </wizard-view-base>
</template>

<style scoped>
.supervisor-form {
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

.action-button {
  min-width: 200px;
}
</style>