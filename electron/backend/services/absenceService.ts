import { Between, Repository } from 'typeorm';
import { AbsenceEntity } from '../entities/absence';
import { AppDataSource } from '../../data-source';

export class AbsenceService {
    private absenceRepository: Repository<AbsenceEntity>;

    constructor() {
        this.absenceRepository = AppDataSource.getInstance().getRepository(AbsenceEntity);
    }

    async addAbsence(absenceData: Partial<AbsenceEntity>): Promise<AbsenceEntity> {
        const absence = this.absenceRepository.create(absenceData);
        return await this.absenceRepository.save(absence);
    }

    async getAbsencesByStudent(studentId: number): Promise<AbsenceEntity[]> {
        return await this.absenceRepository.find({
            where: { student: { id: studentId } },
            relations: ['student'],
            order: {
                date: 'DESC' as const // Explicitly type the order
            }
        });
    }

    async updateAbsenceStatus(absenceId: number, justified: boolean): Promise<AbsenceEntity> {
        const absence = await this.absenceRepository.findOne({
            where: { id: absenceId },
            relations: ['student']
        });

        if (!absence) {
            throw new Error("Absence non trouvée");
        }

        absence.justified = justified;
        return await this.absenceRepository.save(absence);
    }

    async deleteAbsence(absenceId: number): Promise<void> {
        const absence = await this.absenceRepository.findOne({
            where: { id: absenceId }
        });

        if (!absence) {
            throw new Error("Absence non trouvée");
        }

        await this.absenceRepository.remove(absence);
    }

    async getAbsencesByDateRange(startDate: Date, endDate: Date): Promise<AbsenceEntity[]> {
        return await this.absenceRepository.find({
            where: {
                date: Between(startDate, endDate)
            },
            relations: ['student'],
            order: {
                date: 'DESC' as const // Explicitly type the order
            }
        });
    }

    async getAbsenceStatistics(studentId: number): Promise<{
        total: number;
        justified: number;
        unjustified: number;
    }> {
        const absences = await this.getAbsencesByStudent(studentId);
        const justified = absences.filter(a => a.justified).length;

        return {
            total: absences.length,
            justified,
            unjustified: absences.length - justified
        };
    }
}