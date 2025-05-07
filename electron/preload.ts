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
  
  // You can expose other APTs you need here.
  // ...
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
  }
})