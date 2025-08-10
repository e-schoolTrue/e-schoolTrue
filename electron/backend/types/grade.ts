
export interface IGradeData {
    id?: number;
    name: string;  // Required
    code: string;  // Required
    students?: any[];
    branches?: IBranchData[];
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IClassRoomData {
    id?: number;
    name?: string;
    code?: string;
    capacity?: number;
    grade?: IGradeData;
    branch?: IBranchData;
    createdAt?: Date;
    updatedAt?: Date;
}

export interface IBranchData {
    id?: number;
    name?: string;
    code?: string;
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
    message: string;
    error: any | null;
}
