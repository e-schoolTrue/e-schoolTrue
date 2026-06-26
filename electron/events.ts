import { ipcMain, dialog, shell, BrowserWindow } from 'electron';
import path from "path";
import { ResultType } from "./command/index";
import { GradeCommand, BranchCommand, ClassRoomCommand, CourseCommand } from "./command/settingsCommand";
import { SyncConfig, SyncHistory } from './backend/services/backupService';
import { ScheduleCommand } from "#electron/command/scheduleCommand";
import fs from 'fs/promises';
import { ConfigService } from './backend/services/configService';
import { InscriptionFeeEntity } from './backend/entities/paymentConfig';
import { documentContentService } from './backend/services/document-content-service';
import { ICreateConfigParams } from './backend/types/note';
import { CentralizedPdfService } from './backend/services/centralizedPdfService';



// ====================================================
// FONCTIONS D'INITIALISATION
// ====================================================


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

  // --- Document Content ---
  ipcMain.handle("document-content:get", async () => {
    try {
      const content = await documentContentService.get();
      return { success: true, data: content };
    } catch (error) {
      return handleError(error, "document-content:get");
    }
  });

  ipcMain.handle("document-content:update", async (_, data) => {
    try {
      const updatedContent = await documentContentService.update(data);
      return { success: true, data: updatedContent };
    } catch (error) {
      return handleError(error, "document-content:update");
    }
  });


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

  ipcMain.handle('sync:provisionSchool', async (_event, schoolName: string): Promise<{ success: boolean; data?: any; error?: string }> => {
    try {
      const result = await global.backupService.provisionSchoolSchema(schoolName);
      if (!result) {
        return { success: false, error: 'Impossible de provisionner le schema.' };
      }
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, "sync:provisionSchool");
    }
  });

  ipcMain.handle('sync:getMySchools', async (): Promise<{ success: boolean; data?: any[]; error?: string }> => {
    try {
      const schools = await global.backupService.getMySchools();
      return { success: true, data: schools };
    } catch (error) {
      return handleError(error, "sync:getMySchools");
    }
  });

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
  ipcMain.handle("grade:getAllGrades", async () => {
    try {
      return await global.gradeService.getGrades();
    } catch (error) {
      return handleError(error, "grade:getAllGrades");
    }
  });
