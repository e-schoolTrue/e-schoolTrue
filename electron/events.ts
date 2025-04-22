import {  ipcMain } from "electron";
import { GradeService } from "#electron/backend/services/gradeService.ts";
import { GradeCommand, BranchCommand, ClassRoomCommand, CourseCommand } from "#electron/command/settingsCommand.ts";
import { CourseService } from "#electron/backend/services/courseService.ts";
import { StudentService } from "./backend/services/studentService";
import { FileService } from "./backend/services/fileService";
import { YearRepartitionService } from "#electron/backend/services/yearService";
import { ResultType } from "#electron/command";
import * as fs from 'fs/promises';
import { app } from 'electron';
import path from 'path';
import { PaymentService } from './backend/services/paymentService';
import { AbsenceService } from './backend/services/absenceService';
import {SchoolService} from './backend/services/schoolService';
import { ProfessorService } from './backend/services/professorService';
import { DashboardService } from './backend/services/dashboardService';
import { HomeworkService } from './backend/services/homeworkService';
import { VacationService } from './backend/services/vacationService';
import { ScholarshipService } from './backend/services/scholarshipService';
import { ReportCardService } from './backend/services/reportCardService';
import { GradeConfigService } from './backend/services/gradeConfigService';
import { PreferenceService } from './backend/services/preferenceService';
import { IAbsenceServiceParams } from './backend/types/absence';


const global = {
    gradeService: new GradeService(),
    courseService: new CourseService(),
    studentService: new StudentService(),
    fileService: new FileService(),
    paymentService: new PaymentService(),
    absenceService: new AbsenceService(),
    schoolService: new SchoolService(),
    yearRepartitionService: new YearRepartitionService(),
    professorService: new ProfessorService(),
    dashboardService: new DashboardService(),
    homeworkService: new HomeworkService(),
    vacationService: new VacationService(),
    scholarshipService: new ScholarshipService(),
    reportCardService: new ReportCardService(),
    gradeConfigService: new GradeConfigService(),
    preferenceService: new PreferenceService()
};

// Fonction utilitaire pour gérer les erreurs
const handleError = (error: any, message: string): ResultType => {
    console.error('Erreur:', error);
    return { 
        success: false, 
        message: Buffer.from(`${message}: ${error.message}`).toString('base64'),
        error: error instanceof Error ? error.message : String(error),
        data: null
    };
}

// Fonction utilitaire pour convertir les réponses de service en ResultType
const convertToResultType = <T>(response: { success: boolean; data: T | null; message: string | null; error: string | null }): ResultType => {
    return {
        success: response.success,
        data: response.data,
        message: response.message || "Opération réussie",
        error: response.error
    };
};

// Exemple pour un gestionnaire d'événement
ipcMain.handle("grade:all", async (_event: Electron.IpcMainInvokeEvent, _args: any): Promise<ResultType> => {
    try {
        const result = await global.gradeService.getGrades();
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Récupération des grades réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la récupération des grades');
    }
});

ipcMain.handle("grade:new"  , async (_event: Electron.IpcMainInvokeEvent, command: GradeCommand): Promise<ResultType> => {
    try {
        const result = await global.gradeService.newGrade(command);
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Création du grade réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la création du grade');
    }
});

ipcMain.handle("grade:update"  , async (_event: Electron.IpcMainInvokeEvent, command: GradeCommand): Promise<ResultType> => {
    try {
        const result = await global.gradeService.updateGrade(command);
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Mise à jour du grade réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la mise à jour du grade');
    }
});

ipcMain.handle("grade:delete"  , async (_event: Electron.IpcMainInvokeEvent, id: number): Promise<ResultType> => {
    try {
        const result = await global.gradeService.deleteGrade(id);
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Suppression du grade réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la suppression du grade');
    }
});

ipcMain.handle("classRoom:new"  , async (_event: Electron.IpcMainInvokeEvent, command: ClassRoomCommand): Promise<ResultType> => {
    try {
        const result = await global.gradeService.newClassRoom(command);
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Création de la salle de classe réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la création de la salle de classe');
    }
});

