import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity("T_preference")
export class PreferenceEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', unique: true })
    key!: string;

    @Column({ type: 'text' })
    value!: string;
} 