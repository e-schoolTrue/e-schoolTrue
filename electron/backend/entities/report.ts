import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn } from "typeorm";
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

    @Column('simple-array', { 
        nullable: true,
        transformer: {
            to: (value: number[] | null): string | null => {
                if (!value || !Array.isArray(value)) {
                    console.log('Transformation TO - valeur invalide:', value);
                    return null;
                }
                const result = value.map(v => String(v || 0)).join(',');
                console.log('Transformation TO - résultat:', result);
                return result;
            },
            from: (value: any): number[] => {
                console.log('Transformation FROM - valeur reçue:', value);
                // Si la valeur est déjà un tableau
                if (Array.isArray(value)) {
                    return value.map(v => Number(v) || 0);
                }
                // Si c'est une chaîne
                if (typeof value === 'string') {
                    return value.split(',').map(v => Number(v) || 0);
                }
                // Valeur par défaut
                console.log('Transformation FROM - retour tableau vide');
                return [];
            }
        }
    })
    assignmentGrades!: number[];

    @Column({ type: 'float', nullable: true })
    examGrade!: number;

    @Column({ type: 'float', nullable: true })
    finalGrade!: number;

    @Column({ type: 'varchar', nullable: true })
    appreciation!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @ManyToOne(() => StudentEntity)
    student!: StudentEntity;

    @ManyToOne(() => CourseEntity, { eager: true })
    @JoinColumn({ name: 'courseId' })
    course!: CourseEntity;
} 