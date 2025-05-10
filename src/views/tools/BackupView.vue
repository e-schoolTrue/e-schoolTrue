<template>
  <div class="backup-view">
    <el-row :gutter="20">
      <!-- Configuration et actions -->
      <el-col :span="24" :md="8">
        <el-card>
          <template #header>
            <div class="card-header">
              <h2>
                <Icon icon="mdi:database-sync" class="mr-2" />
                Sauvegarde et restauration
              </h2>
              <el-tag :type="isOnline ? 'success' : 'danger'" size="small">
                <Icon :icon="isOnline ? 'mdi:wifi' : 'mdi:wifi-off'" class="mr-2" />
                {{ isOnline ? 'En ligne' : 'Hors ligne' }}
              </el-tag>
            </div>
          </template>

          <div class="actions-container">
            <el-button 
              type="primary" 
              size="default" 
              @click="handleCreateBackup"
              :loading="isCreatingBackup"
              :disabled="isCreatingBackup"
              class="action-button"
            >
              <Icon icon="mdi:database-export" class="mr-2" />
              Créer une sauvegarde
            </el-button>

            <div class="divider">
              <span>Configuration</span>
            </div>

            <div class="config-content">
              <BackupSettings 
                :config="backupConfig" 
                @update="handleConfigUpdate" 
              />
            </div>
          </div>
        </el-card>

        <!-- Statistiques -->
        <el-card class="mt-4">
          <template #header>
            <div class="card-header">
              <h2>
                <Icon icon="mdi:chart-bar" class="mr-2" />
                Statistiques
              </h2>
            </div>
          </template>

          <div class="stats-container">
            <el-row :gutter="20">
              <el-col :span="12">
                <div class="stat-item">
                  <div class="stat-icon">
                    <Icon icon="mdi:database" />
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">{{ backupHistory.length }}</div>
                    <div class="stat-label">Sauvegardes</div>
                  </div>
                </div>
              </el-col>
              <el-col :span="12">
                <div class="stat-item">
                  <div class="stat-icon">
                    <Icon icon="mdi:cloud-upload" />
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">{{ cloudBackupCount }}</div>
                    <div class="stat-label">Dans le cloud</div>
                  </div>
                </div>
              </el-col>
            </el-row>

            <el-row :gutter="20" class="mt-4">
              <el-col :span="12">
                <div class="stat-item">
                  <div class="stat-icon">
                    <Icon icon="mdi:calendar-check" />
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">{{ lastBackupDate }}</div>
                    <div class="stat-label">Dernière sauvegarde</div>
                  </div>
                </div>
              </el-col>
              <el-col :span="12">
                <div class="stat-item">
                  <div class="stat-icon">
                    <Icon icon="mdi:harddisk" />
                  </div>
                  <div class="stat-content">
                    <div class="stat-value">{{ totalStorageUsed }}</div>
                    <div class="stat-label">Espace utilisé</div>
                  </div>
                </div>
              </el-col>
            </el-row>
          </div>
        </el-card>
      </el-col>

      <!-- Historique des sauvegardes -->
      <el-col :span="16">
        <el-card>
          <BackupHistory 
            :history="backupHistory" 
            :loading="isLoadingHistory"
            @restore="handleRestore"
            @delete="handleDelete"
            @download="handleDownload"
          />
        </el-card>
      </el-col>
    </el-row>

    <!-- Dialogue de confirmation de restauration -->
    <el-dialog
      v-model="showRestoreDialog"
      title="Confirmation de restauration"
      width="500px"
    >
      <el-alert
        type="warning"
        :closable="false"
        show-icon
      >
        <p><strong>Attention :</strong> La restauration remplacera toutes les données actuelles par celles de la sauvegarde.</p>
        <p>Cette action est irréversible.</p>
      </el-alert>
      
      <template #footer>
        <el-button @click="showRestoreDialog = false">Annuler</el-button>
        <el-button type="primary" @click="confirmRestore" :loading="isRestoring">
          Confirmer la restauration
        </el-button>
      </template>
    </el-dialog>

    <!-- Dialogue de création de sauvegarde -->
    <el-dialog
      v-model="showBackupDialog"
      title="Créer une sauvegarde"
      width="500px"
    >
      <el-form :model="newBackupForm" label-position="top">
        <el-form-item label="Nom de la sauvegarde">
          <el-input v-model="newBackupForm.name" placeholder="Sauvegarde du 9 mai 2025" />
        </el-form-item>
        
        <el-form-item label="Type de sauvegarde">
          <el-radio-group v-model="newBackupForm.type">
            <el-radio label="full">Complète (toutes les données)</el-radio>
            <el-radio label="partial">Partielle (sélection de tables)</el-radio>
          </el-radio-group>
        </el-form-item>
        
        <el-form-item v-if="newBackupForm.type === 'partial'" label="Sélectionner les tables">
          <el-checkbox-group v-model="newBackupForm.tables">
            <el-checkbox label="students">Étudiants</el-checkbox>
            <el-checkbox label="professors">Professeurs</el-checkbox>
            <el-checkbox label="grades">Classes</el-checkbox>
            <el-checkbox label="courses">Cours</el-checkbox>
            <el-checkbox label="payments">Paiements</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        
        <el-form-item label="Inclure les fichiers">
          <el-switch v-model="newBackupForm.includeFiles" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showBackupDialog = false">Annuler</el-button>
        <el-button type="primary" @click="createBackup" :loading="isCreatingBackup">
          Créer la sauvegarde
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Icon } from '@iconify/vue';
import { formatDistanceToNow, format } from 'date-fns';
import { fr } from 'date-fns/locale';
import BackupSettings from '@/components/backup/BackupSettings.vue';
import BackupHistory from '@/components/backup/BackupHistory.vue';
import type { BackupConfig, BackupHistory as BackupHistoryType } from '@/types/backup';

