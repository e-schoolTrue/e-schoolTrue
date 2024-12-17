import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn } from "typeorm";
import { StudentEntity } from "./students";
import { GradeEntity } from "./grade";

@Entity("report_cards")
export class ReportCardEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar" })
    period!: string; // Trimestre 1, Trimestre 2, etc.

    @Column({ type: "varchar" })
    schoolYear!: string;

    @Column({ type: "simple-json" })
    grades!: {
        courseId: number;
        courseName: string;
        coefficient: number;
        grade: number;
        appreciation: string;
    }[];

    @Column({ type: "text", nullable: true })
    generalAppreciation?: string;

    @Column({ type: "numeric", precision: 5, scale: 2 })
    average!: number;

    @Column({ type: "numeric", precision: 5, scale: 2 })
    classAverage!: number;

    @Column({ type: "integer" })
    rank!: number;

    @Column({ type: "integer" })
    totalStudents!: number;

    @ManyToOne(() => StudentEntity)
    student!: StudentEntity;

    @ManyToOne(() => GradeEntity)
    grade!: GradeEntity;

    @CreateDateColumn()
    createdAt!: Date;
} 