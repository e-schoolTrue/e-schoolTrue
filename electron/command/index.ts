export enum CIVILITY{
    MR="MR",
    MME="MME",
    MLLE="MLLE"
}

export enum FAMILY_SITUATION{
    SINGLE="SINGLE",
    MARRIED="MARRIED",
    DIVORCED="DIVORCED",
    WIDOWED="WIDOWED"
}

export enum ROLE{
    admin="admin",
    professor="professor",
    student="student"
}

export enum SCHOOL_TYPE {
    PRIMARY = "PRIMARY",
    SECONDARY = "SECONDARY"  // Pour collège/lycée
}

export enum TEACHING_TYPE {
    CLASS_TEACHER = "CLASS_TEACHER",    // Instituteur (primaire)
    SUBJECT_TEACHER = "SUBJECT_TEACHER" // Professeur par matière (collège/lycée)
}

export interface TeachingAssignment {
    id?: number;
    professorId: number;
    classId?: number;      // Pour les instituteurs
    courseId?: number;     // Pour les profs de matière
    gradeIds?: number[];   // Classes pour les profs de matière
}

export interface ResultType {
    success: boolean;
    message: string | null;
    data: any;
    error: string | null;
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