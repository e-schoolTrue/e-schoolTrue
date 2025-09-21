import { AppDataSource } from '#electron/data-source';
import { GradeEntity } from '../entities/grade';
import { PaymentAnnualConfigEntity, TranchConfigEntity } from '../entities/paymentConfig';
import { In, Repository } from 'typeorm';

interface TrancheData {
  name: string;
  amount: number;
}

interface PaymentAnnualConfigData {
  id?: number;
  gradeId: string;
  tranches: TrancheData[];
}

export class PaymentAnnualConfigService {
  private annualConfigRepo: Repository<PaymentAnnualConfigEntity>;
  private trancheConfigRepo: Repository<TranchConfigEntity>;
  private gradeRepo: Repository<GradeEntity>;

  constructor() {
    const dataSource = AppDataSource.getInstance();
    this.annualConfigRepo = dataSource.getRepository(PaymentAnnualConfigEntity);
    this.trancheConfigRepo = dataSource.getRepository(TranchConfigEntity);
    this.gradeRepo = dataSource.getRepository(GradeEntity);
  }

  async findAll(): Promise<PaymentAnnualConfigEntity[]> {
    return this.annualConfigRepo.find({
      relations: {
        grade: true,
        tranches: true,
      },
      order: {
        grade: {
          name: 'ASC'
        }
      }
    });
  }

  async findOne(id: number): Promise<PaymentAnnualConfigEntity | null> {
    return this.annualConfigRepo.findOne({ where: { id }, relations: { grade: true, tranches: true } });
  }

  async create(data: PaymentAnnualConfigData): Promise<PaymentAnnualConfigEntity> {
    const grade = await this.gradeRepo.findOne({ where: { id: Number(data.gradeId) } });
    if (!grade) {
      throw new Error('Grade not found');
    }

    const queryRunner = this.annualConfigRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const annualConfig = new PaymentAnnualConfigEntity();
      annualConfig.grade = grade;
      annualConfig.trancheCount = data.tranches.length;

      const savedAnnualConfig = await queryRunner.manager.save(annualConfig);

      const trancheEntities = data.tranches.map(trancheData => {
        const tranche = new TranchConfigEntity();
        tranche.tranchName = trancheData.name;
        tranche.amount = trancheData.amount;
        tranche.paymentAnnualConfig = savedAnnualConfig;
        return tranche;
      });

      await queryRunner.manager.save(trancheEntities);

      await queryRunner.commitTransaction();
      return savedAnnualConfig;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async update(data: PaymentAnnualConfigData): Promise<PaymentAnnualConfigEntity> {
    if (!data.id) {
      throw new Error('Update operation requires an ID.');
    }

    const queryRunner = this.annualConfigRepo.manager.connection.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const annualConfig = await queryRunner.manager.findOne(PaymentAnnualConfigEntity, { where: { id: data.id }, relations: ['tranches'] });
      if (!annualConfig) {
        throw new Error('PaymentAnnualConfig not found');
      }

      // Update tranche count
      annualConfig.trancheCount = data.tranches.length;

      // Delete old tranches
      if (annualConfig.tranches && annualConfig.tranches.length > 0) {
        const oldTrancheIds = annualConfig.tranches.map(t => t.id);
        await queryRunner.manager.delete(TranchConfigEntity, { id: In(oldTrancheIds) });
      }

      // Create new tranches
      const newTrancheEntities = data.tranches.map(trancheData => {
        const tranche = new TranchConfigEntity();
        tranche.tranchName = trancheData.name;
        tranche.amount = trancheData.amount;
        tranche.paymentAnnualConfig = annualConfig;
        return tranche;
      });

      await queryRunner.manager.save(newTrancheEntities);
      const updatedAnnualConfig = await queryRunner.manager.save(annualConfig);

      await queryRunner.commitTransaction();
      return updatedAnnualConfig;

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async delete(id: number): Promise<{ success: boolean }> {
    // The CASCADE option on the entity should handle deletion of child tranches.
    const result = await this.annualConfigRepo.delete(id);
    if (result.affected === 0) {
      throw new Error('Config not found');
    }
    return { success: true };
  }
}