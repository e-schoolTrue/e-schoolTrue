export interface IGradeData {
    id?: number;
    name: string;
    code: string;
    students?: any[];
    branches?: IBranchData[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IClassRoomData {
    id?: number;
    name: string;
    code: string;
    capacity: number;
    grade?: IGradeData;
    branch?: IBranchData;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IBranchData {
    id?: number;
    name: string;
    code: string;
    grade?: IGradeData;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IGradeServiceParams {
    newGrade: {
        name: string;
        code: string;
    };
    updateGrade: {
        id: number;
        name: string;
        code: string;
    };
    newClassRoom: {
        name: string;
        code: string;
        capacity: number;
        gradeId?: number;
        branchId?: number;
    };
    updateClassRoom: {
        id: number;
        name: string;
        code: string;
        capacity: number;
        gradeId?: number;
        branchId?: number;
    };
    newBranch: {
        name: string;
        code: string;
        gradeId: number;
    };
    updateBranch: {
        id: number;
        name: string;
        code: string;
        gradeId: number;
    };
}

export interface IGradeServiceResponse {
    success: boolean;
    data: IGradeData[] | IClassRoomData[] | IBranchData[] | number | null;
    message: string | null;
    error: string | null;
}

// Types pour les commandes
export interface GradeCommand {
    id?: number;
    name: string;
    code: string;
}

export interface BranchCommand {
    id?: number;
    name: string;
    code: string;
    gradeId?: number;
}

export interface ClassRoomCommand {
    id?: number;
    name: string;
    code: string;
    capacity: number;
    gradeId?: number;
    branchId?: number;
}

// Types pour les entités
export interface GradeEntity {
    id?: number;
    name: string;
    code: string;
    branches?: BranchEntity[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface BranchEntity {
    id?: number;
    name: string;
    code: string;
    grade?: GradeEntity;
    createdAt?: Date;
    updatedAt?: Date;
}

// Types pour les formulaires
export interface GradeFormData {
    name: string;
    code: string;
}

export interface BranchFormData {
    name: string;
    code: string;
    gradeId?: number;
}

// Types pour les réponses API
export interface GradeResponse {
    success: boolean;
    data: GradeEntity[] | null;
    message: string | null;
    error: string | null;
}

export interface BranchResponse {
    success: boolean;
    data: BranchEntity[] | null;
    message: string | null;
    error: string | null;
}

// Types pour les entités frontend
export interface Grade {
    id?: number;
    name?: string;
    code?: string;
    students?: any[]; // Référence aux étudiants (à définir dans student.ts)
    branches?: Branch[];
    classRooms?: ClassRoom[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface ClassRoom {
    id?: number;
    name?: string;
    code?: string;
    capacity?: number;
    grade?: Grade;
    gradeId?: number;
    branch?: Branch;
    branchId?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface Branch {
    id?: number;
    name?: string;
    code?: string;
    grade?: Grade;
    gradeId?: number;
    createdAt?: Date;
    updatedAt?: Date;
}

// Types pour les commandes
export interface ClassRoomCommand {
    id?: number;
    name: string;
    code: string;
    capacity: number;
    gradeId?: number;
    branchId?: number;
}

export interface GradeCommand {
    id?: number;
    name: string;
    code: string;
}

export interface BranchCommand {
    id?: number;
    name: string;
    code: string;
    gradeId?: number;
}

// Types pour les réponses API
export interface ApiResponse<T> {
    success: boolean;
    data: T | null;
    message: string | null;
    error: string | null;
}

export interface GradeResponse extends ApiResponse<Grade[]> {}
export interface ClassRoomResponse extends ApiResponse<ClassRoom[]> {}
export interface BranchResponse extends ApiResponse<Branch[]> {}

export interface ClassRoomEntity {
    id?: number;
    name: string;
    code: string;
    capacity: number;
    grade?: GradeEntity;
    branch?: BranchEntity;
    createdAt?: Date;
    updatedAt?: Date;
}
