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
                start: period.start instanceof Date ? period.start : new Date(period.start),
                end: period.end instanceof Date ? period.end : new Date(period.end)
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
            console.log(`Mise à jour de la répartition ${id} avec:`, data);
            
            // Trouver la répartition existante avec toutes ses relations
            const yearRepartition = await this.yearRepartitionRepository.findOneBy({ id });

            if (!yearRepartition) {
                return {
                    success: false,
                    data: null,
                    error: "YearRepartition not found",
                    message: "Répartition d'année scolaire non trouvée",
                };
            }
            
            // Conserver l'état actuel pour le débogage
            console.log('État avant modification:', JSON.stringify(yearRepartition));
            
            // Mettre à jour seulement les champs fournis dans data
            if (data.schoolYear) {
                yearRepartition.schoolYear = data.schoolYear;
            }
            
            // Gérer les périodes séparément pour éviter la création de doublons
            if (data.periodConfigurations && data.periodConfigurations.length > 0) {
                // Remplacer complètement les périodes existantes
                yearRepartition.periodConfigurations = data.periodConfigurations.map(period => ({
                    name: period.name,
                    start: period.start instanceof Date ? period.start : new Date(period.start),
                    end: period.end instanceof Date ? period.end : new Date(period.end)
                }));
            }
            
            console.log('État après modification, avant sauvegarde:', JSON.stringify(yearRepartition));
            
            // Sauvegarder les modifications
            const saved = await this.yearRepartitionRepository.save(yearRepartition);
            console.log('Répartition sauvegardée:', JSON.stringify(saved));
            
            // Vérification après sauvegarde
            const allRepartitions = await this.yearRepartitionRepository.find();
            console.log(`Nombre total de répartitions après mise à jour: ${allRepartitions.length}`);
            
            return {
                success: true,
                data: this.convertToResponse(saved),
                error: null,
                message: "Répartition d'année scolaire mise à jour avec succès",
            };
        } catch (error) {
            console.error("Erreur lors de la mise à jour:", error);
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
            
            // Convertir chaque entité en utilisant la méthode convertToResponse
            const convertedRepartitions = yearRepartitions.map(entity => 
                this.convertToResponse(entity)
            );
            
            return {
                success: true,
                data: convertedRepartitions,
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
            
            // Chercher d'abord une répartition marquée comme courante manuellement
            const manuallySetCurrent = allRepartitions.find(repartition => repartition.isCurrent === true);
            if (manuallySetCurrent) {
                return {
                    success: true,
                    data: this.convertToResponse(manuallySetCurrent),
                    error: null,
                    message: "Année scolaire courante trouvée (définie manuellement)"
                };
            }
            
            // Sinon, chercher une répartition basée sur la date actuelle
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
                message: currentRepartition ? "Année scolaire courante trouvée (basée sur la date)" : "Aucune année scolaire active trouvée"
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
            console.log(`=== setCurrentYearRepartition - Début - ID: ${id} ===`);
            
            // Vérifier si la répartition existe
            const yearRepartition = await this.yearRepartitionRepository.findOne({
                where: { id }
            });

            if (!yearRepartition) {
                console.log(`=== setCurrentYearRepartition - Répartition non trouvée - ID: ${id} ===`);
                return {
                    success: false,
                    data: null,
                    error: "YearRepartition not found",
                    message: "Répartition d'année scolaire non trouvée"
                };
            }
            
            console.log(`=== setCurrentYearRepartition - Répartition trouvée: ${yearRepartition.schoolYear} ===`);

            // Mettre à jour toutes les répartitions pour désactiver l'année courante
            console.log(`=== setCurrentYearRepartition - Désactivation de toutes les répartitions ===`);
            try {
                await this.yearRepartitionRepository
                    .createQueryBuilder()
                    .update()
                    .set({ isCurrent: false })
                    .execute();
                    
                console.log(`=== setCurrentYearRepartition - Toutes les répartitions désactivées ===`);
            } catch (updateError) {
                console.error('Erreur lors de la désactivation des répartitions:', updateError);
                throw updateError;
            }
            
            // Mettre à jour seulement la répartition spécifiée
            console.log(`=== setCurrentYearRepartition - Activation de la répartition ${id} ===`);
            yearRepartition.isCurrent = true;
            
            try {
                const saved = await this.yearRepartitionRepository.save(yearRepartition);
                console.log(`=== setCurrentYearRepartition - Répartition sauvegardée: ${saved.id} ===`);
                
                // Rafraîchir la liste des répartitions pour s'assurer qu'une seule est marquée comme courante
                const allRepartitions = await this.yearRepartitionRepository.find();
                console.log(`=== setCurrentYearRepartition - Nombre total de répartitions: ${allRepartitions.length} ===`);
                
                const currentCount = allRepartitions.filter(rep => rep.isCurrent).length;
                console.log(`=== setCurrentYearRepartition - Nombre de répartitions courantes: ${currentCount} ===`);
                
                if (currentCount > 1) {
                    console.warn(`Multiple current year repartitions found (${currentCount}). Fixing...`);
                    // S'il y a plus d'une répartition marquée comme courante, garder uniquement la dernière
                    for (const rep of allRepartitions) {
                        if (rep.isCurrent && rep.id !== yearRepartition.id) {
                            console.log(`=== setCurrentYearRepartition - Désactivation de la répartition ${rep.id} ===`);
                            rep.isCurrent = false;
                            await this.yearRepartitionRepository.save(rep);
                        }
                    }
                }

                console.log(`=== setCurrentYearRepartition - Succès ===`);
                return {
                    success: true,
                    data: this.convertToResponse(saved),
                    message: "Année scolaire courante définie avec succès",
                    error: null
                };
            } catch (saveError) {
                console.error('Erreur lors de la sauvegarde de la répartition:', saveError);
                throw saveError;
            }
        } catch (error) {
            console.error("=== setCurrentYearRepartition - Erreur globale ===", error);
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Erreur lors de la définition de l'année scolaire courante"
            };
        }
    }
}
