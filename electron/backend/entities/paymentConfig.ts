import { Entity, PrimaryGeneratedColumn, Column, OneToMany, OneToOne, JoinColumn, ManyToOne } from "typeorm";
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

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    inscriptionFee!: number;

    @Column("decimal", { precision: 10, scale: 2, default: 0 })
    reInscriptionFee!: number;

    @Column("boolean", { default: false })
    allowScholarship!: boolean;

    @Column("simple-array", { nullable: true })
    scholarshipPercentages?: number[];

    @Column("text", { nullable: true })
    scholarshipCriteria?: string;

    @OneToMany(() => ScholarshipEntity, scholarship => scholarship.config)
    scholarships!: ScholarshipEntity[];
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


@Entity("payment_annual_config")
export class PaymentAnnualConfigEntity{
    @PrimaryGeneratedColumn()
    id?: number;
    @Column({ type: "numeric"})
    trancheCount?: number;
    @OneToOne(() => GradeEntity, {onDelete: 'CASCADE'})
    @JoinColumn()
    grade?:GradeEntity
    @OneToMany(() => TranchConfigEntity, tranch => tranch.paymentAnnualConfig)
    tranches?: TranchConfigEntity[]
}


@Entity("tranch_config")
export class TranchConfigEntity {
    @PrimaryGeneratedColumn()
    id?: number;
    @Column({ type: "varchar"})
    tranchName?: string;
    @Column({ type: "decimal", precision: 10, scale: 2, default: 0 })
    amount!: number;
    @Column({ type: "integer" })
    tranchMonthCount?: number;
    @ManyToOne(() => PaymentAnnualConfigEntity, {onDelete: 'CASCADE'})
    paymentAnnualConfig?:PaymentAnnualConfigEntity
    @OneToMany(() => TrancheEntryEntity, tranch => tranch.tranchConfig)
    entries?: TrancheEntryEntity[];
}

@Entity("mensuality_tranch")
export class TrancheEntryEntity {
    @PrimaryGeneratedColumn()
    id?: number;
    @Column({ type: "date"})
    startDate?: Date;
    @Column({ type: "date"})
    endDate?: Date;
    @ManyToOne(() => TranchConfigEntity, {onDelete: 'CASCADE'})
    tranchConfig?:TranchConfigEntity
}

