import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from "typeorm";
import { StudentEntity } from "./students";
import { ScholarshipEntity } from "./scholarship";

@Entity("payments")
export class PaymentEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column("decimal", { precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: "varchar", nullable: false })
    paymentType!: string;

    @Column({ 
        type: "varchar", 
        nullable: false,
        default: 'cash'
    })
    paymentMethod!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @ManyToOne(() => StudentEntity, student => student.payments)
    student!: StudentEntity;

    @Column({ type: "integer" })
    studentId!: number;

    @Column({ type: "integer", default: 1 })
    installmentNumber!: number;

    @Column({ 
        type: "varchar",
        default: () => `'${new Date().getFullYear()}'`
    })
    schoolYear!: string;

    @Column({ type: "varchar", nullable: true })
    comment?: string;

    @ManyToOne(() => ScholarshipEntity)
    @JoinColumn({ name: "scholarshipId" })
    scholarship?: ScholarshipEntity;

    @Column({ type: "integer", nullable: true })
    scholarshipId?: number;

    @Column({ type: 'float', nullable: true })
    baseAmount!: number;

    @Column({ type: 'float', nullable: true })
    scholarshipAmount!: number;

    @Column({ type: 'float', nullable: true })
    adjustedAmount!: number;

    @Column({ type: 'float', nullable: true })
    scholarshipPercentage!: number;
}