// @ts-nocheck
import "reflect-metadata";
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'
import path from 'node:path'
import { AppDataSource } from "#electron/data-source.ts";
import './events'
import { registerReportEvents } from './events';
process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
let dataSourceInitialized = false;

// Configuration de l'auto-update
autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

// Configuration pour le mode développement
if (!app.isPackaged) {
  autoUpdater.logger = {
    info: (message: string) => console.log(message),
    warn: (message: string) => console.warn(message),
    error: (message: string, error?: Error) => {
      console.error(message, error)
    },
    debug: (message: string) => console.debug(message)
  }
  
  // Activer les logs détaillés en développement
  autoUpdater.forceDevUpdateConfig = true
  autoUpdater.logger.info('Mode développement: configuration de l\'auto-update')
  
  // Désactiver la vérification des certificats SSL en développement
  app.commandLine.appendSwitch('ignore-certificate-errors')
}

async function initializeDataSource() {
  if (!dataSourceInitialized) {
    try {
      console.log("Début de l'initialisation de la base de données");
      const dataSource = await AppDataSource.initialize();
      console.log("État de la connexion:", dataSource.isInitialized);
      console.log("Base de données initialisée avec succès");
      dataSourceInitialized = true;
    } catch (error) {
      console.error("Erreur lors de l'initialisation de la base de données:", error);
      throw error;
    }
  }
}

async function createWindow() {
  try {
    await initializeDataSource();
    win = new BrowserWindow({
      icon: path.join(process.env.VITE_PUBLIC, 'icon.ico'),
      width: 1200,
      height: 670,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        sandbox: false
      },
    });

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
      win?.webContents.send('main-process-message', (new Date).toLocaleString())
    })

    win.on('ready-to-show', () => {
      win?.show()
    })

    // Vérifiez si VITE_DEV_SERVER_URL est défini
    if (process.env.VITE_DEV_SERVER_URL) {
      await win.loadURL(process.env.VITE_DEV_SERVER_URL)
      win.webContents.openDevTools()
    } else {
      // En production, chargez le fichier index.html
      win.loadFile(path.join(process.env.DIST, 'index.html'))
    }
  } catch (error) {
    console.error("Erreur critique lors de la création de la fenêtre:", error);
    dialog.showErrorBox(
      'Erreur de démarrage',
      `Une erreur est survenue lors du démarrage de l'application: ${error.message}`
    );
    app.quit();
  }
}

// Gestion des événements de mise à jour
autoUpdater.on('checking-for-update', () => {
  console.log('Recherche de mises à jour...')
  win?.webContents.send('checking_for_update')
})

autoUpdater.on('update-available', (info) => {
  console.log('Mise à jour disponible', info)
  win?.webContents.send('update_available', {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes
  })
})

autoUpdater.on('update-not-available', (info) => {
  console.log('Aucune mise à jour disponible', info)
  win?.webContents.send('update_not_available')
})

autoUpdater.on('download-progress', (progressObj) => {
  console.log('Progression du téléchargement:', progressObj.percent)
  win?.webContents.send('download_progress', progressObj)
})

autoUpdater.on('update-downloaded', (info) => {
  console.log('Mise à jour téléchargée', info)
  win?.webContents.send('update_downloaded', {
    version: info.version,
    releaseDate: info.releaseDate,
    releaseNotes: info.releaseNotes
  })
})

// Gestion des erreurs
autoUpdater.on('error', (error) => {
  console.error('Erreur lors de la mise à jour:', error)
  win?.webContents.send('update_error', {
    message: error.message,
    stack: error.stack
  })
})

// Gestion des événements IPC depuis le rendu
ipcMain.handle('check_for_updates', async () => {
  if (!app.isPackaged) {
    console.log('Vérification des mises à jour demandée depuis le rendu (mode développement)')
    // Simuler une mise à jour en développement
    const updateInfo = {
      version: '1.0.1',
      releaseDate: new Date().toISOString(),
      releaseNotes: ['Corrections de bugs', 'Amélioration des performances']
    }
    win?.webContents.send('update_available', updateInfo)
    return { updateInfo }
  } else {
    try {
      const updateCheckResult = await autoUpdater.checkForUpdates()
      return { updateInfo: updateCheckResult?.updateInfo }
    } catch (error) {
      console.error('Erreur lors de la vérification des mises à jour:', error)
      throw error
    }
  }
})

ipcMain.handle('download_update', async () => {
  console.log('Téléchargement de la mise à jour demandé')
  try {
    const result = await autoUpdater.downloadUpdate()
    console.log('Téléchargement de la mise à jour démarré: ', result)
    return result
  } catch (error) {
    console.log('Erreur lors du téléchargement:', error)
    throw error
  }
})

ipcMain.handle('install_update', () => {
  console.log('Installation de la mise à jour demandée')
  setImmediate(() => autoUpdater.quitAndInstall())
  return Promise.resolve()
})

app.whenReady().then(async () => {
  try {
    // Vérifier les mises à jour au démarrage
    if (app.isPackaged) {
      console.log('Vérification des mises à jour...')
      autoUpdater.checkForUpdatesAndNotify()
      
      // Vérifier les mises à jour toutes les heures
      setInterval(() => {
        console.log('Vérification périodique des mises à jour...')
        autoUpdater.checkForUpdatesAndNotify()
      }, 60 * 60 * 1000)
    } else {
      // En développement, vérifier plus fréquemment
      setInterval(() => {
        console.log('Vérification des mises à jour (mode développement)...')
        autoUpdater.checkForUpdatesAndNotify()
      }, 5 * 60 * 1000) // Toutes les 5 minutes en développement
    }
    
    await createWindow();
  } catch (error) {
    console.error("Erreur lors de l'initialisation:", error);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null
  }
})

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow()
  }
})

ipcMain.on("app-quit", () => {
  if (process.platform !== 'darwin') {
    app.quit()
    win = null;
  }
})

registerReportEvents();
