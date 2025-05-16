<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Key } from '@element-plus/icons-vue'

const router = useRouter()
const formRef = ref()
const loading = ref(false)
const step = ref(1)
const securityQuestion = ref('')

const formData = ref({
  username: '',
  securityAnswer: '',
  newPassword: '',
  confirmPassword: ''
})

const rules = computed(() => ({
  username: [
    { required: step.value === 1, message: "Le nom d'utilisateur est requis", trigger: 'blur' },
    { min: 3, message: "Le nom d'utilisateur doit contenir au moins 3 caractères", trigger: 'blur' }
  ],
  securityAnswer: [
    { required: step.value === 2, message: 'La réponse est requise', trigger: 'blur' }
  ],
  newPassword: [
    { required: step.value === 3, message: 'Le nouveau mot de passe est requis', trigger: 'blur' },
    { min: 6, message: 'Le mot de passe doit contenir au moins 6 caractères', trigger: 'blur' }
  ],
  confirmPassword: [
    { required: step.value === 3, message: 'La confirmation du mot de passe est requise', trigger: 'blur' },
    {
      validator: (_rule: any, value: string, callback: Function) => {
        if (value !== formData.value.newPassword) {
          callback(new Error('Les mots de passe ne correspondent pas'))
        } else {
          callback()
        }
      },
      trigger: 'blur'
    }
  ]
}))

const submitButtonText = computed(() => {
  switch (step.value) {
    case 1:
      return 'Continuer'
    case 2:
      return 'Vérifier la réponse'
    case 3:
      return 'Réinitialiser le mot de passe'
    default:
      return 'Continuer'
  }
})

async function handleSubmit() {
  if (!formRef.value) return

  try {
    await formRef.value.validate()
    loading.value = true

    if (step.value === 1) {
      // Étape 1 : Récupérer la question de sécurité
      const result = await window.ipcRenderer.invoke('auth:getSecurityQuestion', {
        username: formData.value.username
      })

      if (result.success) {
        securityQuestion.value = result.data.question
        step.value = 2
      } else {
        ElMessage.error(result.message || 'Erreur lors de la récupération de la question')
      }
    } else if (step.value === 2) {
      // Étape 2 : Valider la réponse de sécurité
      const result = await window.ipcRenderer.invoke('auth:validateSecurityAnswer', {
        username: formData.value.username,
        answer: formData.value.securityAnswer
      })

      if (result.success) {
        step.value = 3
      } else {
        ElMessage.error(result.message || 'Réponse incorrecte')
      }
    } else {
      // Étape 3 : Réinitialiser le mot de passe
      const result = await window.ipcRenderer.invoke('auth:resetPassword', {
        username: formData.value.username,
        newPassword: formData.value.newPassword
      })

      if (result.success) {
        ElMessage.success('Mot de passe réinitialisé avec succès')
        router.push('/login')
      } else {
        ElMessage.error(result.message || 'Erreur lors de la réinitialisation du mot de passe')
      }
    }
  } catch (error) {
    console.error('Erreur:', error)
    ElMessage.error("Une erreur s'est produite")
  } finally {
    loading.value = false
  }
}

function goToLogin() {
  router.push('/login')
}
</script>

<template>
  <div class="forgot-password-container">
    <div class="forgot-password-card">
      <div class="forgot-password-header">
        <el-icon :size="64" class="logo">
          <Key />
        </el-icon>
        <h1>Récupération de mot de passe</h1>
        <p v-if="step === 1">Entrez votre nom d'utilisateur pour afficher votre question de sécurité</p>
        <p v-else-if="step === 2">Répondez à votre question de sécurité</p>
        <p v-else>Entrez votre nouveau mot de passe</p>
      </div>

      <el-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        label-position="top"
        class="forgot-password-form"
        @submit.prevent="handleSubmit"
      >
        <template v-if="step === 1">
          <el-form-item label="Nom d'utilisateur" prop="username">
            <el-input
              v-model="formData.username"
              placeholder="Entrez votre nom d'utilisateur"
              :disabled="loading"
            />
        </el-form-item>
        </template>

        <template v-else-if="step === 2">
          <div class="security-question">
            <p class="question">{{ securityQuestion }}</p>
          </div>
          <el-form-item label="Votre réponse" prop="securityAnswer">
            <el-input
              v-model="formData.securityAnswer"
              placeholder="Entrez votre réponse"
              :disabled="loading"
            />
        </el-form-item>
        </template>

        <template v-else>
          <el-form-item label="Nouveau mot de passe" prop="newPassword">
            <el-input
              v-model="formData.newPassword"
              type="password"
              placeholder="Entrez votre nouveau mot de passe"
              :disabled="loading"
              show-password
            />
        </el-form-item>

          <el-form-item label="Confirmation du mot de passe" prop="confirmPassword">
            <el-input
              v-model="formData.confirmPassword"
              type="password"
              placeholder="Confirmez votre nouveau mot de passe"
              :disabled="loading"
              show-password
            />
        </el-form-item>
        </template>

        <div class="form-actions">
          <el-button
            type="primary"
            native-type="submit"
            :loading="loading"
            class="submit-btn"
          >
            {{ submitButtonText }}
          </el-button>

          <el-button
            type="text"
            @click="goToLogin"
            :disabled="loading"
          >
            Retour à la connexion
          </el-button>
        </div>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.forgot-password-container {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.forgot-password-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
  padding: 40px;
  width: 100%;
  max-width: 420px;
}

.forgot-password-header {
  text-align: center;
  margin-bottom: 40px;
}

.logo {
  color: #409EFF;
  margin-bottom: 20px;
  padding: 16px;
  background: rgba(64, 158, 255, 0.1);
  border-radius: 50%;
}

.forgot-password-header h1 {
  font-size: 28px;
  color: #333;
  margin-bottom: 8px;
}

.forgot-password-header p {
  color: #666;
  font-size: 16px;
  line-height: 1.5;
}

.forgot-password-form {
  margin-top: 20px;
}

.security-question {
  margin-bottom: 20px;
  padding: 16px;
  background: #f5f7fa;
  border-radius: 8px;
}

.security-question .question {
  color: #333;
  font-size: 16px;
  font-weight: 500;
  margin: 0;
}

.form-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 24px;
}

.submit-btn {
  width: 100%;
  padding: 12px;
  font-size: 16px;
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