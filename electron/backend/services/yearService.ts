import { Repository } from "typeorm";
import { YearRepartitionEntity } from "../entities/yearRepartition";
import { AppDataSource } from "../../data-source";
import { ResultType } from "./paymentService";
import { 
    YearRepartition, 
    YearRepartitionCreateInput, 
    YearRepartitionUpdateInput} from "../types/year";

export class YearRepartitionService {
    private yearRepartitionRepository: Repository<YearRepartitionEntity>;

    constructor() {
        this.yearRepartitionRepository = AppDataSource.getInstance().getRepository(YearRepartitionEntity);
    }

    private convertToEntity(data: YearRepartitionCreateInput | YearRepartitionUpdateInput): Partial<YearRepartitionEntity> {
        return {
            schoolYear: data.schoolYear,
            periodConfigurations: data.periodConfigurations?.map(period => ({
                name: period.name,
                start: new Date(period.start),
                end: new Date(period.end)
            })) || []
        };
    }

    private convertToResponse(entity: YearRepartitionEntity): YearRepartition {
        return {
            id: entity.id!,
            schoolYear: entity.schoolYear,
            periodConfigurations: entity.periodConfigurations.map(period => ({
                name: period.name,
                start: period.start,
                end: period.end
            })),
            isCurrent: entity.isCurrent || false,
            createdAt: entity.createdAt || new Date(),
            updatedAt: entity.updatedAt || new Date()
        };
    }

    async createYearRepartition(data: YearRepartitionCreateInput): Promise<ResultType<YearRepartition>> {
        try {
            const newYearRepartition = new YearRepartitionEntity();
            Object.assign(newYearRepartition, this.convertToEntity(data));

            const saved = await this.yearRepartitionRepository.save(newYearRepartition);
            return {
                success: true,
                data: this.convertToResponse(saved),
                error: null,
                message: "Répartition d'année scolaire créée avec succès",
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Échec de la création de la répartition d'année scolaire",
            };
        }
    }

    async updateYearRepartition(id: number, data: YearRepartitionUpdateInput): Promise<ResultType<YearRepartition>> {
        try {
            const yearRepartition = await this.yearRepartitionRepository.findOneBy({ id });

            if (!yearRepartition) {
                return {
                    success: false,
                    data: null,
                    error: "YearRepartition not found",
                    message: "Répartition d'année scolaire non trouvée",
                };
            }

            Object.assign(yearRepartition, this.convertToEntity(data));
            const saved = await this.yearRepartitionRepository.save(yearRepartition);

            return {
                success: true,
                data: this.convertToResponse(saved),
                error: null,
                message: "Répartition d'année scolaire mise à jour avec succès",
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Échec de la mise à jour de la répartition d'année scolaire",
            };
        }
    }

    async getAllYearRepartitions(): Promise<ResultType<YearRepartition[]>> {
        try {
            const yearRepartitions = await this.yearRepartitionRepository.find();
            return {
                success: true,
                data: yearRepartitions.map(this.convertToResponse),
                error: null,
                message: "Répartitions récupérées avec succès",
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Échec de la récupération des répartitions d'années scolaires",
            };
        }
    }

    async deleteYearRepartition(id: number): Promise<ResultType<void>> {
        try {
            const result = await this.yearRepartitionRepository.delete(id);

            if (result.affected === 0) {
                return {
                    success: false,
                    data: null,
                    error: "YearRepartition not found",
                    message: "Répartition d'année scolaire non trouvée",
                };
            }

            return {
                success: true,
                data: null,
                error: null,
                message: "Répartition d'année scolaire supprimée avec succès",
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Échec de la suppression de la répartition d'année scolaire",
            };
        }
    }

    async getCurrentYearRepartition(): Promise<ResultType<YearRepartition | null>> {
        try {
            const allRepartitions = await this.yearRepartitionRepository.find();
            const currentDate = new Date();
            
            const currentRepartition = allRepartitions.find(repartition => {
                const periods = repartition.periodConfigurations;
                if (!periods || periods.length === 0) return false;
                
                const startDate = new Date(periods[0].start);
                const endDate = new Date(periods[periods.length - 1].end);
                
                return currentDate >= startDate && currentDate <= endDate;
            });

            return {
                success: true,
                data: currentRepartition ? this.convertToResponse(currentRepartition) : null,
                error: null,
                message: currentRepartition ? "Année scolaire courante trouvée" : "Aucune année scolaire active trouvée"
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Erreur lors de la récupération de l'année scolaire courante"
            };
        }
    }

    async setCurrentYearRepartition(id: number): Promise<ResultType<YearRepartition>> {
        try {
            const yearRepartition = await this.yearRepartitionRepository.findOne({
                where: { id }
            });

            if (!yearRepartition) {
                return {
                    success: false,
                    data: null,
                    error: "YearRepartition not found",
                    message: "Répartition d'année scolaire non trouvée"
                };
            }

            await this.yearRepartitionRepository.update({}, { isCurrent: false });
            yearRepartition.isCurrent = true;
            const saved = await this.yearRepartitionRepository.save(yearRepartition);

            return {
                success: true,
                data: this.convertToResponse(saved),
                message: "Année scolaire courante définie avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Erreur lors de la définition de l'année scolaire courante"
            };
        }
    }
}
