import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, OneToMany, ManyToOne } from "typeorm";
import { TeachingAssignmentEntity } from "./teaching";
import { FileEntity } from "./file";

@Entity("professors")
export class ProfessorEntity {
    @PrimaryGeneratedColumn()
    id!: number;

     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
     
    @Column({ type: "text" })
    firstname!: string;

    @Column({ type: "text" })
    lastname!: string;

    @Column({ type: "text", unique: true, nullable: true })
    matricule!: string;

    @Column({ type: "text" })
    civility!: string;

    @Column({ type: "int", nullable: true })
    nbr_child!: number;

    @Column({ type: "text" })
    family_situation!: string;

    @Column({ type: 'datetime', nullable: true })
    birth_date!: Date;

    @Column({ type: "text" })
    birth_town!: string;

    @Column({ type: "text" })
    address!: string;

    @Column({ type: "text" })
    town!: string;

    @Column({ type: "text" })
    cni_number!: string;

    @OneToOne(() => FileEntity, { nullable: true })
    @JoinColumn()
    photo?: FileEntity;

    @OneToMany(() => FileEntity, file => file.professor)
    documents!: FileEntity[];

    @ManyToOne(() => DiplomaEntity, { nullable: true })
    @JoinColumn()
    diploma?: DiplomaEntity;

    @OneToOne(() => QualificationEntity, { nullable: true })
    @JoinColumn()
    qualification?: QualificationEntity;

    @OneToMany(() => TeachingAssignmentEntity, teaching => teaching.professor)
    teaching!: TeachingAssignmentEntity[];

    /**
     * Méthode statique pour générer un matricule
     * Cette méthode sera appelée depuis le service, pas directement dans l'entité
     */
    static generateMatricule(schoolName?: string): string {
        // Générer les initiales de l'école (2-3 lettres)
        let schoolPrefix = "PRF";
        if (schoolName) {
            // Extraire les initiales (première lettre de chaque mot)
            const words = schoolName.split(/\s+/);
            schoolPrefix = words
                .map((word: string) => word.charAt(0).toUpperCase())
                .join('')
                .substring(0, 3); // Limiter à 3 caractères maximum
        }
        
        const currentYear = new Date().getFullYear().toString().substring(2); // Prendre seulement les 2 derniers chiffres
        const randomPart = Math.floor(Math.random() * 10000)
            .toString()
            .padStart(4, "0");
            
        return `${schoolPrefix}-P${currentYear}${randomPart}`;
    }
}

@Entity("qualification")
export class QualificationEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    name: string = '';

    @OneToMany(() => ProfessorEntity, professor => professor.qualification, { onDelete: "CASCADE" })
    professors!: ProfessorEntity[];
}

@Entity("diploma")
export class DiplomaEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    name: string = '';

    @OneToMany(() => ProfessorEntity, professor => professor.diploma, { onDelete: "CASCADE" })
    professors!: ProfessorEntity[];
}
