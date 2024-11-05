
export enum CIVILITY{
    Mr="Monsieur",
    Mrs="Madame",
    Lady="Mademoiselle"
}

export enum FILE_TYPE{
    txt="txt",
    pdf="pdf",
    xls="xls",
    png="image/png",
    jpeg="jpeg",
    ico="ico"
}

export enum FAMILY_SITUATION{
    Maried="Marié(e)",
    Divorced="Divorcé(e)",
    Single="Célibataire",
    widower="Veuf(ve)",
}

export enum ROLE{
    professor="professeur",
    student="élève",
    admin="administrateur"

}

export type ResultType = {
    success: boolean | null;
    message: string | null;
    data: any|null;
    error: any|null;
}
