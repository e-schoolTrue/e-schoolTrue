// @ts-nocheck
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import { AppDataSource } from "#electron/data-source.ts";
import './events';  // Importer tous les gestionnaires d'événements
import { registerReportEvents } from './events';
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

// Gestionnaire d'impression générique
ipcMain.handle('print', async (event, options = {}) => {
  try {
    if (!win) {
      console.error('Fenêtre principale non disponible pour l\'impression');
      return false;
    }

    console.log('Impression demandée avec les options:', options);
    
    // Configuration par défaut
    const defaultOptions = {
      silent: false,
      printBackground: true,
      color: true,
      margins: {
        marginType: 'default'
      },
      landscape: false,
      pagesPerSheet: 1,
      collate: true,
      copies: 1,
      pageRanges: []
    };

    // Fusionner les options par défaut avec celles fournies
    const printOptions = { ...defaultOptions, ...options };
    
    // Appel à l'API d'impression Electron
    await win.webContents.print(printOptions);
    return true;
  } catch (error) {
    console.error('Erreur lors de l\'impression:', error);
    return false;
  }
});

// Gestionnaire d'impression spécifique pour les cartes d'étudiants
ipcMain.handle('print:studentCardsMain', async (event, data) => {
  try {
    if (!win) {
      console.error('Fenêtre principale non disponible pour l\'impression des cartes');
      return {
        success: false,
        error: 'Fenêtre principale non disponible'
      };
    }
    
    console.log('Impression des cartes d\'étudiants demandée...');
    
    // Créer une URL temporaire en data pour l'impression
    const printContent = `
      <html>
      <head>
        <style>
          @page {
            size: ${data.options?.format === 'cr80' ? '85.6mm 54mm' : 'A4'};
            margin: 0;
          }
          body {
            margin: 0;
            padding: 0;
            background-color: white;
          }
          .card-container {
            width: 85.6mm;
            height: 54mm;
            position: relative;
            page-break-after: always;
            overflow: hidden;
            background-color: white;
          }
          ${data.options?.format === 'a4' ? `
          .card-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            grid-template-rows: repeat(2, 1fr);
            gap: ${data.options?.marginV || 5}mm ${data.options?.marginH || 5}mm;
            padding: ${data.options?.marginV || 5}mm ${data.options?.marginH || 5}mm;
          }` : ''}
        </style>
      </head>
      <body>
        <div class="${data.options?.format === 'a4' ? 'card-grid' : ''}">
          ${generateStudentCardsHTML(data.students, data.template, data.colorScheme, data.schoolInfo)}
        </div>
      </body>
      </html>
    `;
    
    // Charger le contenu HTML
    const tmpWin = new BrowserWindow({
      show: false,
      webPreferences: {
        offscreen: true,
      }
    });
    
    await tmpWin.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(printContent)}`);
    
    // Configurer les options d'impression
    const printOptions = {
      silent: false,
      printBackground: true,
      color: true,
      margins: {
        marginType: 'custom',
        top: 0,
        bottom: 0,
        left: 0,
        right: 0
      },
      landscape: data.options?.format === 'cr80',
      scaleFactor: 100,
      pagesPerSheet: 1,
      collate: true,
      copies: 1
    };
    
    // Imprimer directement
    console.log('[Debug Print] Options d\'impression:', JSON.stringify(printOptions, null, 2));
    console.log('[Debug Print] Contenu HTML complet avant impression:', printContent);
    await tmpWin.webContents.print(printOptions, (success, reason) => {
      console.log('Résultat impression:', success ? 'Succès' : `Échec: ${reason}`);
      if (!success) {
        console.error('Erreur d\'impression détaillée:', reason);
      }
      tmpWin.close();
    });
    
    return {
      success: true,
      message: 'Cartes envoyées à l\'imprimante'
    };
  } catch (error) {
    console.error('Erreur lors de l\'impression des cartes:', error);
    return {
      success: false,
      error: error.message || 'Erreur d\'impression'
    };
  }
});

// Fonction utilitaire pour générer le HTML des cartes
function generateStudentCardsHTML(students, templateId, colorScheme, schoolInfo) {
  if (!students || !Array.isArray(students) || students.length === 0) {
    return '<div>Aucun étudiant sélectionné</div>';
  }
  
  const now = new Date();
  const schoolYear = `${now.getFullYear()}-${now.getFullYear() + 1}`;
  const validUntil = new Date(now.getFullYear() + 1, 6, 31);
  const validDate = validUntil.toLocaleDateString('fr-FR');
  
  return students.map(student => {
    const photoUrl = student.photo?.optimizedUrl || student.photo?.url || '';
    const logoUrl = schoolInfo?.logo?.optimizedUrl || schoolInfo?.logo?.url || '';
    const primaryColor = colorScheme?.primary || '#1976D2';
    const secondaryColor = colorScheme?.secondary || '#FF5722';
    
    let cardHTML = '';
    
    switch (templateId) {
      case 'template2':
        // Template 2 - Style moderne
        cardHTML = `
          <div class="card-container">
            <div style="background-color: ${primaryColor}; color: white; padding: 3mm; text-align: center; margin-bottom: 2mm;">
              <div style="font-size: 4mm; font-weight: bold;">${schoolInfo?.name || ''}</div>
            </div>
            
            <div style="display: flex; flex-direction: column; align-items: center; padding: 2mm;">
              <div style="border-radius: 50%; overflow: hidden; width: 20mm; height: 20mm; margin-bottom: 2mm; border: 2mm solid ${secondaryColor};">
                <img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="Photo">
              </div>
              
              <div style="text-align: center;">
                <div style="font-size: 4.5mm; font-weight: bold; margin-bottom: 1mm; color: ${secondaryColor};">${student.firstname || ''} ${student.lastname || ''}</div>
                <div style="font-size: 3mm; margin-bottom: 1mm; color: #666;">№ ${student.matricule || ''}</div>
                <div style="font-size: 3mm; margin-bottom: 1mm;">Classe: ${student.grade?.name || ''}</div>
              </div>
            </div>
            
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background-color: ${secondaryColor}; color: white; padding: 2mm; text-align: center; font-size: 2.5mm;">
              Année scolaire ${schoolYear} · Valide jusqu'au: ${validDate}
            </div>
          </div>
        `;
        break;
      
      case 'template3':
        // Template 3 - Style premium
        cardHTML = `
          <div class="card-container">
            <div style="background: linear-gradient(135deg, ${primaryColor}, ${secondaryColor}); height: 10mm; position: relative; margin-bottom: 12mm;">
              <div style="position: absolute; top: 2mm; left: 2mm;">
                <img src="${logoUrl}" style="width: 6mm; height: 6mm; object-fit: contain;" alt="Logo">
              </div>
              <div style="position: absolute; top: 10mm; left: 50%; transform: translateX(-50%); background: white; border-radius: 50%; width: 20mm; height: 20mm; display: flex; justify-content: center; align-items: center; border: 0.5mm solid #ddd; overflow: hidden;">
                <img src="${photoUrl}" style="width: 19mm; height: 19mm; object-fit: cover;" alt="Photo">
              </div>
            </div>
            
            <div style="padding: 0 3mm; text-align: center;">
              <div style="font-size: 4mm; font-weight: bold; margin-bottom: 2mm; color: ${primaryColor};">${student.firstname || ''} ${student.lastname || ''}</div>
              <div style="font-size: 3mm; margin-bottom: 1mm; font-weight: 500; color: ${secondaryColor};">Matricule: ${student.matricule || ''}</div>
              <div style="font-size: 3mm; margin-bottom: 1mm;">Classe: ${student.grade?.name || ''}</div>
            </div>
            
            <div style="position: absolute; bottom: 0; left: 0; right: 0; background-color: #f5f5f5; padding: 2mm; display: flex; justify-content: space-between; font-size: 2.5mm;">
              <div>Année: ${schoolYear}</div>
              <div>Exp: ${validDate}</div>
            </div>
          </div>
        `;
        break;
      
      case 'template1':
      default:
        // Template 1 - Style classique (SIMPLIFIÉ POUR DEBUG)
        console.log(`[Debug Print] Génération Template 1 pour: ${student.firstname} ${student.lastname}`);
        console.log(`[Debug Print] Photo URL: ${photoUrl}`);
        console.log(`[Debug Print] Logo URL: ${logoUrl}`);
        cardHTML = `
          <div class="card-container" style="border: 1px solid black; padding: 5mm; box-sizing: border-box;">
            <h3 style="color: ${primaryColor};">${schoolInfo?.name || 'École'}</h3>
            <img src="${logoUrl}" style="width: 20mm; height: 20mm; object-fit: contain;" alt="Logo">
            <hr>
            <img src="${photoUrl}" style="width: 25mm; height: 32mm; object-fit: cover; border: 1px solid #ccc;" alt="Photo">
            <p style="font-weight: bold; color: ${secondaryColor};">${student.firstname || ''} ${student.lastname || ''}</p>
            <p>Matricule: ${student.matricule || ''}</p>
            <p>Classe: ${student.grade?.name || ''}</p>
            <p>Année: ${schoolYear} / Valide: ${validDate}</p>
          </div>
        `;
        console.log(`[Debug Print] HTML généré pour ${student.firstname}: ${cardHTML.substring(0, 200)}...`);
        break;
    }
    
    return cardHTML;
  }).join('');
}

registerReportEvents();
