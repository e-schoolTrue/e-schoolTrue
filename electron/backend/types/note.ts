import { GradingConfigEntity, CalculationStrategy } from '../entities/configNote';

// ===================================================================
// INTERFACES POUR LA CRÉATION/MISE À JOUR DE CONFIGURATION
// ===================================================================

/**
 * Paramètres pour créer une catégorie d'évaluation
 */
export interface ICategoryInput {
    id?: number; // Si mise à jour d'une catégorie existante
    name: string;
    code?: string;
    weight: number;
    defaultMaxScore: number;
    minEntries?: number;
    maxEntries?: number;
    color?: string;
    displayOrder?: number;
    isExam?: boolean; // True si c'est un examen
}

/**
 * Paramètres pour créer/mettre à jour une configuration de notation
 */
export interface ICreateConfigParams {
    schoolId: number;
    classId?: number | null;
    subjectId?: number | null;
    finalGradeBase: number;
    calculationStrategy?: CalculationStrategy;
    normalizeScores?: boolean;
    description?: string;
    categories: ICategoryInput[];
}

/**
 * Paramètres pour récupérer une configuration applicable
 */
export interface IGetConfigParams {
    schoolId: number;
    classId?: number | null;
    subjectId?: number | null;
}

// ===================================================================
// INTERFACES POUR LES RÉPONSES DE SERVICE
// ===================================================================

/**
 * Réponse standardisée du service
 */
export interface IConfigServiceResponse<T = GradingConfigEntity> {
    success: boolean;
    data: T | null;
    message: string;
    error: string | null;
}

/**
 * Configuration formatée pour le frontend
 */
export interface IFormattedConfig {
    id: number;
    schoolId: number;
    classId: number | null;
    subjectId: number | null;
    finalGradeBase: number;
    calculationStrategy: CalculationStrategy;
    normalizeScores: boolean;
    description: string | null;
    categories: IFormattedCategory[];
    createdAt: string;
    updatedAt: string;
    contextLevel: 'school' | 'class' | 'subject'; // Indique le niveau de config
}

/**
 * Catégorie formatée pour le frontend
 */
export interface IFormattedCategory {
    id: number;
    name: string;
    code: string | null;
    weight: number;
    defaultMaxScore: number;
    minEntries: number | null;
    maxEntries: number | null;
    color: string;
    displayOrder: number;
    isExam: boolean;
}

// ===================================================================
// INTERFACES POUR LE CALCUL DES NOTES
// ===================================================================

/**
 * Entrée de note pour une catégorie spécifique
 */
export interface IGradeEntry {
    categoryId: number;
    categoryCode: string;
    score: number; // Note obtenue
    maxScore: number; // Note maximale pour cette évaluation
    date?: string; // Date de l'évaluation
    comment?: string; // Commentaire optionnel
}

/**
 * Entrée pour le calcul d'une moyenne matière
 */
export interface ISubjectGradesInput {
    studentId: number;
    subjectId: number;
    period: string;
    grades: IGradeEntry[];
}

/**
 * Résultat du calcul pour une catégorie
 */
export interface ICategoryResult {
    categoryId: number;
    categoryName: string;
    categoryCode: string;
    weight: number;
    grades: {
        score: number;
        maxScore: number;
        normalizedScore: number; // Score converti sur la base finale
    }[];
    categoryAverage: number; // Moyenne de la catégorie
    weightedValue: number; // categoryAverage * weight
}

/**
 * Résultat complet du calcul de moyenne
 */
export interface ISubjectAverageResult {
    studentId: number;
    subjectId: number;
    period: string;
    configUsed: {
        id: number;
        level: 'school' | 'class' | 'subject';
        finalGradeBase: number;
        strategy: CalculationStrategy;
    };
    categoryResults: ICategoryResult[];
    finalAverage: number; // Moyenne finale sur finalGradeBase
    totalWeight: number; // Somme des coefficients
    appreciation?: string;
}

/**
 * Résultat du calcul de la moyenne générale
 */
export interface IGeneralAverageResult {
    studentId: number;
    period: string;
    subjectResults: {
        subjectId: number;
        subjectName: string;
        coefficient: number;
        average: number;
        weightedAverage: number;
    }[];
    generalAverage: number;
    totalCoefficients: number;
    rank?: number;
}

// ===================================================================
// INTERFACES POUR LA VALIDATION
// ===================================================================

/**
 * Résultat de validation d'une configuration
 */
export interface IValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Options de calcul
 */
export interface ICalculationOptions {
    roundToDecimals?: number; // Nombre de décimales (défaut: 2)
    includeEmptyCategories?: boolean; // Inclure catégories sans notes
    minGradesRequired?: number; // Minimum de notes requises
}
