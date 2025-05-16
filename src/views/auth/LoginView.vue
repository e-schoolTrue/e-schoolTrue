<script setup lang="ts">
// @ts-nocheck

import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Lock } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const loading = ref(false)
const rememberMe = ref(false)

const formData = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [
    { required: true, message: "Le nom d'utilisateur est requis", trigger: 'blur' },
    { min: 3, message: "Le nom d'utilisateur doit contenir au moins 3 caractères", trigger: 'blur' }
  ],
  password: [
    { required: true, message: 'Le mot de passe est requis', trigger: 'blur' },
    { min: 6, message: 'Le mot de passe doit contenir au moins 6 caractères', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
  try {
    loading.value = true
    const result = await window.ipcRenderer.invoke('auth:validate', {
      username: formData.username,
      password: formData.password
    })

    if (result.success) {
      // Stocker les informations de l'utilisateur
      const userData = {
        id: result.data.id,
        username: result.data.username
      }
      
      if (rememberMe.value) {
        localStorage.setItem('user', JSON.stringify(userData))
      } else {
        sessionStorage.setItem('user', JSON.stringify(userData))
      }
      
      // Utiliser router.push avec un callback pour s'assurer que la navigation est terminée
      router.push('/').then(() => {
        ElMessage({
          message: 'Connexion réussie',
          type: 'success'
        })
      }).catch((err) => {
        console.error('Erreur de navigation:', err)
        // Si la navigation échoue, forcer le rechargement
        window.location.href = '/'
      })
    } else {
      ElMessage.error(result.message || 'Erreur de connexion')
    }
  } catch (error) {
    console.error('Erreur de connexion:', error)
    ElMessage.error("Une erreur s'est produite lors de la connexion")
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="login-container">
    <div class="login-card">
      <div class="login-header">
        <img src="/icon.png" alt="Logo" class="logo" />
        <h1>Bienvenue</h1>
        <p>Connectez-vous à votre espace</p>
      </div>

      <el-form
        ref="loginForm"
        :model="formData"
        :rules="rules"
        class="login-form"
        @submit.prevent="handleLogin"
      >
        <el-form-item prop="username">
          <el-input
            v-model="formData.username"
            placeholder="Nom d'utilisateur"
            prefix-icon="User"
          />
        </el-form-item>

        <el-form-item prop="password">
          <el-input
            v-model="formData.password"
            type="password"
            placeholder="Mot de passe"
            prefix-icon="Lock"
            show-password
          />
        </el-form-item>

        <div class="form-options">
          <el-checkbox v-model="rememberMe">Se souvenir de moi</el-checkbox>
        </div>

        <div class="form-actions">
          <el-button
            type="primary"
            native-type="submit"
            :loading="loading"
            class="submit-btn"
          >
            Se connecter
          </el-button>

          <el-button
            type="text"
            @click="$router.push('/forgot-password')"
            :disabled="loading"
          >
            Mot de passe oublié ?
          </el-button>
        </div>
      </el-form>
    </div>
  </div>
</template>

<style scoped>
.login-container {
  min-height: 100vh;
    display: flex;
  align-items: center;
    justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 16px;
  box-shadow: 0 8px 30px rgba(0, 0, 0, 0.1);
  padding: 40px;
  width: 100%;
  max-width: 420px;
}

.login-header {
  text-align: center;
  margin-bottom: 40px;
}

.logo {
  width: 80px;
  height: 80px;
  margin-bottom: 20px;
  object-fit: contain;
}

.login-header h1 {
  font-size: 28px;
  color: #333;
  margin-bottom: 8px;
}

.login-header p {
  color: #666;
  font-size: 16px;
}

.login-form {
  margin-top: 20px;
}

.form-options {
    display: flex;
  justify-content: space-between;
    align-items: center;
  margin-bottom: 24px;
}

.form-actions {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
}

.submit-btn {
  width: 100%;
  padding: 12px;
  font-size: 16px;
}

:deep(.el-input__wrapper) {
  padding: 12px;
}

:deep(.el-input__inner) {
  font-size: 16px;
}

:deep(.el-form-item__error) {
  font-size: 14px;
  }
</style>