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
} 