import { Repository } from "typeorm";
import { SchoolEntity } from "../entities/school";
import { AppDataSource } from "../../data-source";
import { FileService } from "./fileService";
import {
    ISchoolServiceParams,
    ISchoolServiceResponse,
    ISchoolData
} from "../types/school";

export class SchoolService {
    private schoolRepository: Repository<SchoolEntity>;
    private fileService: FileService;

    private mapToISchoolData(school: SchoolEntity): ISchoolData {
        return {
            ...school,
            logo: school.logo ? {
                id: school.logo.id,
                name: school.logo.name,
                type: school.logo.type
            } : null
        };
    }

    constructor() {
        const dataSource = AppDataSource.getInstance();
        this.schoolRepository = dataSource.getRepository(SchoolEntity);
        this.fileService = new FileService();
    }

    async saveOrUpdateSchool(schoolData: ISchoolServiceParams['saveOrUpdateSchool']): Promise<ISchoolServiceResponse> {
        try {
            // Gestion du logo si un nouveau logo est fourni
            const { logo, ...schoolDataWithoutLogo } = schoolData;
            const schoolDataToSave: Partial<SchoolEntity> = {
                ...schoolDataWithoutLogo
            };

            if (logo && logo.content) {
                const savedLogo = await this.fileService.saveFile({
                    content: logo.content,
                    name: logo.name,
                    type: logo.type
                });
                schoolDataToSave.logo = savedLogo;
            }

            const existingSchool = await this.schoolRepository.findOne({
                where: {},
                relations: ['logo']
            });

            if (existingSchool) {
                Object.assign(existingSchool, schoolDataToSave);
                const savedSchool = await this.schoolRepository.save(existingSchool);
                
                const refreshedSchool = await this.schoolRepository.findOne({
                    where: { id: savedSchool.id },
                    relations: ['logo']
                });

                return {
                    success: true,
                    data: refreshedSchool ? this.mapToISchoolData(refreshedSchool) : null,
                    error: null,
                    message: "Informations de l'école mises à jour avec succès"
                };
            } else {
                const newSchool = this.schoolRepository.create(schoolDataToSave);
                const savedSchool = await this.schoolRepository.save(newSchool);

                const refreshedSchool = await this.schoolRepository.findOne({
                    where: { id: savedSchool.id },
                    relations: ['logo']
                });

                return {
                    success: true,
                    data: refreshedSchool ? this.mapToISchoolData(refreshedSchool) : null,
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

    async getSchool(): Promise<ISchoolServiceResponse> {
        try {
            const school = await this.schoolRepository.findOne({
                where: {},
                relations: ['logo']
            });
            
            console.log('Données de l\'école récupérées:', school);
            
            const mappedData = school ? this.mapToISchoolData(school) : null;
            console.log('Données mappées:', mappedData);

            return {
                success: true,
                data: mappedData,
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
