export interface Scholarship {
    id: number;
    studentId: number;
    percentage: number;
    isActive: boolean;
    schoolYear: string;
    reason?: string;
    createdAt: Date;
    configId?: number;
}

export interface ScholarshipCreateInput {
    studentId: number;
    percentage: number;
    reason?: string;
    configId?: number;
}

export interface ScholarshipUpdateInput {
    percentage?: number;
    isActive?: boolean;
    reason?: string;
    configId?: number;
}
