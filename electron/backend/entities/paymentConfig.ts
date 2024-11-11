import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity('T_payment_config')
export class PaymentConfigEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "int" })
    classId!: number;

    @Column({ type: "text" })
    className!: string;

    @Column({ type: "int" })
    annualAmount!: number;

    @Column({ type: "int" })
    installments!: number;

    @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
    updatedAt!: Date;
} 