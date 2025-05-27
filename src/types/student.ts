import { ResponseType } from "./index";
import type { IFile, IGrade, IAbsence, IPayment, IScholarship, Gender } from "./shared";

// Types pour les données de l'étudiant
export interface IStudentData {
    id?: number;
    firstname?: string;
    lastname?: string;
    matricule?: string;
    birthDay?: Date | null;
    birthPlace?: string;
    address?: string;
    fatherFirstname?: string;
    fatherLastname?: string;
    motherFirstname?: string;
    motherLastname?: string;
    famillyPhone?: string;
    personalPhone?: string;
    sex?: Gender;
    schoolYear?: string;
    createdAt?: Date;
    updatedAt?: Date;
    gradeId?: number;
    photoId?: number;
    documentId?: number;
    documents: IFile[];
    photo: IFile | null;
    grade?: {
        id: number;
        name: string;
        code: string;
    };
}

// Types pour les fichiers de l'étudiant
export interface IStudentFile extends IFile {}

// Types pour les détails complets de l'étudiant
export interface IStudentDetails {
    id: number;
    firstname: string;
    lastname: string;
    matricule?: string;
    birthDay?: Date | null;
    birthPlace?: string;
    address?: string;
    fatherFirstname?: string;
    fatherLastname?: string;
    motherFirstname?: string;
    motherLastname?: string;
    famillyPhone?: string;
    personalPhone?: string;
    sex?: Gender;
    schoolYear?: string;
    createdAt?: Date;
    updatedAt?: Date;
    gradeId?: number;
    photoId?: number;
    documentId?: number;
    photo: IFile | null;
    documents: IFile[];
    grade: IGrade | null;
}

// Types pour les paramètres des méthodes du service
export interface IStudentServiceParams {
    createStudent: {
        firstname: string;
        lastname: string;
        fatherFirstname: string;
        fatherLastname: string;
        birthDay?: Date | null;
        birthPlace?: string;
        address?: string;
        motherFirstname?: string;
        motherLastname?: string;
        famillyPhone?: string;
        personalPhone?: string;
        sex?: Gender;
        schoolYear?: string;
        gradeId?: number;
        photo?: IStudentFile;
        documents?: IStudentFile[];
    };
    updateStudent: {
        id: number;
        data: Partial<IStudentData> & {
            photo?: IStudentFile;
            documents?: IStudentFile[];
        };
    };
    getStudentDetails: {
        studentId: number;
    };
    deleteStudent: {
        studentId: number;
    };
    searchStudents: {
        query: string;
    };
    getStudentsByGrade: {
        gradeId: number;
    };
}

// Types pour les réponses du service
export interface IStudentServiceResponse extends ResponseType {
    data: IStudentDetails | IStudentDetails[] | null;
}

// Type spécifique pour la réponse du total des étudiants
export interface IStudentCountResponse extends ResponseType {
    data: number | null;
}

// Types pour les statistiques des étudiants
export interface IStudentStatistics {
    total: number;
    byGrade: {
        gradeId: number;
        gradeName: string;
        count: number;
    }[];
    byGender: {
        male: number;
        female: number;
    };
}

// Types pour les relations de l'étudiant
export interface IStudentRelations {
    photo?: IFile;
    documents?: IFile[];
    grade?: IGrade;
    absences?: IAbsence[];
    payments?: IPayment[];
    scholarship?: IScholarship[];
}

export interface Student {
    id: number;
    firstname: string;
    lastname: string;
    matricule: string;
    grade?: {
        id: number;
        name: string;
    };
    payments?: Array<{
        id: number;
        amount: number;
        createdAt: string;
        paymentType: string;
    }>;
    scholarship?: Array<{
        id: number;
        percentage: number;
        isActive: boolean;
        schoolYear: string;
    }>;
}
