import { Repository } from 'typeorm';
import { AppDataSource } from '../../data-source';
import { ReportCardEntity } from '../entities/report';
import { StudentEntity } from '../entities/students';
import { GradeEntity } from '../entities/grade';
import { CourseEntity } from '../entities/course';
import { ResultType } from '#electron/command';
import { FileService } from './fileService';
import * as path from 'path';
import * as fs from 'fs/promises';
import { app } from 'electron';
import puppeteer from 'puppeteer';

export class ReportService {
    private reportRepository: Repository<ReportCardEntity>;
    private studentRepository: Repository<StudentEntity>;
    private gradeRepository: Repository<GradeEntity>;
    private courseRepository: Repository<CourseEntity>;
    private fileService: FileService;

    constructor() {
        this.reportRepository = AppDataSource.getInstance().getRepository(ReportCardEntity);
        this.studentRepository = AppDataSource.getInstance().getRepository(StudentEntity);
        this.gradeRepository = AppDataSource.getInstance().getRepository(GradeEntity);
        this.courseRepository = AppDataSource.getInstance().getRepository(CourseEntity);
        this.fileService = new FileService();
    }

    async createReport(data: any): Promise<ResultType> {
        try {
            const report = this.reportRepository.create(data);
            await this.reportRepository.save(report);

            return {
                success: true,
                data: report,
                message: "Bulletin créé avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la création du bulletin",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getReportsByStudent(studentId: number): Promise<ResultType> {
        try {
            const reports = await this.reportRepository.find({
                where: { student: { id: studentId } },
                relations: ['student', 'grade'],
                order: { createdAt: 'DESC' }
            });

            return {
                success: true,
                data: reports,
                message: "Bulletins récupérés avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des bulletins",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getReportsByGrade(gradeId: number, period: string, schoolYear: string): Promise<ResultType> {
        try {
            const reports = await this.reportRepository.find({
                where: {
                    grade: { id: gradeId },
                    period,
                    schoolYear
                },
                relations: ['student', 'grade'],
                order: { 'student.lastname': 'ASC' }
            });

            return {
                success: true,
                data: reports,
                message: "Bulletins de la classe récupérés avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des bulletins",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async generateReportsForGrade(gradeId: number, period: string, schoolYear: string): Promise<ResultType> {
        try {
            const students = await this.studentRepository.find({
                where: { grade: { id: gradeId } },
                relations: ['grade']
            });

            const courses = await this.courseRepository.find({
                where: { grade: { id: gradeId } }
            });

            const reports = [];
            for (const student of students) {
                const grades = courses.map(course => ({
                    courseId: course.id,
                    courseName: course.name,
                    coefficient: course.coefficient,
                    grade: 0, // Note à remplir
                    appreciation: '' // Appréciation à remplir
                }));

                const report = this.reportRepository.create({
                    student,
                    grade: student.grade,
                    period,
                    schoolYear,
                    grades,
                    average: 0,
                    classAverage: 0,
                    rank: 0,
                    totalStudents: students.length
                });

                reports.push(await this.reportRepository.save(report));
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

    async calculateRanks(gradeId: number, period: string, schoolYear: string): Promise<ResultType> {
        try {
            const reports = await this.reportRepository.find({
                where: {
                    grade: { id: gradeId },
                    period,
                    schoolYear
                },
                order: { average: 'DESC' }
            });

            // Mise à jour des rangs
            for (let i = 0; i < reports.length; i++) {
                reports[i].rank = i + 1;
                await this.reportRepository.save(reports[i]);
            }

            return {
                success: true,
                data: reports,
                message: "Rangs calculés avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors du calcul des rangs",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    // ... autres méthodes utiles (getStudentAverages, getClassStatistics, etc.)

    async generatePDF(reportId: number): Promise<ResultType> {
        try {
            const report = await this.reportRepository.findOne({
                where: { id: reportId },
                relations: ['student', 'grade']
            });

            if (!report) {
                throw new Error("Bulletin non trouvé");
            }

            // Logique de génération de PDF à implémenter
            // Utiliser une bibliothèque comme PDFKit ou html-pdf

            return {
                success: true,
                data: { /* chemin vers le PDF généré */ },
                message: "PDF généré avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la génération du PDF",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async generateMultipleReports(data: {
        studentIds: number[];
        period: string;
        templateId: string;
    }): Promise<ResultType> {
        try {
            const { studentIds, period, templateId } = data;
            
            // Récupérer tous les rapports nécessaires
            const reports = await Promise.all(
                studentIds.map(async (studentId) => {
                    const report = await this.getReportData(studentId, period);
                    return report;
                })
            );

            // Générer le PDF combiné
            const pdfBuffer = await this.generatePDF(reports, templateId);

            // Sauvegarder temporairement le fichier PDF
            const tempFilePath = path.join(app.getPath('temp'), `bulletins_${Date.now()}.pdf`);
            await fs.writeFile(tempFilePath, pdfBuffer);

            return {
                success: true,
                data: tempFilePath,
                message: "Bulletins générés avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur lors de la génération multiple des bulletins:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la génération des bulletins",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    private async getReportData(studentId: number, period: string) {
        // Récupérer les données de l'étudiant
        const student = await this.studentRepository.findOne({
            where: { id: studentId },
            relations: ['grade']
        });

        if (!student) {
            throw new Error(`Étudiant non trouvé: ${studentId}`);
        }

        // Récupérer les notes
        const grades = await this.getGrades(studentId, period);
        
        // Calculer les moyennes et le rang
        const { average, classAverage, rank, totalStudents } = await this.calculateStats(
            studentId,
            student.grade.id,
            period
        );

        return {
            student,
            grades,
            average,
            classAverage,
            rank,
            totalStudents,
            period
        };
    }

    private async generatePDF(reports: any[], templateId: string): Promise<Buffer> {
        // Implémenter la génération du PDF ici
        // Vous pouvez utiliser puppeteer ou une autre bibliothèque pour générer le PDF
        
        // Exemple simple avec puppeteer
        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        
        // Générer le HTML pour chaque rapport
        const html = reports.map(report => {
            // Utiliser le template correspondant pour générer le HTML
            return `<div class="report-page">${/* HTML du rapport */}</div>`;
        }).join('');

        await page.setContent(html);
        const pdfBuffer = await page.pdf({
            format: 'A4',
            printBackground: true,
            margin: {
                top: '20mm',
                right: '20mm',
                bottom: '20mm',
                left: '20mm'
            }
        });

        await browser.close();
        return pdfBuffer;
    }
} 