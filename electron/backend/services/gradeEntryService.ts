import { Repository, In } from "typeorm";
import { AppDataSource } from "../../data-source";
import { GradeEntryEntity, CalculatedGradeEntity } from "../entities/gradeEntry";
import { ConfigNoteService } from "./note-config-service";
import {CourseEntity} from "../entities/course";
import {StudentEntity} from "../entities/students";

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
            evaluationDate?: string;
            comment?: string;
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
     * Sauvegarde plusieurs notes pour une matière en une seule transaction
     */
    async bulkSaveGrades(input: BulkSaveGradesInput): Promise<ResultType<any>> {
        try {
            console.log(`\n=== BULK SAVE GRADES ===`);
            console.log('Input:', input);

            const { studentId, courseId, period, grades } = input;

            // D'abord, supprimer les notes existantes pour cet étudiant, matière et période
            await this.gradeEntryRepository.delete({
                studentId,
                courseId,
                period
            });

            // Sauvegarder les nouvelles notes
            for (const grade of grades) {
                const entry = new GradeEntryEntity();
                entry.studentId = studentId;
                entry.courseId = courseId;
                entry.categoryId = grade.categoryId;
                entry.period = period;
                entry.score = grade.score;
                entry.maxScore = grade.maxScore;
                entry.label = grade.label || null;
                entry.evaluationDate = grade.evaluationDate ? new Date(grade.evaluationDate) : new Date();
                entry.comment = grade.comment || null;

                await this.gradeEntryRepository.save(entry);
            }

            console.log(`✅ Notes sauvegardées avec succès pour étudiant ${studentId}, matière ${courseId}`);

            return {
                success: true,
                data: { savedCount: grades.length },
                message: `${grades.length} note(s) sauvegardée(s)`,
                error: null
            };
        } catch (error) {
            console.error("Erreur bulkSaveGrades:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la sauvegarde en bloc",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /**
     * Calcule et sauvegarde automatiquement la moyenne d'un étudiant pour une matière
     * Basé sur les notes brutes existantes dans grade_entry
     */
    async recalculateStudentGrades(
        studentId: number,
        courseId: number,
        classId: number,
        schoolId: number,
        period: string
    ): Promise<ResultType<CalculatedGradeEntity>> {
        try {
            console.log(`\n=== RECALCULER MOYENNES ÉLÈVE ${studentId} ===`);
            return await this.calculateAndCacheGrade(studentId, courseId, classId, schoolId, period);
        } catch (error) {
            console.error("Erreur recalculateStudentGrades:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors du recalcul des moyennes",
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

            console.log('=== CALCUL MOYENNE ===');
            console.log(`Student: ${studentId}, Course: ${courseId}, Period: ${period}`);
            console.log(`Config ID: ${config.id}, Strategy: ${config.calculationStrategy}`);
            console.log(`Catégories dans la config:`, config.categories.map((c: any) => ({ id: c.id, name: c.name, isExam: c.isExam })));
            console.log(`Notes par catégorie (gradesByCategory):`);
            gradesByCategory.forEach((grades, catId) => {
                console.log(`  Catégorie ${catId}: ${grades.length} notes`, grades);
            });
            
            // Vérifier la correspondance
            const configCategoryIds = new Set(config.categories.map((c: any) => c.id));
            const noteCategoryIds = Array.from(gradesByCategory.keys());
            console.log(`📊 IDs config:`, Array.from(configCategoryIds));
            console.log(`📊 IDs notes:`, noteCategoryIds);
            console.log(`📊 Correspondance:`, noteCategoryIds.every(id => configCategoryIds.has(id)));
            
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
                        isExam: category.isExam || false
                    };

                    allClassNormalizedScores.push(categoryAverage);
                }

                if (allClassNormalizedScores.length > 0) {
                    const classGlobalAverage = allClassNormalizedScores.reduce((a, b) => a + b, 0) / allClassNormalizedScores.length;
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
                        grades: [],
                        isExam: true
                    };
                    console.log(`Examen "${category.name}" (coef ${category.weight}): Aucune note - ignoré`);
                    continue;
                }

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
                    isExam: category.isExam || false
                };

                totalWeightedValue += weightedValue;
                totalWeight += category.weight;
            }

            console.log(`Calcul final: ${totalWeightedValue.toFixed(2)} / ${totalWeight} = ${(totalWeightedValue / totalWeight).toFixed(2)}`);
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

            console.log('💾 Sauvegarde categoryBreakdown:', JSON.stringify(categoryBreakdown));

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
     * Invalide le cache des moyennes pour une classe et période
     */
    async invalidateCacheByClass(classId: number, period: string): Promise<ResultType<{ deleted: number }>> {
        try {
            // Récupérer les étudiants de la classe
            const { StudentEntity } = await import("../entities/students");
            const dataSource = AppDataSource.getInstance();
            const students = await dataSource.getRepository(StudentEntity)
                .createQueryBuilder('student')
                .innerJoin('student.grade', 'grade')
                .where('grade.id = :classId', { classId })
                .select(['student.id'])
                .getMany();
            
            let deletedCount = 0;
            for (const student of students) {
                const result = await this.calculatedGradeRepository.delete({ studentId: student.id, period });
                deletedCount += result.affected || 0;
            }
            
            console.log(`✅ Cache invalidé: ${deletedCount} moyennes supprimées pour la classe ${classId}, période ${period}`);
            
            return {
                success: true,
                data: { deleted: deletedCount },
                message: `${deletedCount} moyennes recalculées`,
                error: null
            };
        } catch (error) {
            console.error("Erreur invalidation cache par classe:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de l'invalidation du cache",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
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

    /**
     * Calcule le classement des élèves d'une classe pour une période donnée
     * @param classId - L'identifiant de la classe
     * @param schoolId - L'identifiant de l'école
     * @param period - La période (ex: "Trimestre 1")
     * @returns Un tableau contenant le classement des élèves avec leur rang et moyenne générale
     */
    async getClassRankings(
        classId: number,
        schoolId: number,
        period: string
    ): Promise<ResultType<Array<{
        studentId: number;
        studentName: string;
        generalAverage: number;
        rank: number;
        totalCoefficients: number;
    }>>> {
        try {
            console.log('\n=== CALCUL CLASSEMENT CLASSE ===');
            console.log(`Classe: ${classId}, Période: ${period}`);

            const dataSource = AppDataSource.getInstance();

            // Récupérer tous les élèves de la classe - utiliser la classe directement
            const studentRepo = dataSource.getRepository(StudentEntity);
            const students = await studentRepo.find({
                where: { grade: { id: classId } },
                relations: ['grade']
            });

            if (students.length === 0) {
                return {
                    success: true,
                    data: [],
                    message: "Aucun élève dans cette classe",
                    error: null
                };
            }

            // Récupérer les cours de la classe avec leurs coefficients
            // IMPORTANT: utiliser la même requête que getCentralizedRankings pour
            // assurer la cohérence entre le classement du bulletin et celui de la
            // fiche de centralisation. CourseEntity expose deux relations vers
            // GradeEntity: `grades` (ManyToMany, relation actuelle) et `grade`
            // (ManyToOne, relation legacy). Il faut considérer les deux.
            const courseRepo = dataSource.getRepository(CourseEntity);
            const courses = await courseRepo
                .createQueryBuilder('course')
                .leftJoinAndSelect('course.grades', 'grades')
                .leftJoinAndSelect('course.grade', 'grade')
                .where('grades.id = :classId OR grade.id = :classId', { classId })
                .getMany();

            const courseCoefficients = new Map<number, number>();
            courses.forEach(course => {
                if (course && course.id != null) {
                    courseCoefficients.set(course.id, course.coefficient || 1);
                }
            });
            const courseIds = Array.from(courseCoefficients.keys());

            const studentAverages: Array<{
                studentId: number;
                studentName: string;
                generalAverage: number;
                totalCoefficients: number;
                hasGrades: boolean;
            }> = [];

            for (const student of students) {
                // Restreindre aux moyennes des matières effectivement rattachées
                // à la classe. Sans ce filtre, des moyennes orphelines (ex: matière
                // détachée de la classe) pourraient être prises en compte avec un
                // coefficient de 1, faussant la moyenne générale et donc le rang.
                const averages = courseIds.length > 0
                    ? await this.calculatedGradeRepository.find({
                        where: {
                            studentId: student.id,
                            courseId: In(courseIds),
                            period
                        }
                    })
                    : [];

                let totalWeightedValue = 0;
                let totalCoefficients = 0;

                if (averages.length > 0) {
                    for (const avg of averages) {
                        const coefficient = courseCoefficients.get(avg.courseId);
                        if (coefficient === undefined) continue;
                        totalWeightedValue += avg.finalAverage * coefficient;
                        totalCoefficients += coefficient;
                    }

                    console.log(`Élève ${student.id} (${student.firstname} ${student.lastname}): ${totalCoefficients > 0 ? (totalWeightedValue / totalCoefficients).toFixed(2) : '0.00'}/20 (${averages.length} matières)`);
                } else {
                    console.log(`Élève ${student.id} (${student.firstname} ${student.lastname}): Aucune note`);
                }

                const generalAverage = totalCoefficients > 0 
                    ? Math.round((totalWeightedValue / totalCoefficients) * 100) / 100 
                    : 0;

                studentAverages.push({
                    studentId: student.id,
                    studentName: `${student.firstname} ${student.lastname}`,
                    generalAverage,
                    totalCoefficients,
                    hasGrades: averages.length > 0
                });
            }

            // Trier par moyenne décroissante (les élèves sans notes à la fin)
            studentAverages.sort((a, b) => {
                // Si un élève n'a pas de notes, il est classé après ceux qui en ont
                if (!a.hasGrades && b.hasGrades) return 1;
                if (a.hasGrades && !b.hasGrades) return -1;
                return b.generalAverage - a.generalAverage;
            });

            // Attribuer les rangs (gérer les ex-aequo)
            const rankings = studentAverages.map((student, index, array) => {
                // Les élèves sans notes n'ont pas de rang
                if (!student.hasGrades) {
                    return {
                        studentId: student.studentId,
                        studentName: student.studentName,
                        generalAverage: student.generalAverage,
                        totalCoefficients: student.totalCoefficients,
                        rank: null
                    };
                }

                let rank = index + 1;
                
                // Si la moyenne est identique à celle du précédent, même rang
                if (index > 0 && student.generalAverage === array[index - 1].generalAverage) {
                    rank = (array[index - 1] as any).rank;
                }
                
                return {
                    studentId: student.studentId,
                    studentName: student.studentName,
                    generalAverage: student.generalAverage,
                    totalCoefficients: student.totalCoefficients,
                    rank
                };
            });

            console.log('Classement final:');
            rankings.forEach(r => {
                console.log(`  ${r.rank}. ${r.studentName}: ${r.generalAverage}/20`);
            });
            console.log('=== FIN CALCUL CLASSEMENT ===\n');

            return {
                success: true,
                data: rankings,
                message: `Classement calculé pour ${rankings.length} élèves`,
                error: null
            };
        } catch (error) {
            console.error("Erreur getClassRankings:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors du calcul du classement",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /**
     * Récupère le rang d'un élève spécifique dans sa classe
     * @param studentId - L'identifiant de l'élève
     * @param classId - L'identifiant de la classe
     * @param schoolId - L'identifiant de l'école
     * @param period - La période
     * @returns Le rang de l'élève et sa moyenne
     */
    async getStudentRank(
        studentId: number,
        classId: number,
        schoolId: number,
        period: string
    ): Promise<ResultType<{
        studentId: number;
        rank: number;
        generalAverage: number;
        totalStudents: number;
        classAverage: number;
    }>> {
        try {
            const rankingsResult = await this.getClassRankings(classId, schoolId, period);
            
            if (!rankingsResult.success || !rankingsResult.data) {
                throw new Error("Impossible de calculer le classement");
            }

            const rankings = rankingsResult.data;
            const studentRanking = rankings.find(r => r.studentId === studentId);

            if (!studentRanking) {
                return {
                    success: false,
                    data: null,
                    message: "Élève non trouvé dans le classement (pas de notes)",
                    error: "STUDENT_NOT_RANKED"
                };
            }

            // Calculer la moyenne de classe
            const classAverage = rankings.length > 0
                ? Math.round((rankings.reduce((sum, r) => sum + r.generalAverage, 0) / rankings.length) * 100) / 100
                : 0;

            return {
                success: true,
                data: {
                    studentId,
                    rank: studentRanking.rank,
                    generalAverage: studentRanking.generalAverage,
                    totalStudents: rankings.length,
                    classAverage
                },
                message: "Rang calculé avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur getStudentRank:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors du calcul du rang",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getCentralizedRankings(
        filters?: {
            gradeId: number;
            period?: string;
        }
    ): Promise<ResultType<Array<{
        studentId: number;
        firstname: string;
        lastname: string;
        generalAverage: number;
        rank: number;
        totalScores: number;
        averageScores: number;
    }>>> {
        try {
            if (!filters || typeof filters !== 'object') {
                throw new Error('Filtres non valides');
            }

            if (!filters.gradeId || typeof filters.gradeId !== 'number' || isNaN(filters.gradeId) || filters.gradeId <= 0) {
                throw new Error(`gradeId invalide: ${filters.gradeId}`);
            }

            const dataSource = AppDataSource.getInstance();
            const studentRepo = dataSource.getRepository(StudentEntity);
            const courseRepo:Repository<CourseEntity> = dataSource.getRepository(CourseEntity);

            let students: any[] = [];
            try {
                students = await studentRepo.find({
                    where: { grade: { id: filters.gradeId } },
                    relations: ['grade']
                });
            } catch (studentError) {
                throw new Error(`Erreur lors de la récupération des étudiants: ${studentError instanceof Error ? studentError.message : 'Unknown error'}`);
            }

            let courses: any[];
            try {
                courses = await courseRepo.createQueryBuilder('course')
                    .leftJoinAndSelect('course.grades', 'grades')
                    .leftJoinAndSelect('course.grade', 'grade')
                    .leftJoinAndSelect('course.courses', 'courses')
                    .where('grades.id = :gradeId OR grade.id = :gradeId', { gradeId: filters.gradeId })
                    .getMany();
            } catch (courseError) {
                throw new Error(`Erreur lors de la récupération des matières: ${courseError instanceof Error ? courseError.message : 'Unknown error'}`);
            }

            const courseMap = new Map<number, any>();
            courses.forEach(course => {
                if (course && course.id) {
                    courseMap.set(course.id, course);
                }
            });

            // Pour chaque élève, calculer sa note finale
            const studentResults: Array<{
                studentId: number;
                matricule: string;
                firstname: string;
                lastname: string;
                generalAverage: number;
                rank: number;
                totalScores: number;
                averageScores: number;
                scores: Array<{
                    courseId: number;
                    courseName: string;
                    score: number;
                    coefficient: number;
                    weightedScore: number;
                }>;
            }> = [];

            console.log(`=== DÉBUT TRAITEMENT ÉLÈVES (${students.length} étudiants) ===`);
            
            for (const student of students) {
                try {
                    console.log(`\n--- Traitement étudiant ${student.id} ---`);
                    console.log('Données étudiant avant:', {
                        id: student.id,
                        matricule: student.matricule,
                        firstname: student.firstname,
                        lastname: student.lastname,
                        gradeId: student.grade?.id
                    });
                    
                    // Vérification du matricule
                    if (!student.matricule) {
                        console.warn(`⚠️ Aucun matricule trouvé pour l'étudiant ${student.id}`);
                    }
                    
                    let totalWeightedValue = 0;
                    let totalCoefficients = 0;
                    let averageScores = 0;
                    let scoreCount = 0;
                    
                    const courseIds = Array.from(courseMap.keys());
                    const averages = await this.calculatedGradeRepository.find({
                        where: {
                            studentId: student.id,
                            courseId: In(courseIds),
                            period: filters?.period || undefined
                        }
                    });
                    
                    console.log(`Élève ${student.id}: ${averages.length} moyennes trouvées pour les ${courseMap.size} matières`);
                    
                    const studentScores: Array<{
                        courseId: number;
                        courseName: string;
                        score: number;
                        coefficient: number;
                        weightedScore: number;
                    }> = [];

                    for (const avg of averages) {
                        if (!avg.courseId) {
                            console.warn(`⚠️ Aucun courseId trouvé dans la moyenne pour l'étudiant ${student.id}`);
                            continue;
                        }
                        const course = courseMap.get(avg.courseId);
                        if (!course) {
                            console.warn(`⚠️ Matière non trouvée dans le map pour courseId ${avg.courseId}`);
                            continue;
                        }
                        
                        const coefficient = course?.coefficient || 1;
                        const weightedScore = avg.finalAverage * coefficient;
                        
                        totalWeightedValue += weightedScore;
                        totalCoefficients += coefficient;
                        averageScores += avg.finalAverage;
                        scoreCount += 1;
                        studentScores.push({
                            courseId: avg.courseId,
                            courseName: course?.name || '',
                            score: avg.finalAverage,
                            coefficient: coefficient,
                            weightedScore: weightedScore
                        });
                    }

                    const generalAverage = totalCoefficients > 0 
                        ? Math.round((totalWeightedValue / totalCoefficients) * 100) / 100 
                        : 0;
                    const unweightedAverage = scoreCount > 0
                        ? Math.round((averageScores / scoreCount) * 100) / 100
                        : 0;
                    
                    console.log(`✅ Élève ${student.id} (${student.matricule || 'sans matricule'} ${student.firstname} ${student.lastname}): ${generalAverage}/20 (${averages.length} matières)`);
                    
                    studentResults.push({
                        studentId: student.id,
                        matricule: student.matricule || '',
                        firstname: student.firstname,
                        lastname: student.lastname,
                        generalAverage,
                        rank: 0, // sera calculé après
                        totalScores: totalCoefficients,
                        averageScores: unweightedAverage,
                        scores: studentScores
                    });
                } catch (studentLoopError) {
                    console.error(`❌ Erreur lors du traitement de l'étudiant ${student.id}:`, studentLoopError);
                    // Continuer avec les autres étudiants même si un échoue
                }
            }

            console.log(`=== FIN TRAITEMENT ÉLÈVES ===\n`);

            // Trier par moyenne générale décroissante
            studentResults.sort((a, b) => b.generalAverage - a.generalAverage);

            // Attribuer les rangs (gérer les ex-aequo)
            const rankings = studentResults.map((student, index, array) => {
                let rank = index + 1;
                if (index > 0 && student.generalAverage === (array[index - 1] as any).generalAverage) {
                    rank = (array[index - 1] as any).rank;
                }
                return {
                    ...student,
                    rank
                };
            });

            // class aevrage
            const classAverage = rankings.length > 0
                ? Math.round((rankings.reduce((sum, r) => sum + r.generalAverage, 0) / rankings.length) * 100) / 100
                : 0;

            console.log('Classement final:');
            rankings.forEach(r => {
                console.log(`ranking ${r.rank}. ${r.firstname} ${r.lastname}: ${r.generalAverage}/20 (matricule: ${r.matricule || 'sans matricule'})`);
            });
            console.log(`Moyenne de classe: ${classAverage}`);
            console.log('=== FIN CALCUL CLASSEMENT CENTRALISÉ ===\n');

            // Vérifier que les données sont valides
            if (!rankings || !Array.isArray(rankings)) {
                throw new Error('Les données de classement ne sont pas valides (pas un tableau)');
            }

            // Vérifier que chaque élève a les champs requis
            const invalidStudents = rankings.filter((r: any) => 
                !r.studentId || 
                r.firstname === undefined || 
                r.lastname === undefined ||
                r.generalAverage === undefined
            );

            if (invalidStudents.length > 0) {
                console.error('⚠️ Étudiants avec des données invalides:', invalidStudents);
            }

            console.log(`✅ Classement généré avec succès pour ${rankings.length} étudiants`);

            return {
                success: true,
                data: rankings,
                message: `Classement calculé pour ${rankings.length} élèves`,
                error: null
            };
        } catch (error) {
            console.error('❌ ERREUR CRITIQUE DANS getCentralizedRankings:', error);
            console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace');
            const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
            return {
                success: false,
                data: null,
                message: `Erreur lors du calcul du classement centralisé: ${errorMessage}`,
                error: errorMessage
            };
        }
    }
}

