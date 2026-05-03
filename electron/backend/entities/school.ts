import { 
  BeforeInsert, Column, CreateDateColumn, DeleteDateColumn, 
  Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn, 
  UpdateDateColumn 
} from "typeorm";
import { v4 as uuidv4 } from "uuid";
import { FileEntity } from "./file";

export type CountryCode = 'MAR' | 'SEN' | 'CAF' | 'GIN';
export type CurrencyCode = 'MAD' | 'XOF' | 'XAF' | 'GNF';

@Entity("school_settings")
export class SchoolSettingsEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    // ID de l'utilisateur Supabase
    @Column({ type: "varchar", length: 36, nullable: true })
    user_id?: string;

    @Column({ type: "varchar", length: 50 })
    schoolCode: string = '';

    @Column({ type: "varchar", length: 100 })
    inspectionZone: string = '';

    @Column({ type: "varchar", length: 50 })
    departmentCode: string = '';

    @OneToOne(() => SchoolEntity, school => school.settings)
    @JoinColumn()
    school?: SchoolEntity;

    @DeleteDateColumn()
    deleted_at?: Date;

    @CreateDateColumn()
    created_at?: Date;

    @UpdateDateColumn()
    updated_at?: Date;
}

@Entity("school")
export class SchoolEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    // ID de l'utilisateur Supabase
    @Column({ type: "varchar", length: 36, nullable: true })
    user_id?: string;

    @Column({ type: "varchar", length: 255 })
    name: string = '';

    @Column({ type: "varchar", length: 255 })
    address: string = '';

    @Column({ type: "varchar", length: 255, nullable: true })
    town: string = '';

    @Column({
        type: "varchar",
        length: 3,
        default: 'SEN'
    })
    country: CountryCode = 'SEN';

    @OneToOne(() => FileEntity, { nullable: true })
    @JoinColumn({ name: "logoId" })
    logo?: FileEntity;

    @Column({ type: "varchar", length: 20 })
    phone: string = '';

    @Column({ type: "varchar", length: 255 })
    email: string = '';
    @Column({ type: "varchar", length: 36, nullable: true, unique: true })
    remote_id?: string;

    @Column({ type: "varchar", length: 100, nullable: true })
    schema_name?: string;

    @Column({
        type: "varchar",
        length: 10,
        default: 'publique'
    })
    type: 'publique' | 'privée' = 'publique';

    @Column({ type: "int" })
    foundationYear: number = new Date().getFullYear();

    @OneToOne(() => SchoolSettingsEntity, settings => settings.school)
    settings?: SchoolSettingsEntity;

    @CreateDateColumn()
    created_at?: Date;

    @UpdateDateColumn()
    updated_at?: Date;

    @DeleteDateColumn()
    deleted_at?: Date;

    // Getter virtuel pour la devise
    get currency(): CurrencyCode {
        const currencyMap: Record<CountryCode, CurrencyCode> = {
            'MAR': 'MAD',
            'SEN': 'XOF',
            'CAF': 'XAF',
            'GIN': 'GNF'
        };
        return currencyMap[this.country];
    }
}
