import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index } from "typeorm";
import { GradeEntity } from "./grade";

@Entity('grade_config')
export class GradeConfigEntity {
    @PrimaryGeneratedColumn()
    id!: number;
     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
    @ManyToOne(() => GradeEntity, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'grade_id' })
    @Index({ unique: true })
    grade!: GradeEntity;

    @Column({ type: 'integer', default: 2 })
    numberOfAssignments!: number;

    @Column({ type: 'real', default: 0.4 })
    assignmentWeight!: number;

    @Column({ type: 'real', default: 0.6 })
    examWeight!: number;
} 