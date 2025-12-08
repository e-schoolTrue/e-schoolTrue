import { Repository, In } from "typeorm";
import { AppDataSource } from "../../data-source";
import { GradeEntryEntity, CalculatedGradeEntity } from "../entities/gradeEntry";
import { ConfigNoteService } from "./note-config-service";

interface ResultType<T> {
    success: boolean;
    data: T | null;
    message: string;
    error: string | null;
}

interface SaveGradeEntryInput {
    studentId: number;
    courseId: number;
    categoryId: number;
    period: string;
    score: number;
    maxScore: number;
    label?: string;
    evaluationDate?: string;
    comment?: string;
}

interface GetGradesInput {
    studentId: number;
    courseId: number;
    period: string;
}

interface BulkSaveGradesInput {
    studentId: number;
    courseId: number;
    period: string;
    grades: Array<{
        categoryId: number;
        score: number;
        maxScore: number;
        label?: string;
    }>;
}

export class GradeEntryService {
    private gradeEntryRepository: Repository<GradeEntryEntity>;
    private calculatedGradeRepository: Repository<CalculatedGradeEntity>;
    private configNoteService: ConfigNoteService;

    constructor() {
        const dataSource = AppDataSource.getInstance();
        this.gradeEntryRepository = dataSource.getRepository(GradeEntryEntity);
        this.calculatedGradeRepository = dataSource.getRepository(CalculatedGradeEntity);
        this.configNoteService = new ConfigNoteService();
    }

