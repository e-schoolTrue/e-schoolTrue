import { GradeConfigEntity } from "../entities/gradeConfig";

export interface IGradeConfigData {
    numberOfAssignments: number;
    assignmentWeight: number;
    examWeight: number;
}

export interface IGradeConfigServiceParams {
    saveConfiguration: {
        gradeId: number;
        numberOfAssignments: number;
        assignmentMax: number;
        examMax: number;
    };
    getConfigurationByGrade: {
        gradeId: number;
    };
}

export interface IGradeConfigServiceResponse {
    success: boolean;
    data: IGradeConfigData | null;
    message: string;
    error: string | null;
}
