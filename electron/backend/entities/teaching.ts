import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, ManyToMany, JoinTable, JoinColumn, DeleteDateColumn, UpdateDateColumn, CreateDateColumn } from "typeorm";
import { ProfessorEntity } from "./professor";
import { GradeEntity } from "./grade";
import { CourseEntity } from "./course";
import { TEACHING_TYPE } from "../../command";

@Entity("teaching_assignment")
export class TeachingAssignmentEntity {
    @PrimaryGeneratedColumn()
    id!: number;

     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
     @Column({ type: "varchar", length: 36, nullable: true })
     user_id?: string;
    @ManyToOne(() => ProfessorEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: "professorId" })
    professor!: ProfessorEntity;

    @Column({ type: 'varchar' })
    teachingType!: TEACHING_TYPE;

    @Column({ type: 'varchar' })
    schoolType!: string;

    @ManyToOne(() => GradeEntity, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn()
    class?: GradeEntity;

    @ManyToMany(() => GradeEntity)
    @JoinTable({
        name: "teaching_grades",
        joinColumn: { name: "teaching_id", referencedColumnName: "id" },
        inverseJoinColumn: { name: "grade_id", referencedColumnName: "id" }
    })
    grades?: GradeEntity[];

    @ManyToOne(() => CourseEntity, { nullable: true, onDelete: 'SET NULL' })
    @JoinColumn()
    course?: CourseEntity;

    @Column("simple-array", { nullable: true })
    gradeIds?: string;

    @Column({ type: 'varchar', nullable: true })
    gradeNames?: string;

    @DeleteDateColumn()
    deleted_at?: Date;
    @CreateDateColumn()
    created_at?: Date;
    @UpdateDateColumn()
    updated_at?: Date;
} 