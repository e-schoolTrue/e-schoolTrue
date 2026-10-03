import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn,
    Check,
    Unique,
    Index
} from "typeorm";

export type YearLevel = "PRESCOLAIRE" | "PRIMAIRE" | "SECONDAIRE";

@Entity('year_repartition')
@Check(`"status" IN ('active','closed')`)
@Unique("UQ_year_repartition_schoolYear_level", ["schoolYear", "level"])
@Index("IDX_year_repartition_level", ["level"])
export class YearRepartitionEntity {
    @PrimaryGeneratedColumn()
    id?: number;

     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
     @Column({ type: "varchar", length: 36, nullable: true })
     user_id?: string;

    @Column({ type: 'text', nullable: false })
    schoolYear!: string; // Année scolaire, ex : "2024-2025"

    /**
     * Niveau 3-voies (`PRESCOLAIRE` | `PRIMAIRE` | `SECONDAIRE`).
     * Nullable : `NULL` = année unique legacy (non ventilée, pré-migration).
     * L'unicité `(schoolYear, level)` est garantie côté service (requêtes
     * paramétrées, compatibles SQLite/better-sqlite3), pas par contrainte
     * UNIQUE — les bases legacy avec doublons `schoolYear` restent ouvrables.
     */
    @Column({ type: 'varchar', length: 20, nullable: true, default: 'PRIMAIRE' })
    level?: string | null;


    @Column({ type: 'json', nullable: false })
    periodConfigurations!: {
        start: Date;
        end: Date;
        name: string;
    }[];

    @CreateDateColumn()
    createdAt?: Date;

    @UpdateDateColumn()
    updatedAt?: Date;

    @Column({ type: 'boolean', default: false })
    isCurrent?: boolean;

    @Column({ type: 'varchar', length: 10, default: 'active' })
    status?: string;

    @Column({ type: 'datetime', nullable: true })
    closedAt?: Date | null;

}
