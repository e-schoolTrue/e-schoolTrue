import { Between, Repository, Not, IsNull, DeepPartial } from 'typeorm';
import { logger } from "../utils/logger";
import { AbsenceEntity } from '../entities/absence';
import { AppDataSource } from '../../data-source';
import { StudentEntity } from '../entities/students';
import { GradeEntity } from '../entities/grade';
import { FileService } from "./fileService";
import { CourseEntity } from '../entities/course';
import { ProfessorEntity } from '../entities/professor';

export type ProfessorAbsenceBatchItem = {
    professorId: number;
    date: string;
    timeSlot: string;
    gradeId?: number | null;
    absenceType?: string;
    reason?: string;
    reasonType?: string;
    justified?: boolean;
};
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
            logger.debug('=== Service - Début addAbsence ===');
            logger.debug('addAbsence called', { hasData: !!absenceData });

            const dataSource = AppDataSource.getInstance();
            const absenceRepo = dataSource.getRepository(AbsenceEntity);
            const studentRepo = dataSource.getRepository(StudentEntity);
            const gradeRepo = dataSource.getRepository(GradeEntity);

            // Vérifier que l'étudiant existe
            const student = await studentRepo.findOne({
                where: { id: absenceData.studentId },
                relations: ['grade']
            });
            logger.debug('Étudiant trouvé', { id: student?.id });

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

            logger.debug('Nouvelle absence à sauvegarder', { date: newAbsence.date });
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

            logger.debug('Absence sauvegardée', { id: completeAbsence?.id });

            return {
                success: true,
                data: completeAbsence ? this.mapToIAbsenceData(completeAbsence) : null,
                message: "Absence ajoutée avec succès",
                error: null
            };
        } catch (error) {
            logger.error("Erreur détaillée dans addAbsence:", error);
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

    /**
     * Calcule le nombre total d'absences pour un élève
     * @param studentId - L'identifiant de l'élève
     * @returns Le nombre total d'absences
     */
    async getTotalAbsencesByStudent(studentId: number): Promise<number> {
        const count = await this.absenceRepository.count({
            where: { 
                student: { id: studentId },
                type: 'STUDENT'
            }
        });
        return count;
    }

    /**
     * Calcule le nombre d'heures d'absence en fonction du type
     * @param absence - L'entité absence
     * @returns Le nombre d'heures d'absence
     */
    private calculateAbsenceHours(absence: AbsenceEntity): number {
        switch (absence.absenceType) {
            case 'FULL_DAY':
                return 8; // Journée complète = 8 heures
            case 'MORNING':
            case 'AFTERNOON':
                return 4; // Demi-journée = 4 heures
            case 'COURSE':
                // Calculer les heures à partir de startTime et endTime
                if (absence.startTime && absence.endTime) {
                    const start = absence.startTime.split(':');
                    const end = absence.endTime.split(':');
                    const startMinutes = parseInt(start[0]) * 60 + parseInt(start[1]);
                    const endMinutes = parseInt(end[0]) * 60 + parseInt(end[1]);
                    const diffMinutes = endMinutes - startMinutes;
                    return Math.max(1, Math.round(diffMinutes / 60)); // Au minimum 1 heure
                }
                return 1; // Par défaut, 1 heure de cours
            default:
                return 1; // Par défaut
        }
    }

    /**
     * Calcule le total d'absences par élève pour une classe donnée
     * @param gradeId - L'identifiant de la classe (optionnel)
     * @returns Un tableau contenant les totaux d'absences par élève (en heures)
     */
    async getTotalAbsencesGroupedByStudent(gradeId?: number): Promise<{ studentId: number; studentName: string; totalAbsences: number; totalHours: number; justified: number; unjustified: number }[]> {
        try {
            const queryBuilder = this.absenceRepository.createQueryBuilder('absence')
                .leftJoinAndSelect('absence.student', 'student')
                .where('absence.type = :type', { type: 'STUDENT' });

            if (gradeId) {
                queryBuilder.andWhere('absence.gradeId = :gradeId', { gradeId });
            }

            const absences = await queryBuilder.getMany();

            // Grouper les absences par élève
            const groupedData = absences.reduce((acc, absence) => {
                if (!absence.student) return acc;

                const studentId = absence.student.id;
                if (!acc[studentId]) {
                    acc[studentId] = {
                        studentId,
                        studentName: `${absence.student.firstname} ${absence.student.lastname}`,
                        totalAbsences: 0,
                        totalHours: 0,
                        justified: 0,
                        unjustified: 0
                    };
                }

                // Comptage par créneau (1 par absence) et non par heure
                const slots = 1;
                
                acc[studentId].totalAbsences++;
                acc[studentId].totalHours += slots;
                
                if (absence.justified) {
                    acc[studentId].justified += slots;
                } else {
                    acc[studentId].unjustified += slots;
                }

                return acc;
            }, {} as Record<number, { studentId: number; studentName: string; totalAbsences: number; totalHours: number; justified: number; unjustified: number }>);

            // Convertir en tableau et trier par nombre d'heures d'absence décroissant
            return Object.values(groupedData).sort((a, b) => b.totalHours - a.totalHours);
        } catch (error) {
            logger.error("Erreur lors du calcul des totaux d'absences par élève:", error);
            throw error;
        }
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

            logger.debug(`Absences de type ${type} récupérées: ${absences.length}`);
            if (type === 'PROFESSOR' && absences.length > 0) {
                const sample = absences[0];
                logger.debug('Exemple d\'absence professeur:', {
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
            logger.error(`Erreur lors de la récupération des absences de type ${type}:`, error);
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

            const professorAbsenceData = data as IAbsenceData & { gradeId?: number | null; professorId: number };
            const absence = this.absenceRepository.create({
                date: new Date(data.date),
                absenceType: data.absenceType,
                startTime: data.startTime,
                endTime: data.endTime,
                reason: data.reason,
                reasonType: data.reasonType,
                justified: data.justified,
                professor: { id: data.professorId } as ProfessorEntity,
                ...(Number.isFinite(professorAbsenceData.gradeId) && (professorAbsenceData.gradeId as number) > 0 ? { grade: { id: Number(professorAbsenceData.gradeId) } as GradeEntity } : {}),
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

    async createProfessorAbsencesBatch(absencesData: ProfessorAbsenceBatchItem[]): Promise<IAbsenceServiceResponse> {
        try {
            const parseHM = (raw: string): { h: string; m: string } => {
                const part = String(raw).trim();
                if (part.includes(':')) {
                    const [h, m] = part.split(':');
                    return { h: h.trim(), m: (m ?? '00').trim() };
                }
                if (part.includes('.')) {
                    const f = parseFloat(part);
                    if (!isNaN(f)) {
                        const h = Math.floor(f);
                        const m = Math.round((f - h) * 60);
                        return { h: String(h), m: String(m).padStart(2, '0') };
                    }
                }
                return { h: part, m: '00' };
            };
            const absencesToSave = absencesData.map((data: ProfessorAbsenceBatchItem) => {
                const [startRaw, endRaw] = String(data.timeSlot).split('-');
                const { h: sh, m: sm } = parseHM(startRaw ?? '');
                const { h: eh, m: em } = parseHM(endRaw ?? '');
                const startTime = `${sh.padStart(2, '0')}:${sm.padStart(2, '0')}:00`;
                const endTime = `${eh.padStart(2, '0')}:${em.padStart(2, '0')}:00`;

                return this.absenceRepository.create({
                    date: new Date(data.date),
                    absenceType: data.absenceType,
                    startTime: startTime,
                    endTime: endTime,
                    reason: data.reason,
                    justified: data.justified,
                    reasonType: data.reasonType,
                    professor: { id: data.professorId } as ProfessorEntity,
                    ...(Number.isFinite(data.gradeId) && (data.gradeId as number) > 0 ? { grade: { id: Number(data.gradeId) } as GradeEntity } : {}),
                    type: 'PROFESSOR'
                } as DeepPartial<AbsenceEntity>);
            });

            const savedAbsences = await this.absenceRepository.save(absencesToSave);

            return {
                success: true,
                data: savedAbsences.map(absence => this.mapToIAbsenceData(absence)),
                message: "Absences enregistrées avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de l'enregistrement des absences",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }
}