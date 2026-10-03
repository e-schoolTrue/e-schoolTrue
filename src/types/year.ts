export interface PeriodConfiguration {
    start: string | Date;
    end: string | Date;
    name: string;
}

export type YearStatus = "active" | "closed";

/** Niveau scolaire 3-voies (`null` = année unique legacy, sans ventilation). */
export type SchoolLevel = 'PRESCOLAIRE' | 'PRIMAIRE' | 'SECONDAIRE';

export interface YearRepartition {
    id?: number;
    schoolYear: string;
    /** Niveau 3-voies. Absent/`null` = année unique legacy (non ventilée). */
    level?: SchoolLevel | null;
    periodConfigurations: PeriodConfiguration[];
    created_at?: Date;
    updated_at?: Date;
    isCurrent?: boolean;
    /** Statut du plan V3 : `active` (écriture) ou `closed` (lecture seule). Absent = `active` (compat backend). */
    status?: YearStatus;
    closedAt?: string | Date | null;
}

export interface YearRepartitionCreateInput {
    schoolYear: string;
    /** Niveau 3-voies (forward-compatible : ignoré par les backends legacy). */
    level?: SchoolLevel | null;
    periodConfigurations: PeriodConfiguration[];
}

export interface YearRepartitionUpdateInput {
    schoolYear?: string;
    /** Niveau 3-voies (forward-compatible : ignoré par les backends legacy). */
    level?: SchoolLevel | null;
    periodConfigurations?: PeriodConfiguration[];
}

export interface YearRepartitionResponse {
    id: number;
    schoolYear: string;
    /** Niveau 3-voies. Absent/`null` = année unique legacy (non ventilée). */
    level?: SchoolLevel | null;
    periodConfigurations: PeriodConfiguration[];
    isCurrent: boolean;
    status?: YearStatus;
    closedAt?: string | null;
    created_at: string;
    updated_at: string;
}

/** Payload de bascule d'année — `year:switch` validé serveur, fallback `yearRepartition:setCurrent`. */
export interface YearSwitchInput {
    yearId: number;
}

/** Options de clonage `year:clone` (créer N à partir de N-1). */
export interface YearCloneOptions {
    copyPayment: boolean;
    copyTranches: boolean;
    copyGrading: boolean;
    copyFeeItems: boolean;
}

export interface YearCloneInput extends YearCloneOptions {
    sourceId: number;
}

export interface YearClonePreview {
    paymentConfigs: number;
    tranches: number;
    gradingConfigs: number;
    feeItems: number;
}

/** Erreur métier retournée quand une écriture vise une année clôturée. */
export const YEAR_CLOSED_CODE = 'YEAR_CLOSED';
