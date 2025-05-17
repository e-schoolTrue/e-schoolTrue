// Types de base
export interface ICourseBase {
    id?: number;
    name: string;
    code: string;
    coefficient: number;
}

// Type principal pour les matières
export interface ICourse extends ICourseBase {
    isInGroupement?: boolean;
    groupementId?: number;
    groupement?: ICourse;    // Matière parente
    courses?: ICourse[];     // Sous-matières
    createdAt?: Date;
    updatedAt?: Date;
}

// Type pour les observations
export interface ICourseObservation {
    id?: number;
    observation?: string;
    note?: number;
}

// Types pour les données complètes des matières
export interface ICourseData extends ICourse {
    observations?: ICourseObservation[];
}

// Types pour les formulaires
export interface ICourseFormData extends ICourseBase {}

export interface ICourseGroupFormData extends ICourseBase {
    groupementId?: number;
}

// Types pour les requêtes de service
export interface ICourseServiceParams {
    newCourse: ICourseBase;
    
    addCourseToGroupement: ICourseBase & {
        groupementId?: number;
    };
    
    updateCourse: {
        id: number;
        data: ICourseBase;
    };
}

// Types pour les réponses API
export interface IApiResponse<T> {
    success: boolean;
    data: T | null;
    message: string;
    error: string | null;
}

export interface ICourseServiceResponse extends IApiResponse<ICourseData[] | null> {}

// Types pour la rétrocompatibilité (si nécessaire)
export type Course = ICourse;
export type CourseFormData = ICourseFormData;
export type CourseGroupFormData = ICourseGroupFormData;
export type ApiResponse<T> = IApiResponse<T>;
export type CourseResponse = IApiResponse<ICourse[]>;
export type CourseGroupResponse = IApiResponse<ICourse[]>;
export type CourseCommand = ICourseBase & { 
  isInGroupement?: boolean; 
  groupementId?: number; 
};
export type CourseGroupCommand = ICourseBase & { 
  groupementId?: number; 
  groupement?: ICourseBase; // Pour stocker les informations de base du parent
  isInGroupement?: boolean; 
};
export type CourseObservation = ICourseObservation;
