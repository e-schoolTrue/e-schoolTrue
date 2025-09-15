import { CourseEntity } from "../entities/course";

export interface ICourseData {
    id?: number;
    code?: string;
    name?: string;
    coefficient?: number;
    isInGroupement?: boolean;
    groupement?: CourseEntity;
    grade?: {
        id?: number;
        name?: string;
        code?: string;
    };
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
        gradeId?: number;
    };
    addCourseToGroupement: {
        name: string;
        coefficient: number;
        code: string;
        groupementId?: number;
        gradeId?: number;
    };
    updateCourse: {
        id: number;
        data: {
            name: string;
            coefficient: number;
            code: string;
            gradeId?: number;
        };
    };
}

export interface ICourseServiceResponse {
    success: boolean;
    data: ICourseData[] | null;
    error: string | null;
    message: string;
}
