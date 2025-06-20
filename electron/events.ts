import { ipcMain, dialog, shell } from 'electron';
import path from "path";
import { ResultType } from "./command/index";
import { GradeCommand, BranchCommand, ClassRoomCommand, CourseCommand } from "./command/settingsCommand";
import { SyncConfig, SyncHistory } from './backend/services/backupService';
import fs from 'fs/promises';

// =================================================================
// FONCTIONS UTILITAIRES
// =================================================================

const handleError = (error: any, message: string): ResultType => {
  console.error("Erreur IPC:", message, error);
  return {
    success: false,
    message: `${message}: ${error.message}`,
    error: error instanceof Error ? error.message : String(error),
    data: null,
  };
};

// =================================================================
// FONCTION D'ENREGISTREMENT DES HANDLERS
// =================================================================

export function registerIpcHandlers() {
  console.log('Enregistrement des handlers IPC...');

  // --- Authentification ---
  ipcMain.handle("auth:create", async (_, userData) => global.authService.createSupervisor(userData.username, userData.password, userData.securityQuestion, userData.securityAnswer));
  ipcMain.handle("auth:validate", async (_, { username, password }) => global.authService.validateSupervisor(username, password));
  ipcMain.handle("auth:getSecurityQuestion", async (_, { username }) => global.authService.getSecurityQuestion(username));
  ipcMain.handle("auth:validateSecurityAnswer", async (_, { username, answer }) => global.authService.validateSecurityAnswer(username, answer));
  ipcMain.handle("auth:resetPassword", async (_, { username, newPassword }) => global.authService.resetPassword(username, newPassword));
  ipcMain.handle("auth:login", async (_, credentials) => global.authService.validateSupervisor(credentials.username, credentials.password));

  // --- Authentification Supabase ---
  ipcMain.handle("auth:createSupabaseAccount", async (_, { email, password }) => global.authService.createSupabaseAccount(email, password));
  ipcMain.handle("auth:loginSupabase", async (_, { email, password }) => global.authService.signInWithSupabase(email, password));
  ipcMain.handle("auth:signOut", async () => {
    try {
      await global.authService.signOutFromSupabase();
      return {
        success: true,
        message: "Déconnexion réussie",
        data: null,
        error: null
      };
    } catch (error) {
      return handleError(error, "Erreur lors de la déconnexion");
    }
  });
  ipcMain.handle("auth:checkStatus", async () => {
    const localUser = await global.authService.getCurrentUser();
    const isCloudConnected = await global.authService.isSupabaseSessionValid();
    const isSupabaseAvailable = await global.backupService.checkSupabaseAvailability();
    return {
      success: true,
      data: {
        isAuthenticated: !!localUser,
        user: localUser,
        supabaseStatus: { isAvailable: isSupabaseAvailable, isConnected: isCloudConnected }
      },
      message: "Statut vérifié", error: null
    };
  });

  // --- Sauvegarde / Synchro (Backup) ---
  ipcMain.handle('sync:now', async (): Promise<{ success: boolean; data?: SyncHistory; error?: string }> => {
    try {
      const user = await global.backupService.getSupabaseAuthUser();
      if (!user?.id) {
        return { success: false, error: 'Utilisateur non authentifié. Veuillez vous connecter au cloud.' };
      }
      
      const syncResult = await global.backupService.performBidirectionalSync(user.id);

      if (syncResult.status === 'failed') {
        return { success: false, data: syncResult, error: syncResult.error_message || 'La synchronisation a échoué.' };
      }
      
      return { success: true, data: syncResult };
    } catch (error) {
      return handleError(error, "sync:now");
    }
  });

  // [OK] Récupère l'historique des synchronisations
  ipcMain.handle('sync:getHistory', async (): Promise<{ success: boolean; data?: SyncHistory[]; error?: string }> => {
    try {
      // Vérifier d'abord si l'utilisateur est connecté localement
      const isConnected = await global.authService.isSupabaseSessionValid();
      if (!isConnected) {
        // Pas de session valide = pas d'historique, retourner un tableau vide
        return { success: true, data: [] };
      }

      // Essayer de récupérer l'utilisateur avec un timeout
      const user = await Promise.race([
        global.backupService.getSupabaseAuthUser(),
        new Promise<null>((_, reject) => 
          setTimeout(() => reject(new Error('Timeout')), 5000)
        )
      ]);

      if (!user?.id) {
        return { success: true, data: [] };
      }
      
      const history = await global.backupService.getLocalSyncHistory(user.id);
      return { success: true, data: history };
    } catch (error) {
      console.warn('Erreur lors de la récupération de l\'historique:', error);
      // En cas d'erreur, retourner un tableau vide plutôt qu'une erreur
      return { success: true, data: [] };
    }
  });

  // [OK] Récupère la configuration de la synchronisation
  ipcMain.handle('sync:getConfig', async (): Promise<{ success: boolean; data?: SyncConfig; error?: string }> => {
    try {
      const config = await global.backupService.loadSyncConfig();
      return { success: true, data: config };
    } catch (error) {
      return handleError(error, "sync:getConfig");
    }
  });

  // [OK] Met à jour la configuration de la synchronisation
  ipcMain.handle('sync:updateConfig', async (_event, newConfig: Partial<SyncConfig>): Promise<{ success: boolean; error?: string }> => {
    if (!newConfig) {
      return { success: false, error: 'Aucune configuration fournie.' };
    }
    try {
      await global.backupService.updateSyncConfig(newConfig);
      return { success: true };
    } catch (error) {
      return handleError(error, "sync:updateConfig");
    }
  });

  // --- Grades & Salles de classe ---
  ipcMain.handle("grade:all", async () => global.gradeService.getGrades());
  ipcMain.handle("grade:new", async (_, command: GradeCommand) => global.gradeService.newGrade(command));
  ipcMain.handle("grade:update", async (_, command: GradeCommand) => global.gradeService.updateGrade(command));
  ipcMain.handle("grade:delete", async (_, id: number) => global.gradeService.deleteGrade(id));
  ipcMain.handle("classRoom:new", async (_, command: ClassRoomCommand) => global.gradeService.newClassRoom(command));
  ipcMain.handle("classRoom:delete", async (_, id: number) => global.gradeService.deleteClassRoom(id));
  ipcMain.handle("classRoom:update", async (_, command: ClassRoomCommand) => global.gradeService.updateClassRoom(command));
  ipcMain.handle("classRoom:all", async () => global.gradeService.getClassRooms());
  ipcMain.handle("branch:new", async (_, command: BranchCommand) => global.gradeService.newBranch(command));
  ipcMain.handle("branch:update", async (_, command: BranchCommand) => global.gradeService.updateBranch(command));
  ipcMain.handle("branch:delete", async (_, id: number) => global.gradeService.deleteBranch(id));

  // --- Cours ---
  ipcMain.handle("course:new", async (_, command: CourseCommand) => global.courseService.newCourse(command));
  ipcMain.handle("courseGroup:add", async (_, command: CourseCommand) => global.courseService.addCourseToGroupement(command));
  ipcMain.handle("course:update", async (_, command: CourseCommand) => global.courseService.updateCourse({ id: command.id!, data: { name: command.name!, coefficient: command.coefficient, code: command.code! } }));
  ipcMain.handle("course:delete", async (_, id: number) => global.courseService.deleteCourse(id));
  ipcMain.handle("course:all", async () => global.courseService.getAllCourse());

  // --- Étudiants ---
  ipcMain.handle("student:all", async () => ({ success: true, data: await global.studentService.getAllStudents(), message: "Étudiants récupérés" }));
  ipcMain.handle("student:getDetails", async (_, studentId: number) => global.studentService.getStudentDetails(studentId));
  ipcMain.handle("save-student", async (_, studentData) => studentData.id ? global.studentService.updateStudent(studentData.id, studentData) : global.studentService.createStudent(studentData));
  ipcMain.handle("update-student", async (_, { studentId, studentData }) => global.studentService.updateStudent(studentId, studentData));
  ipcMain.handle("delete-student", async (_, studentId: number) => global.studentService.deleteStudent(studentId));
  ipcMain.handle("student:getByGrade", async (_, gradeId: number) => global.studentService.getStudentsByGrade(gradeId));
  ipcMain.handle("student:getById", async (_, studentId: number) => global.studentService.getStudentById(studentId));
  ipcMain.handle("student:search", async (_, query: string) => global.studentService.searchStudents(query));

  // --- Professeurs ---
  ipcMain.handle("professor:all", async () => global.professorService.getAllProfessors());
  ipcMain.handle("professor:create", async (_, professorData) => global.professorService.createProfessor(professorData));
  ipcMain.handle("professor:update", async (_, { id, data }) => global.professorService.updateProfessor(id, data));
  ipcMain.handle("professor:delete", async (_, professorId: number) => global.professorService.deleteProfessor(professorId));
  ipcMain.handle("professor:getById", async (_, professorId: number) => global.professorService.getProfessorById(professorId));
  ipcMain.handle("professor:search", async (_, query: string) => global.professorService.searchProfessors(query));
  ipcMain.handle("professor:count", async () => global.professorService.getTotalProfessors());

  // --- Fichiers ---

  ipcMain.handle('file:upload', async (_event, fileData: { name: string; type: string; content: string }) => {
    try {
      const result = await global.fileService.saveFile({
        name: fileData.name,
        type: fileData.type,
        content: fileData.content // Le contenu base64 doit être sauvegardé en base
      });
  
      return {
        success: true,
        data: result,
        message: 'Fichier uploadé avec succès',
        error: null
      };
    } catch (error) {
      return handleError(error, "Erreur lors de l'upload du fichier");
    }
  });
  ipcMain.handle('file:getUrl', async (_event, filePath) => {
    try {
      // Récupérer le fichier depuis le service
      const fileId = typeof filePath === 'number' ? filePath : (filePath?.id || null);
      if (!fileId) {
        return {
          success: false,
          data: null,
          error: "ID du fichier manquant",
          message: "L'ID du fichier est requis"
        };
      }
  
      const file = await global.fileService.getFileById({ fileId });
      if (!file) {
        return {
          success: false,
          data: null,
          error: "Fichier non trouvé",
          message: "Le fichier n'a pas pu être récupéré"
        };
      }
  
      const content = Buffer.isBuffer(file.content) 
        ? file.content.toString('base64')
        : Buffer.from(file.content).toString('base64');
  
      return {
        success: true,
        data: {
          content: content,
          type: file.type,
          name: file.name,
          path: file.path
        },
        error: null,
        message: "Fichier récupéré avec succès"
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du fichier:', error);
      return handleError(error, 'Erreur lors de la récupération du fichier');
    }
  });
  ipcMain.handle('file:download', async (_event, params) => {
    try {
      if (!params.path) {
        return {
          success: false,
          data: null,
          error: "Chemin du fichier manquant",
          message: "Le chemin du fichier est requis"
        };
      }
  
      const fileExists = await fs.access(params.path).then(() => true).catch(() => false);
      if (!fileExists) {
        return {
          success: false,
          data: null,
          error: "Fichier introuvable",
          message: "Le fichier demandé n'existe pas"
        };
      }
  
      // Le téléchargement sera géré côté client
      return {
        success: true,
        data: {
          path: params.path,
          name: params.name
        },
        error: null,
        message: "Fichier prêt pour le téléchargement"
      };
    } catch (error) {
      console.error('Erreur lors du téléchargement du fichier:', error);
      return handleError(error, 'Erreur lors du téléchargement du fichier');
    }
  });
  
  ipcMain.handle("getStudentPhoto", async (_event: Electron.IpcMainInvokeEvent, photoId: number): Promise<ResultType> => {
    try {
        const photo = await global.fileService.getFileById({ fileId: photoId });
        if (!photo) {
            return {
                success: false,
                data: null,
                error: "Photo non trouvée",
                message: "La photo n'a pas pu être récupérée"
            };
        }

        // Convertir le Buffer en base64
        const base64Content = photo.content.toString('base64');
        console.log("Taille du contenu base64:", base64Content.length);

        return {
            success: true,
            data: {
                content: base64Content,
                type: photo.type,
                name: photo.name
            },
            error: null,
            message: "Photo récupérée avec succès"
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la récupération de la photo de l\'étudiant');
    }
});
  ipcMain.handle("student:downloadDocument", async (_event: Electron.IpcMainInvokeEvent, documentId: number): Promise<ResultType> => {
    try {
      const document = await global.fileService.getFileById({ fileId: documentId });
      if (!document) {
        return {
          success: false,
          data: null,
          error: "Document non trouvé",
          message: "Le document n'a pas pu être récupéré"
        };
      }
  
      // S'assurer que le contenu est un Buffer avant de le convertir en base64
      const content = Buffer.isBuffer(document.content) 
        ? document.content.toString('base64')
        : Buffer.from(document.content).toString('base64');
  
      console.log('Type du document:', document.type);
      console.log('Nom du document:', document.name);
      console.log('Taille du contenu encodé:', content.length);
  
      return {
        success: true,
        data: {
          content: content,
          type: document.type,
          name: document.name
        },
        error: null,
        message: "Document récupéré avec succès"
      };
    } catch (error) {
      console.error('Erreur lors de la récupération du document:', error);
      return handleError(error, 'Erreur lors de la récupération du document');
    }
  });
  ipcMain.handle("getProfessorPhoto", async (_event: Electron.IpcMainInvokeEvent, photoId: number): Promise<ResultType> => {
    try {
        const photo = await global.fileService.getFileById({ fileId: photoId });
        if (!photo) {
            return {
                success: false,
                data: null,
                error: "Photo non trouvée",
                message: "La photo n'a pas pu être récupérée"
            };
        }
  
        // Convertir le Buffer en base64
        const base64Content = photo.content.toString('base64');
        console.log("Taille du contenu base64:", base64Content.length);
  
        return {
            success: true,
            data: {
                content: base64Content,
                type: photo.type,
                name: photo.name
            },
            error: null,
            message: "Photo récupérée avec succès"
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la récupération de la photo du professeur');
    }
  });
  
  ipcMain.handle("school:getLogo", async (_event: Electron.IpcMainInvokeEvent, logoId: number): Promise<ResultType> => {
    try {
        const logo = await global.fileService.getFileById({ fileId: logoId });
        if (!logo) {
            return {
                success: false,
                data: null,
                error: "Logo non trouvé",
                message: "Le logo n'a pas pu être récupéré"
            };
        }

        return {
            success: true,
            data: {
                content: logo.content.toString('base64'),
                type: logo.type,
                name: logo.name
            },
            error: null,
            message: "Logo récupéré avec succès"
        };
    } catch (error) {
        return handleError(error, "Erreur lors de la récupération du logo");
    }
});
ipcMain.handle("professor:downloadDocument", async (_event: Electron.IpcMainInvokeEvent, documentId: number): Promise<ResultType> => {
  try {
      const document = await global.fileService.getFileById({ fileId: documentId });
      if (!document) {
          return {
              success: false,
              data: null,
              error: "Document non trouvé",
              message: "Le document n'a pas pu être récupéré"
          };
      }

      // ✅ CORRECTION : Utiliser le contenu stocké en base de données
      let base64Content: string;
      
      if (document.content) {
          // Si le contenu est déjà en base de données (Buffer ou string)
          base64Content = Buffer.isBuffer(document.content) 
              ? document.content.toString('base64')
              : Buffer.from(document.content).toString('base64');
      } else if (document.path) {
          // Fallback : si le fichier physique existe encore
          try {
              const fileContent = await fs.readFile(document.path);
              base64Content = fileContent.toString('base64');
          } catch (fsError) {
              console.error('Fichier physique introuvable:', document.path);
              return {
                  success: false,
                  data: null,
                  error: "Fichier physique introuvable",
                  message: "Le document n'a pas pu être récupéré depuis le stockage"
              };
          }
      } else {
          return {
              success: false,
              data: null,
              error: "Aucune source de contenu disponible",
              message: "Le document ne contient ni contenu ni chemin valide"
          };
      }

      return { 
          success: true, 
          data: {
              content: base64Content,
              type: document.type,
              name: document.name
          },
          error: null,
          message: "Document récupéré avec succès"
      };
  } catch (error) {
      return handleError(error, 'Erreur lors de la récupération du document');
  }
});


  ipcMain.handle("file:showInFolder", async (_, filePath: string) => shell.showItemInFolder(path.normalize(filePath)));

  // --- Paiements ---
  ipcMain.handle("payment:getConfigs", async () => global.paymentService.getConfigs());
  ipcMain.handle("payment:saveConfig", async (_, configData) => global.paymentService.saveConfig(configData));
  ipcMain.handle("payment:getByStudent", async (_, studentId) => global.paymentService.getPaymentsByStudent(studentId));
  ipcMain.handle("payment:getConfig", async (_, classId) => global.paymentService.getConfigByClass(String(classId)));
  ipcMain.handle("payment:create", async (_, paymentData) => global.paymentService.addPayment(paymentData));
  ipcMain.handle("payment:getRemainingAmount", async (_, studentId) => global.paymentService.getRemainingAmount(studentId));
  ipcMain.handle("professor:payments:list", async (_, filters) => global.paymentService.getProfessorPayments(filters));
  ipcMain.handle("professor:payments:stats", async () => global.paymentService.getProfessorPaymentStats());
  ipcMain.handle("professor:payment:create", async (_, paymentData) => global.paymentService.addProfessorPayment(paymentData));
  ipcMain.handle("professor:payment:update", async (_, paymentData) => global.paymentService.updateProfessorPayment(paymentData));
  ipcMain.handle("professor:payment:getById", async (_, paymentId) => global.paymentService.getProfessorPaymentById(paymentId));
  
  // --- Absences ---
  ipcMain.handle("absence:allStudent", async () => global.absenceService.getAllAbsences("STUDENT"));
  ipcMain.handle("absence:allProfessor", async () => global.absenceService.getAllAbsences("PROFESSOR"));
  ipcMain.handle("absence:add", async (_, absenceData) => global.absenceService.addAbsence(absenceData));
  ipcMain.handle("absence:addProfessor", async (_, data) => global.absenceService.createProfessorAbsence(data));
  ipcMain.handle("absence:updateProfessor", async (_, data) => global.absenceService.updateProfessorAbsence(data));
  ipcMain.handle("absence:getAllProfessor", async () => global.absenceService.getAllProfessorAbsences());
  ipcMain.handle("absence:deleteProfessor", async (_, id) => global.absenceService.deleteProfessorAbsence(id));
  
  // --- Devoirs (Homework) ---
  ipcMain.handle("homework:create", async (_, data) => global.homeworkService.createHomework(data));
  ipcMain.handle("homework:getByGrade", async (_, gradeId) => global.homeworkService.getHomeworkByGrade(gradeId));
  ipcMain.handle("homework:delete", async (_, id) => global.homeworkService.deleteHomework(id));
  ipcMain.handle("homework:update", async (_, data) => global.homeworkService.updateHomework(data.id, data));
  ipcMain.handle("homework:notify", async (_, data) => ({ success: true, message: "Notifications simulées envoyées." }));
  
  // --- Congés (Vacation) ---
  ipcMain.handle("vacation:getByStudent", async (_, studentId) => global.vacationService.getVacationsByStudent(studentId));
  ipcMain.handle("vacation:getByProfessor", async (_, professorId) => global.vacationService.getVacationsByProfessor(professorId));
  ipcMain.handle("vacation:create", async (_, data) => global.vacationService.createVacation(data));
  ipcMain.handle("vacation:update", async (_, data) => data.id && data.status ? global.vacationService.updateVacationStatus(data.id, data.status, data.comment) : { success: false, error: "INVALID_DATA" });
  ipcMain.handle("vacation:updateStatus", async (_, { id, status, comment }) => global.vacationService.updateVacationStatus(id, status, comment));
  ipcMain.handle("vacation:delete", async (_, id) => global.vacationService.deleteVacation(id));
  
  // --- Bulletins (Report Card) ---
  ipcMain.handle("report:generateMultiple", async (_, data) => global.reportCardService.generateReportCards(data));
  ipcMain.handle("report:preview", async (_, data) => global.reportCardService.generateReportCards({ studentIds: [data.studentId], period: data.period, templateId: "preview" }));
  ipcMain.handle("grades:save", async (_, data) => global.reportCardService.saveStudentGrades(data));
  ipcMain.handle("grades:get", async (_, { studentId, period }) => global.reportCardService.getStudentGrades(studentId, period));
  
  // --- Configuration ---
  ipcMain.handle("gradeConfig:save", async (_, config) => global.gradeConfigService.saveConfiguration(config));
  ipcMain.handle("gradeConfig:get", async (_, { gradeId }) => global.gradeConfigService.getConfigurationByGrade(gradeId));
  ipcMain.handle("preference:saveTemplate", async (_, templateId) => global.preferenceService.saveTemplatePreference(templateId));
  ipcMain.handle("preference:getTemplate", async () => global.preferenceService.getTemplatePreference());
  ipcMain.handle('is-first-launch', () => {
    const isFirst = global.configService.isFirstLaunch();
    console.log(`[IPC] Réponse à 'is-first-launch': ${isFirst}`);
    return { data: isFirst };
  });
  ipcMain.handle("set-first-launch-complete", () => {
    global.configService.setFirstLaunchComplete();
    return { success: true };
  });
  // Gestionnaire pour ouvrir le dialogue de sélection de dossier
ipcMain.handle('open-file-dialog', async () => {
  try {
    const result = await dialog.showOpenDialog({
      properties: ['openDirectory', 'createDirectory'],
      title: 'Sélectionner un dossier de stockage'
    });
    
    if (!result.canceled && result.filePaths.length > 0) {
      return result.filePaths[0];
    }
    return null;
  } catch (error) {
    console.error('Erreur lors de l\'ouverture du dialogue de fichier:', error);
    throw error;
  }
});
  
  // --- École ---
  ipcMain.handle("school:get", async () => global.schoolService.getSchool());
  ipcMain.handle("school:save", async (_, schoolData) => global.schoolService.saveOrUpdateSchool(schoolData));
  ipcMain.handle("school:saveSettings", async (_, settings) => global.schoolService.saveOrUpdateSettings(settings));

  // --- Dashboard ---
  ipcMain.handle("dashboard:stats", async () => global.dashboardService.getStats());
  ipcMain.handle("dashboard:paymentStats", async () => global.dashboardService.getPaymentStats());
  ipcMain.handle("dashboard:absenceStats", async () => global.dashboardService.getAbsenceStats());

  // --- Année Scolaire ---
  ipcMain.handle("yearRepartition:getAll", async () => global.yearRepartitionService.getAllYearRepartitions());
  ipcMain.handle("yearRepartition:getCurrent", async () => global.yearRepartitionService.getCurrentYearRepartition());
  ipcMain.handle("yearRepartition:create", async (_, data) => global.yearRepartitionService.createYearRepartition(data));
  ipcMain.handle("yearRepartition:update", async (_, { id, data }) => global.yearRepartitionService.updateYearRepartition(id, data));
  ipcMain.handle("yearRepartition:delete", async (_, id) => global.yearRepartitionService.deleteYearRepartition(id));
  ipcMain.handle("yearRepartition:setCurrent", async (_, id) => global.yearRepartitionService.setCurrentYearRepartition(id));
  
  // --- Bourses ---
  ipcMain.handle("scholarship:getByStudent", async (_, studentId) => global.scholarshipService.getByStudent(studentId));
  ipcMain.handle("scholarship:getActiveByStudent", async (_, studentId) => global.paymentService.getActiveByStudent(studentId));

  // --- Licence ---
  ipcMain.handle("license:generateMachineId", async () => ({ success: true, data: global.licenseService.generateMachineId() }));
  ipcMain.handle("license:activate", async (_, licenseCode) => global.licenseService.activateLicense(licenseCode));
  ipcMain.handle("license:isValid", async () => ({ success: true, data: await global.licenseService.getLicenseStatus() }));
  
  // Correction pour getLicenseDetails - ne prend aucun paramètre
  ipcMain.handle("license:getDetails", async () => {
    try {
      const details = await global.licenseService.getLicenseDetails();
      return { 
        success: true, 
        data: {
          maxActivations: details.maxActivations,
          usedActivations: details.currentActivations
        }
      };
    } catch (error) {
      return handleError(error, "Erreur lors de la récupération des détails de licence");
    }
  });
  
  // Correction pour generateSub - ne prend aucun paramètre
  ipcMain.handle("license:generateSub", async () => {
    try {
      const result = await global.licenseService.generateSubLicense();
      if (result.success) {
        return { 
          success: true, 
          data: { 
            subLicenseCode: result.newCode 
          },
          message: result.message
        };
      } else {
        return { 
          success: false, 
          error: result.message 
        };
      }
    } catch (error) {
      return handleError(error, "Erreur lors de la génération de sous-licence");
    }
  });
  
  console.log('Tous les handlers IPC ont été enregistrés.');
}