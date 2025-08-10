import { ResponseType } from "./index";

// Interfaces de relations définies localement
export interface IFileRelation {
    id: number;
    name: string;
    type: string;
    path?: string;
    createdAt: Date;
}

export interface IGradeRelation {
    id?: number;
    name?: string;
    code?: string;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IAbsenceRelation {
    id: number;
    date: Date;
    reason: string;
    reasonType: string;
    absenceType: string;
    justified: boolean;
    startTime?: string;
    endTime?: string;
    comments?: string;
    createdAt: Date;
    parentNotified: boolean;
    type: string;
}

export interface IPaymentRelation {
    id: number;
    amount: number;
    paymentType: string;
    paymentMethod: string;
    createdAt: Date;
    studentId: number;
    installmentNumber: number;
    schoolYear: string;
    comment?: string;
    baseAmount?: number;
    adjustedAmount?: number;
}

export interface IScholarshipRelation {
    id: number;
    studentId: number;
    percentage: number;
    isActive: boolean;
    schoolYear: string;
    reason?: string;
    createdAt: Date;
    configId?: number;
}

// Types pour les données de l'étudiant
export interface IStudentData {
    id?: number;
    firstname?: string;
    lastname?: string;
    matricule?: string;
    birthDay?: Date;
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
}

// Types pour les fichiers de l'étudiant
export interface IStudentFile {
    id: number;
    name: string;
    type: string;
    content?: string;
}

// Types pour les détails complets de l'étudiant
export interface IStudentDetails extends IStudentData {
    photo: IStudentFile | null;
    documents: IStudentFile[];
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
        birthDay?: Date;
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
    photo?: IFileRelation;
    documents?: IFileRelation[];
    grade?: IGradeRelation;
    absences?: IAbsenceRelation[];
    payments?: IPaymentRelation[];
    scholarship?: IScholarshipRelation[];
}
