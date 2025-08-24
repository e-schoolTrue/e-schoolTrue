import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, JoinColumn } from "typeorm";
import { ScholarshipEntity } from "./scholarship";
import { GradeEntity } from "./grade";

@Entity("payment_configs")
export class PaymentConfigEntity {
    @PrimaryGeneratedColumn()
    id!: number;
    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;
    @Column({ type: "varchar", length: 36, nullable: true })
    user_id?: string;
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

@Entity("payment_fee")
export class PaymentFeeEntity {
    @PrimaryGeneratedColumn()
    id?: number;
    @Column({ type: "decimal", precision: 10, scale: 2 })
    mensualityAmount?: number;
    @OneToOne(() => GradeEntity, {onDelete: 'CASCADE'})
    @JoinColumn()
    grade:GradeEntity
}

@Entity("inscription_fee")
export class InscriptionFeeEntity {
    @PrimaryGeneratedColumn()
    id?: number;
    @Column({ type: "decimal", precision: 10, scale: 2 })
    inscriptionFeeAmount?: number;
    @OneToOne(() => GradeEntity, {onDelete: 'CASCADE'})
    @JoinColumn()
    grade:GradeEntity
}

@Entity("tranch_config")
export class TranchConfigEntity {
    @PrimaryGeneratedColumn()
    id?: number;
    @Column({ type: "varchar", length: 255 })
    tranchName?: string;
    @Column({ type: "integer" })
    tranchMonthCount?: number;
    @OneToOne(() => GradeEntity, {onDelete: 'CASCADE'})
    @JoinColumn()
    grade:GradeEntity
}

