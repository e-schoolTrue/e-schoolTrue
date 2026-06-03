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

export interface AnnualDistinctions {
    tableauHonneur: boolean;
    encouragements: boolean;
    felicitations: boolean;
}

export interface AnnualDiscipline {
    avertissementTravail: boolean;
    blameTravail: boolean;
    avertissementConduite: boolean;
    blameConduite: boolean;
    exclusionTemporaire: boolean;
}

export interface AnnualStudentRecord {
    studentId: number;
    matricule: string;
    firstname: string;
    lastname: string;
    sex: 'male' | 'female';
    trim1Average: number;
    trim2Average: number;
    trim3Average: number;
    annualAverage: number;
    rank: number;
    distinctions: AnnualDistinctions;
    discipline: AnnualDiscipline;
    finalDecision: string;
    totalScores: number;
    averageScores: number;
}

export interface AnnualPVFilters {
    gradeId?: number;
    schoolYear?: string;
}

export interface AnnualGenderStats {
    effectif: number;
    presents: number;
    percentPresents: number;
    admis: number;
    percentAdmis: number;
}

export interface AnnualPVStats {
    boys: AnnualGenderStats;
    girls: AnnualGenderStats;
    total: AnnualGenderStats;
    classAverage: number;
    generalAppreciation: string;
}
