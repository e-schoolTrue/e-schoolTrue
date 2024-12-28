import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, OneToMany } from "typeorm";
import { TeachingAssignmentEntity } from "./teaching";
import { FileEntity } from "./file";

@Entity("professors")
export class ProfessorEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "text" })
    firstname!: string;

    @Column({ type: "text" })
    lastname!: string;

    @Column({ type: "text" })
    civility!: string;

    @Column({ type: "int", nullable: true })
    nbr_child!: number;

    @Column({ type: "text" })
    family_situation!: string;

    @Column({ type: 'datetime', nullable: true })
    birth_date!: Date;

    @Column({ type: "text" })
    birth_town!: string;

    @Column({ type: "text" })
    address!: string;

    @Column({ type: "text" })
    town!: string;

    @Column({ type: "text" })
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
