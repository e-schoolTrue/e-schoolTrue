import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { FileEntity } from "./file"; // Assurez-vous que le chemin d'importation est correct

@Entity("school")
export class SchoolEntity {
    @PrimaryGeneratedColumn()
    id?: number; // Identifiant unique, optionnel

    @Column({ type: "varchar", length: 255 })
    name: string = ''; // Nom de l'école

    @Column({ type: "varchar", length: 255 })
    address: string = ''; // Adresse de l'école

    // Relation avec FileEntity pour le logo
    @OneToOne(() => FileEntity, { nullable: true })
    @JoinColumn({ name: "logoId" }) // Colonne pour la relation avec le logo
    logo?: FileEntity;

    @Column({ type: "varchar", length: 20 })
    phoneNumber: string = ''; // Numéro de téléphone

    @Column({ type: "varchar", length: 255 })
    email: string = ''; // Email de l'école

    @Column({ 
        type: "varchar", 
        length: 10, 
        transformer: {
            to: (value: string) => value,
            from: (value: string) => value as 'publique' | 'privée'
        },
        default: 'publique'
    })
    type: 'publique' | 'privée' = 'publique'; // Type d'école (publique ou privée)

    @Column({ type: "int" })
    foundationYear: number = new Date().getFullYear(); // Année de fondation
}
