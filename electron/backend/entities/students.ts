import {Column, CreateDateColumn, Entity, OneToOne, PrimaryGeneratedColumn, BeforeInsert, JoinColumn} from "typeorm";
import {FileEntity} from "./file.ts";

@Entity('T_student')
export class StudentEntity {
    @PrimaryGeneratedColumn()
    id?: number

    @Column({type: "text"})
    firstname?: string

    @Column({type: "text"})
    lastname?: string

    @Column({type: "text"})
    matricule?: string

    @Column({type: "text"})
    fatherFirstname?: string

    @Column({type: "text"})
    fatherLastname?: string

    @Column({type: "text"})
    motherFirstname?: string

    @Column({type: "text"})
    motherLastname?: string

    @CreateDateColumn()
    createdAt?: Date

    // Relation avec FileEntity pour la photo
    @OneToOne(() => FileEntity)
    @JoinColumn() // Ajout explicite de JoinColumn pour lier correctement la clé étrangère
    photo?: FileEntity

    @Column({type: "date"})
    birthDay?: Date

    @Column({type: "text"})
    birthPlace?: string

    @Column({type: "text"})
    address?: string

    @Column({type: "text"})
    famillyPhone?: string

    @Column({type: "text"})
    personalPhone?: string

    @BeforeInsert()
    generateMatricule() {
        const currentYear = new Date().getFullYear();
        const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.matricule = `${currentYear}${randomPart}`;
    }
}
