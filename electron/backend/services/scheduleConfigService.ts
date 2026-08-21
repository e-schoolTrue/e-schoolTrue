import { ScheduleConfigEntity } from "../entities/scheduleConfig";
import { AppDataSource } from "../../data-source";
import { Repository } from "typeorm";

interface IScheduleConfigResponse {
    success: boolean;
    data?: any;
    message?: string;
    error?: any;
}

export class ScheduleConfigService {
    private configRepository!: Repository<ScheduleConfigEntity>;

    private async ensureRepository(): Promise<void> {
        if (!this.configRepository) {
            const ds = AppDataSource.getInstance();
            this.configRepository = ds.getRepository(ScheduleConfigEntity);
        }
    }

    async getConfig(classId?: number | null): Promise<IScheduleConfigResponse> {
        try {
            await this.ensureRepository();
            if (classId) {
                let config = await this.configRepository.findOne({ where: { classId }, relations: ['class'] });
                if (config) return { success: true, data: config };
            }
            const globalConfig = await this.configRepository.findOne({ where: { classId: null as any } });
            return { success: true, data: globalConfig || null };
        } catch (error) {
            return { success: false, error, message: "Erreur lors de la récupération de la configuration" };
        }
    }

    async saveConfig(data: { classId?: number; startHour: number; endHour: number; slotDuration: number; lunchStart: number; lunchEnd: number; startMinutes?: number; endMinutes?: number; lunchStartMinutes?: number; lunchEndMinutes?: number; global?: boolean }): Promise<IScheduleConfigResponse> {
        try {
            await this.ensureRepository();
            const where = data.global ? { classId: null as any } : { classId: data.classId };
            const existing = await this.configRepository.findOne({ where });
            const config = existing || new ScheduleConfigEntity();
            config.startHour = data.startHour;
            config.endHour = data.endHour;
            config.slotDuration = data.slotDuration;
            config.lunchStart = data.lunchStart;
            config.lunchEnd = data.lunchEnd;
            config.startMinutes = data.startMinutes ?? 0;
            config.endMinutes = data.endMinutes ?? 0;
            config.lunchStartMinutes = data.lunchStartMinutes ?? 0;
            config.lunchEndMinutes = data.lunchEndMinutes ?? 0;
            if (!data.global && data.classId) config.classId = data.classId;
            if (data.global) config.classId = undefined;
            const saved = await this.configRepository.save(config);
            return { success: true, data: saved, message: "Configuration enregistrée" };
        } catch (error) {
            return { success: false, error, message: "Erreur lors de l'enregistrement" };
        }
    }

    async deleteConfig(id: number): Promise<IScheduleConfigResponse> {
        try {
            await this.ensureRepository();
            await this.configRepository.delete(id);
            return { success: true, message: "Configuration supprimée" };
        } catch (error) {
            return { success: false, error, message: "Erreur lors de la suppression" };
        }
    }
}
