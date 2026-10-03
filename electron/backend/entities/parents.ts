import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  Index,
} from "typeorm";

import type { StudentEntity } from "./students";

/**
 * ParentEntity — Option B Table Parent (Expand seulement).
 *
 * - Table `T_parent` : un foyer = 1 ligne (père + mère + tél + adresse).
 * - `T_student.parentId` (FK nullable) pointe vers le foyer ; les colonnes
 *   à-plat de `T_student` (fatherFirstname/..., `famillyPhone` typo 2L
 *   historique conservée) NE SONT PAS supprimées (phase Expand).
 * - `normalizedPhone` UNIQUE NULL : SQLite autorise N NULL (jamais `''` —
 *   le service/la migration écrivent `NULL`, contrainte fail-fast en migration).
 * - `suspect` : `'no-key'` pour P3 (orphelin sans clé, jamais fusionné),
 *   sinon `NULL`. Les recomposés/homonymes ne sont jamais fusionnés :
 *   clé = tél normalisé (P1) OU quadruplet exact (P2).
 * - `remote_id` UNIQUE NULL : réservé sync Supabase future ; clonage année
 *   (configs-only, jamais d'élèves) n'a rien à backfiller côté parent.
 */
@Entity("T_parent")
@Index("UQ_parent_normalizedPhone", ["normalizedPhone"], { unique: true })
@Index("IDX_parent_names", ["fatherLastname", "fatherFirstname", "motherLastname", "motherFirstname"])
export class ParentEntity {
  @PrimaryGeneratedColumn()
  id!: number;

  // Noms NOT NULL (jamais NULL : `''` = inconnu à-plat, la clé P2 utilise
  // la forme normalisée ; `"|||"` = P3).
  @Column({ type: "text", default: "" })
  fatherFirstname!: string;

  @Column({ type: "text", default: "" })
  fatherLastname!: string;

  @Column({ type: "text", default: "" })
  motherFirstname!: string;

  @Column({ type: "text", default: "" })
  motherLastname!: string;

  /** Typo historique `famillyPhone` (2L) conservée — ne pas renommer. */
  @Column({ type: "text", nullable: true })
  famillyPhone?: string | null;

  /** E.164 ou NULL (jamais `''`). UNIQUE (NULL multiples autorisés). */
  @Column({ type: "varchar", length: 20, nullable: true, unique: true })
  normalizedPhone?: string | null;

  @Column({ type: "text", nullable: true })
  address?: string | null;

  /** `'no-key'` (P3 orphelin, jamais fusionné) sinon `NULL`. */
  @Column({ type: "varchar", length: 16, nullable: true })
  suspect?: string | null;

  /** UUID Supabase (sync future). UNIQUE NULL. */
  @Column({ type: "varchar", length: 36, nullable: true, unique: true })
  remote_id?: string | null;

  @Column({ type: "varchar", length: 36, nullable: true })
  user_id?: string | null;

  @CreateDateColumn()
  createdAt?: Date;

  @UpdateDateColumn()
  updatedAt?: Date;

  @OneToMany("StudentEntity", "parent")
  students?: StudentEntity[];
}
