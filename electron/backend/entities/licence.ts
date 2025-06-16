import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity('local_license')
export class License {
    @PrimaryGeneratedColumn()
    id!: number;
     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
    @Column({ type: "text" })
    code!: string;

    @Column({ type: "text" })
    type!: string;

    @Column({ type: "text" })
    activated_at!: string;  // Format ISO string from Supabase

    @Column({ type: "text" })
    expires_at!: string;    // Format ISO string from Supabase

    @Column({ type: "text" })
    machine_id!: string;

    // Méthodes utilitaires pour la manipulation des dates
    getActivatedDate(): Date {
        return new Date(this.activated_at);
    }

    getExpiryDate(): Date {
        return new Date(this.expires_at);
    }

    isExpired(): boolean {
        return new Date() > this.getExpiryDate();
    }

    getDaysRemaining(): number {
        const now = new Date();
        const expiryDate = this.getExpiryDate();
        const diffTime = expiryDate.getTime() - now.getTime();
        return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    }
}
  