import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { 
  BackupConfig, 
  BackupHistory, 
  BackupStats, 
  BackupNotification,
  BackupSchedule,
  SupabaseConfig 
} from '@/types/backup';
import { useOnline } from '@vueuse/core';
import { ElNotification } from 'element-plus';

export const useBackupStore = defineStore('backup', () => {
  const isOnline = useOnline();
  
  // État
  const config = ref<BackupConfig>({
    autoBackup: true,
    frequency: 'daily',
    maxBackups: 5,
    includeFiles: true,
    useSupabase: false,
    notifyBeforeBackup: true,
    backupTime: '23:00',
    retentionDays: 30,
  });

  const history = ref<BackupHistory[]>([]);
  const stats = ref<BackupStats>({
    totalBackups: 0,
    storageUsed: {
      local: 0,
      supabase: 0,
      total: 0,
    },
    backupSuccess: 0,
    backupErrors: 0,
  });

  const notifications = ref<BackupNotification[]>([]);
  const schedules = ref<BackupSchedule[]>([]);
  const isBackupInProgress = ref(false);

  // Getters
  const unreadNotifications = computed(() => 
    notifications.value.filter(n => !n.read)
  );

  const nextScheduledBackup = computed(() => {
    const activeSchedules = schedules.value
      .filter(s => s.enabled)
      .sort((a, b) => new Date(a.nextRun).getTime() - new Date(b.nextRun).getTime());
    return activeSchedules[0];
  });

  const storageUsagePercentage = computed(() => {
    const maxStorage = 1024 * 1024 * 500; // 500MB
    return (stats.value.storageUsed.total / maxStorage) * 100;
  });

  // Actions
  const initializeBackupSystem = async () => {
    try {
      const result = await window.ipcRenderer.invoke('backup:init');
      if (result.success) {
        config.value = result.data.config;
        history.value = result.data.history;
        stats.value = result.data.stats;
        schedules.value = result.data.schedules;
      }
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du système de sauvegarde:', error);
      addNotification({
        type: 'error',
        message: 'Erreur d\'initialisation',
        description: 'Impossible d\'initialiser le système de sauvegarde',
        timestamp: new Date().toISOString(),
        read: false,
      });
    }
  };

  const createBackup = async (type: 'local' | 'supabase') => {
    if (type === 'supabase' && !isOnline.value) {
      addNotification({
        type: 'warning',
        message: 'Sauvegarde impossible',
        description: 'Connexion Internet requise pour la sauvegarde cloud',
        timestamp: new Date().toISOString(),
        read: false,
      });
      return;
    }

    try {
      isBackupInProgress.value = true;
      const result = await window.ipcRenderer.invoke('backup:create', { type, config: config.value });
      
      if (result.success) {
        history.value.unshift(result.data);
        updateStats();
        addNotification({
          type: 'success',
          message: 'Sauvegarde réussie',
          description: `Sauvegarde ${type} créée avec succès`,
          timestamp: new Date().toISOString(),
          read: false,
        });
      }
    } catch (error) {
      console.error('Erreur lors de la sauvegarde:', error);
      addNotification({
        type: 'error',
        message: 'Erreur de sauvegarde',
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
        timestamp: new Date().toISOString(),
        read: false,
      });
    } finally {
      isBackupInProgress.value = false;
    }
  };

  const restoreBackup = async (backupId: string) => {
    try {
      isBackupInProgress.value = true;
      const result = await window.ipcRenderer.invoke('backup:restore', backupId);
      
      if (result.success) {
        addNotification({
          type: 'success',
          message: 'Restauration réussie',
          description: 'Les données ont été restaurées avec succès',
          timestamp: new Date().toISOString(),
          read: false,
        });
      }
    } catch (error) {
      console.error('Erreur lors de la restauration:', error);
      addNotification({
        type: 'error',
        message: 'Erreur de restauration',
        description: error instanceof Error ? error.message : 'Une erreur est survenue',
        timestamp: new Date().toISOString(),
        read: false,
      });
    } finally {
      isBackupInProgress.value = false;
    }
  };

  const updateConfig = async (newConfig: Partial<BackupConfig>) => {
    try {
      const result = await window.ipcRenderer.invoke('backup:updateConfig', {
        ...config.value,
        ...newConfig
      });
      
      if (result.success) {
        config.value = result.data;
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la configuration:', error);
    }
  };

  const addNotification = (notification: BackupNotification) => {
    notifications.value.unshift(notification);
    if (notification.type === 'error' || notification.type === 'warning') {
      ElNotification({
        title: notification.message,
        message: notification.description || '',
        type: notification.type,
        duration: 5000,
      });
    }
  };

  const markNotificationAsRead = (timestamp: string) => {
    const notification = notifications.value.find(n => n.timestamp === timestamp);
    if (notification) {
      notification.read = true;
    }
  };

  const updateStats = async () => {
    try {
      const result = await window.ipcRenderer.invoke('backup:stats');
      if (result.success) {
        stats.value = result.data;
      }
    } catch (error) {
      console.error('Erreur lors de la mise à jour des statistiques:', error);
    }
  };

  // Initialisation
  initializeBackupSystem();

  return {
    // État
    config,
    history,
    stats,
    notifications,
    schedules,
    isBackupInProgress,
    
    // Getters
    unreadNotifications,
    nextScheduledBackup,
    storageUsagePercentage,
    
    // Actions
    createBackup,
    restoreBackup,
    updateConfig,
    addNotification,
    markNotificationAsRead,
    updateStats,
  };
}); 