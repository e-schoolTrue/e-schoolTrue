import { ipcMain } from "electron";
import { GradeService } from "#electron/backend/services/gradeService.ts";
import { BranchCommand, ClassRoomCommand, CourseCommand, GradeCommand } from "#electron/command/settingsCommand.ts";
import { CourseService } from "#electron/backend/services/courseService.ts";
import { StudentService } from "./backend/services/studentService";
import { FileService } from "./backend/services/fileService";
import { ResultType } from "#electron/command";
import * as fs from 'fs/promises';
import { app } from 'electron';
import path from 'path';
import { PaymentService } from './backend/services/paymentService';
import { AbsenceService } from './backend/services/absenceService';

const global = {
    gradeService: new GradeService(),
    courseService: new CourseService(),
    studentService: new StudentService(),
    fileService: new FileService(),
    paymentService: new PaymentService(),
    absenceService: new AbsenceService(),
   StudentService : new StudentService(),
}

// Fonction utilitaire pour gérer les erreurs
const handleError = (error: any): ResultType => {
    console.error('Erreur:', error);
    return { 
        success: false, 
        message: Buffer.from(`Une erreur est survenue: ${error.message}`).toString('base64'),
        error: error instanceof Error ? error.message : String(error),
        data: null
    };
}

// Exemple pour un gestionnaire d'événement
ipcMain.handle("grade:all", async (_event: Electron.IpcMainInvokeEvent, _args: any): Promise<ResultType> => {
    try {
        return await global.gradeService.getGrades();
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("grade:new"  , async (_event: Electron.IpcMainInvokeEvent, command: GradeCommand): Promise<ResultType> => {
    try {
        return await global.gradeService.newGrade(command);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("grade:update"  , async (_event: Electron.IpcMainInvokeEvent, command: GradeCommand): Promise<ResultType> => {
    try {
        return await global.gradeService.updateGrade(command);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("grade:delete"  , async (_event: Electron.IpcMainInvokeEvent, id: number): Promise<ResultType> => {
    try {
        return await global.gradeService.deleteGrade(id);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("classRoom:new"  , async (_event: Electron.IpcMainInvokeEvent, command: ClassRoomCommand): Promise<ResultType> => {
    try {
        return await global.gradeService.newClassRoom(command);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("classRoom:delete"  , async (_event: Electron.IpcMainInvokeEvent, id: number): Promise<ResultType> => {
    try {
        return await global.gradeService.deleteClassRoom(id);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("classRoom:update"  , async (_event: Electron.IpcMainInvokeEvent, command: ClassRoomCommand): Promise<ResultType> => {
    try {
        return await global.gradeService.updateClassRoom(command);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("classRoom:all", async (_event: Electron.IpcMainInvokeEvent): Promise<ResultType> => {
  try {
    return await global.gradeService.getClassRooms();
  } catch (error) {
    return handleError(error);
  }
});

ipcMain.handle("branch:new"  , async (_event: Electron.IpcMainInvokeEvent, command: BranchCommand): Promise<ResultType> => {
    try {
        return await global.gradeService.newBranch(command);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("branch:update"  , async (_event: Electron.IpcMainInvokeEvent, command: BranchCommand): Promise<ResultType> => {
    try {
        return await global.gradeService.updateBranch(command);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("branch:delete"  , async (_event: Electron.IpcMainInvokeEvent, id: number): Promise<ResultType> => {
    try {
        return await global.gradeService.deleteBranch(id);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("course:new"  , async (_event: Electron.IpcMainInvokeEvent, command: CourseCommand): Promise<ResultType> => {
    try {
        return await global.courseService.newCourse(command);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("courseGroup:add"  , async (_event: Electron.IpcMainInvokeEvent, command: CourseCommand): Promise<ResultType> => {
    try {
        return await global.courseService.addCourseToGroupement(command);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("course:update"  , async (_event: Electron.IpcMainInvokeEvent, command: CourseCommand): Promise<ResultType> => {
    try {
        return await global.courseService.updateCourse(command);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("course:delete"  , async (_event: Electron.IpcMainInvokeEvent, id: number): Promise<ResultType> => {
    try {
        return await global.courseService.deleteCourse(id);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("course:all"  , async (_event: Electron.IpcMainInvokeEvent, _args: any): Promise<ResultType> => {
    try {
        return await global.courseService.getAllCourse();
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("save-student", async (_event: Electron.IpcMainInvokeEvent, studentData: any): Promise<ResultType> => {
    try {
        // Si l'étudiant a un ID, c'est une mise à jour
        if (studentData.id) {
            return await global.studentService.updateStudent(studentData.id, studentData);
        }
        // Sinon, c'est une création
        else {
            return await global.studentService.createStudent(studentData);
        }
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("student:all", async (_event: Electron.IpcMainInvokeEvent, _args: any): Promise<ResultType> => {
    console.log("Début de student:all", _event, _args);
    try {
        const students = await global.studentService.getAllStudents();
        console.log("Données brutes reçues de la base de données:", JSON.stringify(students, null, 2));
        console.log("Nombre d'étudiants récupérés:", students.length);
        return { success: true, data: students, error: null, message: "Étudiants récupérés avec succès" };
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("student:getDetails", async (_event: Electron.IpcMainInvokeEvent, studentId: number): Promise<ResultType> => {
    console.log(`Début de student:getDetails pour l'étudiant ID: ${studentId}`);
    try {
        const studentDetails = await global.studentService.getStudentDetails(studentId);
        console.log("Détails bruts de l'étudiant reçus de la base de données:", JSON.stringify(studentDetails, null, 2));
        return { success: true, data: studentDetails, error: null, message: "Détails de l'étudiant récupérés avec succès" };
    } catch (error) {
        console.error("Erreur dans student:getDetails:", error);
        return handleError(error);
    }
});

ipcMain.handle("student:downloadDocument", async (_event: Electron.IpcMainInvokeEvent, documentId: number): Promise<ResultType> => {
    try {
        const document = await global.fileService.getFileById(documentId);
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
        return handleError(error);
    }
});

ipcMain.handle("getStudentPhoto", async (_event: Electron.IpcMainInvokeEvent, photoId: number): Promise<ResultType> => {
    try {
        const photo = await global.fileService.getFileById(photoId);
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
        return handleError(error);
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
            const savedPhoto = await global.fileService.saveFile(studentData.photo.content, studentData.photo.name, studentData.photo.type);
            studentData.photoId = savedPhoto.id;
        }

        if (studentData.document && studentData.document.length > 0) {
            const savedDocuments = await Promise.all(studentData.document.map(async (doc: any) => {
                if (doc.content) {
                    return await global.fileService.saveFile(doc.content, doc.name, doc.type);
                }
                return doc;
            }));
            studentData.documents = savedDocuments;
        }

        delete studentData.photo;
        delete studentData.document;

        const result = await global.studentService.updateStudent(studentId, studentData);
        return result;
    } catch (error) {
        return handleError(error);
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

// Gestionnaires pour la configuration des paiements
ipcMain.handle("payment:saveConfig", async (_event: Electron.IpcMainInvokeEvent, config: any): Promise<ResultType> => {
    try {
        console.log("Tentative de sauvegarde de la configuration:", config);
        const result = await global.paymentService.saveConfig(config);
        console.log("Résultat de la sauvegarde:", result);
        return result;
    } catch (error) {
        console.error("Erreur dans le gestionnaire payment:saveConfig:", error);
        return handleError(error);
    }
});

ipcMain.handle("payment:getConfigs", async (_event: Electron.IpcMainInvokeEvent): Promise<ResultType> => {
    try {
        return await global.paymentService.getConfigs();
    } catch (error) {
        return handleError(error);
    }
});

// Gestionnaires pour les paiements


ipcMain.handle("payment:getAll", async (_event: Electron.IpcMainInvokeEvent, page: number): Promise<ResultType> => {
    try {
        return await global.paymentService.getPayments(page);
    } catch (error) {
        return handleError(error);
    }
});
ipcMain.handle("payment:add", async (_event: Electron.IpcMainInvokeEvent, paymentData: any): Promise<ResultType> => {
    console.log('=== Données reçues dans le main process ===');
    console.log(JSON.stringify(paymentData, null, 2));

    // Vérification des champs requis
    const requiredFields = ['amount', 'paymentDate', 'paymentType', 'studentId', 'installmentNumber', 'schoolYear'];
    const missingFields = requiredFields.filter(field => !paymentData[field]);
    
    if (missingFields.length > 0) {
        console.error('Champs manquants:', missingFields);
        return {
            success: false,
            data: null,
            message: `Champs requis manquants: ${missingFields.join(', ')}`,
            error: 'MISSING_FIELDS'
        };
    }

    try {
        // Formater les données pour correspondre à l'entité
        const formattedPaymentData = {
            ...paymentData,
            amount: Number(paymentData.amount),
            paymentDate: new Date(paymentData.paymentDate),
            installmentNumber: Number(paymentData.installmentNumber),
            studentId: Number(paymentData.studentId),
            paymentType: paymentData.paymentType.toUpperCase()
        };

        console.log('=== Données formatées ===');
        console.log(JSON.stringify(formattedPaymentData, null, 2));

        const result = await global.paymentService.addPayment(formattedPaymentData);
        console.log('=== Résultat de l\'ajout ===');
        console.log(JSON.stringify(result, null, 2));

        return result;
    } catch (error) {
        console.error('Erreur lors du traitement:', error);
        return handleError(error);
    }
});

ipcMain.handle("payment:getByStudent", async (_event: Electron.IpcMainInvokeEvent, studentId: number): Promise<ResultType> => {
    try {
        return await global.paymentService.getPaymentsByStudent(studentId);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("payment:getConfig", async (_event: Electron.IpcMainInvokeEvent, classId: number): Promise<ResultType> => {
    try {
        return await global.paymentService.getConfigByClass(classId);
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle('payment:getRemainingAmount', async (_event, studentId: number) => {
    try {
        return await global.paymentService.getRemainingAmount(studentId);
    } catch (error) {
        console.error('Error in payment:getRemainingAmount handler:', error);
        throw error;
    }
});
// Assurez-vous que le service est instancié
ipcMain.handle('absence:getByStudent', async (_event, studentId: number) => {
    try {
        return await global.absenceService.getAbsencesByStudent(studentId);
    } catch (error) {
        console.error('Error in absence:getByStudent handler:', error);
        throw error;
    }
});

// Ajouter une nouvelle absence
ipcMain.handle('absence:add', async (_event, absenceData: {
    studentId: number;
    date: Date;
    reason: string;
    justified: boolean;
}) => {
    try {
        // Validation des données d'entrée
        if (!absenceData.studentId || !absenceData.date || !absenceData.reason) {
            throw new Error('Données manquantes requises');
        }

        // Recherche de l'étudiant
        const student = await global.studentService.getStudentById(absenceData.studentId);
        if (!student) {
            throw new Error('Étudiant non trouvé');
        }

        // Création de la nouvelle absence
        const newAbsence = await global.absenceService.addAbsence({
            student,
            date: new Date(absenceData.date),
            reason: absenceData.reason,
            justified: absenceData.justified ?? false
        });

        return {
            success: true,
            data: newAbsence
        };

    } catch (error) {
        console.error('Erreur lors de l\'ajout de l\'absence:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Une erreur inconnue est survenue'
        };
    }
});

// Mettre à jour le statut d'une absence
ipcMain.handle('absence:updateStatus', async (_event, { 
    absenceId, 
    justified 
}: { 
    absenceId: number; 
    justified: boolean; 
}) => {
    try {
        return await global.absenceService.updateAbsenceStatus(absenceId, justified);
    } catch (error) {
        console.error('Error in absence:updateStatus handler:', error);
        throw error;
    }
});

// Supprimer une absence
ipcMain.handle('absence:delete', async (_event, absenceId: number) => {
    try {
        return await global.absenceService.deleteAbsence(absenceId);
    } catch (error) {
        console.error('Error in absence:delete handler:', error);
        throw error;
    }
});

// Obtenir les statistiques d'absence
ipcMain.handle('absence:getStatistics', async (_event, studentId: number) => {
    try {
        return await global.absenceService.getAbsenceStatistics(studentId);
    } catch (error) {
        console.error('Error in absence:getStatistics handler:', error);
        throw error;
    }
});


  