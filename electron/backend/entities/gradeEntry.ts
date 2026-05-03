import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, UpdateDateColumn, JoinColumn, Index } from "typeorm";
import { StudentEntity } from "./students";
import { CourseEntity } from "./course";

/**
 * Entrée de note individuelle pour une catégorie d'évaluation
 * Ex: Devoir 1 de Math pour l'élève X
 */
@Entity("grade_entry")
@Index(["studentId", "courseId", "period", "categoryId"])
export class GradeEntryEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: 'int' })
    studentId: number;

    @Column({ type: 'int' })
    courseId: number;

    @Column({ type: 'int' })
    categoryId: number; // ID de la catégorie (DEV, COM, etc.)

    @Column({ type: 'varchar', length: 100 })
    period: string; // "Trimestre 1", "Semestre 1", etc.

    @Column({ type: 'float' })
    score: number; // Note obtenue

    @Column({ type: 'float' })
    maxScore: number; // Note maximale pour cette évaluation

    @Column({ type: 'varchar', length: 200, nullable: true })
    label: string | null; // "Devoir 1", "Compo finale", etc.

    @Column({ type: 'date', nullable: true })
    evaluationDate: Date | null;

    @Column({ type: 'text', nullable: true })
    comment: string | null;

    @ManyToOne(() => StudentEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: 'studentId' })
    student: StudentEntity;

    @ManyToOne(() => CourseEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: 'courseId' })
    course: CourseEntity;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

/**
 * Résultat calculé pour une matière (cache pour performance)
 */
@Entity("calculated_grade")
@Index(["studentId", "courseId", "period"], { unique: true })
export class CalculatedGradeEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: 'int' })
    studentId: number;

    @Column({ type: 'int' })
    courseId: number;

    @Column({ type: 'varchar', length: 100 })
    period: string;

    @Column({ type: 'float' })
    finalAverage: number; // Moyenne finale calculée

    @Column({ type: 'int' })
    configId: number; // ID de la config utilisée pour le calcul

    @Column({ type: 'simple-json', nullable: true })
    categoryBreakdown: any; // Détails par catégorie (pour affichage)

    @Column({ type: 'text', nullable: true })
    appreciation: string | null;

    @ManyToOne(() => StudentEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: 'studentId' })
    student: StudentEntity;

    @ManyToOne(() => CourseEntity, { onDelete: "CASCADE" })
    @JoinColumn({ name: 'courseId' })
    course: CourseEntity;

    @CreateDateColumn()
    createdAt: Date;

    @UpdateDateColumn()
    updatedAt: Date;
}

