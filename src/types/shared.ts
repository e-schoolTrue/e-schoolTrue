/**
 * Interface pour les filtres de recherche d'étudiants
 * @interface IFilterForm
 * @property {string} schoolYear - Année scolaire pour le filtrage
 * @property {string | number} classId - ID de la classe pour le filtrage
 * @property {string} studentFullName - Nom complet de l'étudiant pour le filtrage
 */
export interface IFilterForm {
  schoolYear: string;
  classId: string | number;
  studentFullName: string;
}

/**
 * Interface pour les critères de filtrage utilisés dans l'impression
 * @interface IFilterCriteria
 * @property {string} [studentFullName] - Nom complet de l'étudiant pour le filtrage
 * @property {string} [schoolGrade] - Nom de la classe pour le filtrage
 * @property {string} [schoolYear] - Année scolaire pour le filtrage
 */
export interface IFilterCriteria {
  studentFullName?: string;
  schoolGrade?: string;
  schoolYear?: string;
}

/**
 * Interface pour les grades/classes
 * @interface IGrade
 * @property {number} id - Identifiant unique du grade
 * @property {string} [name] - Nom du grade
 * @property {string} [description] - Description optionnelle du grade
 * @property {string} [code] - Code optionnel du grade
 */
export interface IGrade {
  id: number;
  name?: string;
  description?: string;
  code?: string;
}

/**
 * Interface pour les options de grade utilisées dans les sélecteurs
 * @interface IGradeOption
 * @property {number} id - Identifiant unique du grade
 * @property {string} name - Nom du grade
 * @property {number} value - Valeur utilisée dans le sélecteur
 * @property {string} label - Libellé affiché dans le sélecteur
 */
export interface IGradeOption {
  id: number;
  name: string;
  value: number;
  label: string;
}

/**
 * Interface pour les options d'année scolaire
 * @interface ISchoolYearOption
 * @property {string} value - Valeur de l'année scolaire
 * @property {string} label - Libellé affiché pour l'année scolaire
 */
export interface ISchoolYearOption {
  value: string;
  label: string;
}

// Types partagés entre le frontend et le backend
export const SCHOOL_TYPE = {
    PRIMARY: "PRIMARY" as const,
    SECONDARY: "SECONDARY" as const
} as const;

export type SchoolType = typeof SCHOOL_TYPE[keyof typeof SCHOOL_TYPE];

export const TEACHING_TYPE = {
    CLASS_TEACHER: "CLASS_TEACHER" as const,
    SUBJECT_TEACHER: "SUBJECT_TEACHER" as const
} as const;

export type TeachingType = typeof TEACHING_TYPE[keyof typeof TEACHING_TYPE];

export const CIVILITY = {
    MR: "MR" as const,
    MME: "MME" as const,
    MLLE: "MLLE" as const
} as const;

export type CivilityType = typeof CIVILITY[keyof typeof CIVILITY];

export const FAMILY_SITUATION = {
    SINGLE: "CÉLIBATAIRE" as const,
    MARRIED: "MARIÉ" as const,
    DIVORCED: "DIVORCÉ" as const,
    WIDOWED: "VEUVE" as const
} as const;

export type FamilySituationType = typeof FAMILY_SITUATION[keyof typeof FAMILY_SITUATION];

/**
 * Interface pour les étudiants
 * @interface IStudent
 * @property {number} id - Identifiant unique de l'étudiant
 * @property {string} firstname - Prénom de l'étudiant
 * @property {string} lastname - Nom de l'étudiant
 * @property {Date} [birth_date] - Date de naissance
 * @property {string} [birth_town] - Ville de naissance
 * @property {string} [address] - Adresse
 * @property {string} [registration_number] - Numéro d'inscription
 */
export interface IStudent {
    id: number;
    firstname: string;
    lastname: string;
    birth_date?: Date;
    birth_town?: string;
    address?: string;
    registration_number?: string;
}

/**
 * Interface pour les cours
 * @interface ICourse
 * @property {number} id - Identifiant unique du cours
 * @property {string} name - Nom du cours
 * @property {string} [code] - Code du cours
 * @property {string} [description] - Description du cours
 */
