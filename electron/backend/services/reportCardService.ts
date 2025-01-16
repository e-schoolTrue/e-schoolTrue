import { Repository } from "typeorm";
import { ReportCardEntity } from "../entities/report";
import { AppDataSource } from "../../data-source";

interface ServiceResultType {
    success: boolean;
    data: any;
    message: string;
    error: string | null;
    generalAverage: number;
}


export class ReportCardService {
    private reportRepository: Repository<ReportCardEntity>;

    constructor() {
        this.reportRepository = AppDataSource.getInstance().getRepository(ReportCardEntity);
    }

    async generateReportCards(data: {
        studentIds: number[];
        period: string;
        templateId: string;
    }): Promise<ServiceResultType> {
        try {
            const reports = [];
            for (const studentId of data.studentIds) {
                const gradesResult = await this.getStudentGrades(studentId, data.period);
                if (!gradesResult.success || !gradesResult.data) continue;
                
                const studentGrades = gradesResult.data;
                if (!studentGrades.length) continue;

                // Créer un rapport pour chaque matière
                const reportGrades = await Promise.all(studentGrades.map((grade: any) => {
                    return this.reportRepository.create({
                        studentId,
                        courseId: grade.courseId,
                        period: data.period,
                        assignmentGrades: grade.assignments,
                        examGrade: grade.exam,
                        finalGrade: grade.average,
                        appreciation: grade.appreciation
                    });
                }));

                reports.push(...await this.reportRepository.save(reportGrades));
            }

            return {
                success: true,
                data: reports,
                message: "Bulletins générés avec succès",
                error: null,
                generalAverage: 0
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la génération des bulletins",
                error: error instanceof Error ? error.message : "Erreur inconnue",
                generalAverage: 0
            };
        }
    }

    async getStudentGrades(studentId: number, period: string): Promise<ServiceResultType> {
        try {
            const grades = await this.reportRepository
                .createQueryBuilder('report')
                .leftJoinAndSelect('report.course', 'course')
                .where('report.studentId = :studentId', { studentId })
                .andWhere('report.period = :period', { period })
                .orderBy('course.name', 'ASC')
                .getMany();
    
            const formattedGrades = grades.map(grade => {
                // Calcul de la moyenne des devoirs (sur 20)
                const assignments = grade.assignmentGrades || [];
                const assignmentAverage = assignments.length > 0 
                    ? assignments.reduce((sum, g) => sum + g, 0) / assignments.length 
                    : 0;
    
                // Normalisation de la note d'examen (de /40 à /20)
                const examGrade = Number(grade.examGrade) || 0;
                const normalizedExamGrade = (examGrade / 40) * 20;
    
                // Moyenne finale (devoirs et examen déjà sur 20)
                const finalGrade = (assignmentAverage + normalizedExamGrade) / 2;
    
                return {
                    courseId: grade.courseId,
                    courseName: grade.course?.name || 'Cours inconnu',
                    coefficient: Number(grade.course?.coefficient) || 1,
                    assignments: assignments,
                    exam: examGrade, // Garde la note originale sur 40
                    average: parseFloat(finalGrade.toFixed(2)),
                    appreciation: grade.appreciation || ''
                };
            });
    
            // Calcul des totaux pondérés pour la moyenne générale
            let totalPoints = 0;
            let totalCoef = 0;
    
            formattedGrades.forEach(grade => {
                totalPoints += grade.average * grade.coefficient;
                totalCoef += grade.coefficient;
            });
    
            const generalAverage = totalCoef > 0 ? parseFloat((totalPoints / totalCoef).toFixed(2)) : 0;
    
            return {
                success: true,
                data: {
                    grades: formattedGrades,
                    generalAverage
                },
                message: "Notes récupérées avec succès",
                error: null,
                generalAverage
            };
        } catch (error) {
            console.error('Erreur récupération notes:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des notes",
                error: error instanceof Error ? error.message : "Erreur inconnue",
                generalAverage: 0
            };
        }
    }
    

    async generateReportCard(data: {
        studentId: number;
        period: string;
    }): Promise<ServiceResultType> {
        try {
            const gradesResult = await this.getStudentGrades(data.studentId, data.period);
            if (!gradesResult.success) {
                throw new Error("Erreur lors de la récupération des notes");
            }

            // Formatage des données
            const formattedGrades = gradesResult.data.map((grade: any) => ({
                courseId: grade.courseId,
                courseName: grade.course.name,
                coefficient: grade.course.coefficient,
                assignments: grade.assignmentGrades || [],
                exam: Number(grade.examGrade) || 0,
                average: Number(grade.finalGrade) || 0,
                appreciation: grade.appreciation || ''
            }));

            // Calcul de la moyenne générale
            const totalCoef = formattedGrades.reduce((sum: any, grade: { coefficient: any; }) => sum + (grade.coefficient || 0), 0);
            const weightedSum = formattedGrades.reduce((sum: number, grade: { average: number; coefficient: any; }) => 
                sum + (grade.average * (grade.coefficient || 0)), 0);
            const generalAverage = totalCoef > 0 ? weightedSum / totalCoef : 0;

            return {
                success: true,
                data: {
                    grades: formattedGrades,
                    generalAverage: generalAverage
                },
                message: "Bulletin généré avec succès",
                error: null,
                generalAverage: generalAverage
            };
        } catch (error) {
            console.error('Erreur génération bulletin:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la génération du bulletin",
                error: error instanceof Error ? error.message : "Erreur inconnue",
                generalAverage: 0
            };
        }
    }

    async saveStudentGrades(data: {
        studentId: number;
        gradeId: number;
        period: string;
        grades: Array<{
            courseId: number;
            assignments: number[];
            exam: number;
            average: number;
            appreciation: string;
        }>;
    }): Promise<ServiceResultType> {
        const queryRunner = AppDataSource.getInstance().createQueryRunner();
        
        try {
            await queryRunner.connect();
            await queryRunner.startTransaction();

            // Suppression des anciennes notes pour cette période
            await queryRunner.manager.delete(ReportCardEntity, {
                studentId: data.studentId,
                period: data.period
            });

            // Création des nouvelles notes
            const reportsToSave = data.grades.map(grade => {
                const report = new ReportCardEntity();
                report.studentId = data.studentId;
                report.courseId = grade.courseId;
                report.period = data.period;
                report.assignmentGrades = grade.assignments;
                report.examGrade = grade.exam;
                report.finalGrade = grade.average;
                report.appreciation = grade.appreciation;
                return report;
            });

            // Sauvegarde des nouvelles notes
            await queryRunner.manager.save(ReportCardEntity, reportsToSave);
            
            // Vérification de la sauvegarde
            const verificationResult = await this.getStudentGrades(data.studentId, data.period);
            
            if (!verificationResult.success || !verificationResult.data?.grades?.length) {
                throw new Error("La sauvegarde n'a pas pu être vérifiée");
            }

            await queryRunner.commitTransaction();
            
            return {
                success: true,
                data: verificationResult.data,
                message: "Notes enregistrées avec succès",
                error: null,
                generalAverage: verificationResult.generalAverage
            };

        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            
            return {
                success: false,
                data: null,
                message: "Erreur lors de la sauvegarde des notes",
                error: error instanceof Error ? error.message : "Erreur inconnue",
                generalAverage: 0
            };
            
        } finally {
            await queryRunner.release();
        }
    }
} 