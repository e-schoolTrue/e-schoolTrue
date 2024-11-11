import { Column, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { StudentEntity } from "./students";  // Assurez-vous que le chemin d'importation est correct

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

    @Column({ type: "datetime", default: () => "CURRENT_TIMESTAMP" })
    createdAt!: Date;

    @ManyToOne(() => StudentEntity, student => student.documents, { onDelete: "CASCADE" })
    student?: StudentEntity;
}
