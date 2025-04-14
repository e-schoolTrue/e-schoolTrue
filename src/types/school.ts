import { CountryCode, CurrencyCode } from "#electron/backend/entities/school";
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
}

export interface ISchoolServiceResponse {
    success: boolean;
    data: ISchoolData | null;
    message: string;
    error: string | null;
}
