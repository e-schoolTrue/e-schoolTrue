// @ts-nocheck
import "reflect-metadata";
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import { autoUpdater } from 'electron-updater';
import path from 'node:path';
import * as fs from 'node:fs';
import { AppDataSource } from "#electron/data-source.ts";
import { runMigrationsSafely } from './migration-runner';
import { isValidNativeBinary, readBinaryHeader, expectedBinaryLabel, toLoadableNativePath } from './backend/lib/native-binding';
import './config/env';
import { registerIpcHandlers } from './events';
import { ConfigService } from './backend/services/configService';
import { AuthService } from './backend/services/authService';
import { CloudSyncService } from './backend/services/backupService';
import { getLocalBackupService } from './backend/services/localBackupService';
import { GradeService } from "./backend/services/gradeService";
import { CourseService } from "./backend/services/courseService";
import { StudentService } from "./backend/services/studentService";
import { FileService } from "./backend/services/fileService";
import { YearRepartitionService } from "./backend/services/yearService";
import { PaymentService } from "./backend/services/paymentService";
import { AbsenceService } from "./backend/services/absenceService";
import { SchoolService } from "./backend/services/schoolService";
import { ProfessorService } from "./backend/services/professorService";
import { DashboardService } from "./backend/services/dashboardService";
import { HomeworkService } from "./backend/services/homeworkService";
import { VacationService } from "./backend/services/vacationService";
import { ScholarshipService } from "./backend/services/scholarshipService";
import { ReportCardService } from "./backend/services/reportCardService";
import { GradeConfigService } from "./backend/services/gradeConfigService";
import { PreferenceService } from "./backend/services/preferenceService";
import { LicenseService } from "./backend/services/licenseService";
import { ScheduleService } from './backend/services/scheduleService';
import { ScheduleConfigService } from './backend/services/scheduleConfigService';
import { InscriptionFeeService } from "./backend/services/inscription-fee.service";
import { PaymentAnnualConfigService } from './backend/services/payment-annual-config.service';
import { ConfigNoteService } from "./backend/services/note-config-service";
import { GradeEntryService } from "./backend/services/gradeEntryService";
import { CentralizedPdfService } from "./backend/services/centralizedPdfService";
import { AuditLogService } from "./backend/services/auditLogService";
import { UserAdminService } from "./backend/services/userAdminService";
import { accountingService } from "./backend/services/accountingService";
import { accountingAuthService } from "./backend/services/accountingAuthService";




// =================================================================
// INITIALISATION DE L'ENVIRONNEMENT
// =================================================================
console.log('Démarrage de l\'application...');

// CDP pour playwright-mcp (dev-only). MUST be before app.whenReady().
if (!app.isPackaged) {
  const cdpPort = process.env.CDP_PORT ?? '9222';
  app.commandLine.appendSwitch('remote-debugging-port', cdpPort);
  app.commandLine.appendSwitch('remote-allow-origins', '*');
  console.log(`[CDP] remote-debugging-port=${cdpPort} (dev-only)`);
}

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null;


// =================================================================
// INITIALISATION DES SERVICES
// =================================================================

function initializeServices() {
  global.authService = new AuthService();
  global.backupService = new CloudSyncService();
  global.localBackupService = getLocalBackupService();
  global.gradeService = new GradeService();
  global.courseService = new CourseService();
  global.studentService = new StudentService();
  global.fileService = new FileService();
  global.paymentService = new PaymentService();
  global.absenceService = new AbsenceService();
  global.schoolService = new SchoolService();
  global.yearRepartitionService = new YearRepartitionService();
  global.professorService = new ProfessorService();
  global.dashboardService = new DashboardService();
  global.homeworkService = new HomeworkService();
  global.vacationService = new VacationService();
  global.scholarshipService = new ScholarshipService();
  global.reportCardService = new ReportCardService();
  global.gradeConfigService = new GradeConfigService();
  global.preferenceService = new PreferenceService();
  global.licenseService = new LicenseService();
  global.scheduleService = new ScheduleService();
  global.scheduleConfigService = new ScheduleConfigService();
  global.inscriptionFeeService = new InscriptionFeeService();
  global.paymentAnnualConfigService = new PaymentAnnualConfigService();
  global.configNoteService = new ConfigNoteService();
  global.gradeEntryService = new GradeEntryService();
  global.centralizedPdfService = new CentralizedPdfService();
  global.auditLogService = new AuditLogService();
  global.userAdminService = new UserAdminService();
  (global as any).accountingService = accountingService;
  (global as any).accountingAuthService = accountingAuthService;
}

