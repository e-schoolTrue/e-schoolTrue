import { AppDataSource } from '#electron/data-source';
import { TranchConfigEntity } from '../entities/paymentConfig';
import { Repository } from 'typeorm';

export class TranchConfigService {
  private repository: Repository<TranchConfigEntity>;

  constructor() {
    this.repository = AppDataSource.getInstance().getRepository(TranchConfigEntity);
  }

  async findAll(): Promise<TranchConfigEntity[]> {
    return this.repository.find({
      relations: {
        grade: true
      }
    });
  }

  async findOne(id: number): Promise<TranchConfigEntity | null> {
    return this.repository.findOne({ where: { id }, relations: { grade: true } });
  }

  async create(data: TranchConfigEntity): Promise<TranchConfigEntity> {
    return this.repository.save(data);
  }  

  async update(data: TranchConfigEntity): Promise<TranchConfigEntity> {
    return this.repository.save(data);
  }

  async delete(id: number): Promise<TranchConfigEntity[]> {
    const result = await this.repository.delete(id);
    return this.findAll()
  }
}
