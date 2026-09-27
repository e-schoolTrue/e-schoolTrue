import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

export type AuditAction = 'create' | 'update' | 'delete' | 'login' | 'logout' | 'password_reset' | 'status_change' | 'system' | 'accounting_unlock' | 'accounting_lock';

export const ACTION_FR: Record<AuditAction, string> = {
    create: 'Création',
    update: 'Modification',
    delete: 'Suppression',
    login: 'Connexion',
    logout: 'Déconnexion',
    password_reset: 'Réinitialisation du mot de passe',
    status_change: 'Changement de statut',
    system: 'Système',
    accounting_unlock: 'Déverrouillage comptable',
    accounting_lock: 'Verrouillage comptable'
};

@Entity("audit_log")
export class AuditLogEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "int", nullable: true })
    actorId!: number | null;

    @Column({ type: "varchar", nullable: true })
    actorUsername!: string | null;

    @Column({ type: "varchar", nullable: true })
    actorRole!: string | null;

    @Column({ type: "varchar" })
    action!: string;

    @Column({ type: "varchar" })
    targetEntity!: string;

    @Column({ type: "varchar", nullable: true })
    targetId!: string | null;

    @Column({ type: "varchar", length: 500 })
    summary!: string;

    @Column({ type: "simple-json", nullable: true })
    diff!: { before?: unknown; after?: unknown } | null;

    @Column({ type: "simple-json", nullable: true })
    metadata!: Record<string, unknown> | null;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date;
}