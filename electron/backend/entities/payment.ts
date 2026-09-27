import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn, UpdateDateColumn, DeleteDateColumn, Index } from "typeorm";
import { StudentEntity } from "./students";
import { ScholarshipEntity } from "./scholarship";

@Entity("payments")
@Index("IDX_payment_created_at", ["created_at"])
@Index("IDX_payment_schoolYear", ["schoolYear"])
@Index("IDX_payment_studentId", ["studentId"])
export class PaymentEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;
    @Column({ type: "varchar", length: 36, nullable: true })
    user_id?: string;
    @Column("decimal", { precision: 14, scale: 2 })
    amount!: number;

    @Column({ type: "varchar", length: 10, nullable: true })
    currency?: string;

    @Column({ type: "varchar", length: 64, nullable: true, unique: true })
    idempotencyKey?: string;

    @Column({ type: "varchar", nullable: false })
    paymentType!: string;

    @Column({ 
        type: "varchar", 
        nullable: false,
        default: 'cash'
    })
    paymentMethod!: string;

    @CreateDateColumn()
    created_at!: Date;
    @UpdateDateColumn()
    updated_at?: Date;
    @DeleteDateColumn()
    deleted_at?: Date;

    @ManyToOne(() => StudentEntity, student => student.payments, { onDelete: "CASCADE" })
    @JoinColumn({ name: "studentId" })
    student!: StudentEntity;

    @Column({ type: "integer", nullable: true })
    studentId?: number;

    /** Numéro de reçu atomique R-YYYY-NNNN, idempotent. */
    @Column({ type: "varchar", length: 20, nullable: true, unique: true })
    receiptNumber?: string;


    @Column({ type: "integer", default: 1 })
    installmentNumber!: number;

    @Column({ 
        type: "varchar",
        default: () => `'${new Date().getFullYear()}'`
    })
    schoolYear!: string;

    @Column({ type: "varchar", nullable: true })
    comment?: string;

    @ManyToOne(() => ScholarshipEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: "scholarshipId" })
    scholarship?: ScholarshipEntity;

    @Column({ type: "integer", nullable: true })
    scholarshipId?: number;

    @Column("decimal", { precision: 14, scale: 2, nullable: true })
    baseAmount!: number;

    @Column("decimal", { precision: 14, scale: 2, nullable: true })
    scholarshipAmount!: number;

    @Column("decimal", { precision: 14, scale: 2, nullable: true })
    adjustedAmount!: number;

    @Column("decimal", { precision: 14, scale: 2, nullable: true })
    scholarshipPercentage!: number;
}