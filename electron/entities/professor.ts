import {Column, Entity, JoinColumn, ManyToOne, OneToMany, OneToOne, PrimaryGeneratedColumn} from "typeorm";
import { CIVILITY, FAMILY_SITUATION } from "@electron/command";
import {FileEntity} from "@electron/entities/file.ts";

@Entity("T_professor")
export class ProfessorEntity {
    @PrimaryGeneratedColumn()
    id?: number;
    @Column({type:"text"})
    firstname?: string;
    @Column({type:"text"})
    lastname?: string;
    @Column({type:"text"})
    civility?: CIVILITY;
    @Column({type:"text"})
    family_situation?: FAMILY_SITUATION;
    @Column({type:"date"})
    birth_date?: Date;
    @Column({type:"text"})
    birth_country?: string;
    @Column({type:"text"})
    birth_town?: string;
    @Column({type:"text"})
    address?: string;
    @Column({type:"text"})
    phone_number?: string;
    @Column({type:"text"})
    town?: string;
    @Column({type:"text"})
    cni_number?: string;

    @OneToMany(() => QualificationEntity , qualification=>qualification.professor)
    qualifications?: QualificationEntity[];
}

@Entity("T_qualification")
export class QualificationEntity {
    @PrimaryGeneratedColumn()
    id?: number;
    @Column({type:"text"})
    name?: string;
    @OneToOne(() => FileEntity , {onDelete:"SET NULL"})
    @JoinColumn()
    attachement?:FileEntity
    @ManyToOne(()=>ProfessorEntity , {onDelete:"CASCADE"})
    professor?:ProfessorEntity

}