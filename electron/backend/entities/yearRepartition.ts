import {
    Column,
    CreateDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from "typeorm";
@Entity('year_repartition')
export class YearRepartitionEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ type: 'text', nullable: false })
    schoolYear!: string; // Année scolaire, ex : "2024-2025"

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
}
