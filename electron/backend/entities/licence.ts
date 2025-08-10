// src/backend/entities/licence.ts

import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity('local_license')
export class License {
    @PrimaryGeneratedColumn()
    id!: number;

    
    @Column({ type: "varchar", length: 36, unique: true })
    remote_id!: string;

    @Column({ type: "varchar", unique: true })
    code!: string;

    @Column({ type: "varchar" })
    type!: string;

    @Column({ type: "text" })
    machine_id!: string;
    
    @Column({ type: "text" }) // Stocké en format ISO string (ex: "2024-05-21T10:00:00.000Z")
    activated_at!: string;

    // IMPORTANT : nullable = true pour gérer les licences à vie
    @Column({ type: "text", nullable: true })
    expires_at: string | null;

    // --- Méthodes utilitaires robustes ---

    public isLifetime(): boolean {
        return this.expires_at === null;
    }

    public isExpired(): boolean {
        // Une licence à vie n'expire jamais
        if (this.isLifetime()) {
            return false;
        }
        return new Date() > new Date(this.expires_at!);
    }

    public getDaysRemaining(): number | null {
        // Retourne null pour une licence à vie
        if (this.isLifetime()) {
            return null;
        }
        const now = new Date();
        const expiryDate = new Date(this.expires_at!);
        const diffTime = expiryDate.getTime() - now.getTime();

        // Si c'est déjà expiré, retourne 0
        if (diffTime <= 0) {
            return 0;
        }

        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
}