// États
const backupConfig = ref<BackupConfig>({
  autoBackup: true,
  frequency: 'daily',
  backupTime: '02:00',
  maxBackups: 5,
  includeFiles: true,
  useSupabase: true,
  notifyBeforeBackup: true,
  retentionDays: 30
});

const backupHistory = ref<BackupHistoryType[]>([]);
const isLoadingHistory = ref(true);
const isCreatingBackup = ref(false);
const isRestoring = ref(false);
const showRestoreDialog = ref(false);
const showBackupDialog = ref(false);
const backupToRestoreId = ref<string | null>(null);

const newBackupForm = ref({
  name: `Sauvegarde du ${format(new Date(), 'dd MMMM yyyy', { locale: fr })}`,
  type: 'full',
  tables: ['students', 'professors', 'grades', 'courses', 'payments'],
  includeFiles: true
});

const isOnline = ref(navigator.onLine);
const isSupabaseAvailable = ref(true);

// Fonction pour vérifier la connexion internet
const checkInternetConnection = async () => {
  try {
    // Vérifier d'abord si le navigateur est en ligne
    if (!navigator.onLine) {
      isOnline.value = false;
      isSupabaseAvailable.value = false;
      return;
    }

    // Tenter de se connecter à un service fiable
    
    isOnline.value = true;
    isSupabaseAvailable.value = true;
  } catch (error) {
    console.error('Erreur de connexion internet:', error);
    isOnline.value = false;
    isSupabaseAvailable.value = false;
  }
};

// Écouter les changements d'état de la connexion
const handleOnline = () => {
  isOnline.value = true;
  checkInternetConnection();
};

const handleOffline = () => {
  isOnline.value = false;
  isSupabaseAvailable.value = false;
};

// Computed properties
const cloudBackupCount = computed(() => {
  return backupHistory.value.filter(backup => backup.type === 'cloud').length;
});