export interface ICourse {
    id: number;
    name: string;
    code?: string;
    description?: string;
}

/**
 * Interface pour les fichiers
 * @interface IFile
 * @property {number} [id] - Identifiant unique du fichier
 * @property {string} name - Nom du fichier
 * @property {string} type - Type MIME du fichier
 * @property {string} [content] - Contenu du fichier en base64
 * @property {string} [url] - URL du fichier
 */
export interface IFile {
    id?: number;
    name: string;
    type: string;
    content?: string;
    url?: string;
}

/**
 * Interface pour les affectations d'enseignement
 * @interface ITeachingAssignment
 * @property {number} [id] - Identifiant unique de l'affectation
 * @property {SchoolType} schoolType - Type d'école (primaire/secondaire)
 * @property {TeachingType} teachingType - Type d'enseignement
 * @property {ICourse} [course] - Cours associé (pour les professeurs de matière)
 * @property {IGrade} [class] - Classe principale (pour les professeurs principaux)
 * @property {string} [gradeIds] - IDs des classes assignées
 */
export interface ITeachingAssignment {
    id?: number;
    schoolType: SchoolType;
    teachingType: TeachingType;
    course?: ICourse;
    class?: IGrade;
    gradeIds?: string | number[];
    professorId?: number;
}

/**
 * Type pour les codes pays
 * Liste des codes pays selon la norme ISO 3166-1 alpha-2
 */
export type CountryCode = 
    | 'CM' // Cameroun
    | 'FR' // France
    | 'BE' // Belgique
    | 'CH' // Suisse
    | 'CA' // Canada
    | 'CI' // Côte d'Ivoire
    | 'SN' // Sénégal
    | 'BF' // Burkina Faso
    | 'ML' // Mali
    | 'NE' // Niger
    | 'TG' // Togo
    | 'BJ' // Bénin
    | 'GA' // Gabon
    | 'CD' // République démocratique du Congo
    | 'CG' // République du Congo
    | 'MG' // Madagascar
    | 'BI' // Burundi
    | 'RW' // Rwanda
    | 'DJ' // Djibouti
    | 'KM' // Comores
    | 'MU' // Maurice
    | 'SC' // Seychelles
    | 'TD' // Tchad
    | 'CF' // République centrafricaine;

/**
 * Type pour les codes de devise
 * Liste des codes de devise selon la norme ISO 4217
 */
export type CurrencyCode = 
    | 'XAF' // Franc CFA BEAC
    | 'EUR' // Euro
    | 'XOF' // Franc CFA BCEAO
    | 'USD' // Dollar américain
    | 'CAD' // Dollar canadien
    | 'CHF' // Franc suisse
    | 'GBP' // Livre sterling
    | 'MGA' // Ariary malgache
    | 'BIF' // Franc burundais
    | 'RWF' // Franc rwandais
    | 'DJF' // Franc djiboutien
    | 'KMF' // Franc comorien
    | 'MUR' // Roupie mauricienne
    | 'SCR'; // Roupie seychelloise

/**
 * Type pour le genre
 */
export type Gender = 'male' | 'female';

/**
 * Interface pour les paiements
 * @interface IPayment
 */
export interface IPayment {
    id?: number;
    amount: number;
    date: Date;
    type: string;
    description?: string;
    status: 'pending' | 'completed' | 'cancelled';
    studentId?: number;
    currency: CurrencyCode;
}

/**
 * Interface pour les absences
 * @interface IAbsence
 */
export interface IAbsence {
    id?: number;
    date: Date;
    reason?: string;
    justified: boolean;
    studentId?: number;
    courseId?: number;
    professorId?: number;
}

/**
 * Interface pour les bourses
 * @interface IScholarship
 */
export interface IScholarship {
    id?: number;
    type: string;
    amount: number;
    startDate: Date;
    endDate?: Date;
    status: 'active' | 'inactive' | 'pending';
    studentId?: number;
    currency: CurrencyCode;
} 