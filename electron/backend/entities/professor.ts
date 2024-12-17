import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, OneToMany } from "typeorm";
import { CIVILITY, FAMILY_SITUATION } from "#electron/command";
import { UserEntity } from "#electron/backend/entities/user.ts";
import { ProfessorPaymentEntity } from "./professorPayment";
import { TeachingAssignmentEntity } from "./teaching";
import { FileEntity } from "./file";

@Entity("professor")
export class ProfessorEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', nullable: true })
    firstname?: string;

    @Column({ type: 'varchar', nullable: true })
    lastname?: string;

    @Column({ 
        type: 'varchar',
        nullable: true,
        enum: CIVILITY
    })
    civility?: CIVILITY;

    @Column({ type: 'int', nullable: true })
    nbr_child?: number;

    @Column({ 
        type: 'varchar',
        nullable: true,
        enum: FAMILY_SITUATION
    })
    family_situation?: FAMILY_SITUATION;

    @Column({ type: 'date', nullable: true })
    birth_date?: Date;

    @Column({ type: 'varchar', nullable: true })
    birth_town?: string;

    @Column({ type: 'varchar', nullable: true })
    address?: string;

    @Column({ type: 'varchar', nullable: true })
    town?: string;

    @Column({ type: 'varchar', nullable: true })
    cni_number?: string;

    @OneToOne(() => DiplomaEntity, { onDelete: "CASCADE" })
    @JoinColumn()
    diploma?: DiplomaEntity;

    @OneToOne(() => QualificationEntity, { onDelete: "CASCADE" })
    @JoinColumn()
    qualification?: QualificationEntity;

    @OneToOne(() => UserEntity, user => user.professor, {
        cascade: true,
        onDelete: 'CASCADE'
    })
    @JoinColumn()
    user?: UserEntity;

    @OneToMany(() => ProfessorPaymentEntity, payment => payment.professor)
    payments!: ProfessorPaymentEntity[];

    @OneToMany(() => TeachingAssignmentEntity, teaching => teaching.professor)
    teaching!: TeachingAssignmentEntity[];

    @OneToMany(() => FileEntity, file => file.professor)
    documents?: FileEntity[];

    @OneToOne(() => FileEntity, { nullable: true })
    @JoinColumn()
    photo?: FileEntity;
}

@Entity("qualification")
export class QualificationEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    name: string = '';
}

@Entity("diploma")
export class DiplomaEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    name: string = '';
}