const lastBackupDate = computed(() => {
  if (backupHistory.value.length === 0) return 'Aucune';
  
  try {
    // Trier les sauvegardes par date (plus récente en premier)
    const sortedBackups = [...backupHistory.value].filter(b => b.created_at);
    
    // Si aucune sauvegarde n'a de date valide
    if (sortedBackups.length === 0) return 'Date inconnue';
    
    // Trier les sauvegardes avec des dates valides
    sortedBackups.sort((a, b) => {
      try {
        const dateA = new Date(a.created_at);
        const dateB = new Date(b.created_at);
        if (isNaN(dateA.getTime()) || isNaN(dateB.getTime())) {
          return 0; // Ignorer les dates invalides
        }
        return dateB.getTime() - dateA.getTime();
      } catch (error) {
        console.error('Erreur lors du tri des dates:', error);
        return 0;
      }
    });
    
    const latestBackup = sortedBackups[0];
    
    // Vérifier si la date est valide
    if (!latestBackup.created_at) return 'Date inconnue';
    
    const dateObj = new Date(latestBackup.created_at);
    if (isNaN(dateObj.getTime())) return 'Date invalide';
    
    return formatDistanceToNow(dateObj, { 
      addSuffix: true, 
      locale: fr 
    });
  } catch (error) {
    console.error('Erreur lors du calcul de la dernière date de sauvegarde:', error);
    return 'Erreur de date';
  }
});

const totalStorageUsed = computed(() => {
  const totalBytes = backupHistory.value.reduce((total, backup) => total + backup.size, 0);
  return formatSize(totalBytes);
});

