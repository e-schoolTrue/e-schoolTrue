import { Repository } from "typeorm";
import { VacationEntity } from "../entities/vacation";
import { AppDataSource } from "../../data-source";
import { ResultType } from "#electron/command";
import { IsNull } from "typeorm";

interface VacationDTO {
  startDate: string;
  endDate: string;
  reason: string;
  studentId?: number;
  professorId?: number;
}

export class VacationService {
    private vacationRepository: Repository<VacationEntity>;

    constructor() {
        this.vacationRepository = AppDataSource.getInstance().getRepository(VacationEntity);
    }

    async createVacation(data: VacationDTO): Promise<ResultType> {
        try {
            console.log("=== Service - createVacation - Données reçues ===", data);

            const vacation = this.vacationRepository.create({
                startDate: data.startDate,
                endDate: data.endDate,
                reason: data.reason,
                status: 'pending',
                student: data.studentId ? { id: data.studentId } : undefined,
                professor: data.professorId ? { id: data.professorId } : undefined
            });

            console.log("=== Service - createVacation - Entité créée ===", vacation);

            const saved = await this.vacationRepository.save(vacation);
            console.log("=== Service - createVacation - Sauvegarde effectuée ===", saved);

            // Récupérer la vacation avec toutes les relations
            const result = await this.vacationRepository.findOne({
                where: { id: saved.id },
                relations: ['student', 'student.grade', 'professor', 'professor.teaching']
            });

            return {
                success: true,
                data: result,
                message: "Congé créé avec succès",
                error: null
            };
        } catch (error) {
            console.error("=== Service - createVacation - Erreur ===", error);
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
                where: { 
                    student: { id: studentId },
                    professor: IsNull()
                },
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
                .where('vacation.student IS NULL') // S'assurer qu'il n'y a pas d'étudiant associé
                .orderBy('vacation.createdAt', 'DESC');

            if (professorId) {
                query.andWhere('professor.id = :professorId', { professorId });
            }

            const vacations = await query.getMany();

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

    async getAllVacations(): Promise<ResultType> {
        try {
            const vacations = await this.vacationRepository.find({
                relations: ['student', 'professor'],
                order: { createdAt: 'DESC' }
            });
            
            return {
                success: true,
                data: vacations,
                message: 'Congés récupérés avec succès',
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: 'Erreur lors de la récupération des congés',
                error: error instanceof Error ? error.message : 'Erreur inconnue'
            };
        }
    }
} 