import {Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";
import {FILE_TYPE} from "@electron/command";

@Entity("T_file")
export class FileEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ type: "text" })
    name?: string;

    @Column({ type: "blob" })
    content?: Buffer;

    @Column({ type: "text"})
    type?: FILE_TYPE;

    @CreateDateColumn()
    createdAt?: Date;

    @UpdateDateColumn()
    updatedAt?: Date;

    @DeleteDateColumn()
    deletedAt?: Date;
}
