import {CIVILITY, FAMILY_SITUATION} from "@electron/command";
import {QualificationCommand} from "@electron/command/professorCommand.ts";


export class ProfessorResponse{
    id?: number;
    firstname?: string;
    lastname?: string;
    phone_number?: string;
    civility?: CIVILITY;
    family_situation?: FAMILY_SITUATION;
    birth_date?: Date;
    birth_country:string;
    birth_town?: string;
    address?: string;
    town?: string;
    cni_number?: string;
    qualifications?:QualificationResponse[]
}

export class QualificationResponse{
    id?:number
    name?:string;
    attachement:string
}