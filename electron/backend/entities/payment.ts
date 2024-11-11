import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn } from "typeorm";
import { StudentEntity } from "./students";

@Entity('T_payment')
export class PaymentEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "int" })
    amount!: number;

    @Column({ type: "datetime" })
    paymentDate!: Date;

    @Column({ type: "text" })
    paymentType!: string; // "CASH" | "CHEQUE" | "VIREMENT"

    @Column({ type: "text", nullable: true })
    reference?: string;

    @Column({ type: "text", nullable: true })
    notes?: string;

    @ManyToOne(() => StudentEntity, student => student.payments)
    @JoinColumn({ name: "studentId" })
    student!: StudentEntity;

    @Column({ type: "int" })
    studentId!: number;

    @Column({ type: "int" })
    installmentNumber!: number;

    @Column({ type: "text" })
    schoolYear!: string;
}