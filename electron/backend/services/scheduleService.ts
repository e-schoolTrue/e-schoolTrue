import { Repository } from "typeorm";
import { logger } from "../utils/logger";
import { ScheduleEntity } from "#electron/backend/entities/schedule";
import { ProfessorEntity } from "#electron/backend/entities/professor";
import { GradeEntity } from "#electron/backend/entities/grade";
import { CourseEntity } from "#electron/backend/entities/course";
import { AppDataSource } from "#electron/data-source";
import { messages } from "#electron/messages";
import { ScheduleCommand } from "#electron/command/scheduleCommand";
import { IScheduleServiceResponse, IScheduleData } from "#electron/backend/types/schedule";
import { TeachingAssignmentEntity } from "#electron/backend/entities/teaching";

export class ScheduleService {
    private scheduleRepository: Repository<ScheduleEntity>;
    private professorRepository: Repository<ProfessorEntity>;
    private gradeRepository: Repository<GradeEntity>;
    private courseRepository: Repository<CourseEntity>;

    constructor() {
        this.scheduleRepository = AppDataSource.getInstance().getRepository(ScheduleEntity);
        this.professorRepository = AppDataSource.getInstance().getRepository(ProfessorEntity);
        this.gradeRepository = AppDataSource.getInstance().getRepository(GradeEntity);
        this.courseRepository = AppDataSource.getInstance().getRepository(CourseEntity);
    }

