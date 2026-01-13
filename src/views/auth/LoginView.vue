<script setup lang="ts">
// @ts-nocheck
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Lock, Right } from '@element-plus/icons-vue' // J'ai ajouté l'icône Right
import { useRouter } from 'vue-router'
import type { FormInstance } from 'element-plus'

const router = useRouter()
const loading = ref(false)
const loginForm = ref<FormInstance>()

const formData = reactive({
  username: '',
  password: ''
})

const rules = {
  username: [
    { required: true, message: "Requis", trigger: 'blur' },
    { min: 3, message: "Min. 3 caractères", trigger: 'blur' }
  ],
  password: [
    { required: true, message: 'Requis', trigger: 'blur' },
    { min: 6, message: 'Min. 6 caractères', trigger: 'blur' }
  ]
}

const handleLogin = async () => {
    if (!loginForm.value) return;

    await loginForm.value.validate(async (valid: boolean) => {
        if (!valid) return;

        loading.value = true;
        try {
            const result = await window.ipcRenderer.invoke("auth:login", {
                username: formData.username,
                password: formData.password
            });

            if (result.success && result.data) {
                localStorage.setItem('user', JSON.stringify(result.data));
                ElMessage.success("Bienvenue !");
                await router.replace('/');
            } else {
                ElMessage.error(result.message || "Identifiants incorrects");
            }
        } catch (error) {
            console.error("Erreur:", error);
            ElMessage.error("Erreur de connexion serveur");
        } finally {
            loading.value = false;
        }
    });
};
</script>

<template>
  <div class="login-wrapper">
    <!-- Overlay sombre pour garantir la lisibilité sur l'image rouge -->
    <div class="background-overlay"></div>
    
    <div class="login-content">
      <div class="brand-section">
        <!-- Optionnel: Un slogan ou le nom de l'app en gros à gauche (visible sur desktop) -->
        <h1 class="app-title">Eschool</h1>
        <p class="app-subtitle">La créativité au bout des doigts.</p>
      </div>

      <div class="card-container">
        <div class="login-card">
          <div class="login-header">
            <!-- Logo avec un fond blanc arrondi pour ressortir -->
            <div class="logo-wrapper">
                <img src="/icon.png" alt="Logo" class="logo" />
            </div>
            <h2>Connexion</h2>
            <p class="text-muted">Heureux de vous revoir</p>
          </div>

          <el-form
            ref="loginForm"
            :model="formData"
            :rules="rules"
            class="login-form"
            @submit.prevent="handleLogin"
            size="large"
          >
            <el-form-item prop="username">
              <el-input
                v-model="formData.username"
                placeholder="Nom d'utilisateur"
                :prefix-icon="User"
                class="custom-input"
              />
            </el-form-item>

            <el-form-item prop="password">
              <el-input
                v-model="formData.password"
                type="password"
                placeholder="Mot de passe"
                :prefix-icon="Lock"
                show-password
                class="custom-input"
              />
            </el-form-item>

            <div class="forgot-password">
                 <el-button 
                    link 
                    type="info" 
                    @click="$router.push('/forgot-password')"
                    :disabled="loading"
                  >
                    Mot de passe oublié ?
                  </el-button>
            </div>

            <el-button
              type="primary"
              native-type="submit"
              :loading="loading"
              class="submit-btn"
              color="#2c3e50" 
              round
            >
              Se connecter
              <el-icon class="el-icon--right"><Right /></el-icon>
            </el-button>
          </el-form>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 
   Configuration globale du layout 
   Utilisation de l'image cover.jpg
*/
.login-wrapper {
  position: relative;
  min-height: 100vh;
  width: 100%;
  background-image: url('/src/assets/cover.jpg');
  background-size: cover;
  background-position: center;
  background-attachment: fixed; /* Effet de parallaxe léger */
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

/* Overlay pour assombrir l'image rouge vif et la rendre élégante */
.background-overlay {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  /* Dégradé du noir vers le rouge très foncé pour garder l'ambiance */
  background: linear-gradient(135deg, rgba(0,0,0,0.7) 0%, rgba(50,0,0,0.4) 100%);
  backdrop-filter: blur(3px); /* Léger flou sur les crayons pour le focus */
  z-index: 1;
}

.login-content {
  position: relative;
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  width: 100%;
  padding: 20px;
}

/* Titre de l'application (visible surtout sur grand écran) */
.brand-section {
  text-align: center;
  margin-bottom: 30px;
  color: white;
  text-shadow: 0 2px 10px rgba(0,0,0,0.3);
}

.app-title {
  font-size: 3rem;
  font-weight: 800;
  margin: 0;
  letter-spacing: -1px;
}

.app-subtitle {
  font-size: 1.1rem;
  opacity: 0.9;
  font-weight: 300;
}

/* 
   Style de la carte (Glassmorphism light) 
*/
.login-card {
  background: rgba(255, 255, 255, 0.92); /* Blanc presque opaque */
  backdrop-filter: blur(20px);
  border-radius: 24px;
  padding: 40px;
  width: 100%;
  max-width: 400px;
  box-shadow: 
    0 20px 40px rgba(0, 0, 0, 0.2), 
    0 0 0 1px rgba(255, 255, 255, 0.5) inset; /* Bordure interne subtile */
  animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}

.logo-wrapper {
  width: 70px;
  height: 70px;
  background: white;
  border-radius: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  box-shadow: 0 4px 15px rgba(0,0,0,0.05);
}

.logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a1a;
  margin: 0 0 8px;
}

.text-muted {
  color: #888;
  font-size: 14px;
  margin: 0;
}

/* 
   Customisation Element Plus 
*/
:deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #e0e0e0 inset;
  border-radius: 12px;
  padding: 8px 15px;
  background-color: #f9f9f9;
  transition: all 0.3s ease;
}

:deep(.el-input__wrapper.is-focus) {
  box-shadow: 0 0 0 2px #333 inset !important; /* Focus noir élégant */
  background-color: white;
}

:deep(.el-input__inner) {
  height: 40px; /* Inputs plus hauts */
  font-size: 15px;
}

.forgot-password {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 24px;
  margin-top: -10px;
}

/* Bouton sombre pour contraster avec le fond rouge/orange */
.submit-btn {
  width: 100%;
  height: 48px;
  font-size: 16px;
  font-weight: 600;
  border: none;
  background: #2c3e50; /* Bleu nuit / Anthracite */
  box-shadow: 0 4px 15px rgba(44, 62, 80, 0.3);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.submit-btn:hover {
  transform: translateY(-1px);
  box-shadow: 0 6px 20px rgba(44, 62, 80, 0.4);
  background: #1a252f; /* Plus sombre au survol */
}

.submit-btn:active {
  transform: translateY(1px);
}

/* Animation d'entrée */
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

/* Responsive */
@media (max-width: 480px) {
  .login-card {
    padding: 30px 20px;
    border-radius: 20px 20px 0 0; /* Style sheet bottom sur mobile */
    position: absolute;
    bottom: 0;
    max-width: 100%;
  }
  
  .login-wrapper {
    align-items: flex-end; /* Aligne en bas sur mobile */
  }
  
  .brand-section {
    margin-bottom: auto; /* Pousse le titre vers le haut */
    margin-top: 100px;
  }
}
</style>