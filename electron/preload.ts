// @ts-nocheck
import { ipcRenderer, contextBridge } from 'electron'


// --------- Expose some API to the Renderer process ---------
contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    return ipcRenderer.on(channel, (event, ...args) => listener(event, ...args))
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, ...omit] = args
    return ipcRenderer.off(channel, ...omit)
  },
  async send(...args: Parameters<typeof ipcRenderer.send>) {
    const [channel, ...omit] = args
    await ipcRenderer.send(channel, ...omit)
  },
  async invoke(...args: Parameters<typeof ipcRenderer.invoke>) {
    const [channel, ...omit] = args
    return await ipcRenderer.invoke(channel, ...omit)
  },
  removeListener(channel: string, listener: (...args: any[]) => void): void {
    ipcRenderer.removeListener(channel, listener)
  },
  
  // You can expose other APTs you need here.
  // ...
})


contextBridge.exposeInMainWorld('documentContent', {
  get: () => ipcRenderer.invoke('document-content:get'),
  update: (data) => ipcRenderer.invoke('document-content:update', data),
})

// Exposer l'API Electron pour l'impression
contextBridge.exposeInMainWorld('electronAPI', {
  isElectron: true,
  
  // API d'impression générique
  print: async (options) => {
    try {
      const result = await ipcRenderer.invoke('print', options)
      return result.success
    } catch (error) {
      console.error('Erreur lors de la commande d\'impression:', error)
      return false
    }
  },
  
  // API spécifique pour l'impression des cartes d'étudiants
  printStudentCards: async (data) => {
    try {
      console.log('Demande d\'impression de cartes d\'étudiants via preload');
      const result = await ipcRenderer.invoke('print:studentCardsMain', data);
      if (!result.success) {
        throw new Error(result.error || 'Échec de l\'impression');
      }
      return result;
    } catch (error) {
      console.error('Erreur lors de l\'impression des cartes:', error);
      throw error;
    }
  },
  
  // API pour afficher un fichier dans l'explorateur de fichiers
  showItemInFolder: async (filePath) => {
    try {
      const result = await ipcRenderer.invoke('file:showInFolder', filePath);
      return result.success;
    } catch (error) {
      console.error('Erreur lors de l\'affichage du fichier dans l\'explorateur:', error);
      return false;
    }
  },
  autoUpdater: {
    checkForUpdates() {
      return ipcRenderer.invoke('check-for-updates')
    },
    downloadUpdate() {
      return ipcRenderer.invoke('download-update')
    },
    installUpdate() {
      return ipcRenderer.invoke('install-update')
    },
    onUpdateAvailable(callback: (info: any) => void) {
      const subscription = (_event: any, info: any) => callback(info)
      ipcRenderer.on('update_available', subscription)
      return () => {
        ipcRenderer.removeListener('update_available', subscription)
      }
    },
    onUpdateDownloaded(callback: (info: any) => void) {
      const subscription = (_event: any, info: any) => callback(info)
      ipcRenderer.on('update_downloaded', subscription)
      return () => {
        ipcRenderer.removeListener('update_downloaded', subscription)
      }
    },
    onDownloadProgress(callback: (progress: any) => void) {
      const subscription = (_event: any, progress: any) => callback(progress)
      ipcRenderer.on('download_progress', subscription)
      return () => {
        ipcRenderer.removeListener('download_progress', subscription)
      }
    },
    onError(callback: (error: Error) => void) {
      const subscription = (_event: any, error: Error) => callback(error)
      ipcRenderer.on('update_error', subscription)
      return () => {
        ipcRenderer.removeListener('update_error', subscription)
      }
    }
  }
})
