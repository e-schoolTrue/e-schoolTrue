import { Repository } from "typeorm";
import { AppDataSource } from "../../data-source";
import { PreferenceEntity } from "../entities/preference";
import { ResultType } from "./paymentService";
import { PreferenceKey } from "../types/preference";

export class PreferenceService {
    private preferenceRepository: Repository<PreferenceEntity>;

    constructor() {
        this.preferenceRepository = AppDataSource.getInstance().getRepository(PreferenceEntity);
    }

    async saveTemplatePreference(templateId: string): Promise<ResultType<string>> {
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

    async getTemplatePreference(): Promise<ResultType<string | null>> {
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

    async getPreference(key: PreferenceKey): Promise<ResultType<string | null>> {
        try {
            const pref = await this.preferenceRepository.findOne({
                where: { key }
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

    async setPreference(key: PreferenceKey, value: string): Promise<ResultType<string>> {
        try {
            await this.preferenceRepository.upsert(
                { key, value },
                ['key']
            );
            return {
                success: true,
                data: value,
                message: "Préférence sauvegardée",
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
} 