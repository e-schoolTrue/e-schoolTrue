import { Between, Repository, Not, IsNull } from 'typeorm';
import { AbsenceEntity } from '../entities/absence';
import { AppDataSource } from '../../data-source';
import { ResultType } from '#electron/command';
import { StudentEntity } from '../entities/students';
import { GradeEntity } from '../entities/grade';
import { FileService } from "./fileService";
import { CourseEntity } from '../entities/course';

export class AbsenceService {
    private absenceRepository: Repository<AbsenceEntity>;
    private fileService: FileService;

    constructor() {
        this.absenceRepository = AppDataSource.getInstance().getRepository(AbsenceEntity);
        this.fileService = new FileService();
    }

    async addAbsence(absenceData: any): Promise<ResultType> {
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

            // Créer l'absence avec les relations
            const newAbsence = absenceRepo.create({
                date: new Date(absenceData.date),
                reason: absenceData.reason,
                reasonType: absenceData.reasonType,
                absenceType: absenceData.absenceType,
                justified: absenceData.justified,
                startTime: absenceData.startTime || null,
                endTime: absenceData.endTime || null,
                comments: absenceData.comments || '',
                type: 'STUDENT',
                student: student,
                grade: grade,
                course: absenceData.courseId ? { id: absenceData.courseId } as CourseEntity : undefined,
                parentNotified: false
            });

            console.log('Nouvelle absence à sauvegarder:', newAbsence);
            const savedAbsence = await absenceRepo.save(newAbsence);

            // Recharger l'absence avec toutes les relations
            const completeAbsence = await absenceRepo.findOneBy({
                id: savedAbsence.id
            });

            console.log('Absence sauvegardée avec relations:', completeAbsence);

            return {
                success: true,
                data: completeAbsence,
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

    async getAllAbsences(type: 'STUDENT' | 'PROFESSOR' = 'STUDENT'): Promise<ResultType> {
        try {
            console.log('=== Service - getAllAbsences - Type demandé ===', type);
            
            const queryBuilder = this.absenceRepository.createQueryBuilder('absence')
                .leftJoinAndSelect('absence.student', 'student')
                .leftJoinAndSelect('absence.grade', 'grade')
                .leftJoinAndSelect('absence.course', 'course')
                .leftJoinAndSelect('absence.professor', 'professor')
                .where('absence.type = :type', { type })
                .orderBy('absence.date', 'DESC')
                .addOrderBy('absence.createdAt', 'DESC');

            const absences = await queryBuilder.getMany();

            console.log('=== Service - getAllAbsences - Requête effectuée ===');
            console.log('Query SQL:', queryBuilder.getSql());
            console.log('Paramètres:', queryBuilder.getParameters());
            console.log('Nombre d\'absences trouvées:', absences.length);
            console.log('Types des absences:', absences.map(a => a.type));

            return {
                success: true,
                data: absences,
                message: `Absences de type ${type} récupérées avec succès (${absences.length} trouvées)`,
                error: null
            };
        } catch (error) {
            console.error('=== Service - getAllAbsences - Erreur ===', error);
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
                document: documentEntity || undefined,
                type: 'PROFESSOR'
            });

            console.log('=== Service - createProfessorAbsence - Nouvelle absence ===', absence);
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