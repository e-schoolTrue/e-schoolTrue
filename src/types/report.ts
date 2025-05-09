export interface ReportCard {
    id: number;
    studentId: number;
    courseId: number;
    period: string;
    assignmentGrades: number[];
    examGrade: number | null;
    finalGrade: number | null;
    appreciation: string | null;
    createdAt: Date;
}

export interface GradeData {
    courseId: number;
    courseName: string;
    coefficient: number;
    assignments: number[];
    exam: number;
    average: number;
    appreciation: string;
}

export interface ReportCardData {
    grades: GradeData[];
    generalAverage: number;
}

export interface GenerateReportCardsInput {
    studentIds: number[];
    period: string;
    templateId: string;
}

export interface GenerateReportCardInput {
    studentId: number;
    period: string;
}

export interface SaveStudentGradesInput {
    studentId: number;
    gradeId: number;
    period: string;
    grades: Array<{
        courseId: number;
        assignments: number[];
        exam: number;
        average: number;
        appreciation: string;
    }>;
}

export interface SchoolInfo {
    name: string;
    type: string;
    address: string;
    town: string;
    phone: string;
    email: string;
    country: 'MAR' | 'SEN' | 'CAF' | 'GIN';
    logo?: {
        url: string;
    };
}

export interface ReportCardTemplate {
    id: string;
    name: string;
    description: string;
    component: any; // This will be a Vue component type
}
