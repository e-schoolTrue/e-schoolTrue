import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { StudentEntity } from "./students";

@Entity('T_absence')
export class AbsenceEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => StudentEntity, student => student.absences)
    student!: StudentEntity;

    @CreateDateColumn({ type: 'datetime' })
    date!: Date;

    @Column('varchar')
    reason!: string;

    @Column('boolean', { default: false })
    justified!: boolean;
}
