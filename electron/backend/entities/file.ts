import { Column, Entity, ManyToOne, PrimaryGeneratedColumn, CreateDateColumn } from "typeorm";
import { StudentEntity } from "./students";
import { ProfessorEntity } from "./professor";

@Entity("T_file")
export class FileEntity {
    @PrimaryGeneratedColumn()
    id!: number;

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
}
