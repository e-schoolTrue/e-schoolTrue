<template>
  <div class="sync-view">
    <el-row :gutter="20">
      <!-- Panneau de contrôle de la synchronisation -->
      <el-col :span="24" :md="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <h2>
                <Icon icon="mdi:cloud-sync" class="mr-2" />
                Synchronisation Cloud
              </h2>
              <el-tag :type="isOnline ? 'success' : 'danger'" size="small">
                <Icon :icon="isOnline ? 'mdi:wifi' : 'mdi:wifi-off'" class="mr-1" />
                {{ isOnline ? 'En ligne' : 'Hors ligne' }}
              </el-tag>
            </div>
          </template>

          <!-- Statut de connexion et action principale -->
          <div class="actions-container mb-4">
            <el-button
              v-if="!isAuthenticated"
              type="primary"
              size="large"
              @click="showAuthDialog = true"
              class="w-full"
            >
              <Icon icon="mdi:login" class="mr-2" />
              Se connecter au Cloud pour synchroniser
            </el-button>

            <div v-else class="w-full">
              <el-alert
                type="success"
                :closable="false"
                class="mb-4"
                title="Connecté au Cloud"
                description="Vos données peuvent être synchronisées."
              />
              
              <!-- Actions principales pour utilisateur connecté -->
              <div class="connected-actions mb-4">
                <el-button
                  type="success"
                  size="large"
                  @click="handleSync"
                  :loading="isSyncing"
                  :disabled="!isOnline || isSyncing"
                  class="w-full mb-2"
                >
                  <Icon icon="mdi:sync" class="mr-2" />
                  Synchroniser maintenant
                </el-button>
                
                <el-button
                  type="danger"
                  size="default"
                  @click="handleSignOut"
                  :loading="isSigningOut"
                  :disabled="isSyncing"
                  class="w-full"
                  plain
                >
                  <Icon icon="mdi:logout" class="mr-2" />
                  Se déconnecter du Cloud
                </el-button>
              </div>
            </div>
          </div>

          <!-- Configuration de la synchronisation -->
          <div v-if="isAuthenticated" class="divider">
            <span>Configuration automatique</span>
          </div>
          <div v-if="isAuthenticated" class="config-content">
            <SyncSettings :config="syncConfig" @update="handleConfigUpdate" />
          </div>
        </el-card>       
      </el-col>

      <!-- Historique des synchronisations -->
      <el-col :span="24" :md="16">
        <el-card>
          <SyncHistory 
            :history="syncHistory" 
            :loading="isLoadingHistory"
          />
        </el-card>
      </el-col>
    </el-row>

    <!-- Dialogue d'authentification -->
    <el-dialog
      v-model="showAuthDialog"
      :title="authMode === 'login' ? 'Connexion requise' : 'Création de compte'"
      width="600px"
      :close-on-click-modal="false"
      @close="closeAuthDialog"
    >
      <login-form v-if="authMode === 'login'" @login-success="handleAuthSuccess" />
      <create-account v-else @account-created="handleAccountCreated" />
      <div class="text-center mt-4">
        <el-button link type="primary" @click="toggleAuthMode">
          {{ authMode === 'login' ? 'Créer un compte' : 'Se connecter' }}
        </el-button>
      </div>
    </el-dialog>

    <!-- Dialogue de confirmation de déconnexion -->
    <el-dialog
      v-model="showSignOutDialog"
      title="Confirmer la déconnexion"
      width="500px"
      :close-on-click-modal="false"
    >
      <div class="sign-out-content">
        <Icon icon="mdi:alert-circle" class="warning-icon" />
        <div class="warning-text">
          <p><strong>Êtes-vous sûr de vouloir vous déconnecter ?</strong></p>
          <p>Cette action va :</p>
          <ul>
            <li>Arrêter la synchronisation automatique</li>
            <li>Supprimer votre session locale</li>
            <li>Effacer l'historique de synchronisation local</li>
          </ul>
          <p class="note">Vos données locales seront conservées, mais ne seront plus synchronisées avec le cloud.</p>
        </div>
      </div>
      
      <template #footer>
        <div class="dialog-footer">
          <el-button @click="showSignOutDialog = false" :disabled="isSigningOut">
            Annuler
          </el-button>
          <el-button 
            type="danger" 
            @click="confirmSignOut"
            :loading="isSigningOut"
          >
            <Icon icon="mdi:logout" class="mr-2" />
            Se déconnecter
          </el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';

import SyncSettings from '@/components/sync/SyncSettings.vue'; 
import SyncHistory from '@/components/sync/SyncHistory.vue';   
import type { SyncConfig, SyncHistoryType } from '../../types/sync'; 
import LoginForm from '@/components/login/supabase/login-form.vue';
import CreateAccount from '@/components/login/supabase/create-account.vue';

