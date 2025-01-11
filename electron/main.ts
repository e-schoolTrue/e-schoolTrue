// @ts-nocheck
import { app, BrowserWindow, ipcMain } from 'electron'
import path from 'node:path'
import { AppDataSource } from "#electron/data-source.ts";
import './events'
import { registerReportEvents } from './events';

process.env.DIST = path.join(__dirname, '../dist')
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public')

let win: BrowserWindow | null
let dataSourceInitialized = false;

async function initializeDataSource() {
  if (!dataSourceInitialized) {
    console.log("Début de l'initialisation de la base de données");
    await AppDataSource.initialize();
    console.log("Base de données initialisée avec succès");
    dataSourceInitialized = true;
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
    console.error("Erreur lors de la création de la fenêtre:", error);
    app.quit();
  }
}

app.whenReady().then(async () => {
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

registerReportEvents();