ipcMain.handle("classroom:getByGradeId", async (_, gradeId: number) => {
    try {
      const allClassrooms = await global.gradeService.getClassRooms();
      const filteredClassrooms = allClassrooms.filter((c: any) => c.gradeId === gradeId);
      return { success: true, data: filteredClassrooms };
    } catch (error) {
      return handleError(error, "classroom:getByGradeId");
    }
  });
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


  ipcMain.handle("student-grades", async (_, params: { studentId: number; period?: string }) => {
    try {
      return undefined;
    } catch (error) {
      return handleError(error, "student-grades");
    }
  });

  ipcMain.handle("centralization-report", async (_, params: { classId?: number; schoolId?: number; schoolYear?: string }) => {
    try {
      return undefined;
    } catch (error) {
      return handleError(error, "centralization-report");
    }
  });

  // --- Cours ---
  ipcMain.handle("course:new", async (_, command: CourseCommand) => global.courseService.newCourse(command));
  ipcMain.handle("courseGroup:add", async (_, command: CourseCommand) => global.courseService.addCourseToGroupement(command));
  ipcMain.handle("course:update", async (_, command: CourseCommand) =>
    global.courseService.updateCourse({
      id: command.id!,
      data: {
        name: command.name!,
        coefficient: command.coefficient,
        code: command.code!,
        gradeId: command.gradeId,
        gradeIds: command.gradeIds
      }
    })
  );
  ipcMain.handle("course:delete", async (_, id: number) => global.courseService.deleteCourse(id));
  ipcMain.handle("course:all", async () => global.courseService.getAllCourse());
  ipcMain.handle("course:getByGrade", async (_, gradeId: number) => global.courseService.getCoursesByGrade(gradeId));

  // --- Étudiants ---
  ipcMain.handle("student:all", async (_, options?: {
    page?: number;
    pageSize?: number;
    filters?: {
      studentFullName?: string;
      grade?: string;
    };
  }) => {
    try {
      // Fournir des valeurs par défaut si options est undefined ou partiel
      const defaultOptions = {
        page: options?.page || 1,
        pageSize: options?.pageSize || 1000, // Grande valeur par défaut pour récupérer tous les étudiants
        filters: options?.filters || {}
      };

      const { students, total } = await global.studentService.getAllStudents(defaultOptions);

      // Pour la compatibilité avec l'ancien code qui attend directement un tableau
      if (!options) {
        return { success: true, data: students, message: "Étudiants récupérés" };
      }

      return { success: true, data: { students, total }, message: "Étudiants récupérés" };
    } catch (error) {
      return handleError(error, "student:all");
    }
  });
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
  ipcMain.handle("professor:getByCourseAndGrade", async (_, { courseId, gradeId }: { courseId: number, gradeId: number }) => 
    global.professorService.getProfessorByCourseAndGrade(courseId, gradeId)
  );

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
  ipcMain.handle("payment:getAnnualConfigs", async () => global.paymentService.getPaymentAnnualConfigs());
  ipcMain.handle("payment:saveAnnualConfig", async (_, configData) => global.paymentService.savePaymentAnnualConfig(configData));
  ipcMain.handle("payment:saveConfig", async (_, configData) => global.paymentService.saveConfig(configData));

  // --- Configurations Personnalisées des Paiements ---
  ipcMain.handle("payment:getCustomConfigs", async () => global.paymentService.getCustomConfigs());
  ipcMain.handle("payment:saveCustomConfig", async (_, configData) => global.paymentService.saveCustomConfig(configData));
  ipcMain.handle("payment:deleteCustomConfig", async (_, configId) => global.paymentService.deleteCustomConfig(configId));

  ipcMain.handle("payment:getByStudent", async (_, studentId) => global.paymentService.getPaymentsByStudent(studentId));
  ipcMain.handle("payment:getByDate", async (_, date) => global.paymentService.getPaymentsByDate(date));
  ipcMain.handle("payment:getConfig", async (_, classId) => global.paymentService.getConfigByClass(String(classId)));
  ipcMain.handle("payment:create", async (_, paymentData) => global.paymentService.addPayment(paymentData));
  ipcMain.handle("payment:getRemainingAmount", async (_, studentId) => global.paymentService.getRemainingAmount(studentId));
  ipcMain.handle("professor:payments:list", async (_, filters) => global.paymentService.getProfessorPayments(filters));
  ipcMain.handle("professor:payments:stats", async () => global.paymentService.getProfessorPaymentStats());
  ipcMain.handle("professor:payment:create", async (_, paymentData) => global.paymentService.addProfessorPayment(paymentData));
  ipcMain.handle("professor:payment:update", async (_, paymentData) => global.paymentService.updateProfessorPayment(paymentData));
  ipcMain.handle("professor:payment:getById", async (_, paymentId) => global.paymentService.getProfessorPaymentById(paymentId));

  // --- Payment Fees ---
  ipcMain.handle("payment-fee:all", async () => {
    try {
      const fees = await global.paymentFeeService.findAll();
      return { success: true, data: fees };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("payment-fee:get", async (_, id: number) => {
    try {
      const fee = await global.paymentFeeService.findOne(id);
      if (!fee) return { success: false, error: 'Payment fee not found' };
      return { success: true, data: fee };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("payment-fee:delete", async (_, id: number) => {
    try {
      const result = await global.paymentFeeService.delete(id);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // --- Inscription Fees ---
  ipcMain.handle("inscription-fee:all", async () => {
    try {
      const fees = await global.inscriptionFeeService.findAll();
      return { success: true, data: fees };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("inscription-fee:get", async (_, id: number) => {
    try {
      const fee = await global.inscriptionFeeService.findOne(id);
      if (!fee) return { success: false, error: 'Inscription fee not found' };
      return { success: true, data: fee };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("inscription-fee:create", async (_, data: InscriptionFeeEntity) => {
    try {
      const result = await global.inscriptionFeeService.create(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("inscription-fee:update", async (_, data: InscriptionFeeEntity) => {
    try {
      const result = await global.inscriptionFeeService.update(data);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle("inscription-fee:delete", async (_, id: number) => {
    try {
      const result = await global.inscriptionFeeService.delete(id);
      return { success: true, data: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // --- Tranch Configurations ---
  ipcMain.handle("tranche-config:all", async () => {
    try {
      // Assumes global.paymentAnnualConfigService is now available
      const configs = await global.paymentAnnualConfigService.findAll();
      return { success: true, data: configs };
    } catch (error) {
      return handleError(error, "tranche-config:all");
    }
  });

  ipcMain.handle("tranche-config:create", async (_, data) => {
    try {
      const result = await global.paymentAnnualConfigService.create(data);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, "tranche-config:create");
    }
  });

  ipcMain.handle("tranche-config:update", async (_, data) => {
    try {
      const result = await global.paymentAnnualConfigService.update(data);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, "tranche-config:update");
    }
  });

  ipcMain.handle("tranche-config:delete", async (_, id: number) => {
    try {
      const result = await global.paymentAnnualConfigService.delete(id);
      return { success: true, data: result };
    } catch (error) {
      return handleError(error, "tranch-config:delete");
    }
  });

  // --- Absences ---
  ipcMain.handle("absence:allStudent", async () => global.absenceService.getAllAbsences("STUDENT"));
  ipcMain.handle("absence:allProfessor", async () => global.absenceService.getAllAbsences("PROFESSOR"));
  ipcMain.handle("absence:add", async (_, absenceData) => global.absenceService.addAbsence(absenceData));
  ipcMain.handle("absence:addProfessor", async (_, data) => global.absenceService.createProfessorAbsence(data));
  ipcMain.handle("absence:updateProfessor", async (_, data) => global.absenceService.updateProfessorAbsence(data));
  ipcMain.handle("absence:getAllProfessor", async () => global.absenceService.getAllProfessorAbsences());
  ipcMain.handle("absence:getTotalAbsencesGroupedByStudent", async (_, gradeId?: number) => global.absenceService.getTotalAbsencesGroupedByStudent(gradeId));
  ipcMain.handle("absence:deleteProfessor", async (_, id) => global.absenceService.deleteProfessorAbsence(id));
  ipcMain.handle("absence:createBatch", async (_, absencesData) => {
    try {
      const result = await global.absenceService.createProfessorAbsencesBatch(absencesData);
      return result;
    } catch (error) {
      return handleError(error, "Erreur lors de la création des absences en lot");
    }
  });

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
  ipcMain.handle("preference:get", async (_, key: string) => {
    try {
      const result = await global.preferenceService.getPreference(key);
      return { success: result.success, data: result.data, error: result.error };
    } catch (error) {
      return { success: false, data: null, error: String(error) };
    }
  });
  ipcMain.handle("preference:set", async (_, { key, value }: { key: string; value: string }) => {
    try {
      const result = await global.preferenceService.setPreference(key, value);
      return { success: result.success, data: result.data, error: result.error };
    } catch (error) {
      return { success: false, data: null, error: String(error) };
    }
  });
  ipcMain.handle('is-first-launch', () => {
    const isFirst = ConfigService.getInstance().isFirstLaunch();
    console.log(`[IPC] Réponse à 'is-first-launch': ${isFirst}`);
    return { data: isFirst };
  });
  ipcMain.handle("set-first-launch-complete", () => {
    ConfigService.getInstance().setFirstLaunchComplete();
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
  // ====================================================================
  // LICENSE BYPASS — Désactive temporairement la vérification de licence
  // Mettre à false ou supprimer ce bloc pour réactiver la vérification
  // ====================================================================
  const LICENSE_BYPASS = true;

  ipcMain.handle("license:generateMachineId", async () => ({ success: true, data: global.licenseService.generateMachineId() }));
  ipcMain.handle("license:activate", async (_, licenseCode) => global.licenseService.activateLicense(licenseCode));
  ipcMain.handle("license:isValid", async () => {
    if (LICENSE_BYPASS) {
      return {
        success: true,
        data: {
          isValid: true,
          daysRemaining: null,
          machineId: 'BYPASS-MODE',
          licenseCode: 'BYPASS-ACTIVE',
          licenseType: 'development',
          expiryDate: null,
          activatedAt: new Date().toISOString(),
        }
      };
    }
    return { success: true, data: await global.licenseService.getLicenseStatus() };
  });

  // Correction pour getLicenseDetails - ne prend aucun paramètre
  ipcMain.handle("license:getDetails", async () => {
    if (LICENSE_BYPASS) {
      return { success: true, data: { maxActivations: 10, usedActivations: 1 } };
    }
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


  //shedule
  // Handler pour créer un emploi du temps
  ipcMain.handle('schedule:create', async (event, command: ScheduleCommand) => {
    try {
      return await global.scheduleService.createSchedule(command);
    } catch (error) {
      console.error('Error in schedule:create handler:', error);
      return {
        success: false,
        message: 'Erreur serveur lors de la création du créneau',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handler pour récupérer l'emploi du temps par date
  ipcMain.handle('schedule:getByDate', async (event, { date }) => {
    try {
      return await global.scheduleService.getScheduleByDate(date);
    } catch (error) {
      console.error('Error in schedule:getByDate handler:', error);
      return {
        success: false,
        message: 'Erreur lors de la récupération de l\'emploi du temps',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handler pour récupérer tous les emplois du temps
  ipcMain.handle('schedule:all', async () => {
    try {
      return await global.scheduleService.getAllSchedules();
    } catch (error) {
      console.error('Error in schedule:all handler:', error);
      return {
        success: false,
        message: 'Erreur serveur lors de la récupération des emplois du temps',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handler pour récupérer l'emploi du temps par classe
  ipcMain.handle('schedule:by-class', async (event, classId: number) => {
    try {
      return await global.scheduleService.getScheduleByClass(classId);
    } catch (error) {
      console.error('Error in schedule:by-class handler:', error);
      return {
        success: false,
        message: 'Erreur serveur lors de la récupération de l\'emploi du temps de la classe',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handler pour récupérer l'emploi du temps par professeur
  ipcMain.handle('schedule:by-professor', async (event, professorId: number) => {
    try {
      return await global.scheduleService.getScheduleByProfessor(professorId);
    } catch (error) {
      console.error('Error in schedule:by-professor handler:', error);
      return {
        success: false,
        message: 'Erreur serveur lors de la récupération de l\'emploi du temps du professeur',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handler pour supprimer un créneau
  ipcMain.handle('schedule:delete', async (event, scheduleId: number) => {
    try {
      return await global.scheduleService.deleteSchedule(scheduleId);
    } catch (error) {
      console.error('Error in schedule:delete handler:', error);
      return {
        success: false,
        message: 'Erreur serveur lors de la suppression du créneau',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // Handler pour mettre à jour un créneau
  ipcMain.handle('schedule:update', async (event, scheduleId: number, command: Partial<ScheduleCommand>) => {
    try {
      return await global.scheduleService.updateSchedule(scheduleId, command);
    } catch (error) {
      console.error('Error in schedule:update handler:', error);
      return {
        success: false,
        message: 'Erreur serveur lors de la mise à jour du créneau',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });
  // ===================================================================
  // CONFIGURATION DES NOTES (ConfigNoteService)
  // ===================================================================
  
  // Sauvegarder une configuration de notation
  ipcMain.handle('grade-config:save', async (_event, params: ICreateConfigParams) => {
    try {
      return await global.configNoteService.saveConfig(params);
    } catch (error) {
      return handleError(error, "grade-config:save");
    }
  });

  // Récupérer la configuration applicable (avec cascade)
  ipcMain.handle('grade-config:get', async (_event, { schoolId, classId, subjectId, period }) => {
    try {
      return await global.configNoteService.getApplicableConfig({ schoolId, classId, subjectId, period });
    } catch (error) {
      return handleError(error, "grade-config:get");
    }
  });

  // Récupérer la configuration exacte (sans cascade)
  ipcMain.handle('grade-config:getExact', async (_event, { schoolId, classId, subjectId, period }) => {
    try {
      return await global.configNoteService.getExactConfig({ schoolId, classId, subjectId, period });
    } catch (error) {
      return handleError(error, "grade-config:getExact");
    }
  });

  // Lister toutes les configurations d'une école
  ipcMain.handle('grade-config:getAllForSchool', async (_event, schoolId: number) => {
    try {
      return await global.configNoteService.getAllConfigsForSchool(schoolId);
    } catch (error) {
      return handleError(error, "grade-config:getAllForSchool");
    }
  });

  // Supprimer une configuration
  ipcMain.handle('grade-config:delete', async (_event, configId: number) => {
    try {
      return await global.configNoteService.deleteConfig(configId);
    } catch (error) {
      return handleError(error, "grade-config:delete");
    }
  });

  // Calculer la moyenne d'une matière
  ipcMain.handle('grade-config:calculateAverage', async (_event, { studentId, subjectId, classId, schoolId, period, grades, options }) => {
    try {
      return await global.configNoteService.calculateSubjectAverage(
        studentId, subjectId, classId, schoolId, period, grades, options
      );
    } catch (error) {
      return handleError(error, "grade-config:calculateAverage");
    }
  });

  // ===================================================================
  // SAISIE DES NOTES (GradeEntryService)
  // ===================================================================

  // Sauvegarder une note individuelle
  // Note: le recalcul des moyennes est déclenché par le frontend via gradeEntry:calculate
  // qui dispose du classId et schoolId corrects
  ipcMain.handle('gradeEntry:save', async (_event, input) => {
    try {
      const result = await global.gradeEntryService.saveGradeEntry(input);

      return result;
    } catch (error) {
      return handleError(error, "gradeEntry:save");
    }
  });

  // Sauvegarder plusieurs notes
  ipcMain.handle('gradeEntry:bulkSave', async (_event, input) => {
    try {
      console.log('=== IPC: gradeEntry:bulkSave called ===');
      console.log('Input:', input);

      const result = await global.gradeEntryService.bulkSaveGrades(input);
      console.log('Result from bulkSaveGrades:', result);

      if (!result.success) {
        console.error('❌ Erreur dans bulkSaveGrades:', result.error);
      }

      return result;
    } catch (error) {
      console.error('❌ IPC Error in gradeEntry:bulkSave:', error);
      return handleError(error, "gradeEntry:bulkSave");
    }
  });

  // Récupérer les notes d'un élève pour une matière
  ipcMain.handle('gradeEntry:get', async (_event, { studentId, courseId, period }) => {
    try {
      return await global.gradeEntryService.getGradeEntries({ studentId, courseId, period });
    } catch (error) {
      return handleError(error, "gradeEntry:get");
    }
  });

  // Calculer et mettre en cache la moyenne
  ipcMain.handle('gradeEntry:calculate', async (_event, { studentId, courseId, classId, schoolId, period }) => {
    try {
      return await global.gradeEntryService.calculateAndCacheGrade(studentId, courseId, classId, schoolId, period);
    } catch (error) {
      return handleError(error, "gradeEntry:calculate");
    }
  });

  // Récupérer une moyenne calculée
  ipcMain.handle('gradeEntry:getCalculated', async (_event, { studentId, courseId, classId, schoolId, period }) => {
    try {
      return await global.gradeEntryService.getCalculatedGrade(studentId, courseId, classId, schoolId, period);
    } catch (error) {
      return handleError(error, "gradeEntry:getCalculated");
    }
  });

  // Supprimer une note
  ipcMain.handle('gradeEntry:delete', async (_event, entryId: number) => {
    try {
      return await global.gradeEntryService.deleteGradeEntry(entryId);
    } catch (error) {
      return handleError(error, "gradeEntry:delete");
    }
  });

  // Récupérer toutes les moyennes d'un élève
  ipcMain.handle('gradeEntry:getStudentAverages', async (_event, { studentId, classId, schoolId, period }) => {
    try {
      return await global.gradeEntryService.getStudentAverages(studentId, classId, schoolId, period);
    } catch (error) {
      return handleError(error, "gradeEntry:getStudentAverages");
    }
  });

    ipcMain.handle('gradeEntry:getClassRankings', async (_event, { classId, schoolId, period }) => {
    try {
      return await global.gradeEntryService.getClassRankings(classId, schoolId, period);
    } catch (error) {
      return handleError(error, "gradeEntry:getClassRankings");
    }
  });

  ipcMain.handle('gradeEntry:getStudentRank', async (_event, { studentId, classId, schoolId, period }) => {
    try {
      return await global.gradeEntryService.getStudentRank(studentId, classId, schoolId, period);
    } catch (error) {
      return handleError(error, "gradeEntry:getStudentRank");
    }
  });

  // Invalider le cache des moyennes calculées
  ipcMain.handle('gradeEntry:invalidateCache', async (_event, { classId, period }) => {
    try {
      return await global.gradeEntryService.invalidateCacheByClass(classId, period);
    } catch (error) {
      return handleError(error, "gradeEntry:invalidateCache");
    }
  });

  // Handler pour obtenir les classements centralisés
  ipcMain.handle('gradeEntry:getCentralizedRankings', async (_event, filters) => {
    try {
      if (!filters || typeof filters !== 'object') {
        throw new Error('Filtres non valides');
      }

      if (filters.gradeId === undefined || filters.gradeId === null || isNaN(filters.gradeId)) {
        throw new Error('gradeId est requis et doit être un nombre valide');
      }

      const result = await global.gradeEntryService.getCentralizedRankings(filters);

      if (!result.success) {
        return result;
      }

      if (result.data && result.data.length === 0) {
        return {
          success: true,
          data: [],
          message: 'Aucun classement disponible pour les filtres sélectionnés',
          error: null
        };
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      return {
        success: false,
        data: null,
        message: `Erreur lors du calcul du classement centralisé: ${errorMessage}`,
        error: errorMessage
      };
    }
  });

  // Handler pour obtenir les classements annuels (Procès-Verbal Annuel)
  ipcMain.handle('gradeEntry:getAnnualRankings', async (_event, filters) => {
    try {
      if (!filters || typeof filters !== 'object') {
        throw new Error('Filtres non valides');
      }

      if (filters.gradeId === undefined || filters.gradeId === null || isNaN(filters.gradeId)) {
        throw new Error('gradeId est requis et doit être un nombre valide');
      }

      const result = await global.gradeEntryService.getAnnualRankings(filters);

      if (!result.success) {
        return result;
      }

      if (result.data && result.data.length === 0) {
        return {
          success: true,
          data: [],
          message: 'Aucun classement annuel disponible pour les filtres sélectionnés',
          error: null
        };
      }

      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erreur inconnue';
      return {
        success: false,
        data: null,
        message: `Erreur lors du calcul du classement annuel: ${errorMessage}`,
        error: errorMessage
      };
    }
  });

  // Handler pour vérifier les conflits
  ipcMain.handle('schedule:check-conflicts', async (event, professorId: number, day: string, timeSlot: string, excludeScheduleId?: number) => {
    try {
      return await global.scheduleService.checkConflicts(professorId, day, timeSlot, excludeScheduleId);
    } catch (error) {
      console.error('Error in schedule:check-conflicts handler:', error);
      return {
        success: false,
        message: 'Erreur serveur lors de la vérification des conflits',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  // --- Centralized Grades PDF ---
  ipcMain.handle('centralized-grades:generatePDF', async (event, data) => {
    try {
      return await global.centralizedPdfService.generateCentralizedGradesPdf(data, {
         generatePdfWithPrintDialog: async (htmlContent: string) => {
          const win = new BrowserWindow({
            width: 1600,
            height: 950,
            show: true,
            webPreferences: {
              nodeIntegration: true,
              contextIsolation: false
            }
          });

          const htmlWithPrintButton = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="UTF-8">
              <title>Fiche de Centralisation des Notes</title>
              <style>
                * { margin: 0; padding: 0; box-sizing: border-box; }
                body {
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  background: #f5f5f5;
                }
                .page {
                  background: white;
                  padding: 8px;
                  min-height: 100vh;
                  page-break-after: always;
                }
                .page:last-child {
                  page-break-after: avoid;
                }
                .header {
                  text-align: center;
                  margin-bottom: 20px;
                  border-bottom: 2px solid #333;
                  padding-bottom: 15px;
                }
                .header h1 {
                  color: #333;
                  font-size: 20px;
                  margin-bottom: 8px;
                }
                .header-info {
                  color: #666;
                  font-size: 13px;
                }
                table {
                  width: 100%;
                  border-collapse: collapse;
                  margin-bottom: 15px;
                }
                th, td {
                  border: 1px solid #ddd;
                  padding: 8px;
                  text-align: center;
                  font-size: 10px;
                }
                th {
                  background-color: #2c3e50;
                  color: white;
                  font-weight: 600;
                }
                .rank-cell {
                  background-color: #2c3e50 !important;
                  color: white !important;
                  font-weight: bold;
                }
                .average-row td {
                  background-color: #e8f4f8;
                  font-weight: bold;
                  color: #2c3e50;
                }
                .print-section {
                  margin-top: 20px;
                  padding: 15px;
                  background: #f9f9f9;
                  border: 2px dashed #ccc;
                  border-radius: 4px;
                  text-align: center;
                }
                .print-btn {
                  background: #4CAF50;
                  color: white;
                  border: none;
                  padding: 12px 24px;
                  font-size: 14px;
                  border-radius: 4px;
                  cursor: pointer;
                  font-weight: 600;
                }
                .print-btn:hover {
                  background: #45a049;
                }
                .page-info {
                  font-size: 11px;
                  color: #666;
                  margin-top: 8px;
                }
                @media print {
                  @page {
                    size: landscape;
                    margin: 5mm;
                  }
                  body {
                    background: white;
                    padding: 0;
                  }
                  .page {
                    box-shadow: none;
                    border-radius: 0;
                    padding: 5mm;
                    min-height: auto;
                  }
                  .print-section {
                    display: none;
                  }
                  thead {
                    display: table-header-group;
                  }
                  tfoot {
                    display: table-footer-group;
                  }
                  tr {
                    page-break-inside: avoid;
                  }
                  th, td {
                    padding: 4px;
                    font-size: 9px;
                  }
                }
              </style>
            </head>
            <body>
              ${htmlContent}
              <div class="print-section">
                <button class="print-btn" onclick="window.print()">🖨️ Imprimer le PDF</button>
              </div>
            </body>
            <script>
              window.onload = function() {
                setTimeout(() => {
                  window.print();
                }, 500);
              };

              window.onafterprint = function() {
                setTimeout(() => { window.close(); }, 500);
              };
            </script>
          `;

          await win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(htmlWithPrintButton)}`);
        }
      });
    } catch (error) {
      console.error('Error in centralized-grades:generatePDF handler:', error);
      return {
        success: false,
        message: 'Erreur serveur lors de la génération du PDF',
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  });

  console.log('Tous les handlers IPC ont été enregistrés.');
}