// --- États du composant ---
const syncConfig = ref<SyncConfig>({
  autoSyncOnConnect: true,
  notifyBeforeSync: true,
  syncIntervalMinutes: 60,
});
const syncHistory = ref<SyncHistoryType[]>([]);
const isLoadingHistory = ref(true);
const isSyncing = ref(false);
const isSigningOut = ref(false);
const isOnline = ref(navigator.onLine);
const isAuthenticated = ref(false);
const showAuthDialog = ref(false);
const showSignOutDialog = ref(false);
const authMode = ref<'login' | 'create'>('login');
let connectionCheckInterval: NodeJS.Timeout | undefined;

// --- Méthodes ---

// Vérifie l'état de la session utilisateur dans le backend
const checkAuthentication = async () => {
  try {
    const response = await window.ipcRenderer.invoke("auth:checkStatus");
    const wasAuthenticated = isAuthenticated.value;
    isAuthenticated.value = response.success && response.data?.supabaseStatus?.isConnected;
    
    // Si l'état d'authentification a changé, mettre à jour l'historique
    if (wasAuthenticated !== isAuthenticated.value) {
      if (isAuthenticated.value) {
        await loadSyncConfig();
        await loadSyncHistory();
      } else {
        // Si déconnecté, vider l'historique
        syncHistory.value = [];
        syncConfig.value = {
          autoSyncOnConnect: true,
          notifyBeforeSync: true,
          syncIntervalMinutes: 60,
        };
      }
    }
  } catch (error) {
    console.error('Erreur lors de la vérification de l\'authentification:', error);
    isAuthenticated.value = false;
    syncHistory.value = [];
  }
};

// Charge l'historique des synchronisations
const loadSyncHistory = async () => {
  // Ne pas charger l'historique si l'utilisateur n'est pas authentifié
  if (!isAuthenticated.value) {
    syncHistory.value = [];
    isLoadingHistory.value = false;
    return;
  }

  isLoadingHistory.value = true;
  try {
    const { success, data, error } = await window.ipcRenderer.invoke("sync:getHistory");
    if (success && Array.isArray(data)) {
      syncHistory.value = data;
    } else {
      console.warn(`Avertissement de chargement de l'historique: ${error}`);
      syncHistory.value = [];
    }
  } catch (err) {
    console.error(`Erreur IPC: ${(err as Error).message}`);
    syncHistory.value = [];
  } finally {
    isLoadingHistory.value = false;
  }
};

// Charge la configuration de la synchronisation
const loadSyncConfig = async () => {
  // Ne charger la config que si authentifié
  if (!isAuthenticated.value) {
    return;
  }

  try {
    const { success, data, error } = await window.ipcRenderer.invoke("sync:getConfig");
    if (success && data) {
      syncConfig.value = { ...syncConfig.value, ...data };
    } else {
      console.warn(`Avertissement de chargement de la configuration: ${error}`);
    }
  } catch (err) {
    console.error(`Erreur IPC: ${(err as Error).message}`);
  }
};

// Met à jour la configuration
const handleConfigUpdate = async (newConfig: SyncConfig) => {
  try {
    const { success, error } = await window.ipcRenderer.invoke("sync:updateConfig", newConfig);
    if (success) {
      syncConfig.value = newConfig;
      ElMessage.success("Configuration mise à jour.");
    } else {
      ElMessage.error(`Erreur de mise à jour: ${error}`);
    }
  } catch (err) {
    ElMessage.error(`Erreur IPC: ${(err as Error).message}`);
  }
};

// Déclenche une synchronisation manuelle
const handleSync = async () => {
  if (!isAuthenticated.value) {
    ElMessage.error("Veuillez vous connecter pour lancer une synchronisation.");
    showAuthDialog.value = true;
    return;
  }
  if (!isOnline.value) {
    ElMessage.warning("Vous devez être en ligne pour synchroniser.");
    return;
  }

  isSyncing.value = true;
  ElMessage.info("Synchronisation en cours...");
  try {
    const { success, data, error } = await window.ipcRenderer.invoke("sync:now");
    if (success) {
      const conflicts = data.conflict_count || 0;
      if (conflicts > 0) {
        ElMessage.warning(`Synchronisation terminée avec ${conflicts} conflit(s) résolu(s).`);
      } else {
        ElMessage.success('Synchronisation terminée avec succès.');
      }
      await loadSyncHistory();
    } else {
      ElMessage.error(`Échec de la synchronisation: ${error}`);
    }
  } catch (err) {
    ElMessage.error(`Erreur IPC: ${(err as Error).message}`);
  } finally {
    isSyncing.value = false;
  }
};

// Gestion de la déconnexion
const handleSignOut = () => {
  showSignOutDialog.value = true;
};