ipcMain.handle("classRoom:delete"  , async (_event: Electron.IpcMainInvokeEvent, id: number): Promise<ResultType> => {
    try {
        const result = await global.gradeService.deleteClassRoom(id);
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Suppression de la salle de classe réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la suppression de la salle de classe');
    }
});

ipcMain.handle("classRoom:update"  , async (_event: Electron.IpcMainInvokeEvent, command: ClassRoomCommand): Promise<ResultType> => {
    try {
        const result = await global.gradeService.updateClassRoom(command);
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Mise à jour de la salle de classe réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la mise à jour de la salle de classe');
    }
});

ipcMain.handle("classRoom:all", async (_event: Electron.IpcMainInvokeEvent): Promise<ResultType> => {
  try {
    const result = await global.gradeService.getClassRooms();
    return {
        success: result.success,
        data: result.data,
        message: result.message || 'Récupération des salles de classe réussie',
        error: result.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération des salles de classe');
  }
});

ipcMain.handle("branch:new"  , async (_event: Electron.IpcMainInvokeEvent, command: BranchCommand): Promise<ResultType> => {
    try {
        const result = await global.gradeService.newBranch(command);
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Création de la branche réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la création de la branche');
    }
});

ipcMain.handle("branch:update"  , async (_event: Electron.IpcMainInvokeEvent, command: BranchCommand): Promise<ResultType> => {
    try {
        const result = await global.gradeService.updateBranch(command);
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Mise à jour de la branche réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la mise à jour de la branche');
    }
});

ipcMain.handle("branch:delete"  , async (_event: Electron.IpcMainInvokeEvent, id: number): Promise<ResultType> => {
    try {
        const result = await global.gradeService.deleteBranch(id);
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Suppression de la branche réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la suppression de la branche');
    }
});

ipcMain.handle("course:new"  , async (_event: Electron.IpcMainInvokeEvent, command: CourseCommand): Promise<ResultType> => {
    try {
        const result = await global.courseService.newCourse(command);
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Création du cours réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la création du cours');
    }
});

ipcMain.handle("courseGroup:add"  , async (_event: Electron.IpcMainInvokeEvent, command: CourseCommand): Promise<ResultType> => {
    try {
        const result = await global.courseService.addCourseToGroupement(command);
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Ajout du cours au groupement réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de l\'ajout du cours au groupement');
    }
});

ipcMain.handle("course:update"  , async (_event: Electron.IpcMainInvokeEvent, command: CourseCommand): Promise<ResultType> => {
    try {
        const result = await global.courseService.updateCourse({
            id: command.id!,
            data: {
                name: command.name!,
                coefficient: command.coefficient,
                code: command.code!
            }
        });
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Mise à jour du cours réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la mise à jour du cours');
    }
});

ipcMain.handle("course:delete"  , async (_event: Electron.IpcMainInvokeEvent, id: number): Promise<ResultType> => {
    try {
        const result = await global.courseService.deleteCourse(id);
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Suppression du cours réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la suppression du cours');
    }
});

ipcMain.handle("course:all"  , async (_event: Electron.IpcMainInvokeEvent, _args: any): Promise<ResultType> => {
    try {
        console.log('Récupération de tous les cours');
        const result = await global.courseService.getAllCourse();
        console.log('Cours récupérés:', result);
        return result;
    } catch (error) {
        console.error('Erreur cours:', error);
        return handleError(error, 'Erreur lors de la récupération de tous les cours');
    }
});

ipcMain.handle("save-student", async (_event: Electron.IpcMainInvokeEvent, studentData: any): Promise<ResultType> => {
    try {
        // Si l'étudiant a un ID, c'est une mise à jour
        if (studentData.id) {
            const result = await global.studentService.updateStudent(studentData.id, studentData);
            return {
                success: result.success,
                data: result.data,
                message: result.message || 'Mise à jour de l\'étudiant réussie',
                error: result.error
            };
        }
        // Sinon, c'est une création
        else {
            const result = await global.studentService.createStudent(studentData);
            return {
                success: result.success,
                data: result.data,
                message: result.message || 'Création de l\'étudiant réussie',
                error: result.error
            };
        }
    } catch (error) {
        return handleError(error, 'Erreur lors de la sauvegarde de l\'étudiant');
    }
});

