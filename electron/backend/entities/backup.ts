import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from "typeorm";

@Entity('backups')
export class BackupEntity {
    @PrimaryGeneratedColumn('uuid')
    id!: string;

    @Column({ type: 'varchar' })
    name!: string;

    @Column({ type: 'varchar' })
    user_id!: string;

    @Column({ type: 'int', nullable: true })
    size?: number;

    @Column({ type: 'text', nullable: true })
    description?: string;

    @CreateDateColumn({ type: 'datetime' })
    created_at!: Date;

    @UpdateDateColumn({ type: 'datetime' })
    updated_at!: Date;
} 