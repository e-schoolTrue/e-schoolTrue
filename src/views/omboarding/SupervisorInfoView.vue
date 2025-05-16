<script setup lang="ts">
// @ts-nocheck
import { ref, inject, computed } from "vue";
import { useRouter } from "vue-router";
import { ElMessage } from 'element-plus';
import WizardViewBase from './WizardViewBase.vue';

const { activeIndex, updateActiveIndex } = inject('activeIndex', {
  activeIndex: ref(8),
  updateActiveIndex: (index: number) => {}
});
const router = useRouter();
const emit = defineEmits(['configuration-saved', 'go-back']);

const formRef = ref();
const isSaving = ref(false);
const isResetMode = ref(false);

const formData = ref({
  username: '',
  password: '',
  confirmPassword: '',
  securityQuestion: '',
  securityAnswer: '',
  oldPassword: '',
  newPassword: '',
  confirmNewPassword: ''
});

const rules = computed(() => ({
  username: [
    { required: true, message: 'Le nom d\'utilisateur est requis', trigger: 'blur' },
    { min: 3, message: 'Le nom d\'utilisateur doit contenir au moins 3 caractères', trigger: 'blur' }
  ],
  ...(isResetMode.value ? {
    oldPassword: [
      { required: true, message: 'L\'ancien mot de passe est requis', trigger: 'blur' }
    ],
    newPassword: [
      { required: true, message: 'Le nouveau mot de passe est requis', trigger: 'blur' },
      { min: 6, message: 'Le mot de passe doit contenir au moins 6 caractères', trigger: 'blur' }
    ],
    confirmNewPassword: [
      { required: true, message: 'La confirmation du mot de passe est requise', trigger: 'blur' },
      {
        validator: (rule: any, value: string, callback: Function) => {
          if (value !== formData.value.newPassword) {
            callback(new Error('Les mots de passe ne correspondent pas'));
          } else {
            callback();
          }
        },
        trigger: 'blur'
      }
    ]
  } : {
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
    ],
    securityQuestion: [
      { required: true, message: 'La question de sécurité est requise', trigger: 'blur' },
      { min: 3, message: 'La question doit contenir au moins 3 caractères', trigger: 'blur' }
    ],
    securityAnswer: [
      { required: true, message: 'La réponse est requise', trigger: 'blur' },
      { min: 2, message: 'La réponse doit contenir au moins 2 caractères', trigger: 'blur' }
    ]
  })
}));

function toggleMode() {
  isResetMode.value = !isResetMode.value;
  formRef.value?.clearValidate();
}

async function handleResetPassword() {
  if (!formRef.value) return;
  
  try {
    const valid = await formRef.value.validate();
    if (!valid) {
      ElMessage.error('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    isSaving.value = true;
    
    const result = await window.ipcRenderer.invoke('auth:resetPassword', {
      username: formData.value.username,
      oldPassword: formData.value.oldPassword,
      newPassword: formData.value.newPassword
    });

    if (result.success) {
      ElMessage.success('Mot de passe réinitialisé avec succès');
      isResetMode.value = false;
      formRef.value?.clearValidate();
      formData.value = {
        username: '',
        password: '',
        confirmPassword: '',
        oldPassword: '',
        newPassword: '',
        confirmNewPassword: ''
      };
    } else {
      ElMessage.error(result.message || 'Erreur lors de la réinitialisation du mot de passe');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error('Une erreur est survenue');
  } finally {
    isSaving.value = false;
  }
}

async function goNext() {
  if (!formRef.value) return;
  
  try {
    const valid = await formRef.value.validate();
    if (!valid) {
      ElMessage.error('Veuillez corriger les erreurs dans le formulaire');
      return;
    }

    isSaving.value = true;
    
    const result = await window.ipcRenderer.invoke('auth:create', {
      username: formData.value.username,
      password: formData.value.password,
      securityQuestion: formData.value.securityQuestion,
      securityAnswer: formData.value.securityAnswer
    });

    if (result.success) {
      emit('configuration-saved', {
        username: formData.value.username,
        createdAt: new Date().toISOString()
      });
    } else {
      console.error('Erreur de création du superviseur:', result);
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
  updateActiveIndex(7);
  router.push({ name: 'payment-configuration' });
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
      
      <template v-if="!isResetMode">
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

        <el-form-item label="Question de sécurité" prop="securityQuestion">
          <el-input 
            v-model="formData.securityQuestion" 
            placeholder="Ex: Quelle est l'année de fondation de l'école ?"
            :disabled="isSaving"
          />
        </el-form-item>

        <el-form-item label="Réponse à la question" prop="securityAnswer">
          <el-input 
            v-model="formData.securityAnswer" 
            placeholder="Votre réponse"
            :disabled="isSaving"
          />
          <div class="form-hint">
            Cette information sera utilisée pour réinitialiser votre mot de passe si vous l'oubliez.
            Assurez-vous de choisir une réponse dont vous vous souviendrez facilement.
          </div>
        </el-form-item>
      </template>

      <template v-else>
        <el-form-item label="Ancien mot de passe" prop="oldPassword">
          <el-input 
            v-model="formData.oldPassword" 
            type="password" 
            placeholder="Ancien mot de passe"
            :disabled="isSaving"
            show-password
          />
        </el-form-item>

        <el-form-item label="Nouveau mot de passe" prop="newPassword">
          <el-input 
            v-model="formData.newPassword" 
            type="password" 
            placeholder="Nouveau mot de passe"
            :disabled="isSaving"
            show-password
          />
        </el-form-item>

        <el-form-item label="Confirmation du nouveau mot de passe" prop="confirmNewPassword">
          <el-input 
            v-model="formData.confirmNewPassword" 
            type="password" 
            placeholder="Confirmation du nouveau mot de passe"
            :disabled="isSaving"
            show-password
          />
        </el-form-item>
      </template>
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
        v-if="!isResetMode"
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

.form-hint {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
  line-height: 1.4;
}
</style>