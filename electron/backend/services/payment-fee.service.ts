import { AppDataSource } from '#electron/data-source';
import { PaymentFeeEntity } from '../entities/paymentConfig';
import { Repository } from 'typeorm';

export class PaymentFeeService {
  private repository: Repository<PaymentFeeEntity>;

  constructor() {
    this.repository = AppDataSource.getInstance().getRepository(PaymentFeeEntity);
  }

  async findAll(): Promise<PaymentFeeEntity[]> {
    return this.repository.find({
      relations: {
        grade: true
      }
    });
  }

  async findOne(id: number): Promise<PaymentFeeEntity | null> {
    return this.repository.findOne({ where: { id }, relations: { grade: true } });
  }

  async create(data: PaymentFeeEntity): Promise<PaymentFeeEntity> {
    return this.repository.save(data);
  }  

  async update(data: PaymentFeeEntity): Promise<PaymentFeeEntity> {
    return this.repository.save(data);
  }

  async delete(id: number): Promise<PaymentFeeEntity[]> {
    const result = await this.repository.delete(id);
    return this.findAll()
  }
}

