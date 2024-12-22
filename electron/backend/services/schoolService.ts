import { Repository } from "typeorm";
import { SchoolEntity } from "../entities/school";
import { FileEntity } from "../entities/file"; // Import de FileEntity pour gérer le logo
import { AppDataSource } from "../../data-source";
import { ResultType } from "#electron/command";

export class SchoolService {
    private schoolRepository: Repository<SchoolEntity>;
    private fileRepository: Repository<FileEntity>;

    constructor() {
        const dataSource = AppDataSource.getInstance();
        this.schoolRepository = dataSource.getRepository(SchoolEntity);
        this.fileRepository = dataSource.getRepository(FileEntity);
    }

    // Enregistrer ou mettre à jour les informations de l'école
    async saveOrUpdateSchool(schoolData: Partial<SchoolEntity>): Promise<ResultType> {
        try {
            // Gestion du logo (charger l'entité si un logoId est fourni)
            if (schoolData.logo && typeof schoolData.logo === 'number') {
                const logoEntity = await this.fileRepository.findOne({
                    where: { id: schoolData.logo }
                });

                if (!logoEntity) {
                    return {
                        success: false,
                        data: null,
                        error: "Logo introuvable",
                        message: "Le logo spécifié n'existe pas dans la base de données"
                    };
                }

                schoolData.logo = logoEntity; // Associer le logo à l'école
            }

            // Rechercher une école existante
            const existingSchool = await this.schoolRepository.findOne({
                where: {},
                relations: ['logo']
            });

            if (existingSchool) {
                // Mise à jour des informations
                const updatedSchool = this.schoolRepository.merge(existingSchool, schoolData);
                const savedSchool = await this.schoolRepository.save(updatedSchool);
                
                // Charger l'école avec toutes les relations après la sauvegarde
                const refreshedSchool = await this.schoolRepository.findOne({
                    where: { id: savedSchool.id },
                    relations: ['logo']
                });

                return {
                    success: true,
                    data: refreshedSchool,
                    error: null,
                    message: "Informations de l'école mises à jour avec succès"
                };
            } else {
                // Enregistrement d'une nouvelle école
                const newSchool = this.schoolRepository.create(schoolData);
                const savedSchool = await this.schoolRepository.save(newSchool);

                return {
                    success: true,
                    data: savedSchool,
                    error: null,
                    message: "École enregistrée avec succès"
                };
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : "Une erreur inconnue est survenue";
            console.error("Erreur dans saveOrUpdateSchool:", error);
            return {
                success: false,
                data: null,
                error: errorMessage,
                message: `Échec de l'enregistrement ou de la mise à jour de l'école : ${errorMessage}`
            };
        }
    }

    // Récupérer les informations de l'école
    async getSchool(): Promise<ResultType> {
        try {
            const school = await this.schoolRepository.findOne({
                where: {},
                relations: ['logo']  //relation
            });
    
            return {
                success: true,
                data: school,
                error: null,
                message: "Informations de l'école récupérées avec succès"
            };
        } catch (error) {
            console.error("Erreur dans getSchool:", error);
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Échec de la récupération des informations de l'école"
            };
        }
    }
}
