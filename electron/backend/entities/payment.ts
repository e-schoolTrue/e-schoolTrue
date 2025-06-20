import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn, UpdateDateColumn, DeleteDateColumn } from "typeorm";
import { StudentEntity } from "./students";
import { ScholarshipEntity } from "./scholarship";

@Entity("payments")
export class PaymentEntity {
    @PrimaryGeneratedColumn()
    id!: number;
     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
     @Column({ type: "varchar", length: 36, nullable: true })
     user_id?: string;
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
    created_at!: Date;
    @UpdateDateColumn()
    updated_at?: Date;
    @DeleteDateColumn()
    deleted_at?: Date;

    @ManyToOne(() => StudentEntity, student => student.payments, { onDelete: "CASCADE" })
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

    @ManyToOne(() => ScholarshipEntity, { onDelete: "CASCADE" })
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