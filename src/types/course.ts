// Types pour les entités
export interface CourseEntity {
    id?: number;
    name: string;
    code: string;
    coefficient: number;
    isInGroupement?: boolean;
    groupement?: CourseEntity;
    courses?: CourseEntity[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ICourseData {
    id?: number;
    code: string;
    name: string;
    coefficient: number;
    isInGroupement?: boolean;
    groupement?: CourseEntity;
    observations?: Array<{
        id?: number;
        observation?: string;
        note?: number;
    }>;
    courses?: CourseEntity[];
}

export interface ICourseServiceParams {
    newCourse: {
        name: string;
        coefficient: number;
        code: string;
    };
    addCourseToGroupement: {
        name: string;
        coefficient: number;
        code: string;
        groupementId?: number;
    };
    updateCourse: {
        id: number;
        data: {
            name: string;
            coefficient: number;
            code: string;
        };
    };
}

export interface ICourseServiceResponse {
    success: boolean;
    data: ICourseData[] | null;
    error: string | null;
    message: string;
}

// Types pour les commandes
export interface CourseCommand {
    id?: number;
    name: string;
    code: string;
    coefficient: number;
}

export interface CourseGroupCommand {
    id?: number;
    name: string;
    code: string;
    coefficient: number;
    groupementId?: number;
}

// Types pour les formulaires
export interface CourseFormData {
    name: string;
    code: string;
    coefficient: number;
}

export interface CourseGroupFormData {
    name: string;
    code: string;
    coefficient: number;
    groupementId?: number;
}

// Types pour les réponses API
export interface CourseResponse {
    success: boolean;
    data: CourseEntity[] | null;
    message: string;
    error: string | null;
}

export interface CourseGroupResponse {
    success: boolean;
    data: CourseEntity[] | null;
    message: string;
    error: string | null;
}
