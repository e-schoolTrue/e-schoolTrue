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