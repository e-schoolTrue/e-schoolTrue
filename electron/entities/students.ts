import { Column, CreateDateColumn, Entity, OneToOne, PrimaryGeneratedColumn, BeforeInsert, JoinColumn, ManyToOne, OneToMany } from "typeorm";
import { FileEntity } from "./file.ts"; // Assurez-vous que le chemin d'importation est correct
import { ClassRoomEntity } from "./grade.ts"; // Assurez-vous que le chemin d'importation est correct
import { PaymentEntity } from './payment.ts';
import { AbsenceEntity } from './absence.ts';

@Entity('T_student')
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

    @ManyToOne(() => ClassRoomEntity, { nullable: true })
    @JoinColumn({ name: "classId" })
    class?: ClassRoomEntity;

    @Column({ type: "int", nullable: true })
    classId?: number | null;

    @BeforeInsert()
    generateMatricule() {
        const currentYear = new Date().getFullYear();
        const randomPart = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
        this.matricule = `${currentYear}${randomPart}`;
    }

    @Column({ type: "text", nullable: true })
    sex?: 'male' | 'female';

    @Column({ type: "text", nullable: true })
    schoolYear?: string;

    // Nouveaux champs
    @Column({ type: "text", nullable: true })
    nationality?: string;

    @Column({ type: "text", nullable: true })
    fatherProfession?: string;

    @Column({ type: "text", nullable: true })
    fatherEmail?: string;

    @Column({ type: "text", nullable: true })
    motherProfession?: string;

    @Column({ type: "text", nullable: true })
    motherEmail?: string;

    @Column({ type: "text", nullable: true })
    bloodGroup?: string;

    @Column({ type: "text", nullable: true })
    allergies?: string;

    @Column({ type: "text", nullable: true })
    medicalConditions?: string;

    @Column({ type: "text", nullable: true })
    doctorName?: string;

    @Column({ type: "text", nullable: true })
    doctorPhone?: string;

    @Column({ type: "text", nullable: true })
    lastSchool?: string;

    @Column({ type: "text", nullable: true })
    lastClass?: string;

    @Column({ type: "text", nullable: true })
    changeReason?: string;

    @Column({ type: "numeric", nullable: true })
    inscriptionFees?: number;

    @Column({ type: "numeric", nullable: true })
    annualFees?: number;

    @Column({ type: "numeric", nullable: true })
    busFees?: number;

    @Column({ type: "numeric", nullable: true })
    canteenFees?: number;

    @Column({ type: "text", nullable: true })
    paymentMode?: string;

    @Column({ type: "boolean", default: false })
    emergencyConsent?: boolean;

    @Column({ type: "boolean", default: false })
    rulesConsent?: boolean;

    // Relation OneToMany avec FileEntity
    @OneToMany(() => FileEntity, file => file.student)
    documents?: FileEntity[];

    @OneToMany(() => PaymentEntity, payment => payment.student)
    payments!: PaymentEntity[];

    @OneToMany(() => AbsenceEntity, absence => absence.student)
    absences!: AbsenceEntity[];
}
