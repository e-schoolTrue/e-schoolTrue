import { Repository } from "typeorm";
import { YearRepartitionEntity } from "#electron/backend/entities/yearRepartition";
import { AppDataSource } from "#electron/data-source";
import { ResultType } from "#electron/command";


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
                message: "Répartition d'année scolaire créée avec succès",
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message,
                message: "Échec de la création de la répartition d'année scolaire",
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
                    message: "Répartition d'année scolaire non trouvée",
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
                message: "Répartition d'année scolaire mise à jour avec succès",
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message,
                message: "Échec de la mise à jour de la répartition d'année scolaire",
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
                message: "Échec de la récupération des répartitions d'années scolaires",
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
                    message: "Répartition d'année scolaire non trouvée",
                };
            }

            return {
                success: true,
                data: null,
                error: null,
                message: "Répartition d'année scolaire supprimée avec succès",
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message,
                message: "Échec de la suppression de la répartition d'année scolaire",
            };
        }
    }

    // Ajouter cette nouvelle méthode
    async getCurrentYearRepartition(): Promise<ResultType> {
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
                data: currentRepartition || null,
                error: null,
                message: currentRepartition ? "Année scolaire courante trouvée" : "Aucune année scolaire active trouvée"
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message,
                message: "Erreur lors de la récupération de l'année scolaire courante"
            };
        }
    }

    // Ajouter cette méthode
    async setCurrentYearRepartition(id: number): Promise<ResultType> {
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

            // Mettre à jour tous les enregistrements pour désactiver isCurrent
            await this.yearRepartitionRepository.update({}, { isCurrent: false });

            // Définir la répartition sélectionnée comme courante
            yearRepartition.isCurrent = true;
            await this.yearRepartitionRepository.save(yearRepartition);

            return {
                success: true,
                data: yearRepartition,
                message: "Année scolaire courante définie avec succès",
                error: null
            };
        } catch (error: any) {
            return {
                success: false,
                data: null,
                error: error.message,
                message: "Erreur lors de la définition de l'année scolaire courante"
            };
        }
    }
}
