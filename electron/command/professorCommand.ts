import {CIVILITY, FAMILY_SITUATION} from "@electron/command/index.ts";

export class ProfessorCommand {
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
    qualifications?:QualificationCommand[]
}

export class QualificationCommand{
    id?:number
    name?:string;
    attachement_id:number
}