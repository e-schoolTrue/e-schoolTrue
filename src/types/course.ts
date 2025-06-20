// Types de base
export interface ICourseBase {
    id?: string;
    name: string;
    code: string;
    coefficient: number;
}

// Type principal pour les matières
export interface ICourse extends ICourseBase {
    isInGroupement?: boolean;
    groupementId?: string;
    groupement?: ICourse;    // Matière parente
    courses?: ICourse[];     // Sous-matières
    created_at?: Date;
    updated_at?: Date;
}

// Type pour les observations
export interface ICourseObservation {
    id?: string;
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
    groupementId?: string;
}

// Types pour les requêtes de service
export interface ICourseServiceParams {
    newCourse: ICourseBase;
    
    addCourseToGroupement: ICourseBase & {
        groupementId?: string;
    };
    
    updateCourse: {
        id: string;
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
  groupementId?: string; 
};
export type CourseGroupCommand = ICourseBase & { 
  groupementId?: string; 
  groupement?: ICourseBase; // Pour stocker les informations de base du parent
  isInGroupement?: boolean; 
};
export type CourseObservation = ICourseObservation;
