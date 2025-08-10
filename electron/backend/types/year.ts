export interface PeriodConfiguration {
    name: string;
    start: string | Date;
    end: string | Date;
}

export interface YearRepartition {
    id: number;
    schoolYear: string;
    periodConfigurations: PeriodConfiguration[];
    createdAt: Date;
    updatedAt: Date;
    isCurrent: boolean;
}

export interface YearRepartitionCreateInput {
    schoolYear: string;
    periodConfigurations: PeriodConfiguration[];
}

export interface YearRepartitionUpdateInput {
    schoolYear?: string;
    periodConfigurations?: PeriodConfiguration[];
}

export interface YearRepartitionResponse {
    id: number;
    schoolYear: string;
    periodConfigurations: PeriodConfiguration[];
    isCurrent: boolean;
    createdAt: string;
    updatedAt: string;
}