    /**
     * Créer un nouveau créneau dans l'emploi du temps
     */
    async createSchedule(command: ScheduleCommand): Promise<IScheduleServiceResponse> {
        try {
            // Validation des champs requis pour le secondaire
            if (!command.professorId || !command.classId || !command.day || !command.timeSlot) {
                return {
                    success: false,
                    message: "Le professeur, la classe, le jour et le créneau horaire sont requis",
                    data: null,
                    error: "Missing required fields"
                };
            }

            // Vérification spécifique selon le type d'école
            const classEntity = await this.gradeRepository.findOne({
                where: { id: command.classId }
            });

            if (!classEntity) {
                return {
                    success: false,
                    message: "Classe introuvable",
                    data: null,
                    error: "Class not found"
                };
            }

            // Pour le secondaire, le courseId est requis
            // Pour le primaire, le teachingId est requis
            if (classEntity.type === 'SECONDARY' && !command.courseId) {
                return {
                    success: false,
                    message: "La matière est requise pour l'école secondaire",
                    data: null,
                    error: "Course ID required for secondary school"
                };
            }

            if (classEntity.type === 'PRIMARY' && !command.teachingId) {
                return {
                    success: false,
                    message: "L'ID d'enseignement est requis pour l'école primaire",
                    data: null,
                    error: "Teaching ID required for primary school"
                };
            }

            // Vérifier que le professeur existe
            const professor = await this.professorRepository.findOne({
                where: { id: command.professorId },
                relations: ['teaching', 'teaching.course', 'teaching.class', 'teaching.grades']
            });

            if (!professor) {
                return {
                    success: false,
                    message: "Professeur introuvable",
                    data: null,
                    error: "Professor not found"
                };
            }

            // Vérifier que la matière existe (uniquement pour le secondaire)
            if (classEntity.type === 'SECONDARY' && command.courseId) {
                const course = await this.courseRepository.findOne({
                    where: { id: command.courseId }
                });

                if (!course) {
                    return {
                        success: false,
                        message: "Matière introuvable",
                        data: null,
                        error: "Course not found"
                    };
                }
            }

            // Vérifier que le professeur enseigne bien cette matière dans cette classe (triple-check: class, gradeIds CSV/array, grades M2M) with Number.isFinite guards
            if (classEntity.type === 'SECONDARY') {
                const courseIdNum = Number(command.courseId);
                const classIdNum = Number(command.classId);
                if (!Number.isFinite(courseIdNum) || courseIdNum <= 0 || !Number.isFinite(classIdNum) || classIdNum <= 0) {
                    return {
                        success: false,
                        message: "IDs invalides pour la vérification d'enseignement",
                        data: null,
                        error: "Invalid IDs"
                    };
                }
                const teachingMatch = professor.teaching.find((t: TeachingAssignmentEntity) => {
                    const tCourseId = t.course ? Number(t.course.id) : NaN;
                    if (!Number.isFinite(tCourseId) || tCourseId !== courseIdNum) return false;
                    if (t.class && Number.isFinite(Number(t.class.id)) && Number(t.class.id) === classIdNum) return true;
                    const rawGradeIds: any = (t as any).gradeIds;
                    // Skip empty array or empty string
                    if (rawGradeIds != null && !(typeof rawGradeIds === 'string' && rawGradeIds.trim() === '') && !(Array.isArray(rawGradeIds) && rawGradeIds.length === 0)) {
                        const ids: number[] = Array.isArray(rawGradeIds)
                            ? rawGradeIds.map((n: any) => Number(n)).filter((n: number) => Number.isFinite(n) && n > 0)
                            : String(rawGradeIds).split(',').map((s: string) => Number(s.trim())).filter((n: number) => Number.isFinite(n) && n > 0);
                        if (ids.includes(classIdNum)) return true;
                    }
                    const gradesArr: GradeEntity[] | undefined = t.grades;
                    if (gradesArr && gradesArr.length > 0) {
                        if (gradesArr.some((g: GradeEntity) => Number.isFinite(Number(g.id)) && Number(g.id) === classIdNum)) return true;
                    }
                    return false;
                });

                if (!teachingMatch) {
                    return {
                        success: false,
                        message: "Ce professeur n'enseigne pas cette matière dans cette classe",
                        data: null,
                        error: "Professor does not teach this course in this class"
                    };
                }
            } else if (classEntity.type === 'PRIMARY') {
                const teachingMatch = professor.teaching.find((t: TeachingAssignmentEntity) => 
                    t.class?.id === command.classId
                );

                if (!teachingMatch) {
                    return {
                        success: false,
                        message: "Ce professeur n'est pas assigné à cette classe",
                        data: null,
                        error: "Professor is not assigned to this class"
                    };
                }
            }

            // Vérifier les conflits horaires (même professeur, même jour, même heure, classe différente)
            const existingSchedule = await this.scheduleRepository.findOne({
                where: {
                    professorId: command.professorId,
                    day: command.day,
                    timeSlot: command.timeSlot
                },
                relations: ['class']
            });

            if (existingSchedule && existingSchedule.classId !== command.classId) {
                return {
                    success: false,
                    message: `Conflit détecté : ${professor.civility} ${professor.firstname} ${professor.lastname} enseigne déjà à cette heure dans la classe ${existingSchedule.class.name}`,
                    data: null,
                    error: "Schedule conflict detected"
                };
            }

            // Vérifier s'il y a déjà un cours dans ce créneau pour cette classe
            const existingClassSchedule = await this.scheduleRepository.findOne({
                where: {
                    classId: command.classId,
                    day: command.day,
                    timeSlot: command.timeSlot
                }
            });

            // Si un cours existe déjà pour cette classe à ce créneau, le remplacer
            if (existingClassSchedule) {
                existingClassSchedule.professorId = command.professorId;
                existingClassSchedule.courseId = command.courseId;
                existingClassSchedule.updatedAt = new Date();
                
                const savedSchedule = await this.scheduleRepository.save(existingClassSchedule);
                
                return {
                    success: true,
                    message: messages.schedule_update_successfully || "Emploi du temps mis à jour avec succès",
                    data: savedSchedule,
                    error: null
                };
            } else {
                // Créer un nouveau créneau
                const newSchedule = new ScheduleEntity();
                newSchedule.professorId = command.professorId;
                newSchedule.courseId = classEntity.type === 'SECONDARY' ? command.courseId! : null;
                newSchedule.classId = command.classId;
                newSchedule.day = command.day;
                newSchedule.timeSlot = command.timeSlot;
                newSchedule.createdAt = new Date();
                newSchedule.updatedAt = new Date();

                const savedSchedule = await this.scheduleRepository.save(newSchedule);

                return {
                    success: true,
                    message: messages.schedule_save_successfully || "Emploi du temps créé avec succès",
                    data: savedSchedule,
                    error: null
                };
            }

        } catch (e: any) {
            logger.error('Error in createSchedule:', e);
            return {
                success: false,
                message: messages.schedule_save_failed || "Erreur lors de la sauvegarde de l'emploi du temps",
                data: null,
                error: e.message
            };
        }
    }

    /**
     * Mapper une ScheduleEntity vers IScheduleData
     */
    private mapEntityToData(entity: ScheduleEntity): IScheduleData {
        return {
            id: entity.id,
            professorId: entity.professorId,
            courseId: entity.courseId,
            classId: entity.classId,
            day: entity.day,
            timeSlot: entity.timeSlot,
            createdAt: entity.createdAt,
            updatedAt: entity.updatedAt,
            professor: entity.professor ? {
                id: entity.professor.id!,
                firstname: entity.professor.firstname,
                lastname: entity.professor.lastname,
                civility: entity.professor.civility,
                color: (entity.professor as any).color || null,
                qualification: entity.professor.qualification ? {
                    id: entity.professor.qualification.id!,
                    name: entity.professor.qualification.name
                } : undefined,
                photo: entity.professor.photo ? {
                    id: entity.professor.photo.id!,
                    name: entity.professor.photo.name,
                    type: entity.professor.photo.type
                } : undefined
            } : undefined,
            course: entity.course ? {
                id: entity.course.id!,
                name: entity.course.name
            } : undefined,
            class: entity.class ? {
                id: entity.class.id!,
                name: entity.class.name
            } : undefined
        };
    }

