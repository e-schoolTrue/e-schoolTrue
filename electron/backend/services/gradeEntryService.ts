import { Repository, In } from "typeorm";
import { AppDataSource } from "../../data-source";
import { GradeEntryEntity, CalculatedGradeEntity } from "../entities/gradeEntry";
import { ConfigNoteService } from "./note-config-service";
import {CourseEntity} from "#electron/backend/entities/course";

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
            
            // Récupérer tous les élèves de la classe
            const studentRepo = dataSource.getRepository('StudentEntity');
            const students = await studentRepo.find({
                where: { grade: { id: classId } },
                relations: ['grade']
            });
            
            console.log(`Nombre d'élèves trouvés: ${students.length}`);

            if (students.length === 0) {
                return {
                    success: true,
                    data: [],
                    message: "Aucun élève dans cette classe",
                    error: null
                };
            }

            // Récupérer les cours de la classe avec leurs coefficients
            const courseRepo = dataSource.getRepository('CourseEntity');
            const courses = await courseRepo.find({
                where: { grade: { id: classId } }
            });

            console.log(`Nombre de matières: ${courses.length}`);

            // Créer un map des coefficients par courseId
            const courseCoefficients = new Map<number, number>();
            courses.forEach(course => {
                courseCoefficients.set(course.id, course.coefficient || 1);
            });

            // Calculer la moyenne générale de chaque élève
            const studentAverages: Array<{
                studentId: number;
                studentName: string;
                generalAverage: number;
                totalCoefficients: number;
            }> = [];

            for (const student of students) {
                // Récupérer toutes les moyennes calculées pour cet élève
                const averages = await this.calculatedGradeRepository.find({
                    where: { 
                        studentId: student.id, 
                        period 
                    }
                });

                if (averages.length === 0) {
                    console.log(`Élève ${student.id} (${student.firstname} ${student.lastname}): Aucune note`);
                    continue; // Ignorer les élèves sans notes
                }

                // Calculer la moyenne générale pondérée
                let totalWeightedValue = 0;
                let totalCoefficients = 0;

                for (const avg of averages) {
                    const coefficient = courseCoefficients.get(avg.courseId) || 1;
                    totalWeightedValue += avg.finalAverage * coefficient;
                    totalCoefficients += coefficient;
                }

                const generalAverage = totalCoefficients > 0 
                    ? Math.round((totalWeightedValue / totalCoefficients) * 100) / 100 
                    : 0;

                console.log(`Élève ${student.id} (${student.firstname} ${student.lastname}): ${generalAverage}/20 (${averages.length} matières)`);

                studentAverages.push({
                    studentId: student.id,
                    studentName: `${student.firstname} ${student.lastname}`,
                    generalAverage,
                    totalCoefficients
                });
            }

            // Trier par moyenne décroissante
            studentAverages.sort((a, b) => b.generalAverage - a.generalAverage);

            // Attribuer les rangs (gérer les ex-aequo)
            const rankings = studentAverages.map((student, index, array) => {
                let rank = index + 1;
                
                // Si la moyenne est identique à celle du précédent, même rang
                if (index > 0 && student.generalAverage === array[index - 1].generalAverage) {
                    rank = (array[index - 1] as any).rank;
                }
                
                return {
                    ...student,
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
            console.log('\n===CALCUL CLASSEMENT CENTRALISÉ ===');
            console.log('Filtres appliqués:', filters || { message: "aucun" });
            
            const dataSource = AppDataSource.getInstance();
            const studentRepo = dataSource.getRepository('StudentEntity');
            const courseRepo:Repository<CourseEntity> = dataSource.getRepository('CourseEntity');
            
            let students: any[] = [];
            students = await studentRepo.find({
                where: { grade: { id: filters.gradeId } },
                relations: ['grade']
            });
            console.log(`Nombre d'élèves trouvés: ${students.length}`);
            let courses: any[];
            const gradeId = filters.gradeId
            courses = await courseRepo.createQueryBuilder('course')
                .leftJoinAndSelect('course.grades', 'grades')
                .leftJoinAndSelect('course.grade', 'grade')
                .leftJoinAndSelect('course.courses', 'courses')
                .where('grades.id = :gradeId OR grade.id = :gradeId', { gradeId })
                .getMany();
            console.log(`Nombre de matières: ${courses.length}`);
            const courseMap = new Map<number, any>();
            courses.forEach(course => {
                courseMap.set(course.id, course);
            });

            // Pour chaque élève, calculer sa note finale
            const studentResults: Array<{
                studentId: number;
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
                }>;
            }> = [];

            for (const student of students) {
                let totalWeightedValue = 0;
                let totalCoefficients = 0;
                let averageScores = 0;
                let scoreCount = 0;
                const averages = await this.calculatedGradeRepository.find({
                    where: {
                        studentId: student.id,
                        courseId: In(Array.from(courseMap.keys())),
                        period: filters?.period || undefined
                    }
                });
                const studentScores: Array<{
                    courseId: number;
                    courseName: string;
                    score: number;
                    coefficient: number;
                }> = [];

                for (const avg of averages) {
                    const course = courseMap.get(avg.courseId);
                    const coefficient = course?.coefficient || 1;
                    
                    totalWeightedValue += avg.finalAverage * coefficient;
                    totalCoefficients += coefficient;
                    averageScores += avg.finalAverage;
                    scoreCount += 1;
                    studentScores.push({
                        courseId: avg.courseId,
                        courseName: course?.name || '',
                        score: avg.finalAverage,
                        coefficient: coefficient
                    });
                }

                const generalAverage = totalCoefficients > 0 
                    ? Math.round((totalWeightedValue / totalCoefficients) * 100) / 100 
                    : 0;
                const unweightedAverage = scoreCount > 0
                    ? Math.round((averageScores / scoreCount) * 100) / 100
                    : 0;
                console.log(`Élève ${student.id} (${student.firstname} ${student.lastname}): ${generalAverage}/20 (${averages.length} matières)`);
                studentResults.push({
                    studentId: student.id,
                    firstname: student.firstname,
                    lastname: student.lastname,
                    generalAverage,
                    rank: 0, // sera calculé après
                    totalScores: totalCoefficients,
                    averageScores: unweightedAverage,
                    scores: studentScores
                });
            }

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
                console.log(`ranking ${r.rank}. ${r.firstname} ${r.lastname}: ${r.generalAverage}/20`);
            });
            console.log(`Moyenne de classe: ${classAverage}`);
            console.log('=== FIN CALCUL CLASSEMENT CENTRALISÉ ===\n');

            return {
                success: true,
                data: rankings,
                message: `Classement calculé pour ${rankings.length} élèves`,
                error: null
            };
        } catch (error) {
            console.error("Erreur getCentralizedRankings:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors du calcul du classement centralisé",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }
}

