export interface PeriodConfiguration {
    start: string | Date;
    end: string | Date;
    name: string;
}

export interface YearRepartition {
    id?: number;
    schoolYear: string;
    periodConfigurations: PeriodConfiguration[];
    created_at?: Date;
    updated_at?: Date;
    isCurrent?: boolean;
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
    created_at: string;
    updated_at: string;
}
