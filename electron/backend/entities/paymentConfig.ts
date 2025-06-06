import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from "typeorm";
import { ScholarshipEntity } from "./scholarship";

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

    @Column("boolean", { default: false })
    allowScholarship!: boolean;

    @Column("simple-array", { nullable: true })
    scholarshipPercentages?: number[];

    @Column("text", { nullable: true })
    scholarshipCriteria?: string;

    @OneToMany(() => ScholarshipEntity, scholarship => scholarship.config)
    scholarships!: ScholarshipEntity[];
} 