// Méthodes
const loadBackupConfig = async () => {
  try {
    const { success, data, error } = await window.ipcRenderer.invoke("backup:config:get");

    if (success && data) {
      backupConfig.value = data;
    } else {
      console.error("Erreur lors du chargement de la configuration:", error);
      ElMessage.error(`Erreur: ${error}`);
    }
  } catch (error) {
    console.error("Erreur lors du chargement de la configuration:", error);
    ElMessage.error(`Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
  }
};

const loadBackupHistory = async () => {
  isLoadingHistory.value = true;

  try {
    const { success, data, error } = await window.ipcRenderer.invoke("backup:history");

    if (success && data) {
      backupHistory.value = data;
    } else {
      console.error("Erreur lors du chargement de l'historique:", error);
      ElMessage.error(`Erreur: ${error}`);
    }
  } catch (error) {
    console.error("Erreur lors du chargement de l'historique:", error);
    ElMessage.error(`Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
  } finally {
    isLoadingHistory.value = false;
  }
};

const handleConfigUpdate = async (config: BackupConfig) => {
  try {
    const { success, error } = await window.ipcRenderer.invoke("backup:config:update", config);

    if (success) {
      ElMessage.success("Configuration mise à jour avec succès");
      backupConfig.value = config;
      
      // Recharger l'historique pour refléter les changements
      await loadBackupHistory();
    } else {
      ElMessage.error(`Erreur: ${error}`);
    }
  } catch (error) {
    console.error("Erreur lors de la mise à jour de la configuration:", error);
    ElMessage.error(`Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
  }
};

const handleCreateBackup = () => {
  showBackupDialog.value = true;
};

const createBackup = async () => {
  isCreatingBackup.value = true;

  try {
    const { success, data, error } = await window.ipcRenderer.invoke("backup:create", newBackupForm.value.name);

    if (success && data) {
      ElMessage.success("Sauvegarde créée avec succès");
      showBackupDialog.value = false;
      await loadBackupHistory(); // recharger la liste
    } else {
      ElMessage.error(`Erreur: ${error}`);
    }
  } catch (error) {
    console.error("Erreur lors de la création de la sauvegarde:", error);
    ElMessage.error(`Erreur: ${error instanceof Error ? error.message : "Erreur inconnue"}`);
  } finally {
    isCreatingBackup.value = false;
  }
};

const handleRestore = (id: string) => {
  backupToRestoreId.value = id;
  showRestoreDialog.value = true;
};

const confirmRestore = async () => {
  if (!backupToRestoreId.value) return;
  
  isRestoring.value = true;
  
  try {
    const { success, message, error } = await window.ipcRenderer.invoke("backup:restore", backupToRestoreId.value);
    
    if (success) {
      ElMessage.success(message || 'Restauration effectuée avec succès');
      showRestoreDialog.value = false;
    } else if (error) {
      ElMessage.error(`Erreur: ${error}`);
    }
  } catch (error) {
    console.error('Erreur lors de la restauration:', error);
    ElMessage.error(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  } finally {
    isRestoring.value = false;
    backupToRestoreId.value = null;
  }
};

const handleDelete = async (id: string) => {
  try {
    const confirmed = await ElMessageBox.confirm(
      'Êtes-vous sûr de vouloir supprimer cette sauvegarde ? Cette action est irréversible.',
      'Confirmation',
      {
        confirmButtonText: 'Supprimer',
        cancelButtonText: 'Annuler',
        type: 'warning'
      }
    );
    
    if (confirmed === 'confirm') {
      const { success, message, error } = await window.ipcRenderer.invoke("backup:delete", id);
      
      if (success) {
        ElMessage.success(message || 'Sauvegarde supprimée avec succès');
        await loadBackupHistory();
      } else if (error) {
        ElMessage.error(`Erreur: ${error}`);
      }
    }
  } catch (error) {
    // L'utilisateur a annulé l'opération
    if (error !== 'cancel') {
      console.error('Erreur lors de la suppression:', error);
      ElMessage.error(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
    }
  }
};

const handleDownload = async (backup: BackupHistoryType) => {
  try {
    const { success, data: filePath, message, error } = await window.ipcRenderer.invoke("backup:download", backup.id);
    
    if (success && filePath) {
      // Utiliser l'API pour afficher le fichier dans l'explorateur
      const showResult = await window.ipcRenderer.invoke("file:showInFolder", filePath);
      
      if (showResult.success) {
        ElMessage.success(message || 'Fichier de sauvegarde localisé');
      } else {
        ElMessage.info('Le fichier de sauvegarde est disponible à: ' + filePath);
      }
    } else if (error) {
      ElMessage.error(`Erreur: ${error}`);
    }
  } catch (error) {
    console.error('Erreur lors du téléchargement:', error);
    ElMessage.error(`Erreur: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
  }
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

// Lifecycle hooks
onMounted(async () => {
  await checkInternetConnection();
  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  await loadBackupConfig();
  await loadBackupHistory();
});

onUnmounted(() => {
  window.removeEventListener('online', handleOnline);
  window.removeEventListener('offline', handleOffline);
});
</script>

<style scoped>
.backup-view {
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

.actions-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.action-button {
  display: flex;
  align-items: center;
  justify-content: center;
}

.divider {
  display: flex;
  align-items: center;
  margin: 10px 0;
  color: #909399;
  font-size: 13px;
}

.divider::before,
.divider::after {
  content: '';
  flex: 1;
  border-top: 1px solid #EBEEF5;
}

.divider span {
  padding: 0 10px;
}

.config-content {
  padding: 5px 0;
}

.config-content :deep(.el-form-item) {
  margin-bottom: 12px;
}

.config-content :deep(.el-form-item__label) {
  font-size: 13px;
  padding-bottom: 4px;
}

.config-content :deep(.el-switch) {
  height: 24px;
}

.config-content :deep(.el-input__wrapper) {
  padding: 0 8px;
}

.config-content :deep(.el-select) {
  width: 100%;
}

.mr-2 {
  margin-right: 8px;
}

.mt-4 {
  margin-top: 16px;
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
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background-color: #ecf5ff;
  color: #409EFF;
  font-size: 24px;
  margin-right: 15px;
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
  font-size: 14px;
  color: #909399;
}
</style>
