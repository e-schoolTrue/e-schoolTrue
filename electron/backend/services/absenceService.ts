import { Between, Repository, Not, IsNull } from 'typeorm';
import { AbsenceEntity } from '../entities/absence';
import { AppDataSource } from '../../data-source';
import { ResultType } from '#electron/command';
import { StudentEntity } from '../entities/students';
import { GradeEntity } from '../entities/grade';
import { FileService } from "./fileService";

export class AbsenceService {
    private absenceRepository: Repository<AbsenceEntity>;
    private fileService: FileService;

    constructor() {
        this.absenceRepository = AppDataSource.getInstance().getRepository(AbsenceEntity);
        this.fileService = new FileService();
    }

    async addAbsence(absenceData: {
        date: Date | string;
        reason: string;
        reasonType: 'MEDICAL' | 'FAMILY' | 'UNAUTHORIZED' | 'SCHOOL_ACTIVITY' | 'OTHER';
        absenceType: 'FULL_DAY' | 'MORNING' | 'AFTERNOON' | 'COURSE';
        justified: boolean;
        studentId: number;
        gradeId: number;
        startTime?: string | null;
        endTime?: string | null;
        courseId?: number | null;
        comments?: string;
        justificationDocument?: string;
    }): Promise<ResultType> {
        try {
            const dataSource = AppDataSource.getInstance();
            const absenceRepo = dataSource.getRepository(AbsenceEntity);
            const studentRepo = dataSource.getRepository(StudentEntity);
            const gradeRepo = dataSource.getRepository(GradeEntity);

            // Vérification des champs obligatoires
            if (!absenceData.reasonType || !absenceData.absenceType) {
                return {
                    success: false,
                    data: null,
                    message: "Le type de motif et le type d'absence sont requis",
                    error: "Missing required fields"
                };
            }

            // Vérifier que l'étudiant existe
            const student = await studentRepo.findOne({
                where: { id: absenceData.studentId },
                relations: ['grade']
            });

            if (!student) {
                return {
                    success: false,
                    data: null,
                    message: "Étudiant non trouvé",
                    error: "Student not found"
                };
            }

            // Vérifier que la classe existe
            const grade = await gradeRepo.findOne({
                where: { id: absenceData.gradeId }
            });

            if (!grade) {
                return {
                    success: false,
                    data: null,
                    message: "Classe non trouvée",
                    error: "Grade not found"
                };
            }

            // Modifier la création de l'absence
            const newAbsence = new AbsenceEntity();
            Object.assign(newAbsence, {
                date: new Date(absenceData.date),
                reason: absenceData.reason,
                reasonType: absenceData.reasonType,
                absenceType: absenceData.absenceType,
                justified: absenceData.justified,
                studentId: absenceData.studentId,
                gradeId: absenceData.gradeId,
                startTime: absenceData.startTime || null,
                endTime: absenceData.endTime || null,
                courseId: absenceData.courseId || null,
                comments: absenceData.comments || '',
                justificationDocument: absenceData.justificationDocument,
                parentNotified: false
            });

            // Sauvegarder l'absence
            const savedAbsence = await absenceRepo.save(newAbsence);

            return {
                success: true,
                data: savedAbsence,
                message: "Absence ajoutée avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur dans addAbsence:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de l'ajout de l'absence",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async getAbsencesByStudent(studentId: number): Promise<AbsenceEntity[]> {
        return await this.absenceRepository.find({
            where: { student: { id: studentId } },
            relations: ['student'],
            order: {
                date: 'DESC' as const // Explicitly type the order
            }
        });
    }

    async updateAbsenceStatus(absenceId: number, justified: boolean): Promise<AbsenceEntity> {
        const absence = await this.absenceRepository.findOne({
            where: { id: absenceId },
            relations: ['student']
        });

        if (!absence) {
            throw new Error("Absence non trouvée");
        }

        absence.justified = justified;
        return await this.absenceRepository.save(absence);
    }

    async deleteAbsence(absenceId: number): Promise<void> {
        const absence = await this.absenceRepository.findOne({
            where: { id: absenceId }
        });

        if (!absence) {
            throw new Error("Absence non trouvée");
        }

        await this.absenceRepository.remove(absence);
    }

    async getAbsencesByDateRange(startDate: Date, endDate: Date): Promise<AbsenceEntity[]> {
        return await this.absenceRepository.find({
            where: {
                date: Between(startDate, endDate)
            },
            relations: ['student'],
            order: {
                date: 'DESC' as const // Explicitly type the order
            }
        });
    }

    async getAbsenceStatistics(studentId: number): Promise<{
        total: number;
        justified: number;
        unjustified: number;
    }> {
        const absences = await this.getAbsencesByStudent(studentId);
        const justified = absences.filter(a => a.justified).length;

        return {
            total: absences.length,
            justified,
            unjustified: absences.length - justified
        };
    }

    async getRecentAbsences(limit: number = 5): Promise<ResultType> {
        try {
            const absences = await this.absenceRepository.find({
                relations: ['student'],
                order: { date: 'DESC' },
                take: limit
            });

            const formattedAbsences = absences.map(absence => ({
                id: absence.id,
                studentName: absence.student ? `${absence.student.firstname} ${absence.student.lastname}` : 'N/A',
                date: absence.date,
                reason: absence.reason,
                justified: absence.justified
            }));

            return {
                success: true,
                data: formattedAbsences,
                message: "Absences récentes récupérées avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des absences récentes",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async getAllAbsences(): Promise<ResultType> {
        try {
            const absences = await this.absenceRepository.find({
                relations: {
                    student: true,
                    grade: true,
                    course: true
                },
                order: {
                    date: 'DESC',
                    createdAt: 'DESC'
                }
            });

            return {
                success: true,
                data: absences,
                message: "Absences récupérées avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur dans getAllAbsences:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des absences",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async createProfessorAbsence(data: any): Promise<ResultType> {
        try {
            let documentEntity = null;
            
            // Gérer le document si présent
            if (data.document) {
                const savedDocument = await this.fileService.saveDocuments(
                    [data.document],
                    data.professorId
                );
                if (savedDocument.length > 0) {
                    documentEntity = savedDocument[0];
                }
            }

            const absence = this.absenceRepository.create({
                date: new Date(data.date),
                absenceType: data.absenceType,
                startTime: data.startTime,
                endTime: data.endTime,
                reason: data.reason,
                reasonType: data.reasonType,
                justified: data.justified,
                professor: { id: data.professorId },
                document: documentEntity
            });

            const saved = await this.absenceRepository.save(absence);

            // Charger l'absence avec toutes les relations
            const result = await this.absenceRepository.findOne({
                where: { id: saved.id },
                relations: ['professor', 'document']
            });

            return {
                success: true,
                data: result,
                message: "Absence enregistrée avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur détaillée:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de l'enregistrement de l'absence",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async updateProfessorAbsence(data: any): Promise<ResultType> {
        try {
            const absence = await this.absenceRepository.findOne({
                where: { id: data.id },
                relations: ['document']
            });

            if (!absence) {
                return {
                    success: false,
                    data: null,
                    message: "Absence non trouvée",
                    error: "NOT_FOUND"
                };
            }

            // Mise à jour des champs
            Object.assign(absence, {
                startDate: data.startDate,
                endDate: data.endDate,
                reason: data.reason
            });

            // Gérer le nouveau document si présent
            if (data.document) {
                const savedDocument = await this.fileService.saveFile(
                    data.document.content,
                    data.document.name,
                    data.document.type
                );
                absence.document = savedDocument;
            }

            const updated = await this.absenceRepository.save(absence);

            return {
                success: true,
                data: updated,
                message: "Absence mise à jour avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la mise à jour de l'absence",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getAllProfessorAbsences(): Promise<ResultType> {
        try {
            const absences = await this.absenceRepository.find({
                where: { professor: { id: Not(IsNull()) } },
                relations: ['professor', 'professor.teaching', 'document'],
                order: { date: 'DESC' }
            });

            return {
                success: true,
                data: absences,
                message: "Absences récupérées avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des absences",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async deleteProfessorAbsence(id: number): Promise<ResultType> {
        try {
            const result = await this.absenceRepository.delete(id);

            if (result.affected === 0) {
                return {
                    success: false,
                    data: null,
                    message: "Absence non trouvée",
                    error: "NOT_FOUND"
                };
            }

            return {
                success: true,
                data: null,
                message: "Absence supprimée avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la suppression de l'absence",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }
}