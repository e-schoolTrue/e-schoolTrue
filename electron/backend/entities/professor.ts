import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import { CIVILITY, FAMILY_SITUATION } from "#electron/command";
import { UserEntity } from "#electron/backend/entities/user.ts";

@Entity("professor")
export class ProfessorEntity {
    id?: number;
    firstname?: string;
    lastname?: string;
    civility?: CIVILITY;
    nbr_child?: number;
    family_situation?: FAMILY_SITUATION;
    birth_date?: Date;
    birth_town?: string;
    address?: string;
    town?: string;
    cni_number?: string;

    @OneToOne(() => DiplomaEntity, { onDelete: "CASCADE" })
    @JoinColumn()
    diploma?: DiplomaEntity; // Marqué comme optionnelle

    @OneToOne(() => QualificationEntity, { onDelete: "CASCADE" })
    @JoinColumn()
    qualification?: QualificationEntity; // Marqué comme optionnelle

    @OneToOne(() => UserEntity) // Correction ici : majuscule
    @JoinColumn()
    user?: UserEntity; // Marqué comme optionnelle
}
@Entity("qualification")
export class QualificationEntity {
    @Column()
    name: string = ''; // Initialisation avec une chaîne vide
}

@Entity("diploma")
export class DiplomaEntity {
    @Column()
    name: string = ''; // Initialisation avec une chaîne vide
}
