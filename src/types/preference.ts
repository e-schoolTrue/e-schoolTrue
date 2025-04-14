export interface Preference {
    id: number;
    key: string;
    value: string;
}

export interface PreferenceCreateInput {
    key: string;
    value: string;
}

export interface PreferenceUpdateInput {
    value: string;
}

export type PreferenceKey = 'reportTemplate' | string;
