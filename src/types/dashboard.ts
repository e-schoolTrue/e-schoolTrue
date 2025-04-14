export interface IDashboardStats {
    totalStudents: number;
    totalProfessors: number;
    totalClasses: number;
    recentPayments: IRecentPayment[];
    recentAbsences: { [key: string]: number };
}

export interface IRecentPayment {
    id: number;
    studentName: string;
    amount: number;
    date: Date;
}

export interface IDashboardServiceResponse {
    success: boolean;
    data: {
        stats: IDashboardStats;
    };
    message: string;
    error: string | null;
}
