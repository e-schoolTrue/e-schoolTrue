// @ts-nocheck
import 'reflect-metadata';
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import { AppDataSource } from "#electron/data-source.ts";
import { ConfigService } from './backend/services/configService';
import './events';  // Importer tous les gestionnaires d'événements

console.log('Démarrage de l\'application...');

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
let dataSourceInitialized = false;

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
    console.log('Début de la création de la fenêtre...');
    
    // Initialiser le service de configuration
    console.log('Initialisation du service de configuration...');
    const configService = ConfigService.getInstance();
    console.log('Instance du service de configuration créée');
    
    await configService.initialize();
    console.log('Service de configuration initialisé');

    // Vérifier si c'est le premier lancement
    const isFirstLaunch = await configService.isFirstLaunchCheck();
    console.log('Est-ce le premier lancement ?', isFirstLaunch);

    // Initialiser la base de données dans tous les cas
    await initializeDataSource();
    console.log('Base de données initialisée');

    win = new BrowserWindow({
      icon: path.join(process.env.VITE_PUBLIC, 'icon.ico'),
      width: 1200,
      height: 670,
      autoHideMenuBar: true,
      show: false,
      webPreferences: {
        preload: path.join(__dirname, 'preload.js'),
        sandbox: false,
        partition: 'persist:main',
        contextIsolation: true,
        webSecurity: true
      },
    });

    console.log('Fenêtre créée, configuration de la session...');

    // Configure session to handle storage properly
    const session = win.webContents.session;
    await session.clearStorageData({
      storages: ['appcache', 'filesystem', 'indexdb', 'localstorage', 'shadercache', 'websql', 'serviceworkers', 'cachestorage'],
    });

    console.log('Session configurée, attente du chargement...');

    // Test active push message to Renderer-process.
    win.webContents.on('did-finish-load', () => {
      console.log('Contenu chargé avec succès');
      win?.webContents.send('main-process-message', (new Date).toLocaleString())
    });

    win.on('ready-to-show', () => {
      console.log('Fenêtre prête à être affichée');
      if (win) {
        win.show();
        win.focus();
      }
    });

    // Vérifiez si VITE_DEV_SERVER_URL est défini
    if (process.env.VITE_DEV_SERVER_URL) {
      console.log('Chargement de l\'URL de développement:', process.env.VITE_DEV_SERVER_URL);
      await win.loadURL(process.env.VITE_DEV_SERVER_URL);
      win.webContents.openDevTools();
    } else {
      console.log('Chargement du fichier de production:', path.join(process.env.DIST, 'index.html'));
      win.loadFile(path.join(process.env.DIST, 'index.html'));
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

app.whenReady().then(async () => {
  console.log('Application prête, création de la fenêtre...');
  try {
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

// Ajouter les gestionnaires IPC pour la configuration
ipcMain.handle('get-config-views', async () => {
  const configService = ConfigService.getInstance();
  return await configService.getConfigViews();
});

// Gestionnaire pour ouvrir le dialogue de sélection de fichier
ipcMain.handle('open-file-dialog', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

// Gestionnaire pour initialiser la base de données
ipcMain.handle('init-db', async (event, path) => {
  try {
    // Initialisation de la base de données avec le chemin sélectionné
    await AppDataSource.initialize({
      type: "sqlite",
      database: path + "/database.db",
      // ... autres configurations
    });
    return { success: true };
  } catch (error) {
    return { success: false, error };
  }
});

export { ipcMain };

