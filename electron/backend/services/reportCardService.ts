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
import { GradeConfigEntity } from "#electron/backend/entities/gradeConfig";
import { FormulaEvaluator } from "#electron/backend/utils/formula-evaluator";
import { StudentEntity } from "#electron/backend/entities/students";
import * as handlebars from 'handlebars';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app, BrowserWindow } from "electron";
import { SchoolService } from "./schoolService";
import { YearRepartitionService } from "./yearService";
import { FileService } from "./fileService";

export class ReportCardService {
    private reportRepository: Repository<ReportCardEntity>;
    private gradeConfigRepository: Repository<GradeConfigEntity>;
    private studentRepository: Repository<StudentEntity>;
    private schoolService: SchoolService;
    private yearService: YearRepartitionService;
    private fileService: FileService;

    constructor() {
        this.reportRepository = AppDataSource.getInstance().getRepository(ReportCardEntity);
        this.gradeConfigRepository = AppDataSource.getInstance().getRepository(GradeConfigEntity);
        this.studentRepository = AppDataSource.getInstance().getRepository(StudentEntity);
        this.schoolService = new SchoolService();
        this.yearService = new YearRepartitionService();
        this.fileService = new FileService();
    }

    private async getSchoolLogo(): Promise<string | null> {
        try {
            const schoolResult = await this.schoolService.getSchool();
            if (schoolResult.success && schoolResult.data?.logo) {
                const logoData = schoolResult.data.logo;
                if (logoData.id) {
                    const logoFile = await this.fileService.getFileById({ fileId: logoData.id });
                    if (logoFile && logoFile.content) {
                        const base64 = logoFile.content.toString('base64');
                        return `data:${logoFile.type};base64,${base64}`;
                    }
                }
            }
        } catch (error) {
            console.error('Erreur récupération logo école:', error);
        }
        return null;
    }

    private async getStudentPhoto(studentId: number): Promise<string | null> {
        try {
            const student = await this.studentRepository.findOne({ 
                where: { id: studentId }, 
                relations: ['photo'] 
            });
            if (student?.photoId) {
                const photoFile = await this.fileService.getFileById({ fileId: student.photoId });
                if (photoFile && photoFile.content) {
                    const base64 = photoFile.content.toString('base64');
                    return `data:${photoFile.type};base64,${base64}`;
                }
            }
        } catch (error) {
            console.error('Erreur récupération photo étudiant:', error);
        }
        return null;
    }

    async generateReportCards(data: GenerateReportCardsInput): Promise<ResultType<any>> {
        try {
            const templatePath = path.join(app.getAppPath(), 'dist-electron', 'templates', 'report-card.html');
            const templateHtml = await fs.readFile(templatePath, 'utf-8');
            
            // Register Handlebars helpers
            handlebars.registerHelper('lt', function(a, b) {
                return a < b;
            });
            
            const template = handlebars.compile(templateHtml);

            const schoolInfo = await this.schoolService.getSchool();
            const currentYear = await this.yearService.getCurrentYearRepartition();
            const schoolLogo = await this.getSchoolLogo();

            for (const studentId of data.studentIds) {
                const student = await this.studentRepository.findOne({ where: { id: studentId }, relations: ['grade', 'photo'] });
                if (!student) continue;

                const gradesResult = await this.getStudentGrades(studentId, data.period);
                if (!gradesResult.success || !gradesResult.data) continue;

                const studentPhoto = await this.getStudentPhoto(studentId);

                const reportData = {
                    schoolName: schoolInfo.data?.name || 'Mon École',
                    schoolAddress: schoolInfo.data?.address || '',
                    schoolPhone: schoolInfo.data?.phone || '',
                    schoolYear: currentYear.data?.schoolYear || '2024-2025',
                    period: data.period,
                    studentName: `${student.firstname} ${student.lastname}`,
                    studentMatricule: student.matricule || '',
                    gradeName: student.grade.name,
                    grades: gradesResult.data.grades,
                    generalAverage: gradesResult.data.generalAverage,
                    schoolLogo: schoolLogo,
                    studentPhoto: studentPhoto
                };

                const htmlContent = template(reportData);
                const pdfBuffer = await global.pdfService.generatePdf(htmlContent);

                const tempDir = app.getPath('temp');
                const pdfPath = path.join(tempDir, `bulletin-${student.firstname}-${data.period}.pdf`);
                await fs.writeFile(pdfPath, pdfBuffer);

                const win = new BrowserWindow({ show: false });
                await win.loadFile(pdfPath);
                win.webContents.print({ silent: false, printBackground: true }, (success, errorType) => {
                    if (!success) console.log(errorType);
                    win.close();
                });
            }

            return {
                success: true,
                message: "Bulletins générés avec succès",
                data: null,
                error: null
            };
        } catch (error) {
            console.error('Error generating report cards:', error);
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
            const student = await this.studentRepository.findOne({ where: { id: studentId }, relations: ['grade'] });
            if (!student) {
                throw new Error('Student not found');
            }

            const gradeConfig = await this.gradeConfigRepository.findOne({ where: { grade: { id: student.grade.id } } });

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
                let finalGrade: number;

                if (gradeConfig?.formula) {
                    finalGrade = FormulaEvaluator.evaluate(gradeConfig.formula, {
                        assignments: assignmentAverage,
                        exam: examGrade
                    });
                } else if (gradeConfig) {
                    const assignmentWeight = gradeConfig.assignmentWeight;
                    const examWeight = gradeConfig.examWeight;
                    finalGrade = (assignmentAverage * assignmentWeight) + (examGrade * examWeight);
                }
                else {
                    // Fallback to old logic, assuming exam is /20
                    finalGrade = (assignmentAverage + examGrade) / 2;
                }
    
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

            for (const gradeData of data.grades) {
                let report = await queryRunner.manager.findOne(ReportCardEntity, {
                    where: {
                        studentId: data.studentId,
                        period: data.period,
                        courseId: gradeData.courseId
                    }
                });
    
                if (report) {
                    // Update existing report
                    report.assignmentGrades = gradeData.assignments;
                    report.examGrade = gradeData.exam;
                    report.finalGrade = gradeData.average;
                    report.appreciation = gradeData.appreciation;
                } else {
                    // Create new report
                    report = new ReportCardEntity();
                    report.studentId = data.studentId;
                    report.courseId = gradeData.courseId;
                    report.period = data.period;
                    report.assignmentGrades = gradeData.assignments;
                    report.examGrade = gradeData.exam;
                    report.finalGrade = gradeData.average;
                    report.appreciation = gradeData.appreciation;
                }
                await queryRunner.manager.save(report);
            }
    
            const verificationResult = await this.getStudentGrades(data.studentId, data.period);
            
            if (!verificationResult.success) {
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