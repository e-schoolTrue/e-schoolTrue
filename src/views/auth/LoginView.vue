<script setup lang="ts">
// @ts-nocheck
import { ref, reactive, onMounted, onUnmounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { User, Lock, Right, Calendar } from '@element-plus/icons-vue' // J'ai ajouté l'icône Right
import { useRouter } from 'vue-router'
import type { FormInstance } from 'element-plus'
import { useUserStore } from '@/stores/userStore'
import { useYearStore, PENDING_DB_REFRESH_KEY } from '@/stores/yearStore'

const router = useRouter()
const userStore = useUserStore()
const yearStore = useYearStore()
const loading = ref(false)
const yearsLoading = ref(false)
const loginForm = ref<FormInstance>()

const formData = reactive({
  username: '',
  password: '',
  /** Année choisie au login. `null` = aucune sélection (init serveur seule). */
  yearId: null as number | null,
})

/** Années existantes triées (100% manuelles — AUCUNE auto-création, MANUAL_ONLY).
 * L'option N+1 auto a été supprimée (MANUAL_ONLY) : si la liste est
 * vide, le select affiche « Aucune année ouverte — créez-la manuellement ». */
const yearOptions = computed(() => [...yearStore.list].sort((a, b) => a.schoolYear.localeCompare(b.schoolYear)))

const loadYears = async () => {
  yearsLoading.value = true
  try {
    // Post-import/restore dev : flag posé AVANT reload → refetch APRÈS reload
    // avec activeYear repersisté via init(null) (fetchCurrent seul ne persiste
    // jamais — seul init() repersiste, voir yearStore).
    let pendingRefresh = false
    try {
      pendingRefresh = localStorage.getItem(PENDING_DB_REFRESH_KEY) != null
    } catch {
      pendingRefresh = false
    }
    if (pendingRefresh) {
      try {
        await yearStore.fetchList()
        await yearStore.init(null)
      } catch {
        /* best-effort : liste partielle quand même affichée */
      } finally {
        try {
          localStorage.removeItem(PENDING_DB_REFRESH_KEY)
        } catch {
          /* best-effort */
        }
      }
    }
    const years = pendingRefresh ? [...yearStore.list] : await yearStore.fetchList()
    // Défaut : année `isCurrent`, sinon dernière.
    const current = years.find((y) => y.isCurrent) ?? years[years.length - 1]
    formData.yearId = current?.id ?? null
  } catch {
    formData.yearId = null
  } finally {
    yearsLoading.value = false
  }
}

onMounted(() => {
  void loadYears()
  // Fix import/restore sans restart : le backend broadcast `backup:db-replaced`
  // après le swap à froid. On recharge la liste pour que le select d'années
  // se remplisse sans redémarrage manuel.
  try {
    window.ipcRenderer?.on?.('backup:db-replaced', handleDbReplaced)
  } catch {
    /* best-effort */
  }
})

onUnmounted(() => {
  try {
    window.ipcRenderer?.removeListener?.('backup:db-replaced', handleDbReplaced)
  } catch {
    /* best-effort */
  }
})

function handleDbReplaced(): void {
  void loadYears()
}

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
            // `yearId` transmis au backend (ignoré s'il ne le gère pas encore) ;
            // la bascule validée serveur suit juste après via `year:switch`.
            const result = await window.ipcRenderer.invoke("auth:login", {
                username: formData.username,
                password: formData.password,
                yearId: formData.yearId,
            });

            if (result.success && result.data) {
                // Chaînage plan V3 : user PUIS année.
                userStore.setUser(result.data);
                const chosen = yearStore.list.find((y) => y.id === formData.yearId) ?? null;
                if (chosen?.id != null) {
                    try {
                        await yearStore.setActiveYear(chosen.id);
                    } catch (switchErr) {
                        console.warn('Bascule année post-login impossible, init serveur :', switchErr);
                        await yearStore.init(null).catch(() => undefined);
                    }
                } else {
                    // Aucune année choisie (null) : init depuis le serveur / le stock.
                    await yearStore.init(null).catch(() => undefined);
                }
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

            <el-form-item prop="yearId">
              <el-select
                v-model="formData.yearId"
                placeholder="Année scolaire (optionnel)"
                :prefix-icon="Calendar"
                :loading="yearsLoading"
                clearable
                class="custom-input year-select"
              >
                <el-option
                  v-for="y in yearOptions"
                  :key="y.id"
                  :value="y.id"
                  :label="`${y.schoolYear}${y.isCurrent ? ' (en cours)' : ''}${y.status === 'closed' ? ' — clôturée' : ''}`"
                />
                <el-option
                  v-if="yearOptions.length === 0 && !yearsLoading"
                  :value="null"
                  label="Aucune année ouverte — créez-la manuellement"
                  disabled
                />
              </el-select>
              <div v-if="yearOptions.length === 0 && !yearsLoading" class="year-manual-hint">
                Aucune année ouverte — créez-la manuellement depuis l’écran admin après connexion.
              </div>
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

/* Hint manuel (liste vide) — cohérence 100% manuelle, pas d'auto-création. */
.year-manual-hint {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
  line-height: 1.4;
}

/* Le select année occupe toute la largeur comme les inputs */
.year-select {
  width: 100%;
}
.year-select :deep(.el-input__wrapper) {
  width: 100%;
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