// =================================================================
// GARDE PILOTE NATIF (better-sqlite3) — PLATFORM-AWARE.
// Le binaire natif a déjà été retrouvé remplacé par un build d'une autre
// plateforme (ex. DLL Windows sur Linux → "invalid ELF header"), ce qui
// faisait échouer TypeORM avec une erreur cryptique. Inversement, exiger
// ELF partout BLOQUE les postes Windows (binaire PE légitime) : la
// validation dépend donc de process.platform (voir lib/native-binding).
// Fail-closed avec message actionnable (jamais de consigne npm en packagé).
// =================================================================
function verifyNativeBinding(): void {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require('node:fs') as typeof import('node:fs');
  const candidates: string[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    candidates.push(require.resolve('better-sqlite3/build/Release/better_sqlite3.node'));
  } catch { /* résolu via replis ci-dessous */ }
  // Replis : dev (repo) et prod (asar.unpacked voisin du bundle).
  candidates.push(
    path.join(__dirname, '..', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
    path.join(process.resourcesPath ?? '', 'app.asar.unpacked', 'node_modules', 'better-sqlite3', 'build', 'Release', 'better_sqlite3.node'),
  );
  const isOk = (p: string): boolean => {
    const header = readBinaryHeader(p, fs);
    return header !== null && isValidNativeBinary(header, process.platform);
  };
  // En packagé, require.resolve pointe DANS app.asar, mais dlopen charge en
  // réalité la copie dépaquetée (voir toLoadableNativePath).
  if (app.isPackaged) {
    const resolved = candidates.length > 0 ? toLoadableNativePath(candidates[0]) : null;
    if (resolved && isOk(resolved)) return; // cas nominal packagé
    const fallback = candidates
      .slice(1)
      .map(toLoadableNativePath)
      .find((p) => isOk(p));
    if (fallback) {
      console.log(`[0/4] Pilote natif packagé OK via ${fallback}`);
      return;
    }
    // Pas de restauration auto en packagé (Program Files, installateur
    // partiel…) : fail-closed avec consigne de réinstallation.
    throw new Error(
      `Pilote natif better-sqlite3 invalide ou absent (attendu : ${expectedBinaryLabel(process.platform)}). ` +
        'Réinstallez l\u2019application depuis le dernier installeur puis redémarrez.'
    );
  }
  const target = candidates.find((p) => { try { return fs.existsSync(p); } catch { return false; } });
  if (target && isOk(target)) return; // cas nominal dev
  // Tentative de restauration (dev uniquement) : première copie saine (même plateforme).
  const healthy = candidates.find((p) => p !== target && isOk(p));
  if (target && healthy) {
    try {
      fs.copyFileSync(healthy, target);
      console.log(`[0/4] Pilote natif restauré depuis ${healthy}`);
      if (isOk(target)) return;
    } catch (e) {
      console.error('[0/4] Restauration du pilote natif échouée:', (e as Error)?.message ?? e);
    }
  }
  const expected = expectedBinaryLabel(process.platform);
  throw new Error(
    app.isPackaged
      ? `Pilote natif better-sqlite3 invalide ou absent (attendu : ${expected}). ` +
        'Réinstallez l\u2019application depuis le dernier installeur puis redémarrez.'
      : `Pilote natif better-sqlite3 invalide ou absent (attendu : ${expected}). ` +
        'Relancez `npm run rebuild:db-driver` puis redémarrez.'
  );
}

// =================================================================
// PRE-BOOT FROID [1.5/4] — fix 1.1.31 (auto-repair Oui, synchronize:false).
// Problème : synchronize:true AVANT runMigrations créait
// temporary_tranch_config SANS IF NOT EXISTS ; après interruption le
// fantôme faisait échouer initialize() en boucle AVANT tout backup.
// Implémentation dédupliquée dans ./preboot (stamp/pid, prune keep=5,
// trio WAL, garde hasReal, integrity_check). Ce fichier ne fait que
// réimporter pour startApplication (évite les miroirs main/runner/repair).
// =================================================================
import { preBootRepair } from './preboot';

// =================================================================
// FONCTION PRINCIPALE DE DÉMARRAGE
// =================================================================


async function startApplication() {
  console.log('--- DÉBUT DU FLUX DE DÉMARRAGE ---');

  console.log('[0/4] Vérification du pilote natif better-sqlite3...');
  verifyNativeBinding();
  console.log('[0/4] Pilote natif OK.');

  console.log('[1/4] Initialisation du ConfigService...');
  const configService = ConfigService.getInstance();
  const isFirstLaunch = configService.isFirstLaunch();
  console.log(`[1/4] État détecté : Premier lancement = ${isFirstLaunch}`);

  console.log('[1.5/4] Repair froid pré-boot (backup + purge temporary_* + integrity_check)...');
  try {
    const coldDbPath = path.join(app.getPath('userData'), 'database.db');
    preBootRepair(coldDbPath);
  } catch (error) {
    console.error('[1.5/4] Pre-boot repair ÉCHEC — arrêt avant initialize:', error);
    try { dialog.showErrorBox('Base corrompue (pré-démarrage)', `Vérification pré-démarrage impossible. Un backup froid .pre-boot-*.db a été conservé à côté de database.db. Erreur: ${(error as Error)?.message ?? error}`); } catch { /* headless */ }
    throw error;
  }

  console.log('[2/4] Initialisation de la source de données...');
  try {
    await AppDataSource.initialize(isFirstLaunch);
    console.log('[2/4] Source de données initialisée avec succès.');
  } catch (error) {
    console.error("Erreur fatale lors de l'initialisation de la source de données:", error);
    throw error;
  }

  console.log('[2b/4] Migrations sécurisées (backup + baseline + vérifs)...');
  const prevAutoDownload = autoUpdater.autoDownload;
  const prevAutoInstall = autoUpdater.autoInstallOnAppQuit;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  try {
    const ds = AppDataSource.getInstance();
    const dbPath = (ds.options as unknown as { database?: string }).database
      ?? path.join(app.getPath('userData'), 'database.db');
    const res = await runMigrationsSafely(ds, dbPath);
    console.log(`[2b/4] Migrations OK (ran=${res.ran.length}, baselineMarked=${res.baselineMarked}, backup=${res.backupPath || '(fresh-sans-backup)'}).`);
  } catch (error) {
    console.error('[2b/4] Échec migrations — restore auto tenté par le runner:', error);
    try { dialog.showErrorBox('Échec de Migration', `Migration impossible. Un backup pré-migration a été restauré automatiquement. Erreur: ${(error as Error)?.message ?? error}`); } catch { /* headless */ }
    throw error;
  } finally {
    autoUpdater.autoDownload = prevAutoDownload;
    autoUpdater.autoInstallOnAppQuit = prevAutoInstall;
  }


  console.log('[3/4] Initialisation des services métier...');
  initializeServices();
  console.log('[3/4] Services métier initialisés avec succès.');

  // V3 : rattrapage auto-création année N+1 (best-effort, ne bloque jamais createWindow).
  try {
    await (global as any).yearRepartitionService?.ensureSchoolYear?.(new Date()).then((r: any) => {
      if (r?.data) console.log(`[3c/4] Année auto-créée : ${(r.data as any).schoolYear}`);
    }).catch((e: any) => console.warn("[3c/4] ensureSchoolYear différé:", e?.message ?? e));
  } catch (e: any) {
    console.warn("[3c/4] ensureSchoolYear ignoré (best-effort):", e?.message ?? e);
  }

  console.log('[3b/4] Restauration de la session locale...');
  try {
    await global.authService.init();
    // Log sans PII : booléen uniquement, ni id, ni username, ni displayName.
    const restored = await global.authService.getCurrentUser().then((u) => !!u).catch(() => false);
    console.log(`[3b/4] Session locale restaurée: ${restored ? 'oui' : 'non'}.`);
  } catch (error) {
    console.warn('[3b/4] Restauration de la session locale impossible (poursuite sans session):', (error as Error)?.message ?? error);
  }

  await global.auditLogService.init();

  console.log('[3/5] Initialisation des handlers IPC...');
  registerIpcHandlers();
  console.log('[3/5] Handlers IPC initialisés avec succès.');

  console.log('[4/4] Création de la fenêtre principale...');
  await createWindow();
  console.log('[4/4] Fenêtre créée.');

  console.log('--- FLUX DE DÉMARRAGE TERMINÉ ---');
}
async function setupAutoUpdate() {
  // Configuration de l'auto-update
  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  // Gestion globale des erreurs non capturées de l'updater
  process.on('unhandledRejection', (reason, promise) => {
    console.error('[Updater] Unhandled Rejection at:', promise, 'reason:', reason)
  })
  process.on('uncaughtException', (error) => {
    console.error('[Updater] Uncaught Exception:', error)
  })

  // Configuration pour le mode développement - désactiver les vérifications réseau
  if (!app.isPackaged) {
    autoUpdater.logger = {
      info: (message: string) => console.log(message),
      warn: (message: string) => console.warn(message),
      error: (message: string, error?: Error) => {
        console.error(message, error)
      },
      debug: (message: string) => console.debug(message)
    }

    // En dev, ne pas utiliser le serveur de mise à jour (évite http://localhost:3000/updates → Grafana HTML)
    autoUpdater.autoDownload = false
    autoUpdater.autoInstallOnAppQuit = false
    autoUpdater.logger.info('Mode développement: auto-update désactivé (évite les erreurs de parsing)')

    // Désactiver la vérification des certificats SSL en développement
    app.commandLine.appendSwitch('ignore-certificate-errors')
    return
  }

  // En production, activer les logs détaillés si besoin
  autoUpdater.logger = autoUpdater.logger || console as any
}

async function createWindow() {
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
      webSecurity: true,
    },
  });

  win.webContents.on('did-finish-load', () => {
    console.log('Contenu de la fenêtre chargé.');
    win?.webContents.send('main-process-message', `Bienvenue ! Heure du serveur: ${new Date().toLocaleString()}`);
  });

  win.on('ready-to-show', () => {
    console.log('Fenêtre prête à être affichée.');
    win?.show();
    win?.focus();
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    console.log('Chargement de l\'URL du serveur de développement VITE...');
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    console.log('Chargement du fichier de production...');
    await win.loadFile(path.join(process.env.DIST, 'index.html'));
  }
}

