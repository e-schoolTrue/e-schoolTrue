import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { ProfessorEntity } from "./professor";

@Entity("professor_payments")
export class ProfessorPaymentEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column("decimal", { precision: 10, scale: 2 })
    amount!: number;

    @Column({ type: "varchar", nullable: false })
    type!: string;

    @Column({ type: "varchar", nullable: false, default: 'cash' })
    paymentMethod!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @ManyToOne(() => ProfessorEntity, professor => professor)
    professor!: ProfessorEntity;

    @Column({ type: "integer" })
    professorId!: number;

    @Column({ type: "varchar" })
    month!: string;

    @Column({ type: "varchar", nullable: true })
    reference?: string;

    @Column({ type: "varchar", nullable: true })
    comment?: string;

    @Column({ type: "boolean", default: false })
    isPaid!: boolean;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    grossAmount!: number;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
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
}