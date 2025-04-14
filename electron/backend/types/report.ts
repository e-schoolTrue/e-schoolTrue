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
