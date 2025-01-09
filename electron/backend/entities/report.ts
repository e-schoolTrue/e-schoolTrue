import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { StudentEntity } from "./students";
import { CourseEntity } from "./course";

@Entity("T_report_card")
export class ReportCardEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'int' })
    studentId!: number;

    @Column({ type: 'int' })
    courseId!: number;

    @Column({ type: 'varchar' })
    period!: string;

    @Column('simple-array')
    assignmentGrades!: number[];

    @Column({ type: 'float' })
    examGrade!: number;

    @Column({ type: 'float' })
    finalGrade!: number;

    @Column({ type: 'varchar' })
    appreciation!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @ManyToOne(() => StudentEntity)
    student!: StudentEntity;

    @ManyToOne(() => CourseEntity)
    course!: CourseEntity;
} 