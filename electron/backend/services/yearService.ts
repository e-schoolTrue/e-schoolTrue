import { Repository } from "typeorm";
import { YearRepartitionEntity } from "#electron/backend/entities/yearRepartition";
import { AppDataSource } from "#electron/data-source";
import { ResultType } from "#electron/command";
import { messages } from "#app/messages";

export class YearRepartitionService {
    private yearRepartitionRepository: Repository<YearRepartitionEntity>;

    constructor() {
        this.yearRepartitionRepository = AppDataSource.getInstance().getRepository(YearRepartitionEntity);
    }

    // Créer une nouvelle répartition d'année scolaire
    async createYearRepartition(data: {
        schoolYear: string;
        periodConfigurations: { start: Date; end: Date; name: string }[];
    }): Promise<ResultType> {
        try {
            const newYearRepartition = new YearRepartitionEntity();
            newYearRepartition.schoolYear = data.schoolYear;
            newYearRepartition.periodConfigurations = data.periodConfigurations;

            await this.yearRepartitionRepository.save(newYearRepartition);

            return {
                success: true,
                data: newYearRepartition,
                error: null,
                message: messages.year_repartition_created_successfully,
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message,
                message: messages.year_repartition_creation_failed,
            };
        }
    }

    // Mettre à jour une répartition d'année scolaire
    async updateYearRepartition(
        id: number,
        data: {
            schoolYear?: string;
            periodConfigurations?: { start: Date; end: Date; name: string }[];
        }
    ): Promise<ResultType> {
        try {
            const yearRepartition = await this.yearRepartitionRepository.findOneBy({ id });

            if (!yearRepartition) {
                return {
                    success: false,
                    data: null,
                    error: "YearRepartition not found",
                    message: messages.year_repartition_not_found,
                };
            }

            if (data.schoolYear) yearRepartition.schoolYear = data.schoolYear;
            if (data.periodConfigurations) {
                yearRepartition.periodConfigurations = data.periodConfigurations;
            }

            await this.yearRepartitionRepository.save(yearRepartition);

            return {
                success: true,
                data: yearRepartition,
                error: null,
                message: messages.year_repartition_updated_successfully,
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message,
                message: messages.year_repartition_update_failed,
            };
        }
    }

    // Récupérer toutes les répartitions d'années scolaires
    async getAllYearRepartitions(): Promise<ResultType> {
        try {
            const yearRepartitions = await this.yearRepartitionRepository.find();
            return {
                success: true,
                data: yearRepartitions,
                error: null,
                message: "",
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message,
                message: messages.year_repartition_retrieve_failed,
            };
        }
    }

    // Supprimer une répartition d'année scolaire
    async deleteYearRepartition(id: number): Promise<ResultType> {
        try {
            const result = await this.yearRepartitionRepository.delete(id);

            if (result.affected === 0) {
                return {
                    success: false,
                    data: null,
                    error: "YearRepartition not found",
                    message: messages.year_repartition_not_found,
                };
            }

            return {
                success: true,
                data: null,
                error: null,
                message: messages.year_repartition_deleted_successfully,
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message,
                message: messages.year_repartition_delete_failed,
            };
        }
    }
}