ipcMain.handle("student:all", async (_event: Electron.IpcMainInvokeEvent, _args: any): Promise<ResultType> => {
    console.log("Début de student:all", _event, _args);
    try {
        const result = await global.studentService.getAllStudents();
        console.log("Données brutes reçues de la base de données:", JSON.stringify(result, null, 2));
        console.log("Nombre d'étudiants récupérés:", result.length);
        return { success: true, data: result, error: null, message: "Étudiants récupérés avec succès" };
    } catch (error) {
        return handleError(error, 'Erreur lors de la récupération de tous les étudiants');
    }
});

ipcMain.handle("student:getDetails", async (_event: Electron.IpcMainInvokeEvent, studentId: number): Promise<ResultType> => {
    console.log(`Début de student:getDetails pour l'étudiant ID: ${studentId}`);
    try {
        // Utilisez directement le résultat de getStudentDetails
        const result = await global.studentService.getStudentDetails(studentId);
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Récupération des détails de l\'étudiant réussie',
            error: result.error
        };
    } catch (error) {
        console.error("Erreur dans student:getDetails:", error);
        return handleError(error, 'Erreur lors de la récupération des détails de l\'étudiant');
    }
});

ipcMain.handle("student:downloadDocument", async (_event: Electron.IpcMainInvokeEvent, documentId: number): Promise<ResultType> => {
    try {
      const document = await global.fileService.getFileById({ fileId: documentId });
      if (document && document.path) {
          // Lire le contenu du fichier et le convertir en base64
          const fileContent = await fs.readFile(document.path);
          const base64Content = fileContent.toString('base64');

          return { 
              success: true, 
              data: {
                  content: base64Content, // Envoyer directement le contenu base64
                  type: document.type,
                  name: document.name
              },
              error: null,
              message: "Document récupéré avec succès"
          };
      } else {
          return {
              success: false,
              data: null,
              error: "Document non trouvé",
              message: "Le document n'a pas pu être récupéré"
          };
      }
  } catch (error) {
      return handleError(error, 'Erreur lors de la récupération du document');
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


// Ajoutez ces nouvelles constantes
const CONFIG_FILE_PATH = path.join(app.getPath('userData'), 'class-config.json');

// Ajoutez ces nouveaux gestionnaires d'événements
ipcMain.handle('get-class-config', async () => {
    try {
      const configExists = await fs.access(CONFIG_FILE_PATH).then(() => true).catch(() => false);
      if (configExists) {
        const configData = await fs.readFile(CONFIG_FILE_PATH, 'utf-8');
        return { success: true, data: JSON.parse(configData) };
      } else {
        return { success: true, data: null };
      }
    } catch (error) {
      console.error('Erreur lors de la récupération de la configuration des classes:', error);
      if (error instanceof Error) {
        return { success: false, error: error.message };
      } else {
        return { success: false, error: 'Une erreur inconnue est survenue' };
      }
    }
  });
ipcMain.handle('save-class-config', async (_event, config) => {
  try {
    await fs.writeFile(CONFIG_FILE_PATH, JSON.stringify(config), 'utf-8');
    return { success: true };
  } catch (error) {
    console.error('Erreur lors de la sauvegarde de la configuration des classes:', error);
    if (error instanceof Error) {
      return { success: false, error: error.message };
    } else {
      return { success: false, error: 'Une erreur inconnue est survenue' };
    }
  }
});

ipcMain.handle("update-student", async (_event: Electron.IpcMainInvokeEvent, { studentId, studentData }: { studentId: number, studentData: any }): Promise<ResultType> => {
    console.log("Début de update-student avec les données:", JSON.stringify(studentData));
    try {
        if (studentData.photo && studentData.photo.content) {
            const savedPhoto = await global.fileService.saveFile({
                content: studentData.photo.content,
                name: studentData.photo.name,
                type: studentData.photo.type
            });
            studentData.photoId = savedPhoto.id;
        }

        if (studentData.document && studentData.document.length > 0) {
            const savedDocuments = await Promise.all(studentData.document.map(async (doc: any) => {
                if (doc.content) {
                    return await global.fileService.saveFile({
                        content: doc.content,
                        name: doc.name,
                        type: doc.type
                    });
                }
                return doc;
            }));
            studentData.documents = savedDocuments;
        }

        delete studentData.photo;
        delete studentData.document;

        const result = await global.studentService.updateStudent(studentId, studentData);
        return {
            success: result.success,
            data: result.data,
            message: result.message || 'Mise à jour de l\'étudiant réussie',
            error: result.error
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la mise à jour de l\'étudiant');
    }
});

ipcMain.handle('delete-student', async (_event, studentId: number) => {
    try {
      await global.studentService.deleteStudent(studentId); // Appel sans affecter le résultat à une variable
      return { success: true, message: "Étudiant supprimé avec succès" };
    } catch (error) {
      console.error("Erreur lors de la suppression de l'étudiant:", error);
      return { success: false, message: "Une erreur est survenue lors de la suppression de l'étudiant" };
    }
  });

// Garder uniquement ces handlers pour les absences
ipcMain.handle('absence:allStudent', async () => {
  try {
    const result = await global.absenceService.getAllAbsences('STUDENT');
    return {
      success: result.success,
      data: result.data,
      message: result.message,
      error: result.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération de toutes les absences');
  }
});

ipcMain.handle('absence:allProfessor', async () => {
  try {
    const result = await global.absenceService.getAllAbsences('PROFESSOR');
    return {
      success: result.success,
      data: result.data,
      message: result.message,
      error: result.error
    };
  } catch (error) {
    console.error('=== Events - Erreur dans absence:allProfessor ===', error);
    return handleError(error, 'Erreur lors de la récupération de toutes les absences');
  }
});

ipcMain.handle('absence:add', async (_event, absenceData: IAbsenceServiceParams['addAbsence']) => {
  try {
    console.log('=== IPC - Réception absence:add ===', absenceData);
    const result = await global.absenceService.addAbsence(absenceData);
    console.log('=== IPC - Résultat absence:add ===', result);
    return result;
  } catch (error) {
    console.error('Erreur lors de l\'ajout de l\'absence via IPC:', error);
    return handleError(error, 'Erreur lors de la création de l\'absence');
  }
});

// Ajouter un handler spécifique pour les absences étudiants
ipcMain.handle('absence:addStudent', async (_event, absenceData: IAbsenceServiceParams['addAbsence']) => {
  try {
    const result = await global.absenceService.addAbsence(absenceData);
    return {
      success: result.success,
      data: result.data,
      message: result.message || 'Ajout de l\'absence réussie',
      error: result.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la création de l\'absence');
  }
});

// Handlers pour les absences professeurs
ipcMain.handle('absence:addProfessor', async (_event, data: IAbsenceServiceParams['createProfessorAbsence']) => {
  try {
    const response = await global.absenceService.createProfessorAbsence(data);
    return convertToResultType(response);
  } catch (error) {
    return handleError(error, 'Erreur lors de la création de l\'absence');
  }
});

ipcMain.handle('absence:updateProfessor', async (_event, data: IAbsenceServiceParams['updateProfessorAbsence']) => {
  try {
    const response = await global.absenceService.updateProfessorAbsence(data);
    return convertToResultType(response);
  } catch (error) {
    return handleError(error, 'Erreur lors de la mise à jour de l\'absence');
  }
});

ipcMain.handle('absence:getAllProfessor', async () => {
  try {
    const response = await global.absenceService.getAllProfessorAbsences();
    return convertToResultType(response);
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération de toutes les absences');
  }
});

ipcMain.handle('absence:deleteProfessor', async (_event, id: number) => {
  try {
    const response = await global.absenceService.deleteProfessorAbsence(id);
    return convertToResultType(response);
  } catch (error) {
    return handleError(error, 'Erreur lors de la suppression de l\'absence');
  }
});

// Handler pour récupérer les étudiants d'une classe
ipcMain.handle('student:getByGrade', async (_event: Electron.IpcMainInvokeEvent, gradeId: number): Promise<ResultType> => {
  try {
    const response = await global.studentService.getStudentsByGrade(gradeId);
    return convertToResultType(response);
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération des étudiants');
  }
});

// Handler pour supprimer un devoir
ipcMain.handle('homework:delete', async (_, id: number) => {
  try {
    return await global.homeworkService.deleteHomework(id);
  } catch (error) {
    return handleError(error, 'Erreur lors de la suppression du devoir');
  }
});

// Handler pour mettre à jour un devoir
ipcMain.handle('homework:update', async (_, data: any) => {
  try {
    const { id, ...updateData } = data;
    return await global.homeworkService.updateHomework(id, updateData);
  } catch (error) {
    return handleError(error, 'Erreur lors de la mise à jour du devoir');
  }
});

// Handler pour notifier les étudiants
ipcMain.handle('homework:notify', async (_, data: any) => {
  try {
    // Ici vous pouvez implémenter la logique de notification
    // Par exemple, envoyer des SMS ou des emails
    console.log("Notification à envoyer:", data);
    
    // Pour l'instant, on simule un succès
    return {
      success: true,
      message: "Notifications envoyées avec succès",
      error: null,
      data: null
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la notification');
  }
});

// Ajouter cet événement s'il n'existe pas déjà
ipcMain.handle('school:getLogo', async (_, logoId: number) => {
    try {
        const logo = await global.fileService.getFileById({ fileId: logoId });
        if (!logo) {
            return {
                success: false,
                data: null,
                message: "Logo non trouvé",
                error: "Logo non trouvé"
            };
        }

        const base64Content = Buffer.from(logo.content).toString('base64');
        return {
            success: true,
            data: {
                id: logo.id,
                name: logo.name,
                type: logo.type,
                path: logo.path,
                content: base64Content
            },
            message: "Logo récupéré avec succès",
            error: null
        };
    } catch (error) {
        console.error('Erreur lors de la récupération du logo:', error);
        return {
            success: false,
            data: null,
            error: error instanceof Error ? error.message : "Erreur inconnue",
            message: "Une erreur est survenue lors de la récupération du logo"
        };
    }
});

// Gestionnaires pour les paiements
ipcMain.handle('payment:getConfigs', async () => {
  try {
    const response = await global.paymentService.getConfigs();
    console.log('=== payment:getConfigs - Réponse ===', response);
    return convertToResultType(response);
  } catch (error) {
    console.error('=== payment:getConfigs - Erreur ===', error);
    return handleError(error, 'Erreur lors de la récupération des configurations de paiement');
  }
});

ipcMain.handle('payment:saveConfig', async (_event, configData) => {
  try {
    const response = await global.paymentService.saveConfig(configData);
    return convertToResultType(response);
  } catch (error) {
    return handleError(error, 'Erreur lors de la sauvegarde de la configuration de paiement');
  }
});

ipcMain.handle('payment:getByStudent', async (_event, studentId) => {
  try {
    const response = await global.paymentService.getPaymentsByStudent(studentId);
    return convertToResultType(response);
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération des paiements');
  }
});

ipcMain.handle('payment:getConfig', async (_event, classId) => {
  try {
    const response = await global.paymentService.getConfigByClass(String(classId));
    return convertToResultType(response);
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération de la configuration de paiement');
  }
});

ipcMain.handle('payment:create', async (_event, paymentData) => {
  try {
    const response = await global.paymentService.addPayment(paymentData);
    return convertToResultType(response);
  } catch (error) {
    return handleError(error, 'Erreur lors de la création du paiement');
  }
});

ipcMain.handle('payment:getRemainingAmount', async (_event, studentId) => {
  try {
    const response = await global.paymentService.getRemainingAmount(studentId);
    return convertToResultType(response);
  } catch (error) {
    return handleError(error, 'Erreur lors du calcul du montant restant');
  }
});

// Événements de sauvegarde
ipcMain.handle('scholarship:getByStudent', async (_, studentId: number) => {
  try {
    const scholarships = await global.scholarshipService.getByStudent(studentId);
    console.log('=== Bourses récupérées pour étudiant', studentId, '===');
    console.log('Résultat:', scholarships);
    return scholarships;
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération des bourses');
  }
});

ipcMain.handle('scholarship:getActiveByStudent', async (_, studentId: number) => {
    try {
        const response = await global.paymentService.getActiveByStudent(studentId);
        return convertToResultType(response);
    } catch (error) {
        return handleError(error, 'Erreur lors de la récupération des bourses');
    }
});

// Gestionnaires pour les répartitions d'année scolaire
ipcMain.handle("yearRepartition:getAll", async () => {
    try {
        const result = await global.yearRepartitionService.getAllYearRepartitions();
        return convertToResultType(result);
    } catch (error) {
        return handleError(error, 'Erreur lors de la récupération des répartitions d\'année');
    }
});

ipcMain.handle("yearRepartition:getCurrent", async () => {
    try {
        const result = await global.yearRepartitionService.getCurrentYearRepartition();
        return convertToResultType(result);
    } catch (error) {
        return handleError(error, 'Erreur lors de la récupération de l\'année scolaire courante');
    }
});

ipcMain.handle("yearRepartition:create", async (_, data) => {
    try {
        const result = await global.yearRepartitionService.createYearRepartition(data);
        return convertToResultType(result);
    } catch (error) {
        return handleError(error, 'Erreur lors de la création de la répartition d\'année');
    }
});

ipcMain.handle("yearRepartition:update", async (_, {id, data}) => {
    try {
        console.log(`=== yearRepartition:update - Début - ID: ${id} ===`);
        console.log('Données reçues:', JSON.stringify({id, data}, null, 2));
        
        if (!id) {
            throw new Error("ID de répartition manquant");
        }
        
        const result = await global.yearRepartitionService.updateYearRepartition(id, data);
        
        console.log('=== yearRepartition:update - Résultat ===');
        console.log(JSON.stringify(result, null, 2));
        
        return convertToResultType(result);
    } catch (error) {
        console.error('=== yearRepartition:update - Erreur ===', error);
        return handleError(error, 'Erreur lors de la mise à jour de la répartition d\'année');
    }
});

ipcMain.handle("yearRepartition:delete", async (_, id) => {
    try {
        const result = await global.yearRepartitionService.deleteYearRepartition(id);
        return convertToResultType(result);
    } catch (error) {
        return handleError(error, 'Erreur lors de la suppression de la répartition d\'année');
    }
});

ipcMain.handle("yearRepartition:setCurrent", async (_event, id: number) => {
    try {
        return await global.yearRepartitionService.setCurrentYearRepartition(id);
    } catch (error) {
        return handleError(error, 'Erreur lors de la mise à jour de la répartition');
    }
});

// Ajouter ce handler pour les congés des professeurs
ipcMain.handle('vacation:getByProfessor', async (_event, professorId?: number) => {
  try {
    return await global.vacationService.getVacationsByProfessor(professorId);
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération des congés');
  }
});

// Ajouter ce handler pour la mise à jour du statut des congés
ipcMain.handle('vacation:updateStatus', async (_event, { id, status, comment }) => {
  try {
    return await global.vacationService.updateVacationStatus(id, status, comment);
  } catch (error) {
    return handleError(error, 'Erreur lors de la mise à jour du statut');
  }
});

// Ajouter les handlers pour les bulletins
ipcMain.handle('report:generateMultiple', async (_event, data) => {
    try {
        return await global.reportCardService.generateReportCards(data);
    } catch (error) {
        return handleError(error, 'Erreur lors de la génération des bulletins');
    }
});

ipcMain.handle('report:preview', async (_event, data) => {
    try {
        const result = await global.reportCardService.generateReportCards({
            studentIds: [data.studentId],
            period: data.period,
            templateId: 'preview'
        });
        return result;
    } catch (error) {
        return handleError(error, 'Erreur lors de la génération du bulletin');
    }
});

// Handler pour la configuration des notes
ipcMain.handle('gradeConfig:save', async (_event, config) => {
    try {
        console.log('=== Events - Début gradeConfig:save ===', config);
        const result = await global.gradeConfigService.saveConfiguration(config);
        console.log('=== Events - Résultat gradeConfig:save ===', result);
        return result;
    } catch (error) {
        console.error('=== Events - Erreur dans gradeConfig:save ===', error);
        return handleError(error, 'Erreur lors de la sauvegarde de la configuration');
    }
});


// Sauvegarder les notes d'un étudiant
ipcMain.handle('grades:save', async (_event, data: {
    studentId: number;
    gradeId: number;
    period: string;
    grades: Array<{
        courseId: number;
        assignments: number[];
        exam: number;
        average: number;
        appreciation: string;
    }>;
}) => {
    try {
        console.log('Handler grades:save appelé avec:', data);
        return await global.reportCardService.saveStudentGrades(data);
    } catch (error) {
        console.error('Erreur dans le handler grades:save:', error);
        return {
            success: false,
            data: null,
            message: "Erreur lors de la sauvegarde des notes",
            error: error instanceof Error ? error.message : "Erreur inconnue"
        };
    }
});

// Handler pour récupérer un étudiant par son ID
ipcMain.handle('student:getById', async (_event, studentId: number) => {
    try {
        const response = await global.studentService.getStudentById(studentId);
        return convertToResultType(response);
    } catch (error) {
        return handleError(error, 'Erreur lors de la récupération de l\'étudiant');
    }
});

ipcMain.handle('gradeConfig:saveGeneral', async (_event, config) => {
    try {
        // Implémenter la sauvegarde de la configuration générale
        return {
            success: true,
            data: config,
            message: "Configuration générale sauvegardée",
            error: null
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la sauvegarde de la configuration générale');
    }
});

// Handler pour récupérer la configuration des notes


ipcMain.handle('grades:get', async (_event, { studentId, period }) => {
    try {
        return await global.reportCardService.getStudentGrades(studentId, period);
    } catch (error) {
        return handleError(error, 'Erreur lors de la récupération des notes');
    }
});

ipcMain.handle('preference:saveTemplate', async (_, templateId: string) => {
    return await global.preferenceService.saveTemplatePreference(templateId);
});

ipcMain.handle('preference:getTemplate', async () => {
    return await global.preferenceService.getTemplatePreference();
});

// Handler pour récupérer la configuration des notes
ipcMain.handle('gradeConfig:get', async (_event, { gradeId }) => {
    try {
        console.log('=== Events - Début gradeConfig:get ===', gradeId);
        const gradeConfigService = new GradeConfigService();
        const result = await gradeConfigService.getConfigurationByGrade(gradeId);
        console.log('=== Events - Résultat gradeConfig:get ===', result);
        return result;
    } catch (error) {
        console.error('=== Events - Erreur dans gradeConfig:get ===', error);
        return handleError(error, 'Erreur lors de la récupération de la configuration');
    }
});

// Handler pour mettre à jour un professeur
ipcMain.handle("professor:update", async (_event: Electron.IpcMainInvokeEvent, { id, data }: { id: number, data: any }): Promise<ResultType> => {
  try {
    console.log(`Début de professor:update pour le professeur ID: ${id}`);
    const response = await global.professorService.updateProfessor(id, data);
    return {
      success: response.success,
      data: response.data,
      message: response.message || 'Mise à jour du professeur réussie',
      error: response.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la mise à jour du professeur');
  }
});

// Gestionnaire pour récupérer les informations de l'école
ipcMain.handle('school:get', async () => {
    try {
        const result = await global.schoolService.getSchool();
        return result;
    } catch (error) {
        return handleError(error, 'Erreur lors de la récupération des informations de l\'école');
    }
});

// Gestionnaire pour récupérer les statistiques du tableau de bord
ipcMain.handle('dashboard:stats', async () => {
    try {
        const [studentsResult, professorsResult] = await Promise.all([
            global.dashboardService.getTotalStudents(),
            global.dashboardService.getTotalProfessors()
        ]);

        if (!studentsResult.success || !professorsResult.success) {
            throw new Error('Erreur lors de la récupération des statistiques');
        }

        return {
            success: true,
            data: {
                totalStudents: studentsResult.data,
                totalProfessors: professorsResult.data
            },
            message: 'Statistiques récupérées avec succès',
            error: null
        };
    } catch (error) {
        return handleError(error, 'Erreur lors de la récupération des statistiques');
    }
});

// Gestionnaire pour sauvegarder les informations de l'école
ipcMain.handle('school:save', async (_event, schoolData) => {
    try {
        const result = await global.schoolService.saveOrUpdateSchool(schoolData);
        return result;
    } catch (error) {
        return handleError(error, 'Erreur lors de la sauvegarde des informations de l\'école');
    }
});

// Handler pour créer un nouveau professeur
ipcMain.handle("professor:create", async (_event: Electron.IpcMainInvokeEvent, professorData: any): Promise<ResultType> => {
  try {
    console.log("Début de professor:create avec les données:", JSON.stringify(professorData));
    const response = await global.professorService.createProfessor(professorData);
    return {
      success: response.success,
      data: response.data,
      message: response.message || 'Professeur créé avec succès',
      error: response.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la création du professeur');
  }
});

// Handler pour récupérer tous les professeurs
ipcMain.handle("professor:all", async (_event: Electron.IpcMainInvokeEvent): Promise<ResultType> => {
  try {
    console.log("Début de professor:all");
    const response = await global.professorService.getAllProfessors();
    return {
      success: response.success,
      data: response.data,
      message: response.message || 'Récupération des professeurs réussie',
      error: response.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération des professeurs');
  }
});

// Handler pour récupérer un professeur par son ID
ipcMain.handle("professor:getById", async (_event: Electron.IpcMainInvokeEvent, professorId: number): Promise<ResultType> => {
  try {
    console.log(`Début de professor:getById pour le professeur ID: ${professorId}`);
    const response = await global.professorService.getProfessorById(professorId);
    return {
      success: response.success,
      data: response.data,
      message: response.message || 'Récupération du professeur réussie',
      error: response.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la récupération du professeur');
  }
});

// Handler pour supprimer un professeur
ipcMain.handle("professor:delete", async (_event: Electron.IpcMainInvokeEvent, professorId: number): Promise<ResultType> => {
  try {
    console.log(`Début de professor:delete pour le professeur ID: ${professorId}`);
    const response = await global.professorService.deleteProfessor(professorId);
    return {
      success: response.success,
      data: response.data,
      message: response.message || 'Suppression du professeur réussie',
      error: response.error
    };
  } catch (error) {
    return handleError(error, 'Erreur lors de la suppression du professeur');
  }
});

// Exporter la fonction registerReportEvents pour qu'elle puisse être utilisée dans main.ts
export function registerReportEvents() {
  const reportService = new ReportCardService();

  // Génération du bulletin
  ipcMain.handle('report:generate', async (_, data: { studentId: number; period: string }) => {
    console.log('Demande de génération de bulletin:', data);
    try {
      const result = await reportService.generateReportCard(data);
      console.log('Résultat de la génération:', result);
      return result;
    } catch (error) {
      console.error('Erreur génération bulletin:', error);
      return {
        success: false,
        data: null,
        message: "Erreur lors de la génération du bulletin",
        error: error instanceof Error ? error.message : "Erreur inconnue",
        generalAverage: 0
      };
    }
  });

  // Récupération des notes
  ipcMain.handle('report:getGrades', async (_, data: { studentId: number; period: string }) => {
    console.log('Demande de récupération des notes:', data);
    try {
      const result = await reportService.getStudentGrades(data.studentId, data.period);
      console.log('Notes récupérées:', result);
      return result;
    } catch (error) {
      console.error('Erreur récupération notes:', error);
      return {
        success: false,
        data: [],
        message: "Erreur lors de la récupération des notes",
        error: error instanceof Error ? error.message : "Erreur inconnue",
        generalAverage: 0
      };
    }
  });
}









