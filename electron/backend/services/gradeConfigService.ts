import { Repository } from "typeorm";
import { AppDataSource } from "../../data-source";
import { GradeConfigEntity } from "../entities/gradeConfig";
import { ResultType } from "#electron/command";

export class GradeConfigService {
    private gradeConfigRepository: Repository<GradeConfigEntity>;

    constructor() {
        this.gradeConfigRepository = AppDataSource.getInstance().getRepository(GradeConfigEntity);
    }



    async saveConfiguration(data: {
        gradeId: number;
        configs: Array<{
            courseId: number;
            numberOfAssignments: number;
            assignmentWeight: number;
            examWeight: number;
        }>;
    }): Promise<ResultType> {
        try {
            const savedConfigs = [];
            for (const config of data.configs) {
                const gradeConfig = this.gradeConfigRepository.create({
                    grade: { id: data.gradeId },
                    course: { id: config.courseId },
                    numberOfAssignments: config.numberOfAssignments,
                    assignmentWeight: config.assignmentWeight,
                    examWeight: config.examWeight
                });
                savedConfigs.push(await this.gradeConfigRepository.save(gradeConfig));
            }

            return {
                success: true,
                data: savedConfigs,
                message: "Configuration sauvegardée avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la sauvegarde",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getConfigurationByGrade(gradeId: number): Promise<ResultType> {
        try {
            const config = await this.gradeConfigRepository.find({
                where: { grade: { id: gradeId } },
                relations: ['course']
            });

            return {
                success: true,
                data: {
                    defaultAssignments: 2, // Valeur par défaut
                    configurations: config
                },
                message: "Configuration récupérée avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération de la configuration",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }
} 