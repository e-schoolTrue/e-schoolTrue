import { Column, DeleteDateColumn, Entity, ManyToOne, PrimaryGeneratedColumn } from "typeorm";
import { StudentEntity } from "./students";  // Assurez-vous que le chemin d'importation est correct

@Entity("T_file")
export class FileEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ type: "text" })
    name?: string;

    @Column({ type: "text" })
    path?: string;  // Chemin d'accès au fichier sur le disque

    @Column({ type: "numeric" })
    size?: number;

    @Column({ type: "text" })
    type?: string;

    @Column({ type: "datetime" })
    createdAt?: Date;

    @Column({ type: "datetime" })
    updatedAt?: Date;

    @DeleteDateColumn()
    deletedAt?: Date;

    // Relation ManyToOne avec StudentEntity
    @ManyToOne(() => StudentEntity, student => student.documents, { onDelete: "CASCADE" })
    student?: StudentEntity;
}
