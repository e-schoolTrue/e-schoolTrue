import { Repository } from "typeorm";
import { HomeworkEntity } from "../entities/homework";
import { AppDataSource } from "../../data-source";
import { ResultType } from "./paymentService";
import { Homework, HomeworkCreateInput, HomeworkUpdateInput } from "../types/homework";

export class HomeworkService {
    private homeworkRepository: Repository<HomeworkEntity>;

    constructor() {
        this.homeworkRepository = AppDataSource.getInstance().getRepository(HomeworkEntity);
    }

    async createHomework(data: HomeworkCreateInput): Promise<ResultType<Homework>> {
        try {
            console.log("Données reçues dans le service:", data);

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
                data: result as unknown as Homework,
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

    async getHomeworkByGrade(gradeId: number): Promise<ResultType<Homework[]>> {
        try {
            const homework = await this.homeworkRepository.find({
                where: { grade: { id: gradeId } },
                relations: ['course', 'professor', 'grade']
            });

            return {
                success: true,
                data: homework as unknown as Homework[],
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

    async deleteHomework(id: number): Promise<ResultType<void>> {
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

    async updateHomework(id: number, data: HomeworkUpdateInput): Promise<ResultType<Homework>> {
        try {
            const existingHomework = await this.homeworkRepository.findOne({
                where: { id }
            });

            if (!existingHomework) {
                return {
                    success: false,
                    data: null,
                    message: "Devoir non trouvé",
                    error: "NOT_FOUND"
                };
            }

            const updatedHomework = this.homeworkRepository.merge(existingHomework, {
                ...data,
                course: data.courseId ? { id: data.courseId } : undefined,
                grade: data.gradeId ? { id: data.gradeId } : undefined,
                professor: data.professorId ? { id: data.professorId } : undefined
            });

            const saved = await this.homeworkRepository.save(updatedHomework);
            const result = await this.homeworkRepository.findOne({
                where: { id: saved.id },
                relations: ['course', 'grade', 'professor']
            });

            return {
                success: true,
                data: result as unknown as Homework,
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