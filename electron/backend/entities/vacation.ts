import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { ProfessorEntity } from "./professor";
import { StudentEntity } from "./students";

@Entity("vacation")
export class VacationEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column("date")
    startDate!: Date;

    @Column("date")
    endDate!: Date;

    @Column("text")
    reason!: string;

    @Column("varchar")
    status!: 'pending' | 'approved' | 'rejected';

    @Column({ type: "integer", nullable: true })
    professorId?: number;

    @ManyToOne(() => ProfessorEntity, { nullable: true })
    professor?: ProfessorEntity;

    @ManyToOne(() => StudentEntity, { nullable: true })
    student?: StudentEntity;

    @CreateDateColumn()
    createdAt!: Date;

    @Column("text", { nullable: true })
    comment?: string;
} 