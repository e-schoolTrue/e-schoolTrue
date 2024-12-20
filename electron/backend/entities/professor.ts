import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, OneToMany } from "typeorm";
import { CIVILITY, FAMILY_SITUATION } from "#electron/command";
import { UserEntity } from "#electron/backend/entities/user.ts";
import { ProfessorPaymentEntity } from "./professorPayment";
import { TeachingAssignmentEntity } from "./teaching";
import { FileEntity } from "./file";

@Entity("professors")
export class ProfessorEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column()
    firstname!: string;

    @Column()
    lastname!: string;

    @Column()
    civility!: string;

    @Column()
    nbr_child!: number;

    @Column()
    family_situation!: string;

    @Column({ type: 'datetime', nullable: true })
    birth_date!: Date;

    @Column()
    birth_town!: string;

    @Column()
    address!: string;

    @Column()
    town!: string;

    @Column()
    cni_number!: string;

    @OneToOne(() => FileEntity, { nullable: true })
    @JoinColumn()
    photo?: FileEntity;

    @OneToMany(() => FileEntity, file => file.professor)
    documents!: FileEntity[];

    @OneToOne(() => DiplomaEntity, { nullable: true })
    @JoinColumn()
    diploma?: DiplomaEntity;

    @OneToOne(() => QualificationEntity, { nullable: true })
    @JoinColumn()
    qualification?: QualificationEntity;

    @OneToMany(() => TeachingAssignmentEntity, teaching => teaching.professor)
    teaching!: TeachingAssignmentEntity[];
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
