export interface PeriodConfiguration {
    name: string;
    start: string | Date;
    end: string | Date;
}

export type YearStatus = "active" | "closed";

export type SchoolLevel = 'PRESCOLAIRE' | 'PRIMAIRE' | 'SECONDAIRE';

export interface YearRepartition {
    id: number;
    schoolYear: string;
    level?: SchoolLevel | null;
    periodConfigurations: PeriodConfiguration[];
    createdAt: Date;
    updatedAt: Date;
    isCurrent: boolean;
    status: YearStatus;
    closedAt: Date | null;
}

export interface YearRepartitionCreateInput {
    schoolYear: string;
    level?: string | null;
    periodConfigurations: PeriodConfiguration[];
}

export interface YearRepartitionUpdateInput {
    schoolYear?: string;
    level?: string | null;
    periodConfigurations?: PeriodConfiguration[];
}

export interface YearRepartitionResponse {
    id: number;
    schoolYear: string;
    periodConfigurations: PeriodConfiguration[];
    isCurrent: boolean;
    status: YearStatus;
    closedAt: string | null;
    createdAt: string;
    updatedAt: string;
}
