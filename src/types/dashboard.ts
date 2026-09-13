export interface IDashboardStats {
    totalStudents: number;
    totalProfessors: number;
    totalClasses: number;
    recentPayments: IRecentPayment[];
    recentProfessorPayments: IProfessorRecentPayment[];
    recentAbsences: IRecentAbsence[];
}

export interface IRecentPayment {
    id: number;
    studentName: string;
    amount: number;
    date: Date;
}

export interface IProfessorRecentPayment {
    id: number;
    professorName: string;
    amount: number;
    date: Date;
}

export interface IRecentAbsence {
    id: number;
    studentName: string;
    className: string;
    date: Date;
    absenceType: string;
    justified: boolean;
    type?: string;
}

export interface IAbsenceStats {
    student: { [key: string]: number };
    professor: { [key: string]: number };
}

export interface IDashboardServiceResponse {
    success: boolean;
    data: {
        stats: IDashboardStats;
    };
    message: string;
    error: string | null;
}
