import { Entity, PrimaryColumn, Column } from "typeorm";

/**
 * @deprecated DEPRECATED — plus utilisé depuis la bascule au mot de passe de
 * connexion de l'utilisateur courant (`AccountingAuthService.verify` compare
 * via bcrypt au hash de `UserEntity`). Table conservée vide pour compatibilité
 * (aucune lecture/écriture, ne bloque plus aucune opération).
 */
@Entity("accounting_vault")
export class AccountingVaultEntity {
    @PrimaryColumn({ type: "integer" })
    id!: number;

    /** Hash bcrypt du secret partagé. NULL = secret jamais configuré. */
    @Column({ type: "varchar", nullable: true })
    secretHash!: string | null;

    @Column({ type: "datetime", nullable: true })
    setAt!: Date | null;

    /** Id de l'admin ayant configuré / réinitialisé le secret en dernier. */
    @Column({ type: "int", nullable: true })
    updatedBy!: number | null;

    @Column({ type: "int", default: 0 })
    failedAttempts!: number;

    /** Verrouillage temporaire après trop de tentatives (throttling). */
    @Column({ type: "datetime", nullable: true })
    lockedUntil!: Date | null;
}
