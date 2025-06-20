import { Repository } from "typeorm";
import { VacationEntity } from "../entities/vacation";
import { AppDataSource } from "../../data-source";
import { ResultType } from "./paymentService";
import { IsNull } from "typeorm";
import { 
    Vacation, 
    VacationCreateInput, 
    VacationStatus 
} from "../types/vacation";

export class VacationService {
    private vacationRepository: Repository<VacationEntity>;

    constructor() {
        this.vacationRepository = AppDataSource.getInstance().getRepository(VacationEntity);
    }

    async createVacation(data: VacationCreateInput): Promise<ResultType<Vacation>> {
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

    async getVacationsByStudent(studentId: number): Promise<ResultType<Vacation[]>> {
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

    async getVacationsByProfessor(professorId?: number): Promise<ResultType<Vacation[]>> {
        try {
            const query = this.vacationRepository
                .createQueryBuilder('vacation')
                .leftJoinAndSelect('vacation.professor', 'professor')
                .where('vacation.student IS NULL')
                .orderBy('vacation.created_at', 'DESC');

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

    async updateVacationStatus(id: number, status: VacationStatus, comment?: string): Promise<ResultType<Vacation>> {
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

    async deleteVacation(id: number): Promise<ResultType<void>> {
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

    async getAllVacations(): Promise<ResultType<Vacation[]>> {
        try {
            const vacations = await this.vacationRepository.find({
                relations: ['student', 'professor'],
                order: { created_at: 'DESC' }
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