    /**
     * Sauvegarde une note individuelle
     */
    async saveGradeEntry(input: SaveGradeEntryInput): Promise<ResultType<GradeEntryEntity>> {
        try {
            const entry = new GradeEntryEntity();
            entry.studentId = input.studentId;
            entry.courseId = input.courseId;
            entry.categoryId = input.categoryId;
            entry.period = input.period;
            entry.score = input.score;
            entry.maxScore = input.maxScore;
            entry.label = input.label || null;
            entry.evaluationDate = input.evaluationDate ? new Date(input.evaluationDate) : null;
            entry.comment = input.comment || null;

            const saved = await this.gradeEntryRepository.save(entry);

            // Invalider le cache
            await this.invalidateCalculatedGrade(input.studentId, input.courseId, input.period);

            return {
                success: true,
                data: saved,
                message: "Note enregistrée avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur saveGradeEntry:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la sauvegarde",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /**
     * Sauvegarde multiple de notes
     */
    async bulkSaveGrades(input: BulkSaveGradesInput): Promise<ResultType<GradeEntryEntity[]>> {
        const dataSource = AppDataSource.getInstance();
        
        try {
            console.log('\n=== BULK SAVE GRADES ===');
            console.log('Input:', JSON.stringify(input, null, 2));
            
            const result = await dataSource.transaction(async (manager) => {
                // Supprimer les notes existantes pour cette période
                const deleteResult = await manager.delete(GradeEntryEntity, {
                    studentId: input.studentId,
                    courseId: input.courseId,
                    period: input.period
                });
                console.log(`Notes supprimées: ${deleteResult.affected || 0}`);

                // Créer les nouvelles notes
                const entries = input.grades.map(g => {
                    const entry = new GradeEntryEntity();
                    entry.studentId = input.studentId;
                    entry.courseId = input.courseId;
                    entry.categoryId = g.categoryId;
                    entry.period = input.period;
                    entry.score = g.score;
                    entry.maxScore = g.maxScore;
                    entry.label = g.label || null;
                    entry.evaluationDate = null;
                    entry.comment = null;
                    console.log('Création note:', {
                        studentId: entry.studentId,
                        courseId: entry.courseId,
                        categoryId: entry.categoryId,
                        score: entry.score,
                        maxScore: entry.maxScore,
                        period: entry.period
                    });
                    return entry;
                });

                const saved = await manager.save(entries);
                console.log(`Notes sauvegardées: ${saved.length}`);
                return saved;
            });

            // Invalider le cache
            await this.invalidateCalculatedGrade(input.studentId, input.courseId, input.period);
            console.log('Cache invalidé');
            console.log('=== FIN BULK SAVE ===\n');

            return {
                success: true,
                data: result,
                message: "Notes enregistrées avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur bulkSaveGrades:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la sauvegarde",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /**
     * Récupère toutes les notes d'un élève pour une matière et une période
     */
    async getGradeEntries(input: GetGradesInput): Promise<ResultType<GradeEntryEntity[]>> {
        try {
            console.log('\n=== GET GRADE ENTRIES ===');
            console.log('Recherche notes pour:', input);
            
            const entries = await this.gradeEntryRepository.find({
                where: {
                    studentId: input.studentId,
                    courseId: input.courseId,
                    period: input.period
                },
                order: {
                    categoryId: "ASC",
                    createdAt: "ASC"
                }
            });

            console.log(`Trouvé ${entries.length} notes:`, entries.map(e => ({
                id: e.id,
                categoryId: e.categoryId,
                score: e.score,
                maxScore: e.maxScore
            })));
            console.log('=== FIN GET ENTRIES ===\n');

            return {
                success: true,
                data: entries,
                message: "Notes récupérées",
                error: null
            };
        } catch (error) {
            console.error("Erreur getGradeEntries:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /**
     * Calcule et met en cache la moyenne pour une matière
     */
    async calculateAndCacheGrade(
        studentId: number,
        courseId: number,
        classId: number,
        schoolId: number,
        period: string
    ): Promise<ResultType<CalculatedGradeEntity>> {
        try {
            console.log(`\n=== CALCUL MOYENNE ===`);
            console.log(`Élève: ${studentId}, Matière: ${courseId}, Période: ${period}`);
            
            // Récupérer toutes les notes
            const entriesResult = await this.getGradeEntries({ studentId, courseId, period });
            console.log(`Nombre de notes récupérées: ${entriesResult.data?.length || 0}`);
            console.log(`Notes:`, entriesResult.data);
            
            if (!entriesResult.success || !entriesResult.data) {
                throw new Error("Impossible de récupérer les notes");
            }

            const entries = entriesResult.data;

            // Récupérer la configuration applicable
            const configResult = await this.configNoteService.getApplicableConfig({
                schoolId,
                classId
            });

            if (!configResult.success || !configResult.data) {
                throw new Error("Aucune configuration de notation trouvée");
            }

            const config = configResult.data;

            // Grouper les notes par catégorie
            const gradesByCategory = new Map<number, Array<{ score: number; maxScore: number }>>();
            
            for (const entry of entries) {
                const existing = gradesByCategory.get(entry.categoryId) || [];
                existing.push({ score: entry.score, maxScore: entry.maxScore });
                gradesByCategory.set(entry.categoryId, existing);
            }

            // Séparer les catégories: notes de classe vs examens
            const classCategories: any[] = [];
            const examCategories: any[] = [];
            
            for (const category of config.categories) {
                if (category.isExam) {
                    examCategories.push(category);
                } else {
                    classCategories.push(category);
                }
            }

            console.log(`Séparation: ${classCategories.length} notes de classe, ${examCategories.length} examens`);

            // Calculer la moyenne de chaque catégorie et stocker les détails
            const categoryBreakdown: any = {};
            let totalWeightedValue = 0;
            let totalWeight = 0;

            // 1. Traiter les notes de classe (groupées)
            // Les notes de classe sont moyennées et comptent pour 1 coefficient total
            if (classCategories.length > 0) {
                const allClassNormalizedScores: number[] = [];
                
                for (const category of classCategories) {
                    const categoryGrades = gradesByCategory.get(category.id) || [];
                    
                    if (categoryGrades.length === 0) {
                        categoryBreakdown[category.id] = {
                            categoryName: category.name,
                            categoryCode: category.code,
                            average: 0,
                            weight: category.weight,
                            gradesCount: 0,
                            isExam: false
                        };
                        console.log(`Note de classe "${category.name}": Aucune note - ignorée`);
                        continue;
                    }

                    // Normaliser les notes
                    const normalizedScores = categoryGrades.map(g => {
                        if (config.normalizeScores) {
                            return (g.score / g.maxScore) * config.finalGradeBase;
                        }
                        return g.score;
                    });

                    const categoryAverage = normalizedScores.reduce((a, b) => a + b, 0) / normalizedScores.length;
                    
                    console.log(`Note de classe "${category.name}" (coef ${category.weight}):`, {
                        notes: categoryGrades,
                        notesNormalisees: normalizedScores,
                        moyenneCategorie: categoryAverage
                    });

                    categoryBreakdown[category.id] = {
                        categoryName: category.name,
                        categoryCode: category.code,
                        average: Math.round(categoryAverage * 100) / 100,
                        weight: category.weight,
                        gradesCount: categoryGrades.length,
                        grades: categoryGrades,
                        isExam: false
                    };

                    // Ajouter la moyenne de cette catégorie aux notes de classe
                    allClassNormalizedScores.push(categoryAverage);
                }

                // Calculer la moyenne globale des notes de classe
                if (allClassNormalizedScores.length > 0) {
                    const classGlobalAverage = allClassNormalizedScores.reduce((a, b) => a + b, 0) / allClassNormalizedScores.length;
                    // CORRECTION: Les notes de classe comptent pour 1 coefficient total, pas la somme
                    const classCoefficient = 1;
                    const classWeightedValue = classGlobalAverage * classCoefficient;
                    
                    console.log(`Moyenne globale notes de classe: ${classGlobalAverage.toFixed(2)}, Coef: ${classCoefficient}, Valeur pondérée: ${classWeightedValue.toFixed(2)}`);
                    
                    totalWeightedValue += classWeightedValue;
                    totalWeight += classCoefficient;
                }
            }

            // 2. Traiter les examens (individuellement)
            for (const category of examCategories) {
                const categoryGrades = gradesByCategory.get(category.id) || [];
                
                if (categoryGrades.length === 0) {
                    categoryBreakdown[category.id] = {
                        categoryName: category.name,
                        categoryCode: category.code,
                        average: 0,
                        weight: category.weight,
                        gradesCount: 0,
                        isExam: true
                    };
                    console.log(`Examen "${category.name}" (coef ${category.weight}): Aucune note - ignoré`);
                    continue;
                }

                // Normaliser et calculer la moyenne
                const normalizedScores = categoryGrades.map(g => {
                    if (config.normalizeScores) {
                        return (g.score / g.maxScore) * config.finalGradeBase;
                    }
                    return g.score;
                });

                const categoryAverage = normalizedScores.reduce((a, b) => a + b, 0) / normalizedScores.length;
                const weightedValue = categoryAverage * category.weight;

                console.log(`Examen "${category.name}" (coef ${category.weight}):`, {
                    notes: categoryGrades,
                    notesNormalisees: normalizedScores,
                    moyenneCategorie: categoryAverage,
                    valeurPonderee: weightedValue
                });

                categoryBreakdown[category.id] = {
                    categoryName: category.name,
                    categoryCode: category.code,
                    average: Math.round(categoryAverage * 100) / 100,
                    weight: category.weight,
                    gradesCount: categoryGrades.length,
                    grades: categoryGrades,
                    isExam: true
                };

                totalWeightedValue += weightedValue;
                totalWeight += category.weight;
            }

            console.log(`Calcul final: ${totalWeightedValue.toFixed(2)} / ${totalWeight} = ${(totalWeightedValue / totalWeight).toFixed(2)}`);

            // Calculer la moyenne finale
            let finalAverage: number;
            if (config.calculationStrategy === 'SIMPLE') {
                console.log('Stratégie: SIMPLE (moyenne de toutes les notes sans coefficients)');
                const allNormalizedScores = entries.map(e => {
                    if (config.normalizeScores) {
                        return (e.score / e.maxScore) * config.finalGradeBase;
                    }
                    return e.score;
                });
                finalAverage = allNormalizedScores.length > 0 
                    ? allNormalizedScores.reduce((a, b) => a + b, 0) / allNormalizedScores.length 
                    : 0;
                console.log(`Moyenne simple: ${allNormalizedScores.join(' + ')} / ${allNormalizedScores.length} = ${finalAverage}`);
            } else {
                console.log('Stratégie: PONDÉRÉE (avec coefficients)');
                finalAverage = totalWeight > 0 ? totalWeightedValue / totalWeight : 0;
                console.log(`Moyenne pondérée: ${totalWeightedValue} / ${totalWeight} = ${finalAverage}`);
            }

            finalAverage = Math.round(finalAverage * 100) / 100;
            console.log(`Moyenne finale arrondie: ${finalAverage} / ${config.finalGradeBase}`);

            // Sauvegarder dans le cache
            let calculated = await this.calculatedGradeRepository.findOne({
                where: { studentId, courseId, period }
            });

            if (!calculated) {
                calculated = new CalculatedGradeEntity();
                calculated.studentId = studentId;
                calculated.courseId = courseId;
                calculated.period = period;
            }

            calculated.finalAverage = finalAverage;
            calculated.configId = config.id;
            calculated.categoryBreakdown = categoryBreakdown;

            await this.calculatedGradeRepository.save(calculated);

            return {
                success: true,
                data: calculated,
                message: "Moyenne calculée",
                error: null
            };
        } catch (error) {
            console.error("Erreur calculateAndCacheGrade:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors du calcul",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /**
     * Récupère la moyenne calculée (avec recalcul si nécessaire)
     */
    async getCalculatedGrade(
        studentId: number,
        courseId: number,
        classId: number,
        schoolId: number,
        period: string
    ): Promise<ResultType<CalculatedGradeEntity>> {
        try {
            let calculated = await this.calculatedGradeRepository.findOne({
                where: { studentId, courseId, period }
            });

            if (!calculated) {
                // Calculer si pas en cache
                return await this.calculateAndCacheGrade(studentId, courseId, classId, schoolId, period);
            }

            return {
                success: true,
                data: calculated,
                message: "Moyenne récupérée",
                error: null
            };
        } catch (error) {
            console.error("Erreur getCalculatedGrade:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /**
     * Supprime une note
     */
    async deleteGradeEntry(entryId: number): Promise<ResultType<null>> {
        try {
            const entry = await this.gradeEntryRepository.findOne({ where: { id: entryId } });
            if (!entry) {
                throw new Error("Note non trouvée");
            }

            await this.gradeEntryRepository.remove(entry);
            await this.invalidateCalculatedGrade(entry.studentId, entry.courseId, entry.period);

            return {
                success: true,
                data: null,
                message: "Note supprimée",
                error: null
            };
        } catch (error) {
            console.error("Erreur deleteGradeEntry:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la suppression",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /**
     * Invalide le cache d'une moyenne calculée
     */
    private async invalidateCalculatedGrade(studentId: number, courseId: number, period: string): Promise<void> {
        try {
            await this.calculatedGradeRepository.delete({ studentId, courseId, period });
        } catch (error) {
            console.error("Erreur invalidation cache:", error);
        }
    }

    /**
     * Récupère toutes les moyennes d'un élève pour une période
     */
    async getStudentAverages(
        studentId: number,
        classId: number,
        schoolId: number,
        period: string
    ): Promise<ResultType<CalculatedGradeEntity[]>> {
        try {
            const averages = await this.calculatedGradeRepository.find({
                where: { studentId, period },
                relations: ['course']
            });

            return {
                success: true,
                data: averages,
                message: "Moyennes récupérées",
                error: null
            };
        } catch (error) {
            console.error("Erreur getStudentAverages:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }
}

