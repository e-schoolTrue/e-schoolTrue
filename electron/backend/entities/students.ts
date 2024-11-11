import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  BeforeInsert,
  JoinColumn,
  OneToMany,
} from "typeorm";
import { FileEntity } from "./file"; // Assurez-vous que le chemin d'importation est correct
import { PaymentEntity } from "./payment";
import { AbsenceEntity } from "./absence";

@Entity("T_student")
export class StudentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  @Column({ type: "text" })
  firstname?: string;

  @Column({ type: "text" })
  lastname?: string;

  @Column({ type: "text" })
  matricule?: string;

  @Column({ type: "text" })
  fatherFirstname?: string;

  @Column({ type: "text" })
  fatherLastname?: string;

  @Column({ type: "text" })
  motherFirstname?: string;

  @Column({ type: "text" })
  motherLastname?: string;

  @CreateDateColumn()
  createdAt?: Date;

  // Relation avec FileEntity pour le document
  @OneToOne(() => FileEntity)
  @JoinColumn({ name: "documentId" })
  document?: FileEntity;

  // Relation avec FileEntity pour la photo
  @OneToOne(() => FileEntity, { nullable: true })
  @JoinColumn({ name: "photoId" })
  photo?: FileEntity;

  @Column({ type: "int", nullable: true })
  photoId?: number;

  @Column({ type: "date" })
  birthDay?: Date;

  @Column({ type: "text" })
  birthPlace?: string;

  @Column({ type: "text" })
  address?: string;

  @Column({ type: "text" })
  famillyPhone?: string;

  @Column({ type: "text" })
  personalPhone?: string;

  @Column({ type: "int", nullable: true })
  classId?: number | null;

  @OneToMany(() => AbsenceEntity, (absence) => absence.student, {
    cascade: true,
    eager: true,
  })
  absences?: AbsenceEntity[];

  @BeforeInsert()
  generateMatricule() {
    const currentYear = new Date().getFullYear();
    const randomPart = Math.floor(Math.random() * 10000)
      .toString()
      .padStart(4, "0");
    this.matricule = `${currentYear}${randomPart}`;
  }

  @Column({ type: "text", nullable: true })
  sex?: "male" | "female";

  @Column({ type: "text", nullable: true })
  schoolYear?: string;

  // Relation OneToMany avec FileEntity pour les documents
  @OneToMany(() => FileEntity, (file) => file.student, {
    cascade: true, // Ajouter cascade pour sauvegarder automatiquement les documents
    eager: true, // Charger automatiquement les documents
  })
  documents?: FileEntity[];

  // Relation OneToMany avec PaymentEntity pour les paiements
  @OneToMany(() => PaymentEntity, (payment) => payment.student, {
    cascade: true,
    eager: true,
  })
  payments?: PaymentEntity[];
}