    /**
     * Récupérer tous les emplois du temps
     */
    async getAllSchedules(): Promise<IScheduleServiceResponse> {
        try {
            const schedules = await this.scheduleRepository.find({
                relations: [
                    'professor',
                    'professor.qualification',
                    'professor.photo',
                    'course',
                    'class'
                ],
                order: {
                    day: 'ASC',
                    timeSlot: 'ASC'
                }
            });

            const mappedSchedules: IScheduleData[] = schedules.map(schedule => this.mapEntityToData(schedule));

            return {
                success: true,
                message: "Emplois du temps récupérés avec succès",
                data: mappedSchedules,
                error: null
            };
        } catch (e: any) {
            logger.error('Error in getAllSchedules:', e);
            return {
                success: false,
                message: messages.schedule_retrieve_failed || "Erreur lors de la récupération des emplois du temps",
                data: null,
                error: e.message
            };
        }
    }

    /**
     * Récupérer l'emploi du temps par classe
     */
    async getScheduleByClass(classId: number): Promise<IScheduleServiceResponse> {
        try {
            const schedules = await this.scheduleRepository.find({
                where: { classId },
                relations: [
                    'professor',
                    'professor.qualification',
                    'professor.photo',
                    'course',
                    'class'
                ],
                order: {
                    day: 'ASC',
                    timeSlot: 'ASC'
                }
            });

            const mappedSchedules: IScheduleData[] = schedules.map(schedule => this.mapEntityToData(schedule));

            return {
                success: true,
                message: "Emploi du temps de la classe récupéré avec succès",
                data: mappedSchedules,
                error: null
            };
        } catch (e: any) {
            logger.error('Error in getScheduleByClass:', e);
            return {
                success: false,
                message: "Erreur lors de la récupération de l'emploi du temps de la classe",
                data: null,
                error: e.message
            };
        }
    }

    /**
     * Récupérer l'emploi du temps par professeur
     */
    async getScheduleByProfessor(professorId: number): Promise<IScheduleServiceResponse> {
        try {
            const schedules = await this.scheduleRepository.find({
                where: { professorId },
                relations: [
                    'professor',
                    'professor.qualification',
                    'professor.photo',
                    'course',
                    'class'
                ],
                order: {
                    day: 'ASC',
                    timeSlot: 'ASC'
                }
            });

            const mappedSchedules: IScheduleData[] = schedules.map(schedule => this.mapEntityToData(schedule));

            return {
                success: true,
                message: "Emploi du temps du professeur récupéré avec succès",
                data: mappedSchedules,
                error: null
            };
        } catch (e: any) {
            logger.error('Error in getScheduleByProfessor:', e);
            return {
                success: false,
                message: "Erreur lors de la récupération de l'emploi du temps du professeur",
                data: null,
                error: e.message
            };
        }
    }

    /**
     * Supprimer un créneau de l'emploi du temps
     */
    async deleteSchedule(scheduleId: number): Promise<IScheduleServiceResponse> {
        try {
            const schedule = await this.scheduleRepository.findOne({
                where: { id: scheduleId }
            });

            if (!schedule) {
                return {
                    success: false,
                    message: "Créneau introuvable",
                    data: null,
                    error: "Schedule not found"
                };
            }

            await this.scheduleRepository.remove(schedule);

            return {
                success: true,
                message: messages.schedule_delete_successfully || "Créneau supprimé avec succès",
                data: { id: scheduleId },
                error: null
            };
        } catch (e: any) {
            logger.error('Error in deleteSchedule:', e);
            return {
                success: false,
                message: messages.schedule_delete_failed || "Erreur lors de la suppression du créneau",
                data: null,
                error: e.message
            };
        }
    }

