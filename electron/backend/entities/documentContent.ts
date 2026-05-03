import { 
  Column, 
  Entity, 
  PrimaryGeneratedColumn, 
  CreateDateColumn, 
  UpdateDateColumn 
} from "typeorm";

@Entity("document_content")
export class DocumentContentEntity {

  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column({ type: "varchar", length: 36, nullable: true, unique: true })
  remote_id?: string;

  @Column({ type: "text", nullable: true })
  inscription: string;

  @Column({ type: "text", nullable: true })
  scolarite: string;

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;
}