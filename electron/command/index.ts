
export enum CIVILITY{
    Mr="Monsieur",
    Mrs="Madame",
    Lady="Mademoiselle"
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

export class Mapper{
    static mapTo<S,T>(source:S , target:new()=>T):T{
        const _target:T = new target()
        Object.getOwnPropertyNames(_target).map((property:string)=>{
            (_target as any)[property]=(source as any)[property]
        })
        return _target
    }
}