// =================================================================
// CYCLE DE VIE DE L'APPLICATION 
// =================================================================
// Gestion des événements de mise à jour
setupAutoUpdate()
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


// Gestion des événements de mise àjour automatique depuis le rendu
ipcMain.handle('check-for-updates', async () => {
  if (!app.isPackaged) {
    console.log('Vérification des mises à jour demandée depuis le rendu (mode développement) - simulée')
    // Simuler une mise à jour en développement sans appel réseau
    const updateInfo = {
      version: '1.0.1',
      releaseDate: new Date().toISOString(),
      releaseNotes: ['Corrections de bugs', 'Amélioration des performances']
    }
    win?.webContents.send('update_available', updateInfo)
    return { success: true, updateInfo }
  } else {
    try {
      const updateCheckResult = await autoUpdater.checkForUpdates()
      return { success: true, updateInfo: updateCheckResult?.updateInfo }
    } catch (error: any) {
      console.error('Erreur lors de la vérification des mises à jour (gérée):', error?.message || error)
      return { success: false, error: error?.message || String(error) }
    }
  }
})

ipcMain.handle('download-update', async () => {
  console.log('Téléchargement de la mise à jour demandé')
  try {
    const result = await autoUpdater.downloadUpdate()
    console.log('Téléchargement de la mise à jour démarré: ', result)
    return { success: true, result }
  } catch (error: any) {
    console.error('Erreur lors du téléchargement (gérée):', error?.message || error)
    return { success: false, error: error?.message || String(error) }
  }
})

