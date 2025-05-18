import { ResponseType } from "./index";
import type { CivilityType, FamilySituationType, SchoolType, ITeachingAssignment } from "./shared";

// Types pour les données du professeur
export interface IProfessorData {
    id?: number;
    firstname: string;
    lastname: string;
    civility: CivilityType;
    nbr_child?: number;
    family_situation: FamilySituationType;
    birth_date?: Date;
    birth_town: string;
    address: string;
    town: string;
    cni_number: string;
}

// Types pour les fichiers du professeur
export interface IProfessorFile {
    id?: number;
    name: string;
    type: string;
    content?: string;
    url?: string;
}

// Types pour les détails complets du professeur
export interface IProfessorDetails extends IProfessorData {
    photo?: IProfessorFile;
    documents?: IProfessorFile[];
    diploma?: {
        id: number;
        name: string;
    };
    qualification?: {
        id: number;
        name: string;
    };
    teaching?: ITeachingAssignment[];
}

// Types pour les paramètres des méthodes du service
export interface IProfessorServiceParams {
    createProfessor: {
        firstname: string;
        lastname: string;
        civility: CivilityType;
        nbr_child?: number;
        family_situation: FamilySituationType;
        birth_date?: Date;
        birth_town: string;
        address: string;
        town: string;
        cni_number: string;
        diploma?: string;
        qualification?: string;
        photo?: IProfessorFile;
        documents?: IProfessorFile[];
        teaching?: {
            schoolType: SchoolType;
            classId?: number;
            courseId?: number;
            gradeIds?: number[];
        };
    };
    updateProfessor: {
        id: number;
        data: Partial<IProfessorData> & {
            photo?: IProfessorFile;
            documents?: IProfessorFile[];
            diploma?: { name: string };
            qualification?: { name: string };
            teaching?: {
                teachingType?: string;
                schoolType?: SchoolType | null;
                classId?: number;
                courseId?: number | null;
                gradeIds?: string | number[];
            };
        };
    };
    getProfessorDetails: {
        professorId: number;
    };
    deleteProfessor: {
        professorId: number;
    };
    searchProfessors: {
        query: string;
    };
}

// Types pour les réponses du service
export interface IProfessorServiceResponse extends ResponseType {
    data: IProfessorDetails | IProfessorDetails[] | null;
}

// Types pour les statistiques des professeurs
export interface IProfessorStatistics {
    total: number;
    bySchoolType: {
        primary: number;
        secondary: number;
    };
    byTeachingType: {
        classTeacher: number;
        subjectTeacher: number;
    };
}

export interface ROLE{
    admin: "admin",
    professor: "professor",
    student: "student"
}
