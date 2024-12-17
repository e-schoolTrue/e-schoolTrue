<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { Icon } from '@iconify/vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import BackupSettings from '@/components/backup/BackupSettings.vue';
import BackupHistory from '@/components/backup/BackupHistory.vue';
import type { BackupConfig, BackupHistory as BackupHistoryType } from '@/types/backup';
import { useBackupStore } from '@/stores/backupStore';
import { useOnline } from '@vueuse/core';

const isOnline = useOnline();
const backupStore = useBackupStore();
const loading = ref(false);
const showSettings = ref(false);

const backupConfig = ref<BackupConfig>({
  autoBackup: true,
  frequency: 'daily',
  maxBackups: 5,
  includeFiles: true,
  useSupabase: false,
  notifyBeforeBackup: true,
  backupTime: '23:00',
  retentionDays: 30,
});

const backupHistory = ref<BackupHistoryType[]>([]);
const nextBackupDate = computed(() => {
  // Calcul de la prochaine sauvegarde basé sur la configuration
  return new Date(Date.now() + 24 * 60 * 60 * 1000);
});

const storageUsed = ref({
  local: 0,
  supabase: 0,
  total: 0,
  limit: 1024 * 1024 * 500, // 500MB limite par défaut
});

const handleBackup = async (type: 'local' | 'supabase') => {
  if (type === 'supabase' && !isOnline.value) {
    ElMessage.error('Connexion Internet requise pour la sauvegarde Supabase');
    return;
  }

  try {
    loading.value = true;
    const result = await window.ipcRenderer.invoke('backup:create', {
      type,
      config: backupConfig.value
    });

    if (result.success) {
      ElMessage.success('Sauvegarde effectuée avec succès');
      await loadBackupHistory();
    } else {
      throw new Error(result.error);
    }
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    ElMessage.error('Erreur lors de la sauvegarde');
  } finally {
    loading.value = false;
  }
};

const restoreBackup = async (backupId: string) => {
  try {
    const confirmed = await ElMessageBox.confirm(
      'Cette action va restaurer vos données à partir de la sauvegarde sélectionnée. Continuer ?',
      'Confirmation',
      {
        confirmButtonText: 'Oui, restaurer',
        cancelButtonText: 'Annuler',
        type: 'warning'
      }
    );

    if (confirmed) {
      loading.value = true;
      const result = await window.ipcRenderer.invoke('backup:restore', backupId);
      
      if (result.success) {
        ElMessage.success('Restauration effectuée avec succès');
        window.location.reload();
      } else {
        throw new Error(result.error);
      }
    }
  } catch (error) {
    console.error('Erreur lors de la restauration:', error);
    ElMessage.error('Erreur lors de la restauration');
  } finally {
    loading.value = false;
  }
};

const loadBackupHistory = async () => {
  try {
    const result = await window.ipcRenderer.invoke('backup:history');
    if (result.success) {
      backupHistory.value = result.data;
    }
  } catch (error) {
    console.error('Erreur lors du chargement de l\'historique:', error);
  }
};

const updateConfig = async (newConfig: BackupConfig) => {
  try {
    const result = await window.ipcRenderer.invoke('backup:updateConfig', newConfig);
    if (result.success) {
      backupConfig.value = newConfig;
      ElMessage.success('Configuration mise à jour');
    }
  } catch (error) {
    console.error('Erreur lors de la mise à jour de la configuration:', error);
    ElMessage.error('Erreur lors de la mise à jour');
  }
};

const checkStorageUsage = async () => {
  try {
    const result = await window.ipcRenderer.invoke('backup:storage');
    if (result.success) {
      storageUsed.value = result.data;
    }
  } catch (error) {
    console.error('Erreur lors de la vérification du stockage:', error);
  }
};

onMounted(async () => {
  await Promise.all([
    loadBackupHistory(),
    checkStorageUsage()
  ]);
});
</script>

<template>
  <div class="backup-view">
    <!-- En-tête -->
    <div class="header-section">
      <h1>
        <Icon icon="mdi:backup-restore" class="mr-2" />
        Sauvegarde et Restauration
      </h1>
      <el-button-group>
        <el-button type="primary" @click="handleBackup('local')" :loading="loading">
          <Icon icon="mdi:content-save" class="mr-2" />
          Sauvegarde Locale
        </el-button>
        <el-button 
          type="success" 
          @click="handleBackup('supabase')" 
          :loading="loading"
          :disabled="!isOnline"
        >
          <Icon icon="mdi:cloud-upload" class="mr-2" />
          Sauvegarde Cloud
        </el-button>
        <el-button type="info" @click="showSettings = true">
          <Icon icon="mdi:cog" class="mr-2" />
          Paramètres
        </el-button>
      </el-button-group>
    </div>

    <!-- Statistiques -->
    <div class="stats-section">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-card shadow="hover">
            <template #header>
              <div class="card-header">
                <Icon icon="mdi:clock-outline" class="mr-2" />
                Prochaine sauvegarde
              </div>
            </template>
            <div class="card-content">
              {{ nextBackupDate.toLocaleString() }}
            </div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card shadow="hover">
            <template #header>
              <div class="card-header">
                <Icon icon="mdi:database" class="mr-2" />
                Espace utilisé
              </div>
            </template>
            <div class="card-content">
              <el-progress 
                :percentage="(storageUsed.total / storageUsed.limit) * 100"
                :format="(p) => `${(storageUsed.total / 1024 / 1024).toFixed(2)} MB`"
              />
            </div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card 
            shadow="hover"
            :class="{ 'offline-card': !isOnline }"
          >
            <template #header>
              <div class="card-header">
                <Icon 
                  :icon="isOnline ? 'mdi:wifi' : 'mdi:wifi-off'"
                  class="mr-2"
                />
                Statut
              </div>
            </template>
            <div class="card-content">
              {{ isOnline ? 'Connecté' : 'Hors ligne' }}
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- Historique -->
    <backup-history
      :history="backupHistory"
      :loading="loading"
      @restore="restoreBackup"
    />

    <!-- Dialog des paramètres -->
    <el-dialog
      v-model="showSettings"
      title="Paramètres de sauvegarde"
      width="60%"
    >
      <backup-settings
        :config="backupConfig"
        @update="updateConfig"
      />
    </el-dialog>
  </div>
</template>

<style scoped>
.backup-view {
  padding: 20px;
  max-width: 1200px;
  margin: 0 auto;
}

.header-section {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 30px;
}

.header-section h1 {
  display: flex;
  align-items: center;
  margin: 0;
  font-size: 24px;
}

.stats-section {
  margin-bottom: 30px;
}

.card-header {
  display: flex;
  align-items: center;
  font-weight: bold;
}

.card-content {
  text-align: center;
  font-size: 18px;
}

.offline-card {
  background-color: #fef0f0;
}

.mr-2 {
  margin-right: 8px;
}

:deep(.el-card__header) {
  padding: 15px;
  border-bottom: 1px solid #ebeef5;
}

:deep(.el-card__body) {
  padding: 20px;
}
</style> 