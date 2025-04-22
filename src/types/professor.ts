import { TeachingAssignmentEntity } from "#electron/backend/entities/teaching";
import { ResponseType } from "./index";

// Types pour les données du professeur
export interface IProfessorData {
    id?: number;
    firstname: string;
    lastname: string;
    civility: string;
    nbr_child?: number;
    family_situation: string;
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
    teaching?: TeachingAssignmentEntity[];
}

// Types pour les paramètres des méthodes du service
export interface IProfessorServiceParams {
    createProfessor: {
        firstname: string;
        lastname: string;
        civility: string;
        nbr_child?: number;
        family_situation: string;
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
            schoolType: 'PRIMARY' | 'SECONDARY';
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
