import { Repository } from "typeorm";
import { AppDataSource } from "../../data-source";
import { GradeConfigEntity } from "../entities/gradeConfig";
import { GradeEntity } from "../entities/grade";
import { ResultType } from "#electron/command";

export class GradeConfigService {
    private gradeConfigRepository: Repository<GradeConfigEntity>;
    private gradeRepository: Repository<GradeEntity>;

    constructor() {
        try {
            this.gradeConfigRepository = AppDataSource.getInstance().getRepository(GradeConfigEntity);
            this.gradeRepository = AppDataSource.getInstance().getRepository(GradeEntity);
        } catch (error) {
            console.error('Erreur lors de l\'initialisation du repository:', error);
            throw error;
        }
    }

    async saveConfiguration(data: {
        gradeId: number;
        numberOfAssignments: number;
        assignmentMax: number;
        examMax: number;
    }): Promise<ResultType> {
        try {
            console.log('Début saveConfiguration avec données:', data);
            
            // Vérifier d'abord si la classe existe
            const grade = await this.gradeRepository.findOneBy({ id: data.gradeId });

            if (!grade) {
                throw new Error('Classe non trouvée');
            }

            // Rechercher la configuration existante
            let gradeConfig = await this.gradeConfigRepository
                .createQueryBuilder('config')
                .leftJoinAndSelect('config.grade', 'grade')
                .where('grade.id = :gradeId', { gradeId: data.gradeId })
                .getOne();

            console.log('Configuration existante:', gradeConfig);

            if (!gradeConfig) {
                console.log('Création d\'une nouvelle configuration');
                gradeConfig = this.gradeConfigRepository.create({
                    grade: grade,
                    numberOfAssignments: data.numberOfAssignments,
                    assignmentWeight: 0.4,
                    examWeight: 0.6
                });
            } else {
                console.log('Mise à jour de la configuration existante');
                gradeConfig.numberOfAssignments = data.numberOfAssignments;
            }

            const savedConfig = await this.gradeConfigRepository.save(gradeConfig);
            console.log('Configuration sauvegardée:', savedConfig);

            return {
                success: true,
                data: {
                    numberOfAssignments: savedConfig.numberOfAssignments,
                    assignmentWeight: savedConfig.assignmentWeight,
                    examWeight: savedConfig.examWeight
                },
                message: "Configuration sauvegardée avec succès",
                error: null
            };
        } catch (error) {
            console.error('Erreur dans saveConfiguration:', error);
            return {
                success: false,
                data: null,
                message: error instanceof Error ? error.message : "Erreur lors de la sauvegarde",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getConfigurationByGrade(gradeId: number): Promise<ResultType> {
        try {
            console.log('Recherche de configuration pour la classe:', gradeId);
            
            const config = await this.gradeConfigRepository
                .createQueryBuilder('config')
                .leftJoinAndSelect('config.grade', 'grade')
                .where('grade.id = :gradeId', { gradeId })
                .getOne();

            console.log('Configuration trouvée:', config);

            const formattedData = {
                numberOfAssignments: config?.numberOfAssignments || 2,
                assignmentWeight: config?.assignmentWeight || 0.4,
                examWeight: config?.examWeight || 0.6
            };

            console.log('Données formatées renvoyées:', formattedData);

            return {
                success: true,
                data: formattedData,
                message: "Configuration récupérée avec succès",
                error: null
            };
        } catch (error) {
            console.error('Erreur dans getConfigurationByGrade:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération de la configuration",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }
} 