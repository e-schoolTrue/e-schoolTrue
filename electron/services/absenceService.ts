import { Repository } from 'typeorm';
import { AbsenceEntity } from '@electron/entities/absence.ts';
import { AppDataSource } from '@electron/data-source.ts';

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
            order: { date: 'DESC' }
        });
    }

    // Ajoutez d'autres méthodes selon vos besoins
}
