import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { StudentEntity } from "./students";

@Entity('T_payment')
export class PaymentEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => StudentEntity, student => student.payments)
    student!: StudentEntity;

    @Column('decimal', { precision: 10, scale: 2 })
    amount!: number;

    @Column('varchar')
    paymentType!: string;

    @Column('date')
    paymentDate!: Date;

    @Column('varchar', { nullable: true })
    paymentMethod!: string;

    @Column('varchar', { nullable: true })
    receiptNumber!: string;
}