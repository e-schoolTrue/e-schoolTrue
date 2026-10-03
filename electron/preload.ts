// @ts-nocheck
import { ipcRenderer, contextBridge } from 'electron'


// --------- Expose some API to the Renderer process ---------
/**
 * `ipcRenderer.on(channel, wrapper)` avec wrapper anonyme casse
 * `removeListener(channel, original)` (leak : le wrapper ne matche jamais).
 * On mémorise original → wrapper par channel pour que removeListener/off
 * retrouve le bon wrapper. Documenté ici car le listener App.vue /
 * LoginView `backup:db-replaced` s'abonne/désabonne à chaque mount.
 */
const wrappedListeners = new Map<string, Map<Function, Function>>();

function rememberWrapper(channel: string, original: Function, wrapper: Function): void {
  let byChannel = wrappedListeners.get(channel);
  if (!byChannel) {
    byChannel = new Map();
    wrappedListeners.set(channel, byChannel);
  }
  byChannel.set(original, wrapper);
}

function resolveWrapper(channel: string, original: Function): Function | undefined {
  return wrappedListeners.get(channel)?.get(original);
}

function forgetWrapper(channel: string, original: Function): void {
  const byChannel = wrappedListeners.get(channel);
  if (!byChannel) return;
  byChannel.delete(original);
  if (byChannel.size === 0) wrappedListeners.delete(channel);
}

contextBridge.exposeInMainWorld('ipcRenderer', {
  on(...args: Parameters<typeof ipcRenderer.on>) {
    const [channel, listener] = args
    const wrapper = (event: unknown, ...a: unknown[]) => (listener as (...a: unknown[]) => void)(event, ...a);
    rememberWrapper(channel as string, listener as unknown as Function, wrapper as unknown as Function);
    return ipcRenderer.on(channel, wrapper as never)
  },
  off(...args: Parameters<typeof ipcRenderer.off>) {
    const [channel, listener] = args as unknown as [string, Function | undefined];
    if (typeof listener === 'function') {
      const wrapped = resolveWrapper(channel, listener);
      if (wrapped) {
        forgetWrapper(channel, listener);
        return ipcRenderer.off(channel, wrapped as never);
      }
    }
    return ipcRenderer.off(channel, ...([listener].filter(Boolean) as never[]))
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
    const wrapped = resolveWrapper(channel, listener as unknown as Function);
    if (wrapped) {
      forgetWrapper(channel, listener as unknown as Function);
      ipcRenderer.removeListener(channel, wrapped as never);
      return;
    }
    ipcRenderer.removeListener(channel, listener as never)
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
