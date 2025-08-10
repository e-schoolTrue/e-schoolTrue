import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, CreateDateColumn, JoinColumn, DeleteDateColumn, UpdateDateColumn } from "typeorm";
import { StudentEntity } from "./students";
import { ProfessorEntity } from "./professor";
import { CourseEntity } from "./course";
import { GradeEntity } from "./grade";
import { FileEntity } from "./file";

@Entity("absences")
export class AbsenceEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    // ✅ UUID de Supabase (ajouté pour synchronisation distante)
    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: "varchar", length: 36, nullable: true })
    user_id?: string;

    @Column("date")
    date!: Date;

    @Column("text")
    reason!: string;

    @Column({
        type: "varchar",
        enum: ["MEDICAL", "FAMILY", "UNAUTHORIZED", "SCHOOL_ACTIVITY", "OTHER"]
    })
    reasonType!: string;

    @Column({
        type: "varchar",
        enum: ["FULL_DAY", "MORNING", "AFTERNOON", "COURSE"]
    })
    absenceType!: string;

    @Column({ type: "boolean", default: false })
    justified!: boolean;

    @Column({ type: "time", nullable: true })
    startTime?: string;

    @Column({ type: "time", nullable: true })
    endTime?: string;

    @Column({ type: "text", nullable: true })
    comments?: string;

    @ManyToOne(() => StudentEntity, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'studentId' }) 
    student?: StudentEntity;

    @ManyToOne(() => ProfessorEntity, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'professorId' })
    professor?: ProfessorEntity;

    @ManyToOne(() => GradeEntity)
    grade!: GradeEntity;

    @ManyToOne(() => CourseEntity, { nullable: true })
    course?: CourseEntity;

    @ManyToOne(() => FileEntity, { nullable: true })
    @JoinColumn()
    document?: FileEntity;

    @CreateDateColumn()
    created_at?: Date;
    @DeleteDateColumn()
    deleted_at?: Date;
    @UpdateDateColumn()
    updated_at?: Date;

    @Column({ type: "boolean", default: false })
    parentNotified!: boolean;

    @Column({
        type: "varchar",
        enum: ["STUDENT", "PROFESSOR"],
        default: "STUDENT"
    })
    type!: string;
    }
