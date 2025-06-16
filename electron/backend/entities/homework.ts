import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { CourseEntity } from "./course";
import { GradeEntity } from "./grade";
import { ProfessorEntity } from "./professor";

@Entity("homework")
export class HomeworkEntity {
    @PrimaryGeneratedColumn()
    id!: number;
     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
    @Column("text")
    description!: string;

    @Column("date")
    dueDate!: Date;

    @ManyToOne(() => CourseEntity)
    course!: CourseEntity;

    @ManyToOne(() => GradeEntity)
    grade!: GradeEntity;

    @ManyToOne(() => ProfessorEntity, { onDelete: "CASCADE" })
    professor!: ProfessorEntity;

    @CreateDateColumn()
    createdAt!: Date;

    @Column({ type: "boolean", default: false })
    isCompleted!: boolean;
} 