import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from "typeorm";
import { ProfessorEntity } from "./professor";

@Entity("professor_payments")
export class ProfessorPaymentEntity {
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
    type!: string;

    @Column({ type: "varchar", nullable: false, default: 'cash' })
    paymentMethod!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @ManyToOne(() => ProfessorEntity, professor => professor, { onDelete: "CASCADE" })
    professor!: ProfessorEntity;

    @Column({ type: "integer" })
    professorId!: number;

    @Column({ type: "varchar" })
    month!: string;

    @Column({ type: "varchar", length: 32, nullable: true, unique: true })
    reference?: string;

    @Column({ type: "varchar", nullable: true })
    comment?: string;

    @Column("decimal", { precision: 7, scale: 2, default: 0 })
    hoursTotal!: number;

    @Column("decimal", { precision: 14, scale: 2, default: 0 })
    hourlyRate!: number;

    @Column({ type: "integer", nullable: true })
    salarySlipId?: number;

    @Column({ type: "boolean", default: false })
    isPaid!: boolean;

    @Column("decimal", { precision: 14, scale: 2, default: 0 })
    grossAmount!: number;

    @Column("decimal", { precision: 14, scale: 2, default: 0 })
    netAmount!: number;

    @Column("simple-json", { nullable: true })
    deductions!: Array<{
        name: string;
        amount: number;
        description?: string;
    }>;

    @Column("simple-json", { nullable: true })
    additions?: {
        name: string;
        amount: number;
        description?: string;
    }[];

    @CreateDateColumn()
    created_at?: Date;
    @UpdateDateColumn()
    updated_at?: Date;
    @DeleteDateColumn()
    deleted_at?: Date;
}
