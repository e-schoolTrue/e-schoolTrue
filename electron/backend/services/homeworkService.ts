import { Repository } from "typeorm";
import { HomeworkEntity } from "../entities/homework";
import { CourseEntity } from "../entities/course";
import { GradeEntity } from "../entities/grade";
import { ProfessorEntity } from "../entities/professor";
import { AppDataSource } from "../../data-source";
import { ResultType } from "./paymentService";
import { Homework, HomeworkCreateInput, HomeworkUpdateInput } from "../types/homework";

export class HomeworkService {
    private homeworkRepository: Repository<HomeworkEntity>;
    private courseRepository: Repository<CourseEntity>;
    private gradeRepository: Repository<GradeEntity>;
    private professorRepository: Repository<ProfessorEntity>;

    constructor() {
        const dataSource = AppDataSource.getInstance();
        this.homeworkRepository = dataSource.getRepository(HomeworkEntity);
        this.courseRepository = dataSource.getRepository(CourseEntity);
        this.gradeRepository = dataSource.getRepository(GradeEntity);
        this.professorRepository = dataSource.getRepository(ProfessorEntity);
    }

    async createHomework(data: HomeworkCreateInput): Promise<ResultType<Homework>> {
        try {
            console.log("Données reçues dans le service:", data);

            // Vérifier que les entités liées existent
            const course = await this.courseRepository.findOne({ where: { id: data.courseId } });
            if (!course) {
                return {
                    success: false,
                    data: null,
                    message: `Cours avec l'ID ${data.courseId} non trouvé`,
                    error: "COURSE_NOT_FOUND"
                };
            }

            const grade = await this.gradeRepository.findOne({ where: { id: data.gradeId } });
            if (!grade) {
                return {
                    success: false,
                    data: null,
                    message: `Classe avec l'ID ${data.gradeId} non trouvée`,
                    error: "GRADE_NOT_FOUND"
                };
            }

            const professor = await this.professorRepository.findOne({ where: { id: data.professorId } });
            if (!professor) {
                return {
                    success: false,
                    data: null,
                    message: `Professeur avec l'ID ${data.professorId} non trouvé`,
                    error: "PROFESSOR_NOT_FOUND"
                };
            }

            // Créer le devoir avec les entités vérifiées
            const homework = this.homeworkRepository.create({
                description: data.description,
                dueDate: new Date(data.dueDate),
                course: course,
                grade: grade,
                professor: professor
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

            // Vérifier les entités liées si elles sont fournies
            let course, grade, professor;
            
            if (data.courseId !== undefined) {
                course = await this.courseRepository.findOne({ where: { id: data.courseId } });
                if (!course) {
                    return {
                        success: false,
                        data: null,
                        message: `Cours avec l'ID ${data.courseId} non trouvé`,
                        error: "COURSE_NOT_FOUND"
                    };
                }
            }

            if (data.gradeId !== undefined) {
                grade = await this.gradeRepository.findOne({ where: { id: data.gradeId } });
                if (!grade) {
                    return {
                        success: false,
                        data: null,
                        message: `Classe avec l'ID ${data.gradeId} non trouvée`,
                        error: "GRADE_NOT_FOUND"
                    };
                }
            }

            if (data.professorId !== undefined) {
                professor = await this.professorRepository.findOne({ where: { id: data.professorId } });
                if (!professor) {
                    return {
                        success: false,
                        data: null,
                        message: `Professeur avec l'ID ${data.professorId} non trouvé`,
                        error: "PROFESSOR_NOT_FOUND"
                    };
                }
            }

            // Mettre à jour le devoir avec les entités vérifiées
            const updatedHomework = this.homeworkRepository.merge(existingHomework, {
                ...data,
                course: course || existingHomework.course,
                grade: grade || existingHomework.grade,
                professor: professor || existingHomework.professor
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