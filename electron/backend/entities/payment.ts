import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { StudentEntity } from "./students";

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
}