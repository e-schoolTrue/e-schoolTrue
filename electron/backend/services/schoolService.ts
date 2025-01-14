import { Repository } from "typeorm";
import { SchoolEntity } from "../entities/school";
import { AppDataSource } from "../../data-source";
import { ResultType } from "#electron/command";
import { FileService } from "./fileService";

export class SchoolService {
    private schoolRepository: Repository<SchoolEntity>;
    private fileService: FileService;

    constructor() {
        const dataSource = AppDataSource.getInstance();
        this.schoolRepository = dataSource.getRepository(SchoolEntity);
        this.fileService = new FileService();
    }

    async saveOrUpdateSchool(schoolData: any): Promise<ResultType> {
        try {
            // Déterminer la devise en fonction du pays
            const currencyMap: { [key: string]: string } = {
                'MAR': 'MAD',
                'SEN': 'FCFA',
                'CAF': 'FCFA',
                'GIN': 'GNF'
            };
            
            // S'assurer que la devise est toujours définie
            schoolData.currency = currencyMap[schoolData.country] || 'FCFA';
            
            // Gestion du logo si un nouveau logo est fourni
            if (schoolData.logo && schoolData.logo.content) {
                const savedLogo = await this.fileService.saveFile(
                    schoolData.logo.content,
                    schoolData.logo.name,
                    schoolData.logo.type
                );
                schoolData.logo = savedLogo;
            }

            const existingSchool = await this.schoolRepository.findOne({
                where: {},
                relations: ['logo']
            });

            if (existingSchool) {
                const updatedSchool = this.schoolRepository.merge(existingSchool, schoolData);
                const savedSchool = await this.schoolRepository.save(updatedSchool);
                
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

    async getSchool(): Promise<ResultType> {
        try {
            const school = await this.schoolRepository.findOne({
                where: {},
                relations: ['logo']
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
