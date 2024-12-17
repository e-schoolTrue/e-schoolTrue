import { Repository } from "typeorm";
import { VacationEntity } from "../entities/vacation";
import { AppDataSource } from "../../data-source";
import { ResultType } from "#electron/command";
import { ProfessorEntity } from "../entities/professor";

export class VacationService {
    private vacationRepository: Repository<VacationEntity>;

    constructor() {
        this.vacationRepository = AppDataSource.getInstance().getRepository(VacationEntity);
    }

    async createVacation(data: Partial<VacationEntity>): Promise<ResultType> {
        try {
            console.log("Données reçues:", data); // Debug

            // Vérifier que le professeur existe
            const professor = await this.vacationRepository.manager
                .getRepository(ProfessorEntity)
                .findOne({ where: { id: data.professorId } });

            if (!professor) {
                return {
                    success: false,
                    data: null,
                    message: "Professeur non trouvé",
                    error: "PROFESSOR_NOT_FOUND"
                };
            }

            // Créer l'entité vacation avec le professeur
            const vacation = this.vacationRepository.create({
                ...data,
                professor,
                status: 'pending'
            });

            const saved = await this.vacationRepository.save(vacation);
            console.log("Vacation sauvegardée:", saved); // Debug

            // Récupérer la vacation avec toutes les relations
            const result = await this.vacationRepository.findOne({
                where: { id: saved.id },
                relations: ['professor', 'professor.teaching']
            });

            return {
                success: true,
                data: result,
                message: "Congé créé avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur dans createVacation:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la création du congé",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getVacationsByStudent(studentId: number): Promise<ResultType> {
        try {
            const vacations = await this.vacationRepository.find({
                where: { student: { id: studentId } },
                relations: ['student']
            });

            return {
                success: true,
                data: vacations,
                message: "Congés récupérés avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des congés",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getVacationsByProfessor(professorId?: number): Promise<ResultType> {
        try {
            const query = this.vacationRepository
                .createQueryBuilder('vacation')
                .leftJoinAndSelect('vacation.professor', 'professor')
                .leftJoinAndSelect('professor.teaching', 'teaching')
                .leftJoinAndSelect('teaching.course', 'course')
                .leftJoinAndSelect('teaching.class', 'class')
                .orderBy('vacation.createdAt', 'DESC');

            if (professorId) {
                query.where('professor.id = :professorId', { professorId });
            }

            const vacations = await query.getMany();
            console.log("Vacations récupérées:", vacations); // Debug

            return {
                success: true,
                data: vacations,
                message: "Congés récupérés avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur dans getVacationsByProfessor:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des congés",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async updateVacationStatus(id: number, status: 'approved' | 'rejected', comment?: string): Promise<ResultType> {
        try {
            const vacation = await this.vacationRepository.findOne({
                where: { id }
            });

            if (!vacation) {
                return {
                    success: false,
                    data: null,
                    message: "Congé non trouvé",
                    error: "NOT_FOUND"
                };
            }

            vacation.status = status;
            if (comment) vacation.comment = comment;

            const updated = await this.vacationRepository.save(vacation);

            return {
                success: true,
                data: updated,
                message: "Statut du congé mis à jour avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la mise à jour du statut",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async deleteVacation(id: number): Promise<ResultType> {
        try {
            const result = await this.vacationRepository.delete(id);
            
            if (result.affected === 0) {
                return {
                    success: false,
                    data: null,
                    message: "Congé non trouvé",
                    error: "NOT_FOUND"
                };
            }

            return {
                success: true,
                data: null,
                message: "Congé supprimé avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la suppression",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }
} 