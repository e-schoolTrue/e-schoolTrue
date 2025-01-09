import { Repository } from "typeorm";
import { AppDataSource } from "../../data-source";
import { PreferenceEntity } from "../entities/preference";
import { ResultType } from "#electron/command";

export class PreferenceService {
    private preferenceRepository: Repository<PreferenceEntity>;

    constructor() {
        this.preferenceRepository = AppDataSource.getInstance().getRepository(PreferenceEntity);
    }

    async saveTemplatePreference(templateId: string): Promise<ResultType> {
        try {
            await this.preferenceRepository.upsert(
                { key: 'reportTemplate', value: templateId },
                ['key']
            );
            return {
                success: true,
                data: templateId,
                message: "Préférence de template sauvegardée",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la sauvegarde de la préférence",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getTemplatePreference(): Promise<ResultType> {
        try {
            const pref = await this.preferenceRepository.findOne({
                where: { key: 'reportTemplate' }
            });
            return {
                success: true,
                data: pref?.value || null,
                message: "Préférence récupérée",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération de la préférence",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }
} 