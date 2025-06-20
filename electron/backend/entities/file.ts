import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from "typeorm";
import { StudentEntity } from "./students";
import { ProfessorEntity } from "./professor";

@Entity("T_file")
export class FileEntity {
    @PrimaryGeneratedColumn()
    id!: number;
     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
     @Column({ type: "varchar", length: 36, nullable: true })
     user_id?: string;

    @Column({ type: "text" })
    name!: string;

    @Column({ type: "text" })
    path!: string;

    @Column({ type: "text" })
    type!: string;

    @CreateDateColumn()
    createdAt!: Date;

    @ManyToOne(() => StudentEntity, student => student.documents, { onDelete: "CASCADE" })
    student?: StudentEntity;

    @ManyToOne(() => ProfessorEntity, professor => professor.documents, { onDelete: "CASCADE" })
    professor?: ProfessorEntity;

    @CreateDateColumn()
    created_at?: Date;
    @UpdateDateColumn()
    updated_at?: Date;
    @DeleteDateColumn()
    deleted_at?: Date;
    }
