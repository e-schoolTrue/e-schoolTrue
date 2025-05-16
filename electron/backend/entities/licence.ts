import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";

@Entity('local_license')
export class License {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({type: "text"})
    code!: string;

    @Column({type: "text"})
    type!: string;

    @Column({type: "text"})
    activated_at!: string;

    @Column({type: "text"})
    expires_at!: string;

    @Column({type: "text"})
    machine_id!: string;
}
  