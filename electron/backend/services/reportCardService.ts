import { Repository } from "typeorm";
import { ReportCardEntity } from "../entities/report";
import { AppDataSource } from "../../data-source";
import { ResultType } from "./paymentService";
import { 
    ReportCard, 
    ReportCardData, 
    GenerateReportCardsInput, 
    GenerateReportCardInput, 
    SaveStudentGradesInput,
    GradeData 
} from "../types/report";

export class ReportCardService {
    private reportRepository: Repository<ReportCardEntity>;

    constructor() {
        this.reportRepository = AppDataSource.getInstance().getRepository(ReportCardEntity);
    }

    async generateReportCards(data: GenerateReportCardsInput): Promise<ResultType<ReportCard[]>> {
        try {
            const reports = [];
            for (const studentId of data.studentIds) {
                const gradesResult = await this.getStudentGrades(studentId, data.period);
                if (!gradesResult.success || !gradesResult.data) continue;
                
                const studentGrades = gradesResult.data;
                if (!studentGrades?.grades?.length) continue;

                const reportGrades = await Promise.all(studentGrades.grades.map((grade: GradeData) => {
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
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la génération des bulletins",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getStudentGrades(studentId: number, period: string): Promise<ResultType<ReportCardData>> {
        try {
            const grades = await this.reportRepository
                .createQueryBuilder('report')
                .leftJoinAndSelect('report.course', 'course')
                .where('report.studentId = :studentId', { studentId })
                .andWhere('report.period = :period', { period })
                .orderBy('course.name', 'ASC')
                .getMany();
    
            const formattedGrades = grades.map(grade => {
                const assignments = grade.assignmentGrades || [];
                const assignmentAverage = assignments.length > 0 
                    ? assignments.reduce((sum, g) => sum + g, 0) / assignments.length 
                    : 0;
    
                const examGrade = Number(grade.examGrade) || 0;
                const normalizedExamGrade = (examGrade / 40) * 20;
                const finalGrade = (assignmentAverage + normalizedExamGrade) / 2;
    
                return {
                    courseId: grade.courseId,
                    courseName: grade.course?.name || 'Cours inconnu',
                    coefficient: Number(grade.course?.coefficient) || 1,
                    assignments: assignments,
                    exam: examGrade,
                    average: parseFloat(finalGrade.toFixed(2)),
                    appreciation: grade.appreciation || ''
                };
            });
    
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
                error: null
            };
        } catch (error) {
            console.error('Erreur récupération notes:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des notes",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async generateReportCard(data: GenerateReportCardInput): Promise<ResultType<ReportCardData>> {
        try {
            const gradesResult = await this.getStudentGrades(data.studentId, data.period);
            if (!gradesResult.success) {
                throw new Error("Erreur lors de la récupération des notes");
            }

            return {
                success: true,
                data: gradesResult.data,
                message: "Bulletin généré avec succès",
                error: null
            };
        } catch (error) {
            console.error('Erreur génération bulletin:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la génération du bulletin",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async saveStudentGrades(data: SaveStudentGradesInput): Promise<ResultType<ReportCardData>> {
        const queryRunner = AppDataSource.getInstance().createQueryRunner();
        
        try {
            await queryRunner.connect();
            await queryRunner.startTransaction();

            await queryRunner.manager.delete(ReportCardEntity, {
                studentId: data.studentId,
                period: data.period
            });

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

            await queryRunner.manager.save(ReportCardEntity, reportsToSave);
            
            const verificationResult = await this.getStudentGrades(data.studentId, data.period);
            
            if (!verificationResult.success || !verificationResult.data?.grades?.length) {
                throw new Error("La sauvegarde n'a pas pu être vérifiée");
            }

            await queryRunner.commitTransaction();
            
            return {
                success: true,
                data: verificationResult.data,
                message: "Notes enregistrées avec succès",
                error: null
            };

        } catch (error) {
            if (queryRunner.isTransactionActive) {
                await queryRunner.rollbackTransaction();
            }
            
            return {
                success: false,
                data: null,
                message: "Erreur lors de la sauvegarde des notes",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
            
        } finally {
            await queryRunner.release();
        }
    }
} 