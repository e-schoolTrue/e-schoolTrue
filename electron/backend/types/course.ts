import { CourseEntity } from "../entities/course";

export interface ICourseData {
    id?: number;
    code?: string;
    name?: string;
    coefficient?: number;
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
