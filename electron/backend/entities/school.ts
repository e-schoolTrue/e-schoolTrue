import { Column, Entity, JoinColumn, OneToOne, PrimaryGeneratedColumn } from "typeorm";
import { FileEntity } from "./file";

export type CountryCode = 'MAR' | 'SEN' | 'CAF' | 'GIN';
export type CurrencyCode = 'MAD' | 'XOF' | 'XAF' | 'GNF';

@Entity("school")
export class SchoolEntity {
    @PrimaryGeneratedColumn()
    id?: number;

    @Column({ type: "varchar", length: 255 })
    name: string = '';

    @Column({ type: "varchar", length: 255 })
    address: string = '';

    @Column({ type: "varchar", length: 255, nullable: true })
    town: string = '';

    @Column({ 
        type: "varchar", 
        length: 3,
        default: 'SEN',
        transformer: {
            to: (value: string) => value,
            from: (value: string) => value as CountryCode
        }
    })
    country: CountryCode = 'SEN';

    @OneToOne(() => FileEntity, { nullable: true })
    @JoinColumn({ name: "logoId" })
    logo?: FileEntity;

    @Column({ type: "varchar", length: 20 })
    phone: string = '';

    @Column({ type: "varchar", length: 255 })
    email: string = '';

    @Column({ 
        type: "varchar", 
        length: 10,
        transformer: {
            to: (value: string) => value,
            from: (value: string) => value as 'publique' | 'privée'
        },
        default: 'publique'
    })
    type: 'publique' | 'privée' = 'publique';

    @Column({ type: "int" })
    foundationYear: number = new Date().getFullYear();

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
