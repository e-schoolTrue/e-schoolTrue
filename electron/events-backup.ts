// Gestionnaires d'événements pour le service de sauvegarde
ipcMain.handle("backup:create", async (_event: Electron.IpcMainInvokeEvent, name?: string): Promise<ResultType> => {
  try {
    const result = await global.backupService.createBackup(name);
    return {
      success: result.success,
      data: result.data,
      message: result.success ? 'Sauvegarde créée avec succès' : 'Échec de la création de la sauvegarde',
      error: result.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la création de la sauvegarde');
  }
});

ipcMain.handle("backup:restore", async (_event: Electron.IpcMainInvokeEvent, id: string): Promise<ResultType> => {
  try {
    const result = await global.backupService.restoreBackup(id);
    return {
      success: result.success,
      data: null,
      message: result.success ? 'Restauration effectuée avec succès' : 'Échec de la restauration',
      error: result.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la restauration de la sauvegarde');
  }
});

ipcMain.handle("backup:delete", async (_event: Electron.IpcMainInvokeEvent, id: string): Promise<ResultType> => {
  try {
    const result = await global.backupService.deleteBackup(id);
    return {
      success: result.success,
      data: null,
      message: result.success ? 'Sauvegarde supprimée avec succès' : 'Échec de la suppression de la sauvegarde',
      error: result.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la suppression de la sauvegarde');
  }
});

ipcMain.handle("backup:download", async (_event: Electron.IpcMainInvokeEvent, id: string): Promise<ResultType> => {
  try {
    const result = await global.backupService.downloadBackup(id);
    return {
      success: result.success,
      data: result.path,
      message: result.success ? 'Téléchargement effectué avec succès' : 'Échec du téléchargement',
      error: result.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors du téléchargement de la sauvegarde');
  }
});

ipcMain.handle("backup:history", async (_event: Electron.IpcMainInvokeEvent): Promise<ResultType> => {
  try {
    const result = await global.backupService.getBackupHistory();
    return {
      success: result.success,
      data: result.data,
      message: result.success ? 'Récupération de l\'historique réussie' : 'Échec de la récupération de l\'historique',
      error: result.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération de l\'historique des sauvegardes');
  }
});

ipcMain.handle("backup:config:get", async (_event: Electron.IpcMainInvokeEvent): Promise<ResultType> => {
  try {
    const result = await global.backupService.getConfig();
    return {
      success: result.success,
      data: result.data,
      message: result.success ? 'Récupération de la configuration réussie' : 'Échec de la récupération de la configuration',
      error: result.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération de la configuration des sauvegardes');
  }
});

ipcMain.handle("backup:config:update", async (_event: Electron.IpcMainInvokeEvent, config: any): Promise<ResultType> => {
  try {
    const result = await global.backupService.updateConfig(config);
    return {
      success: result.success,
      data: null,
      message: result.success ? 'Configuration mise à jour avec succès' : 'Échec de la mise à jour de la configuration',
      error: result.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la mise à jour de la configuration des sauvegardes');
  }
});
