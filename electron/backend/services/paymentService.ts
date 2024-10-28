import { Repository } from 'typeorm';
import { PaymentEntity } from '../entities/payment';
import { AppDataSource } from '../../data-source';

export class PaymentService {
    private paymentRepository: Repository<PaymentEntity>;

    constructor() {
        this.paymentRepository = AppDataSource.getInstance().getRepository(PaymentEntity);
    }

    async addPayment(paymentData: Partial<PaymentEntity>): Promise<PaymentEntity> {
        const payment = this.paymentRepository.create(paymentData);
        return await this.paymentRepository.save(payment);
    }

    async getPaymentsByStudent(studentId: number): Promise<PaymentEntity[]> {
        return await this.paymentRepository.find({
            where: { student: { id: studentId } },
            order: { paymentDate: 'DESC' }
        });
    }

    // Ajoutez d'autres méthodes selon vos besoins
}
