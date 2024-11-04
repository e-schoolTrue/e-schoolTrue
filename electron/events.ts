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
    absenceService: new AbsenceService()
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
    console.log("Données de l'étudiant reçues pour la sauvegarde:", JSON.stringify(studentData, null, 2));
    try {
        if (studentData.photo && studentData.photo.content) {
            const savedPhoto = await global.fileService.saveFile(
                studentData.photo.content,
                studentData.photo.name,
                studentData.photo.type
            );
            studentData.photoId = savedPhoto.id;
        }

        if (studentData.document && studentData.document.length > 0) {
            const savedDocuments = await Promise.all(studentData.document.map(async (doc: any) => {
                if (doc.content) {
                    return await global.fileService.saveFile(
                        doc.content,
                        doc.name,
                        doc.type
                    );
                }
                return doc;
            }));
            studentData.documents = savedDocuments;
        }

        delete studentData.photo;
        delete studentData.document;

        const result = await global.studentService.saveStudent(studentData);
        return result;
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
    console.log(`Début de student:downloadDocument pour le document ID: ${documentId}`);
    try {
        const document = await global.fileService.getFileById(documentId);
        if (document && document.path) {
            const content = await fs.readFile(document.path);
            return { 
                success: true, 
                data: {
                    content: content,
                    type: document.type,
                    extension: document.type ? document.type.split('/')[1] : undefined
                },
                error: null,
                message: "Document récupéré avec succès"
            };
        } else {
            console.log("Document non trouvé ou incomplet");
            return { success: false, message: "Document non trouvé ou incomplet", error: null, data: null };
        }
    } catch (error) {
        return handleError(error);
    }
});

ipcMain.handle("getStudentPhoto", async (_event: Electron.IpcMainInvokeEvent, photoId: number): Promise<ResultType> => {
    try {
        const photo = await global.fileService.getFileById(photoId);
        if (photo && photo.path) {
            const content = await fs.readFile(photo.path);
            return { 
                success: true, 
                data: {
                    content: content,
                    type: photo.type
                },
                error: null,
                message: "Photo récupérée avec succès"
                
            };
        } else {
            return { success: false, message: "Photo non trouvée", error: null, data: null };
        }
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

ipcMain.handle('payment:getByStudent', async (_event, studentId) => {
  try {
    const payments = await global.paymentService.getPaymentsByStudent(studentId);
    return { success: true, data: payments };
  } catch (error) {
    return handleError(error);
  }
});

ipcMain.handle('payment:add', async (_event, paymentData) => {
  try {
    const payment = await global.paymentService.addPayment(paymentData);
    return { success: true, data: payment };
  } catch (error) {
    return handleError(error);
  }
});

ipcMain.handle('absence:getByStudent', async (_event, studentId) => {
  try {
    const absences = await global.absenceService.getAbsencesByStudent(studentId);
    return { success: true, data: absences };
  } catch (error) {
    return handleError(error);
  }
});

ipcMain.handle('absence:add', async (_event, absenceData) => {
  try {
    const absence = await global.absenceService.addAbsence(absenceData);
    return { success: true, data: absence };
  } catch (error) {
    return handleError(error);
  }
});