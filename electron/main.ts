
import 'reflect-metadata';
import { app, BrowserWindow, ipcMain, dialog } from 'electron';
import path from 'node:path';
import dotenv from 'dotenv';
import './config/env';

// --- Services et Logique Métier ---
import { AppDataSource } from "./data-source";
import { ConfigService } from './backend/services/configService';
import { AuthService } from './backend/services/authService';
import { CloudSyncService } from './backend/services/backupService';
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

// --- Handlers IPC ---
import { registerIpcHandlers } from './events';

// =================================================================
// DÉCLARATION GLOBALE
// =================================================================
declare global {
  var authService: AuthService;
  var backupService: CloudSyncService;
  var gradeService: GradeService;
  var courseService: CourseService;
  var studentService: StudentService;
  var fileService: FileService;
  var paymentService: PaymentService;
  var absenceService: AbsenceService;
  var schoolService: SchoolService;
  var yearRepartitionService: YearRepartitionService;
  var professorService: ProfessorService;
  var dashboardService: DashboardService;
  var homeworkService: HomeworkService;
  var vacationService: VacationService;
  var scholarshipService: ScholarshipService;
  var reportCardService: ReportCardService;
  var gradeConfigService: GradeConfigService;
  var preferenceService: PreferenceService;
  var configService: ConfigService;
  var licenseService: LicenseService;
}

// =================================================================
// INITIALISATION DE L'ENVIRONNEMENT
// =================================================================
dotenv.config();
console.log('Démarrage de l\'application...');

process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null;

// =================================================================
// FONCTION PRINCIPALE DE DÉMARRAGE
// =================================================================

async function startApplication() {
  console.log('--- DÉBUT DU FLUX DE DÉMARRAGE ---');

  console.log('[1/4] Initialisation du ConfigService...');
  const configService = ConfigService.getInstance();
  const isFirstLaunch = configService.isFirstLaunch();
  console.log(`[1/4] État détecté : Premier lancement = ${isFirstLaunch}`);

  console.log('[2/4] Initialisation de la source de données...');
  try {
    await AppDataSource.initialize(isFirstLaunch);
    console.log('[2/4] Source de données initialisée avec succès.');
  } catch (error) {
    console.error("Erreur fatale lors de l'initialisation de la source de données:", error);
    throw error;
  }

  console.log('[3/4] Initialisation des services métier et des handlers IPC...');
  global.configService = configService;
  global.authService = new AuthService();
  global.backupService = new CloudSyncService();
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
  global.licenseService = new LicenseService(); // correction ici : instanciation

  registerIpcHandlers();
  console.log('[3/4] Services et handlers IPC initialisés avec succès.');

  console.log('[4/4] Création de la fenêtre principale...');
  await createWindow();
  console.log('[4/4] Fenêtre créée.');
  console.log('--- FLUX DE DÉMARRAGE TERMINÉ ---');
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

app.whenReady().then(async () => {
  console.log('Événement "app.whenReady" déclenché.');
  try {
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
