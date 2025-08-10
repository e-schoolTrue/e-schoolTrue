// @ts-nocheck
import { ipcRenderer, contextBridge } from 'electron'

// --------- Expose some API to the Renderer process ---------
const electronAPI = {
  // Gestion des événements IPC
  ipcRenderer: {
    on(channel: string, listener: (...args: any[]) => void) {
      const subscription = (_event: any, ...args: any[]) => listener(...args)
      ipcRenderer.on(channel, subscription)
      return () => {
        ipcRenderer.removeListener(channel, subscription)
      }
    },
    off(channel: string, listener: (...args: any[]) => void) {
      ipcRenderer.removeListener(channel, listener)
    },
    send(channel: string, ...args: any[]) {
      ipcRenderer.send(channel, ...args)
    },
    invoke(channel: string, ...args: any[]) {
      return ipcRenderer.invoke(channel, ...args)
    },
    removeListener(channel: string, listener: (...args: any[]) => void) {
      ipcRenderer.removeListener(channel, listener)
    }
  },
  
  // API spécifique pour les mises à jour
  autoUpdater: {
    checkForUpdates() {
      return ipcRenderer.invoke('check_for_updates')
    },
    downloadUpdate() {
      return ipcRenderer.invoke('download_update')
    },
    installUpdate() {
      return ipcRenderer.invoke('install_update')
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
}

// Exposition de l'API au processus de rendu
contextBridge.exposeInMainWorld('electron', electronAPI)

// Pour la rétrocompatibilité
declare global {
  interface Window {
    electron: typeof electronAPI
  }
}