const confirmSignOut = async () => {
  isSigningOut.value = true;
  try {
    const { success, error } = await window.ipcRenderer.invoke("auth:signOut");
    if (success) {
      // Réinitialiser l'état local
      isAuthenticated.value = false;
      syncHistory.value = [];
      syncConfig.value = {
        autoSyncOnConnect: true,
        notifyBeforeSync: true,
        syncIntervalMinutes: 60,
      };
      
      showSignOutDialog.value = false;
      ElMessage.success('Déconnexion réussie. Vos données locales sont conservées.');
      
      // Arrêter la vérification périodique
      if (connectionCheckInterval) {
        clearInterval(connectionCheckInterval);
      }
      
    } else {
      ElMessage.error(`Erreur lors de la déconnexion: ${error}`);
    }
  } catch (err) {
    ElMessage.error(`Erreur IPC: ${(err as Error).message}`);
  } finally {
    isSigningOut.value = false;
  }
};

// Gestion de la boîte de dialogue d'authentification
const closeAuthDialog = () => (showAuthDialog.value = false);
const toggleAuthMode = () => (authMode.value = authMode.value === 'login' ? 'create' : 'login');

const handleAuthSuccess = async () => {
  isAuthenticated.value = true;
  showAuthDialog.value = false;
  ElMessage.success('Connexion réussie !');
  await loadSyncConfig();
  await loadSyncHistory();
  
  // Redémarrer la vérification périodique
  connectionCheckInterval = setInterval(checkAuthentication, 60 * 1000);
  
  // Lancer une synchro auto après connexion si configuré
  if (syncConfig.value.autoSyncOnConnect) {
    await handleSync();
  }
};

const handleAccountCreated = () => {
  authMode.value = 'login';
  ElMessage.success('Un mail de validation a été envoyé à votre adresse email.');
};

// Gestion de la connectivité réseau
const updateOnlineStatus = () => (isOnline.value = navigator.onLine);

// --- Cycle de vie du composant ---
onMounted(async () => {
  await checkAuthentication();
  
  // Ne charger les données que si authentifié
  if (isAuthenticated.value) {
    await loadSyncConfig();
    await loadSyncHistory();
    
    // Vérifier périodiquement si la session est toujours valide
    connectionCheckInterval = setInterval(checkAuthentication, 60 * 1000);
  } else {
    // Si pas authentifié, arrêter le loading
    isLoadingHistory.value = false;
  }

  window.addEventListener('online', updateOnlineStatus);
  window.addEventListener('offline', updateOnlineStatus);
});

onUnmounted(() => {
  window.removeEventListener('online', updateOnlineStatus);
  window.removeEventListener('offline', updateOnlineStatus);
  if (connectionCheckInterval) clearInterval(connectionCheckInterval);
});
</script>

<style scoped>
.sync-view {
  padding: 20px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.card-header h2 {
  display: flex;
  align-items: center;
  margin: 0;
  font-size: 16px;
  color: #409EFF;
}
.actions-container, .w-full {
  width: 100%;
}
.connected-actions .w-full {
  width: 100%;
}
.mb-2 { margin-bottom: 0.5rem; }
.mb-4 { margin-bottom: 1.5rem; }
.mt-4 { margin-top: 1.5rem; }
.mr-1 { margin-right: 0.25rem; }
.mr-2 { margin-right: 0.5rem; }
.text-center { text-align: center; }

.divider {
  display: flex;
  align-items: center;
  margin: 20px 0;
  color: #909399;
  font-size: 13px;
}
.divider::before, .divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid #EBEEF5;
}
.divider span {
  padding: 0 10px;
}

/* Styles pour le dialogue de déconnexion */
.sign-out-content {
  display: flex;
  align-items: flex-start;
  gap: 15px;
}
.warning-icon {
  font-size: 24px;
  color: #E6A23C;
  margin-top: 5px;
}
.warning-text {
  flex: 1;
}
.warning-text p {
  margin: 0 0 10px 0;
}
.warning-text ul {
  margin: 10px 0;
  padding-left: 20px;
}
.warning-text li {
  margin: 5px 0;
}
.note {
  font-size: 12px;
  color: #909399;
  font-style: italic;
}
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.stats-container {
  padding: 10px 0;
}
.stat-item {
  display: flex;
  align-items: center;
  padding: 10px;
  background-color: #f8f9fa;
  border-radius: 8px;
  height: 100%;
}
.stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 45px;
  height: 45px;
  border-radius: 50%;
  background-color: #ecf5ff;
  color: #409EFF;
  font-size: 22px;
  margin-right: 15px;
  flex-shrink: 0;
}
.stat-content {
  flex: 1;
}
.stat-value {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}
.stat-label {
  font-size: 13px;
  color: #909399;
}
</style>