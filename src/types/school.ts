import type { CountryCode, CurrencyCode } from "./shared";
import { IFileData } from "./file";     

export interface ISchoolData {
    id?: number;
    name: string;
    address: string;
    town?: string;
    country: CountryCode;
    logo?: IFileData | null;    
    logoFile?: File | null;
    phone: string;
    email: string;
    type: 'publique' | 'privée';
    foundationYear: number;
    currency?: CurrencyCode;
    settings?: ISchoolSettingsData;
}

export interface ISchoolSettingsData {
    id?: number;
    schoolCode: string;
    inspectionZone: string;
    departmentCode: string;
}

export interface ISchoolServiceParams {
    saveOrUpdateSchool: {
        name: string;
        address: string;
        town?: string;
        country: CountryCode;
        logo?: {
            content: string;
            name: string;
            type: string;
        } | null;
        phone: string;
        email: string;
        type: 'publique' | 'privée';
        foundationYear: number;
    };
    saveOrUpdateSettings: {
        schoolCode: string;
        inspectionZone: string;
        departmentCode: string;
    };
}

export interface ISchoolServiceResponse {
    success: boolean;
    data: ISchoolData | null;
    message: string;
    error: string | null;
}

export interface ISchoolSettingsServiceResponse {
    success: boolean;
    data: ISchoolSettingsData | null;
    message: string;
    error: string | null;
}
