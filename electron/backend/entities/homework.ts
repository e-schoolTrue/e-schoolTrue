import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { CourseEntity } from "./course";
import { GradeEntity } from "./grade";
import { ProfessorEntity } from "./professor";

@Entity("homework")
export class HomeworkEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column("text")
    description!: string;

    @Column("date")
    dueDate!: Date;

    @ManyToOne(() => CourseEntity)
    course!: CourseEntity;

    @ManyToOne(() => GradeEntity)
    grade!: GradeEntity;

    @ManyToOne(() => ProfessorEntity)
    professor!: ProfessorEntity;

    @CreateDateColumn()
    createdAt!: Date;

    @Column({ type: "boolean", default: false })
    isCompleted!: boolean;
} 