ipcMain.handle('install-update', () => {
  console.log('Installation de la mise à jour demandée')
  setImmediate(() => autoUpdater.quitAndInstall())
  return Promise.resolve()
})

app.whenReady().then(async () => {
  console.log('Événement "app.whenReady" déclenché.');
  try {
    // Vérifier les mises à jour au démarrage (uniquement en production)
    if (app.isPackaged) {
      console.log('Vérification des mises à jour...')
      autoUpdater.checkForUpdatesAndNotify().catch(err => console.error('[Updater] check failed (ignored):', err?.message || err))

      // Vérifier les mises à jour toutes les heures
      setInterval(() => {
        console.log('Vérification périodique des mises à jour...')
        autoUpdater.checkForUpdatesAndNotify().catch(err => console.error('[Updater] periodic check failed (ignored):', err?.message || err))
      }, 60 * 60 * 1000)
    } else {
      console.log('Mode développement: vérification des mises à jour désactivée (dev-app-update.yml pointe vers localhost:3000)')
    }
    await startApplication();
  } catch (error) {
    console.error("Échec critique du démarrage de l'application dans whenReady:", error);
    dialog.showErrorBox('Échec du Démarrage', `Impossible de démarrer l'application. Erreur: ${error.message}`);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('quit', () => {
  win = null;
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    startApplication();
  }
});

export { ipcMain };
