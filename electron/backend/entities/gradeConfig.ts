import { Entity, PrimaryGeneratedColumn, Column, ManyToOne } from "typeorm";
import { GradeEntity } from "./grade";
import { CourseEntity } from "./course";

@Entity("grade_configurations")
export class GradeConfigEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @ManyToOne(() => GradeEntity)
    grade!: GradeEntity;

    @ManyToOne(() => CourseEntity)
    course!: CourseEntity;

    @Column({ type: "varchar" })
    schoolYear!: string;

    @Column({ type: "int" })
    numberOfAssignments!: number;

    @Column({ type: "int" })
    assignmentWeight!: number;

    @Column({ type: "int" })
    examWeight!: number;

    @Column({ type: 'simple-json', nullable: true })
    appreciationRanges!: {
        excellent: { min: number; max: number };
        veryGood: { min: number; max: number };
        good: { min: number; max: number };
        average: { min: number; max: number };
        poor: { min: number; max: number };
    };
} 