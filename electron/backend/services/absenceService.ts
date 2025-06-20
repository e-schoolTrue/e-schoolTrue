import { Between, Repository, Not, IsNull, DeepPartial } from 'typeorm';
import { AbsenceEntity } from '../entities/absence';
import { AppDataSource } from '../../data-source';
import { StudentEntity } from '../entities/students';
import { GradeEntity } from '../entities/grade';
import { FileService } from "./fileService";
import { CourseEntity } from '../entities/course';
import { 
    IAbsenceData, 
    IAbsenceStatistics, 
    IAbsenceServiceParams, 
    IAbsenceServiceResponse 
} from '../types/absence';
import { getCurrentSupabaseUserId } from '../lib/session';

interface FileUpload {
    content: string;
    name: string;
    type: string;
}

export class AbsenceService {
    private absenceRepository: Repository<AbsenceEntity>;
    private fileService: FileService;

    private mapToIAbsenceData(entity: AbsenceEntity): IAbsenceData {
        return {
            ...entity,
            type: entity.type as 'STUDENT' | 'PROFESSOR'
        };
    }

    constructor() {
        this.absenceRepository = AppDataSource.getInstance().getRepository(AbsenceEntity);
        this.fileService = new FileService();
    }

    async addAbsence(absenceData: IAbsenceServiceParams['addAbsence']): Promise<IAbsenceServiceResponse> {
        const UserId = getCurrentSupabaseUserId();
        try {
            console.log('=== Service - Début addAbsence ===');
            console.log('Données reçues:', absenceData);

            const dataSource = AppDataSource.getInstance();
            const absenceRepo = dataSource.getRepository(AbsenceEntity);
            const studentRepo = dataSource.getRepository(StudentEntity);
            const gradeRepo = dataSource.getRepository(GradeEntity);

            // Vérifier que l'étudiant existe
            const student = await studentRepo.findOne({
                where: { id: absenceData.studentId },
                relations: ['grade']
            });
            console.log('Étudiant trouvé:', student);

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

            // Gérer d'abord le document justificatif si présent
            let documentEntity = null;
            if (absenceData.document) {
                const documentData = absenceData.document as unknown as FileUpload;
                const savedDocument = await this.fileService.saveFile({
                    content: documentData.content,
                    name: documentData.name,
                    type: documentData.type
                });
                documentEntity = savedDocument;
            }

            // Créer l'absence avec le document
            const newAbsence = absenceRepo.create({
                date: new Date(absenceData.date),
                reason: absenceData.reason,
                reasonType: absenceData.reasonType,
                absenceType: absenceData.absenceType,
                justified: absenceData.justified || (documentEntity !== null),
                startTime: absenceData.startTime || null,
                endTime: absenceData.endTime || null,
                comments: absenceData.comments || '',
                type: 'STUDENT',
                student: student,
                grade: grade,
                course: absenceData.courseId ? { id: absenceData.courseId } as CourseEntity : undefined,
                parentNotified: false,
                document: documentEntity
            } as DeepPartial<AbsenceEntity>);

            console.log('Nouvelle absence à sauvegarder:', newAbsence);
            const savedAbsence = await absenceRepo.save(newAbsence);

            // Recharger l'absence avec toutes les relations
            const completeAbsence = await absenceRepo.findOne({
                where: { id: savedAbsence.id },
                relations: [
                    'student',
                    'grade',
                    'course',
                    'document'
                ]
            });

            console.log('Absence sauvegardée avec relations:', completeAbsence);

            return {
                success: true,
                data: completeAbsence ? this.mapToIAbsenceData(completeAbsence) : null,
                message: "Absence ajoutée avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur détaillée dans addAbsence:", error);
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

    async getAbsenceStatistics(studentId: number): Promise<IAbsenceStatistics> {
        const absences = await this.getAbsencesByStudent(studentId);
        const justified = absences.filter(a => a.justified).length;

        return {
            total: absences.length,
            justified,
            unjustified: absences.length - justified
        };
    }

    async getRecentAbsences(limit: number = 5): Promise<IAbsenceServiceResponse> {
        try {
            const absences = await this.absenceRepository.find({
                relations: ['student'],
                order: { date: 'DESC' },
                take: limit
            });

            return {
                success: true,
                data: absences.map(absence => this.mapToIAbsenceData(absence)),
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

    async getAllAbsences(type: 'STUDENT' | 'PROFESSOR' = 'STUDENT'): Promise<IAbsenceServiceResponse> {
        try {
            const absences = await this.absenceRepository.createQueryBuilder('absence')
                .leftJoinAndSelect('absence.student', 'student')
                .leftJoinAndSelect('absence.grade', 'grade')
                .leftJoinAndSelect('absence.course', 'course')
                .leftJoinAndSelect('absence.professor', 'professor')
                .leftJoinAndSelect('absence.document', 'document')
                .leftJoinAndSelect('professor.teaching', 'teaching')
                .leftJoinAndSelect('teaching.course', 'teachingCourse')
                .leftJoinAndSelect('teaching.class', 'teachingClass')
                .leftJoinAndSelect('teaching.grades', 'teachingGrades')
                .where('absence.type = :type', { type })
                .orderBy('absence.date', 'DESC')
                .addOrderBy('absence.created_at', 'DESC')
                .getMany();

            console.log(`Absences de type ${type} récupérées: ${absences.length}`);
            if (type === 'PROFESSOR' && absences.length > 0) {
                const sample = absences[0];
                console.log('Exemple d\'absence professeur:', {
                    id: sample.id,
                    professorId: sample.professor?.id,
                    hasTeaching: !!sample.professor?.teaching && sample.professor.teaching.length > 0,
                    teachingCount: sample.professor?.teaching?.length ?? 0,
                    firstTeaching: sample.professor?.teaching?.[0] ? {
                        id: sample.professor.teaching[0].id,
                        hasCourse: !!sample.professor.teaching[0].course,
                        hasClass: !!sample.professor.teaching[0].class,
                        hasGrades: !!sample.professor.teaching[0].grades?.length
                    } : null
                });
            }

            return {
                success: true,
                data: absences.map(absence => this.mapToIAbsenceData(absence)),
                message: `Absences de type ${type} récupérées avec succès (${absences.length} trouvées)`,
                error: null
            };
        } catch (error) {
            console.error(`Erreur lors de la récupération des absences de type ${type}:`, error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des absences",
                error: error instanceof Error ? error.message : "Unknown error"
            };
        }
    }

    async createProfessorAbsence(data: IAbsenceServiceParams['createProfessorAbsence']): Promise<IAbsenceServiceResponse> {
        try {
            let documentEntity = null;

            if (data.document && data.professorId) {
                const savedDocument = await this.fileService.saveFile({
                    content: data.document.content,
                    name: data.document.name,
                    type: data.document.type
                });
                documentEntity = savedDocument;
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
                document: documentEntity || undefined,
                type: 'PROFESSOR'
            } as DeepPartial<AbsenceEntity>);

            const saved = await this.absenceRepository.save(absence);
            const result = await this.absenceRepository.findOne({
                where: { id: saved.id },
                relations: ['professor', 'document']
            });

            return {
                success: true,
                data: result ? this.mapToIAbsenceData(result) : null,
                message: "Absence enregistrée avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de l'enregistrement de l'absence",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async updateProfessorAbsence(data: IAbsenceServiceParams['updateProfessorAbsence']): Promise<IAbsenceServiceResponse> {
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
                startTime: data.startTime,
                endTime: data.endTime,
                reason: data.reason
            });

            if (data.document) {
                const savedDocument = await this.fileService.saveFile({
                    content: data.document.content,
                    name: data.document.name,
                    type: data.document.type
                });
                absence.document = savedDocument;
            }

            const updated = await this.absenceRepository.save(absence);

            return {
                success: true,
                data: this.mapToIAbsenceData(updated),
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

    async getAllProfessorAbsences(): Promise<IAbsenceServiceResponse> {
        try {
            const absences = await this.absenceRepository.find({
                where: { professor: { id: Not(IsNull()) } },
                relations: ['professor', 'professor.teaching', 'document'],
                order: { date: 'DESC' }
            });

            return {
                success: true,
                data: absences.map(absence => this.mapToIAbsenceData(absence)),
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

    async deleteProfessorAbsence(id: number): Promise<IAbsenceServiceResponse> {
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