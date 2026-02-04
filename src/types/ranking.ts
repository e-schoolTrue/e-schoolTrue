export interface StudentRanking {
    studentId: number;
    firstname: string;
    lastname: string;
    generalAverage: number;
    rank: number;
    totalScores: number;
    averageScores: number;
    scores: Array<{
        courseId: number;
        courseName: string;
        score: number;
        coefficient: number;
    }>;
}

export interface CentralizedRankingsResponse {
    success: boolean;
    data: StudentRanking[];
    message: string;
    error: string|null;
}

export interface RankingFilters {
    classId?: number;
    gradeId?: number;
    subjectId?: number;
    period?: string;
    minScore?: number;
    maxScore?: number;
}
