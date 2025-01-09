import { Repository } from "typeorm";
import { ReportCardEntity } from "../entities/report";
import { AppDataSource } from "../../data-source";
import { ResultType } from "#electron/command";


interface Grade {
    average: number;
    coefficient: number;
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
    }): Promise<ResultType> {
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

    async getStudentGrades(studentId: number, period: string): Promise<ResultType> {
        try {
            const grades = await this.reportRepository.find({
                where: {
                    studentId: studentId,
                    period: period
                },
                relations: ['course'],
                order: {
                    courseId: 'ASC'
                }
            });

            const formattedGrades = grades.map(grade => ({
                courseId: grade.courseId,
                courseName: grade.course.name,
                coefficient: grade.course.coefficient,
                assignments: grade.assignmentGrades,
                exam: grade.examGrade,
                average: grade.finalGrade,
                appreciation: grade.appreciation,
                classAverage: 0 // TODO: Calculer la moyenne de classe
            }));

            return {
                success: true,
                data: formattedGrades,
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

    async generateReportCard(data: {
        studentId: number;
        period: string;
    }): Promise<ResultType> {
        try {
            const gradesResult = await this.getStudentGrades(data.studentId, data.period);
            if (!gradesResult.success) {
                throw new Error("Erreur lors de la récupération des notes");
                }

            // Calculer la moyenne générale
            const grades = gradesResult.data;
            let totalPoints = 0;
            let totalCoef = 0;

            grades.forEach((grade: Grade) => {
                totalPoints += grade.average * grade.coefficient;
                totalCoef += grade.coefficient;
            });

            const generalAverage = totalCoef > 0 ? totalPoints / totalCoef : 0;

            return {
                success: true,
                data: {
                    grades: grades,
                    generalAverage: generalAverage,
                    period: data.period
                },
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
    }): Promise<ResultType> {
        try {
            
            await this.reportRepository.delete({
                studentId: data.studentId,
                period: data.period
            });

            // Sauvegarder les nouvelles notes
            const savedGrades = await Promise.all(data.grades.map(async (grade) => {
                const report = this.reportRepository.create({
                    studentId: data.studentId,
                    courseId: grade.courseId,
                    period: data.period,
                    assignmentGrades: grade.assignments,
                    examGrade: grade.exam,
                    finalGrade: grade.average,
                    appreciation: grade.appreciation
                });
                console.log(report);
                return await this.reportRepository.save(report);
            }));

            return {
                success: true,
                data: savedGrades,
                message: "Notes enregistrées avec succès",
                error: null
            };
        } catch (error) {
            console.error('Erreur sauvegarde notes:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la sauvegarde des notes",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }
} 