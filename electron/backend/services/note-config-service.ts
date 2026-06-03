import { Repository, IsNull } from "typeorm";
import { AppDataSource } from "../../data-source";
import { GradingConfigEntity, EvaluationCategoryEntity, CalculationStrategy } from "../entities/configNote";
import { 
    ICreateConfigParams, 
    IConfigServiceResponse,
    IGetConfigParams,
    IFormattedConfig,
    IFormattedCategory,
    IValidationResult,
    IGradeEntry,
    ISubjectAverageResult,
    ICategoryResult,
    ICalculationOptions
} from "../types/note";

/**
 * Service de gestion des configurations de notation
 * Gère la hiérarchie: École > Classe > Matière
 */
export class ConfigNoteService {
    private configRepository: Repository<GradingConfigEntity>;
    private categoryRepository: Repository<EvaluationCategoryEntity>;

    constructor() {
        const dataSource = AppDataSource.getInstance();
        this.configRepository = dataSource.getRepository(GradingConfigEntity);
        this.categoryRepository = dataSource.getRepository(EvaluationCategoryEntity);
    }

    // ===================================================================
    // MÉTHODES DE GESTION DE CONFIGURATION
    // ===================================================================

    /**
     * Valide les paramètres de configuration
     */
    validateConfig(params: ICreateConfigParams): IValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validation de base
        if (!params.schoolId || params.schoolId <= 0) {
            errors.push("L'identifiant de l'école est requis");
        }

        if (!params.finalGradeBase || params.finalGradeBase < 1) {
            errors.push("La base de notation doit être supérieure à 0");
        }

        if (!params.categories || params.categories.length === 0) {
            errors.push("Au moins une catégorie d'évaluation est requise");
        }

        // Validation des catégories
        params.categories?.forEach((cat, index) => {
            if (!cat.name || cat.name.trim() === '') {
                errors.push(`Catégorie ${index + 1}: Le nom est requis`);
            }
            if (cat.weight < 0) {
                errors.push(`Catégorie "${cat.name}": Le coefficient doit être positif`);
            }
            if (cat.defaultMaxScore < 1) {
                errors.push(`Catégorie "${cat.name}": La base de notation doit être supérieure à 0`);
            }
        });

        // Avertissements
        const totalWeight = params.categories?.reduce((sum, cat) => sum + cat.weight, 0) || 0;
        if (totalWeight === 0) {
            warnings.push("La somme des coefficients est nulle, toutes les catégories seront ignorées");
        }

