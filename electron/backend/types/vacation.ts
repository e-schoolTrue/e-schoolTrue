export type VacationStatus = 'pending' | 'approved' | 'rejected';

export interface Vacation {
    id?: number;
    startDate: Date;
    endDate: Date;
    reason: string;
    status: VacationStatus;
    professorId?: number;
    studentId?: number;
    createdAt?: Date;
    comment?: string;
}

export interface VacationCreateInput {
    startDate: string;
    endDate: string;
    reason: string;
    studentId?: number;
    professorId?: number;
}

export interface VacationUpdateInput {
    status?: VacationStatus;
    comment?: string;
}
