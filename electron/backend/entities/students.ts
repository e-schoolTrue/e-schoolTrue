import {
  Column,
  CreateDateColumn,
  Entity,
  OneToOne,
  PrimaryGeneratedColumn,
  JoinColumn,
  OneToMany,
  UpdateDateColumn,
  ManyToOne,
  Index,
  DeleteDateColumn,
} from "typeorm";

import { FileEntity } from "./file";
import { GradeEntity } from "./grade";
import { AbsenceEntity } from "./absence";
import { PaymentEntity } from "./payment";
import { ScholarshipEntity } from "./scholarship";

@Entity("T_student")
@Index(["firstname", "lastname", "birthDay"], { unique: true })
export class StudentEntity {
  [x: string]: any;
  @PrimaryGeneratedColumn()
  id!: number;

   // ✅ UUID de Supabase (ajouté pour synchronisation distante)
   @Column({ type: "varchar", length: 36, nullable: true, unique: true })
   remote_id?: string;
   @Column({ type: "varchar", length: 36, nullable: true })
   user_id?: string;
  @Column({ type: "text" })
  firstname?: string;

  @Column({ type: "text" })
  lastname?: string;

  @Column({ type: "text", unique: true })
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
  created_at?: Date;

  @DeleteDateColumn()
  deleted_at?: Date;

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

  @Column({ type: "int", nullable: true })
  documentId?: number;

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
 
  /**
   * Méthode statique pour générer un matricule
   * Cette méthode sera appelée depuis le service, pas directement dans l'entité
   */
  static generateMatricule(schoolName?: string): string {
    // Générer les initiales de l'école (2-3 lettres)
    let schoolPrefix = "STD";
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
      
    return `${schoolPrefix}-S${currentYear}${randomPart}`;
  }

  @Column({ type: "text", nullable: true })
  sex?: "male" | "female";

  @Column({ type: "text", nullable: true })
  schoolYear?: string;

  // Nouveaux champs

  // Relation OneToMany avec FileEntity
  @OneToMany(() => FileEntity, (file) => file.student)
  documents?: FileEntity[];

  @ManyToOne(() => GradeEntity, (grade) => grade.students, { nullable: false })
  @JoinColumn({ name: "gradeId" })
  grade!: GradeEntity;

  // Ajouter les relations avec Absence et Payment
  @OneToMany(() => AbsenceEntity, (absence) => absence.student)
  absences!: AbsenceEntity[];

  @OneToMany(() => PaymentEntity, (payment) => payment.student)
  payments!: PaymentEntity[];

  @UpdateDateColumn()
  updated_at?: Date;

  @OneToMany(() => ScholarshipEntity, scholarship => scholarship.student)
  scholarship!: ScholarshipEntity[];
}
