import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("payment_configs")
export class PaymentConfigEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar" })
    classId!: string;

    @Column({ type: "varchar", nullable: true })
    className?: string;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    annualAmount!: number;
} 