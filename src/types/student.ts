import { FileEntity } from "#electron/backend/entities/file";
import { GradeEntity } from "#electron/backend/entities/grade";            
import { AbsenceEntity } from "#electron/backend/entities/absence";
import { PaymentEntity } from "#electron/backend/entities/payment";
import { ScholarshipEntity } from "#electron/backend/entities/scholarship";
import { ResponseType } from "./index";

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
    sex?: "male" | "female";
    schoolYear?: string;
    createdAt?: Date;
    updatedAt?: Date;
    gradeId?: number;
    photoId?: number;
    documentId?: number;
    documents: FileEntity[];
    photo: FileEntity | null;
}

// Types pour les fichiers de l'étudiant
export interface IStudentFile {
    id: number;
    name: string;
    type: string;
    content?: string;
}

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
    sex?: "male" | "female";
    schoolYear?: string;
    createdAt?: Date;
    updatedAt?: Date;
    gradeId?: number;
    photoId?: number;
    documentId?: number;
    photo: FileEntity | null;
    documents: FileEntity[];
    grade: {
        id: number;
        name?: string;
        description?: string;
        code?: string;
    } | null;
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
        sex?: "male" | "female";
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
    photo?: FileEntity;
    documents?: FileEntity[];
    grade?: GradeEntity;
    absences?: AbsenceEntity[];
    payments?: PaymentEntity[];
    scholarship?: ScholarshipEntity[];
}
