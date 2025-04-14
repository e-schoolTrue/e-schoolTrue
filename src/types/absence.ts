import { StudentEntity } from "#electron/backend/entities/students";
import { CourseEntity } from "#electron/backend/entities/course";
import { FileEntity } from "#electron/backend/entities/file";
import { GradeEntity } from "#electron/backend/entities/grade";

// Types pour les données d'absence
export interface IAbsenceData {
    id?: number;
    date: Date;
    reason?: string;
    reasonType?: string;
    absenceType?: string;
    justified?: boolean;
    startTime?: string;
    endTime?: string;
    comments?: string;
    type: 'STUDENT' | 'PROFESSOR';
    studentId?: number;
    gradeId?: number;
    courseId?: number;
    professorId?: number;
    parentNotified?: boolean;
    student?: StudentEntity;
    grade?: GradeEntity;
    course?: CourseEntity;
    document?: FileEntity;
}

// Types pour les statistiques d'absence
export interface IAbsenceStatistics {
    total: number;
    justified: number;
    unjustified: number;
}

// Types pour les absences récentes
export interface IRecentAbsence {
    id: number;
    studentName: string;
    date: Date;
    reason?: string;
    justified: boolean;
}

// Types pour les paramètres des méthodes du service
export interface IAbsenceServiceParams {
    addAbsence: IAbsenceData;
    getAbsencesByStudent: { studentId: number };
    updateAbsenceStatus: { absenceId: number; justified: boolean };
    deleteAbsence: { absenceId: number };
    getAbsencesByDateRange: { startDate: Date; endDate: Date };
    getAbsenceStatistics: { studentId: number };
    getRecentAbsences: { limit?: number };
    getAllAbsences: { type?: 'STUDENT' | 'PROFESSOR' };
    createProfessorAbsence: IAbsenceData & {
        document?: {
            content: string;
            name: string;
            type: string;
        };
    };
    updateProfessorAbsence: IAbsenceData & {
        document?: {
            content: string;
            name: string;
            type: string;
        };
    };
    deleteProfessorAbsence: { id: number };
}


