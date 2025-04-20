// Types pour les entités frontend
export interface Course {
    id?: number;
    name: string;
    code: string;
    coefficient: number;
    isInGroupement?: boolean;
    groupementId?: number;  // Relation avec une matière parente
    groupement?: Course;    // Matière parente
    courses?: Course[];     // Sous-matières
    createdAt?: Date;
    updatedAt?: Date;
}

// Types pour les formulaires
export interface CourseFormData {
    id?: number;
    name: string;
    code: string;
    coefficient: number;
}

export interface CourseGroupFormData {
    id?: number;
    name: string;
    code: string;
    coefficient: number;
    groupementId?: number;
}

// Types pour les réponses API
export interface ApiResponse<T> {
    success: boolean;
    data: T | null;
    message: string;
    error: string | null;
}

export interface CourseResponse extends ApiResponse<Course[]> {}

export interface CourseGroupResponse extends ApiResponse<Course[]> {}

// Types pour les commandes (utilisées pour les communications avec le backend)
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
    isInGroupement?: boolean;
}

// Types pour la gestion des observations
export interface CourseObservation {
    id?: number;
    observation?: string;
    note?: number;
}

export interface ICourseData {
    id?: number;
    code: string;
    name: string;
    coefficient: number;
    isInGroupement?: boolean;
    groupement?: Course;
    observations?: Array<CourseObservation>;
    courses?: Course[];
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
