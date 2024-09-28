import {Column, CreateDateColumn, DeleteDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";


@Entity("T_file")
export class FileEntity{
    @PrimaryGeneratedColumn()
    id?: number
    @Column({type: "text"})
    name?: string
    @Column({ type: "blob", nullable: true })
    content?: Buffer;    
    @Column({type: "numeric"})
    size?: number
    @Column({type: "text"})
    type?: string
    @CreateDateColumn()
    createdAt?: Date
    @UpdateDateColumn()
    updatedAt?: Date
    @DeleteDateColumn()
    deletedAt?: Date
}