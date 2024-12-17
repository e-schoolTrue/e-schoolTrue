import { Repository } from "typeorm";
import { HomeworkEntity } from "../entities/homework";
import { AppDataSource } from "../../data-source";
import { ResultType } from "#electron/command";

export class HomeworkService {
    private homeworkRepository: Repository<HomeworkEntity>;

    constructor() {
        this.homeworkRepository = AppDataSource.getInstance().getRepository(HomeworkEntity);
    }

    async createHomework(data: any): Promise<ResultType> {
        try {
            console.log("Données reçues dans le service:", data);

            // Vérification des données requises
            if (!data.gradeId || !data.courseId || !data.professorId || !data.description || !data.dueDate) {
                console.error("Données manquantes:", { 
                    gradeId: !!data.gradeId,
                    courseId: !!data.courseId,
                    professorId: !!data.professorId,
                    description: !!data.description,
                    dueDate: !!data.dueDate
                });
                throw new Error("Données manquantes pour la création du devoir");
            }

            const homework = this.homeworkRepository.create({
                description: data.description,
                dueDate: new Date(data.dueDate),
                course: { id: data.courseId },
                grade: { id: data.gradeId },
                professor: { id: data.professorId }
            });

            console.log("Objet homework créé:", homework);

            const saved = await this.homeworkRepository.save(homework);
            console.log("Devoir sauvegardé:", saved);

            const result = await this.homeworkRepository.findOne({
                where: { id: saved.id },
                relations: ['course', 'grade', 'professor']
            });

            console.log("Résultat final avec relations:", result);

            return {
                success: true,
                data: result,
                message: "Devoir créé avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur détaillée lors de la création du devoir:", error);
            return {
                success: false,
                data: null,
                message: error instanceof Error ? error.message : "Erreur lors de la création du devoir",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getHomeworkByGrade(gradeId: number): Promise<ResultType> {
        try {
            const homework = await this.homeworkRepository.find({
                where: { grade: { id: gradeId } },
                relations: ['course', 'professor', 'grade']
            });

            return {
                success: true,
                data: homework,
                message: "Devoirs récupérés avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des devoirs",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async deleteHomework(id: number): Promise<ResultType> {
        try {
            const result = await this.homeworkRepository.delete(id);
            
            if (result.affected === 0) {
                return {
                    success: false,
                    message: "Devoir non trouvé",
                    error: "NOT_FOUND",
                    data: null
                };
            }

            return {
                success: true,
                message: "Devoir supprimé avec succès",
                error: null,
                data: null
            };
        } catch (error) {
            console.error("Erreur lors de la suppression:", error);
            return {
                success: false,
                message: "Erreur lors de la suppression",
                error: error instanceof Error ? error.message : "Erreur inconnue",
                data: null
            };
        }
    }

    async updateHomework(id: number, data: any): Promise<ResultType> {
        try {
            // Supprimer l'ancien devoir
            await this.homeworkRepository.delete(id);
            
            // Créer le nouveau devoir
            const homework = this.homeworkRepository.create({
                description: data.description,
                dueDate: new Date(data.dueDate),
                course: { id: data.courseId },
                grade: { id: data.gradeId },
                professor: { id: data.professorId }
            });

            const saved = await this.homeworkRepository.save(homework);
            
            const result = await this.homeworkRepository.findOne({
                where: { id: saved.id },
                relations: ['course', 'grade', 'professor']
            });

            return {
                success: true,
                data: result,
                message: "Devoir mis à jour avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur lors de la mise à jour:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la mise à jour",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }
} 