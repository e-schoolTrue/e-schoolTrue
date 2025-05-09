// @ts-nocheck
import { app, BrowserWindow, ipcMain, dialog } from 'electron'
import path from 'node:path'
import { AppDataSource } from "#electron/data-source.ts";
import './events';  // Importer tous les gestionnaires d'événements
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

ipcMain.handle("backup:test:directInsert", async (_event: Electron.IpcMainInvokeEvent): Promise<ResultType> => {
  try {
    console.log('Début du test d\'insertion directe dans la table backups');
    const result = await global.backupService.testDirectInsert();
    return {
      success: result.success,
      data: result.error ? null : result.data,
      message: result.success ? 'Test d\'insertion directe réussi' : 'Échec du test d\'insertion directe',
      error: result.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors du test d\'insertion directe');
  }
});


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
    
    // Créer une fenêtre temporaire pour l'impression
    const tmpWin = new BrowserWindow({
      width: 856,
      height: 540,
      show: false, // La fenêtre est cachée par défaut
      webPreferences: {
        javascript: true,
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    const script = `
      document.write(\`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Impression des cartes</title>
            <meta charset="UTF-8">
            <style>
              @page {
                size: ${data.options?.format === 'cr80' ? '85.6mm 54mm' : 'A4'};
                margin: 0;
              }
              body {
                margin: 0;
                padding: ${data.options?.format === 'a4' ? `${data.options?.marginV || 5}mm ${data.options?.marginH || 5}mm` : '0'};
              }
              .card-grid {
                display: grid;
                grid-gap: ${data.options?.marginV || 5}mm ${data.options?.marginH || 5}mm;
                grid-template-columns: repeat(auto-fill, 85.6mm);
                justify-content: center;
              }
            </style>
          </head>
          <body>
            <div class="${data.options?.format === 'a4' ? 'card-grid' : ''}">
              ${generateStudentCardsHTML(data.students, data.template, data.colorScheme, data.schoolInfo)}
            </div>
          </body>
        </html>
      \`);
    `;

    return new Promise((resolve) => {
      tmpWin.loadURL('about:blank')
        .then(() => tmpWin.webContents.executeJavaScript(script))
        .then(() => {
          // Attendre que le contenu soit chargé
          tmpWin.webContents.on('did-finish-load', async () => {
            try {
              // Montrer la fenêtre temporairement
              tmpWin.show();

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
                landscape: true,
                scaleFactor: 100,
                shouldPrintBackgrounds: true,
                pageSize: {
                  width: 85600,
                  height: 54000
                }
              };

              // Attendre un court instant pour s'assurer que la fenêtre est bien rendue
              await new Promise(r => setTimeout(r, 500));

              tmpWin.webContents.print(printOptions, (success, errorType) => {
                console.log('Résultat impression:', success ? 'Succès' : `Erreur: ${errorType}`);
                
                // Attendre un peu avant de fermer la fenêtre
                setTimeout(() => {
                  tmpWin.close();
                  resolve({
                    success: success,
                    message: success ? 'Impression terminée avec succès' : `Erreur: ${errorType}`
                  });
                }, 500);
              });
            } catch (error) {
              console.error('Erreur lors de l\'impression:', error);
              tmpWin.close();
              resolve({
                success: false,
                error: error instanceof Error ? error.message : 'Erreur inconnue'
              });
            }
          });
        })
        .catch(error => {
          console.error('Erreur lors du chargement de la page:', error);
          tmpWin.close();
          resolve({
            success: false,
            error: error instanceof Error ? error.message : 'Erreur inconnue'
          });
        });
    });
  } catch (error) {
    console.error('Erreur lors de la préparation de l\'impression:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erreur inconnue'
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
