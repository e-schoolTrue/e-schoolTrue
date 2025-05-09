import type { BackupConfig, BackupHistory } from '@/types/backup';

/**
 * Service frontend pour la gestion des sauvegardes et restaurations
 * Ce service communique avec le backend Electron qui gère le fichier SQLite
 */
class BackupService {
  /**
   * Crée une nouvelle sauvegarde
   */
  async createBackup(name?: string): Promise<{ success: boolean; data?: BackupHistory; error?: string }> {
    try {
      const result = await window.ipcRenderer.invoke('backup:create', name);
      return {
        success: result.success,
        data: result.data,
        error: result.error
      };
    } catch (error) {
      console.error('Erreur lors de la création de la sauvegarde:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de la création de la sauvegarde'
      };
    }
  }

  /**
   * Restaure une sauvegarde
   */
  async restoreBackup(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.ipcRenderer.invoke('backup:restore', id);
      return {
        success: result.success,
        error: result.error
      };
    } catch (error) {
      console.error('Erreur lors de la restauration de la sauvegarde:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de la restauration'
      };
    }
  }

  /**
   * Supprime une sauvegarde
   */
  async deleteBackup(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.ipcRenderer.invoke('backup:delete', id);
      return {
        success: result.success,
        error: result.error
      };
    } catch (error) {
      console.error('Erreur lors de la suppression de la sauvegarde:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de la suppression'
      };
    }
  }

  /**
   * Télécharge une sauvegarde
   */
  async downloadBackup(id: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      const result = await window.ipcRenderer.invoke('backup:download', id);
      
      if (result.success && result.data) {
        // Le backend retourne le chemin du fichier
        // Nous devons demander au backend de servir ce fichier
        // Pour simplifier, nous retournons le chemin comme URL
        return {
          success: true,
          url: result.data
        };
      }
      
      return {
        success: false,
        error: result.error || 'Échec du téléchargement'
      };
    } catch (error) {
      console.error('Erreur lors du téléchargement de la sauvegarde:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue lors du téléchargement'
      };
    }
  }

  /**
   * Récupère l'historique des sauvegardes
   */
  async getBackupHistory(): Promise<{ success: boolean; data?: BackupHistory[]; error?: string }> {
    try {
      const result = await window.ipcRenderer.invoke('backup:history');
      return {
        success: result.success,
        data: result.data || [],
        error: result.error
      };
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique des sauvegardes:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de la récupération de l\'historique',
        data: []
      };
    }
  }

  /**
   * Met à jour la configuration des sauvegardes
   */
  async updateConfig(config: BackupConfig): Promise<{ success: boolean; error?: string }> {
    try {
      const result = await window.ipcRenderer.invoke('backup:config:update', config);
      return {
        success: result.success,
        error: result.error
      };
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la configuration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de la mise à jour de la configuration'
      };
    }
  }

  /**
   * Test d'insertion directe dans la table backups
   * Cette méthode est utilisée uniquement pour tester l'insertion dans Supabase
   */
  async testDirectInsert(): Promise<{ success: boolean; data?: any; error?: any }> {
    try {
      console.log('Appel du test d\'insertion directe dans la table backups');
      const result = await window.ipcRenderer.invoke('backup:test:directInsert');
      return {
        success: result.success,
        data: result.data,
        error: result.error
      };
    } catch (error) {
      console.error('Erreur lors du test d\'insertion directe:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue lors du test d\'insertion directe'
      };
    }
  }

  /**
   * Récupère la configuration des sauvegardes
   */
  async getConfig(): Promise<{ success: boolean; data?: BackupConfig; error?: string }> {
    try {
      const result = await window.ipcRenderer.invoke('backup:config:get');
      return {
        success: result.success,
        data: result.data,
        error: result.error
      };
    } catch (error) {
      console.error('Erreur lors de la récupération de la configuration:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de la récupération de la configuration'
      };
    }
  }
}

export const backupService = new BackupService();
export default backupService;
