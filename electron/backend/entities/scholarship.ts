import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne } from "typeorm";
import { StudentEntity } from "./students";
import { PaymentConfigEntity } from "./paymentConfig";

@Entity("scholarships")
export class ScholarshipEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "integer" })
    studentId!: number;

    @Column({ type: "float" })
    percentage!: number;

    @Column({ type: "boolean", default: true })
    isActive!: boolean;

    @Column({ type: "varchar" })
    schoolYear!: string;

    @Column({ type: "varchar", nullable: true })
    reason?: string;

    @CreateDateColumn()
    createdAt!: Date;

    @ManyToOne(() => StudentEntity, student => student.scholarship)
    student!: StudentEntity;

    @ManyToOne(() => PaymentConfigEntity, config => config.scholarships)
    config!: PaymentConfigEntity;

    @Column({ type: "integer", nullable: true })
    configId!: number;
} 