        // Vérifier les codes en double
        const codes = params.categories?.map(c => c.code?.toUpperCase()).filter(Boolean);
        const uniqueCodes = new Set(codes);
        if (codes && codes.length !== uniqueCodes.size) {
            warnings.push("Certains codes de catégories sont en double");
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings
        };
    }

    /**
     * Sauvegarde ou met à jour une configuration de notation
     */
    async saveConfig(params: ICreateConfigParams): Promise<IConfigServiceResponse> {
        try {
            // Validation
            const validation = this.validateConfig(params);
            if (!validation.isValid) {
                return {
                    success: false,
                    data: null,
                    message: validation.errors.join("; "),
                    error: "VALIDATION_ERROR"
                };
            }

            const dataSource = AppDataSource.getInstance();

            const result = await dataSource.transaction(async (manager) => {
                // Chercher config existante pour ce contexte précis (incluant la période)
                let existingConfig = await manager.findOne(GradingConfigEntity, {
                    where: {
                        schoolId: params.schoolId,
                        classId: params.classId ?? IsNull(),
                        subjectId: params.subjectId ?? IsNull(),
                        period: params.period ?? IsNull()
                    },
                    relations: ["categories"]
                });

                // Si elle n'existe pas, créer une nouvelle
                if (!existingConfig) {
                    existingConfig = new GradingConfigEntity();
                    existingConfig.schoolId = params.schoolId;
                    existingConfig.classId = params.classId ?? null;
                    existingConfig.subjectId = params.subjectId ?? null;
                    existingConfig.period = params.period ?? null;
                }

                // Mise à jour des champs
                existingConfig.finalGradeBase = params.finalGradeBase;
                existingConfig.calculationStrategy = params.calculationStrategy || CalculationStrategy.WEIGHTED;
                existingConfig.normalizeScores = params.normalizeScores ?? true;
                existingConfig.description = params.description ?? null;

                // Supprimer les anciennes catégories si la config existe
                if (existingConfig.id) {
                    await manager.delete(EvaluationCategoryEntity, { config: { id: existingConfig.id } });
                }

                // Créer les nouvelles catégories
                console.log('💾 Sauvegarde catégories - isExam values:', params.categories.map(c => ({ name: c.name, isExam: c.isExam })));
                const newCategories = params.categories.map((catDto, index) => {
                    const cat = new EvaluationCategoryEntity();
                    cat.name = catDto.name.trim();
                    cat.code = catDto.code?.toUpperCase() || catDto.name.substring(0, 3).toUpperCase();
                    cat.weight = catDto.weight;
                    cat.defaultMaxScore = catDto.defaultMaxScore;
                    cat.minEntries = catDto.minEntries ?? null;
                    cat.maxEntries = catDto.maxEntries ?? null;
                    cat.color = catDto.color || this.getDefaultColor(index);
                    cat.displayOrder = catDto.displayOrder ?? index;
                    cat.isExam = catDto.isExam ?? false;
                    console.log(`💾 Catégorie ${cat.name}: isExam = ${cat.isExam}`);
                    return cat;
                });

                existingConfig.categories = newCategories;

                return await manager.save(existingConfig);
            });

            return {
                success: true,
                data: result,
                message: "Configuration de notation enregistrée avec succès",
                error: null
            };

        } catch (error) {
            console.error("Erreur dans saveConfig:", error);
            return {
                success: false,
                data: null,
                message: "Impossible de sauvegarder la configuration",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /**
     * Récupère la configuration applicable selon la hiérarchie (Cascade)
     * Priorité: Matière+Classe > Classe > École
     * Pour chaque niveau: d'abord avec période spécifique, puis sans période
     */
    async getApplicableConfig(params: IGetConfigParams): Promise<IConfigServiceResponse<IFormattedConfig>> {
        try {
            let config: GradingConfigEntity | null = null;
            let contextLevel: 'school' | 'class' | 'subject' = 'school';

            // Helper: cherche config avec period en priorité, fallback sans period
            const findConfig = async (where: any): Promise<GradingConfigEntity | null> => {
                // Essayer avec la période spécifique d'abord
                if (params.period) {
                    const withPeriod = await this.configRepository.findOne({
                        where: { ...where, period: params.period },
                        relations: ["categories"]
                    });
                    if (withPeriod) return withPeriod;
                }
                // Fallback: config sans période (compatible avec anciennes configs)
                return await this.configRepository.findOne({
                    where: { ...where, period: IsNull() },
                    relations: ["categories"]
                });
            };

            // A. Priorité 1: Config spécifique Matière + Classe
            if (params.subjectId && params.classId) {
                config = await findConfig({
                    schoolId: params.schoolId,
                    classId: params.classId,
                    subjectId: params.subjectId
                });
                if (config) {
                    contextLevel = 'subject';
                }
            }

            // B. Priorité 2: Config de la Classe (toutes matières)
            if (!config && params.classId) {
                config = await findConfig({
                    schoolId: params.schoolId,
                    classId: params.classId,
                    subjectId: IsNull()
                });
                if (config) {
                    contextLevel = 'class';
                }
            }

            // C. Priorité 3: Config de l'École par défaut
            if (!config) {
                config = await findConfig({
                    schoolId: params.schoolId,
                    classId: IsNull(),
                    subjectId: IsNull()
                });
                if (config) {
                    contextLevel = 'school';
                }
            }

            if (!config) {
                return {
                    success: false,
                    data: null,
                    message: "Aucune configuration de notation trouvée",
                    error: "NO_CONFIG_FOUND"
                };
            }

            // Formater la réponse
            const formattedConfig = this.formatConfig(config, contextLevel);

            return {
                success: true,
                data: formattedConfig,
                message: `Configuration ${contextLevel === 'school' ? "par défaut de l'école" : contextLevel === 'class' ? "de classe" : "spécifique matière"} trouvée`,
                error: null
            };

        } catch (error) {
            console.error("Erreur dans getApplicableConfig:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération de la configuration",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /**
     * Récupère EXACTEMENT la configuration pour un contexte (sans cascade)
     * Utile pour l'édition
     */
    async getExactConfig(params: IGetConfigParams): Promise<IConfigServiceResponse<IFormattedConfig>> {
        try {
            const config = await this.configRepository.findOne({
                where: {
                    schoolId: params.schoolId,
                    classId: params.classId ?? IsNull(),
                    subjectId: params.subjectId ?? IsNull(),
                    period: params.period ?? IsNull()
                },
                relations: ["categories"]
            });

            if (!config) {
                return {
                    success: false,
                    data: null,
                    message: "Aucune configuration trouvée pour ce contexte précis",
                    error: "NO_CONFIG_FOUND"
                };
            }

            const contextLevel = params.subjectId ? 'subject' : params.classId ? 'class' : 'school';
            const formattedConfig = this.formatConfig(config, contextLevel);

            return {
                success: true,
                data: formattedConfig,
                message: "Configuration récupérée avec succès",
                error: null
            };

        } catch (error) {
            console.error("Erreur dans getExactConfig:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération de la configuration",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /**
     * Liste toutes les configurations d'une école
     */
    async getAllConfigsForSchool(schoolId: number): Promise<IConfigServiceResponse<IFormattedConfig[]>> {
        try {
            const configs = await this.configRepository.find({
                where: { schoolId },
                relations: ["categories"],
                order: { createdAt: "DESC" }
            });

            const formattedConfigs = configs.map(config => {
                const contextLevel = config.subjectId ? 'subject' : config.classId ? 'class' : 'school';
                return this.formatConfig(config, contextLevel);
            });

            return {
                success: true,
                data: formattedConfigs,
                message: `${formattedConfigs.length} configuration(s) trouvée(s)`,
                error: null
            };

        } catch (error) {
            console.error("Erreur dans getAllConfigsForSchool:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des configurations",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /**
     * Supprime une configuration
     */
    async deleteConfig(configId: number): Promise<IConfigServiceResponse<null>> {
        try {
            const config = await this.configRepository.findOne({ where: { id: configId } });
            
            if (!config) {
                return {
                    success: false,
                    data: null,
                    message: "Configuration non trouvée",
                    error: "NOT_FOUND"
                };
            }

            // Empêcher la suppression de la config école par défaut si c'est la seule
            if (!config.classId && !config.subjectId) {
                const otherConfigs = await this.configRepository.count({
                    where: { schoolId: config.schoolId }
                });
                if (otherConfigs === 1) {
                    return {
                        success: false,
                        data: null,
                        message: "Impossible de supprimer la configuration par défaut de l'école",
                        error: "CANNOT_DELETE_DEFAULT"
                    };
                }
            }

            await this.configRepository.remove(config);

            return {
                success: true,
                data: null,
                message: "Configuration supprimée avec succès",
                error: null
            };

        } catch (error) {
            console.error("Erreur dans deleteConfig:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la suppression de la configuration",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    // ===================================================================
    // MÉTHODES DE CALCUL DES NOTES
    // ===================================================================

    /**
     * Calcule la moyenne d'une matière pour un élève selon la configuration applicable
     */
    async calculateSubjectAverage(
        studentId: number,
        subjectId: number,
        classId: number,
        schoolId: number,
        period: string,
        grades: IGradeEntry[],
        options: ICalculationOptions = {}
    ): Promise<IConfigServiceResponse<ISubjectAverageResult>> {
        try {
            // Récupérer la configuration applicable
            const configResult = await this.getApplicableConfig({ schoolId, classId, subjectId });
            
            if (!configResult.success || !configResult.data) {
                return {
                    success: false,
                    data: null,
                    message: "Aucune configuration de notation trouvée",
                    error: "NO_CONFIG"
                };
            }

            const config = configResult.data;
            const roundTo = options.roundToDecimals ?? 2;

            // Grouper les notes par catégorie
            const gradesByCategory = new Map<number, IGradeEntry[]>();
            
            for (const grade of grades) {
                const existing = gradesByCategory.get(grade.categoryId) || [];
                existing.push(grade);
                gradesByCategory.set(grade.categoryId, existing);
            }

            // Calculer la moyenne pour chaque catégorie
            const categoryResults: ICategoryResult[] = [];
            let totalWeightedValue = 0;
            let totalWeight = 0;

            for (const category of config.categories) {
                const categoryGrades = gradesByCategory.get(category.id) || [];
                
                // Ignorer les catégories vides si l'option est désactivée
                if (categoryGrades.length === 0 && !options.includeEmptyCategories) {
                    continue;
                }

                // Normaliser et calculer la moyenne de la catégorie
                const normalizedGrades = categoryGrades.map(g => {
                    // Convertir sur la base finale si normalisation activée
                    const normalizedScore = config.normalizeScores
                        ? (g.score / g.maxScore) * config.finalGradeBase
                        : g.score;
                    
                    return {
                        score: g.score,
                        maxScore: g.maxScore,
                        normalizedScore: this.round(normalizedScore, roundTo)
                    };
                });

                const categoryAverage = normalizedGrades.length > 0
                    ? normalizedGrades.reduce((sum, g) => sum + g.normalizedScore, 0) / normalizedGrades.length
                    : 0;

                const weightedValue = categoryAverage * category.weight;

                categoryResults.push({
                    categoryId: category.id,
                    categoryName: category.name,
                    categoryCode: category.code || '',
                    weight: category.weight,
                    grades: normalizedGrades,
                    categoryAverage: this.round(categoryAverage, roundTo),
                    weightedValue: this.round(weightedValue, roundTo)
                });

                totalWeightedValue += weightedValue;
                totalWeight += category.weight;
            }

            // Calculer la moyenne finale
            let finalAverage: number;
            
            if (config.calculationStrategy === CalculationStrategy.SIMPLE) {
                // Moyenne simple: toutes les notes se valent
                const allNormalizedScores = categoryResults.flatMap(cr => cr.grades.map(g => g.normalizedScore));
                finalAverage = allNormalizedScores.length > 0
                    ? allNormalizedScores.reduce((a, b) => a + b, 0) / allNormalizedScores.length
                    : 0;
            } else {
                // Moyenne pondérée
                finalAverage = totalWeight > 0 ? totalWeightedValue / totalWeight : 0;
            }

            return {
                success: true,
                data: {
                    studentId,
                    subjectId,
                    period,
                    configUsed: {
                        id: config.id,
                        level: config.contextLevel,
                        finalGradeBase: config.finalGradeBase,
                        strategy: config.calculationStrategy
                    },
                    categoryResults,
                    finalAverage: this.round(finalAverage, roundTo),
                    totalWeight: this.round(totalWeight, roundTo)
                },
                message: "Moyenne calculée avec succès",
                error: null
            };

        } catch (error) {
            console.error("Erreur dans calculateSubjectAverage:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors du calcul de la moyenne",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    // ===================================================================
    // MÉTHODES UTILITAIRES PRIVÉES
    // ===================================================================

    /**
     * Formate une configuration pour le frontend
     */
    private formatConfig(config: GradingConfigEntity, contextLevel: 'school' | 'class' | 'subject'): IFormattedConfig {
        const sortedCategories = [...config.categories].sort((a, b) => a.displayOrder - b.displayOrder);
        
        return {
            id: config.id,
            schoolId: config.schoolId,
            classId: config.classId,
            subjectId: config.subjectId,
            period: config.period,
            finalGradeBase: config.finalGradeBase,
            calculationStrategy: config.calculationStrategy,
            normalizeScores: config.normalizeScores,
            description: config.description,
            categories: sortedCategories.map(cat => this.formatCategory(cat)),
            createdAt: config.createdAt.toISOString(),
            updatedAt: config.updatedAt.toISOString(),
            contextLevel
        };
    }

    /**
     * Formate une catégorie pour le frontend
     */
    private formatCategory(category: EvaluationCategoryEntity): IFormattedCategory {
        return {
            id: category.id,
            name: category.name,
            code: category.code,
            weight: category.weight,
            defaultMaxScore: category.defaultMaxScore,
            minEntries: category.minEntries,
            maxEntries: category.maxEntries,
            color: category.color,
            displayOrder: category.displayOrder,
            isExam: category.isExam
        };
    }

    /**
     * Retourne une couleur par défaut selon l'index
     */
    private getDefaultColor(index: number): string {
        const colors = [
            '#3498db', // Bleu
            '#e74c3c', // Rouge
            '#2ecc71', // Vert
            '#f39c12', // Orange
            '#9b59b6', // Violet
            '#1abc9c', // Turquoise
            '#34495e', // Gris foncé
            '#e67e22', // Orange foncé
        ];
        return colors[index % colors.length];
    }

    /**
     * Arrondit un nombre à n décimales
     */
    private round(value: number, decimals: number): number {
        return Math.round(value * Math.pow(10, decimals)) / Math.pow(10, decimals);
    }
}
