import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from "typeorm";
import { ProfessorEntity } from "./professor";
import { StudentEntity } from "./students";

@Entity("vacation")
export class VacationEntity {
    @PrimaryGeneratedColumn()
    id!: number;

     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
     @Column({ type: "varchar", length: 36, nullable: true })
     user_id?: string;

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

    @ManyToOne(() => ProfessorEntity, { nullable: true , onDelete:"CASCADE"})
    professor?: ProfessorEntity;

    @ManyToOne(() => StudentEntity, { nullable: true , onDelete:"CASCADE"})
    student?: StudentEntity;

    @CreateDateColumn()
    createdAt!: Date;

    @Column("text", { nullable: true })
    comment?: string;

    @CreateDateColumn()
    created_at?: Date;
    @UpdateDateColumn()
    updated_at?: Date;
    @DeleteDateColumn()
    deleted_at?: Date;
} 