    /**
     * Mettre à jour un créneau de l'emploi du temps
     */
    async updateSchedule(scheduleId: number, command: Partial<ScheduleCommand>): Promise<IScheduleServiceResponse> {
        try {
            const schedule = await this.scheduleRepository.findOne({
                where: { id: scheduleId }
            });

            if (!schedule) {
                return {
                    success: false,
                    message: "Créneau introuvable",
                    data: null,
                    error: "Schedule not found"
                };
            }

            // Mettre à jour les champs fournis
            if (command.professorId !== undefined) schedule.professorId = command.professorId;
            if (command.courseId !== undefined) schedule.courseId = command.courseId;
            if (command.classId !== undefined) schedule.classId = command.classId;
            if (command.day !== undefined) schedule.day = command.day;
            if (command.timeSlot !== undefined) schedule.timeSlot = command.timeSlot;
            schedule.updatedAt = new Date();

            // Vérifier les conflits si les informations critiques ont changé
            if (command.professorId || command.day || command.timeSlot) {
                const existingSchedule = await this.scheduleRepository.findOne({
                    where: {
                        professorId: schedule.professorId,
                        day: schedule.day,
                        timeSlot: schedule.timeSlot
                    }
                });

                if (existingSchedule && existingSchedule.id !== scheduleId && existingSchedule.classId !== schedule.classId) {
                    return {
                        success: false,
                        message: "Conflit détecté : ce professeur enseigne déjà à cette heure dans une autre classe",
                        data: null,
                        error: "Schedule conflict detected"
                    };
                }
            }

            const updatedSchedule = await this.scheduleRepository.save(schedule);

            return {
                success: true,
                message: messages.schedule_update_successfully || "Créneau mis à jour avec succès",
                data: updatedSchedule,
                error: null
            };
        } catch (e: any) {
            logger.error('Error in updateSchedule:', e);
            return {
                success: false,
                message: messages.schedule_update_failed || "Erreur lors de la mise à jour du créneau",
                data: null,
                error: e.message
            };
        }
    }

    /**
     * Vérifier les conflits pour un créneau donné
     */
    async checkConflicts(professorId: number, day: string, timeSlot: string, excludeScheduleId?: number): Promise<{
        hasConflict: boolean;
        conflictDetails?: any;
    }> {
        try {
            const query = this.scheduleRepository.createQueryBuilder('schedule')
                .leftJoinAndSelect('schedule.class', 'class')
                .leftJoinAndSelect('schedule.professor', 'professor')
                .leftJoinAndSelect('schedule.course', 'course')
                .where('schedule.professorId = :professorId', { professorId })
                .andWhere('schedule.day = :day', { day })
                .andWhere('schedule.timeSlot = :timeSlot', { timeSlot });

            if (excludeScheduleId) {
                query.andWhere('schedule.id != :excludeScheduleId', { excludeScheduleId });
            }

            const conflictingSchedule = await query.getOne();

            return {
                hasConflict: !!conflictingSchedule,
                conflictDetails: conflictingSchedule
            };
        } catch (e: any) {
            logger.error('Error in checkConflicts:', e);
            return {
                hasConflict: false
            };
        }
    }

    /**
     * Récupérer l'emploi du temps pour une date donnée
     */
   // dans votre classe ScheduleService

/**
 * Récupérer l'emploi du temps pour une date donnée
 */

async getScheduleByDate(date: string): Promise<IScheduleServiceResponse> {
    try {
        // --- LOG 1 : VÉRIFIER LA DONNÉE D'ENTRÉE ---
        logger.debug(`[BACKEND - getScheduleByDate] Appel reçu avec la date : "${date}"`);

        // Utiliser la version corrigée pour éviter les problèmes de fuseau horaire
        const [year, month, day] = date.split('-').map(Number);
        const safeDate = new Date(year, month - 1, day);

        const dayNames = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
        const dayIndex = safeDate.getDay();
        const dayName = dayNames[dayIndex];

        // --- LOG 2 : VÉRIFIER LE JOUR CALCULÉ ---
        logger.debug(`[BACKEND - getScheduleByDate] Jour de la semaine calculé pour la requête : "${dayName}"`);

        const schedules = await this.scheduleRepository.find({
            where: { day: dayName }, // Le filtre critique
            relations: [
                'professor',
                'course',
                'class'
            ]
        });

        // --- LOG 3 : VÉRIFIER LE RÉSULTAT DE LA REQUÊTE ---
        logger.debug(`[BACKEND - getScheduleByDate] Requête SQL équivalente : SELECT * FROM schedule WHERE day = '${dayName}'`);
        logger.debug(`[BACKEND - getScheduleByDate] Nombre de résultats trouvés dans la BDD : ${schedules.length}`);

        // Le reste de la fonction...
        const mappedSchedules = schedules.map(schedule => this.mapEntityToData(schedule));
        return {
            success: true,
            message: "Emplois du temps récupérés avec succès",
            data: mappedSchedules,
            error: null
        };

    } catch (e: any) {
        // --- LOG 4 : CAPTURER LES ERREURS ---
        logger.error('[BACKEND - getScheduleByDate] Une erreur est survenue :', e);
        return {
            success: false,
            message: "Erreur lors de la récupération des emplois du temps",
            data: null,
            error: e.message
        };
    }
}
}