import type { IStudent, ICourse, IFile, IGrade } from './shared';

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
    student?: IStudent;
    grade?: IGrade;
    course?: ICourse;
    document?: IFile;
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


