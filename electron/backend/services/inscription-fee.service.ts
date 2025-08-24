import { InscriptionFeeEntity } from '../entities/paymentConfig';
import { AppDataSource } from '#electron/data-source';
import { Repository } from 'typeorm';

export class InscriptionFeeService {
  private repository: Repository<InscriptionFeeEntity>;

  constructor() {
    this.repository = AppDataSource.getInstance().getRepository(InscriptionFeeEntity);
  }

  async findAll(): Promise<InscriptionFeeEntity[]> {
    return this.repository.find({
      relations: {
        grade: true
      }
    });
  }

  async findOne(id: number): Promise<InscriptionFeeEntity | null> {
    return this.repository.findOne({ where: { id }, relations: { grade: true } });
  }

  async create(data: InscriptionFeeEntity): Promise<InscriptionFeeEntity> {
    return this.repository.save(data);
  }  

  async update(data: InscriptionFeeEntity): Promise<InscriptionFeeEntity> {
    return this.repository.save(data);
  }

  async delete(id: number): Promise<InscriptionFeeEntity[]> {
    const result = await this.repository.delete(id);
    return this.findAll()
  }
}

