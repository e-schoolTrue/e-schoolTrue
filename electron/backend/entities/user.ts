import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { ROLE } from "#electron/command";

@Entity("user")
export class UserEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: "varchar", unique: true })
    username!: string;

    @Column({ type: "varchar" })
    password!: string;

    @Column({ 
        type: 'varchar',
        enum: ROLE,
        default: ROLE.admin
    })
    role!: ROLE;

    @Column({ type: "varchar" })
    securityQuestion!: string;

    @Column({ type: "varchar" })
    securityAnswer!: string;

    @Column({ type: 'datetime', default: () => 'CURRENT_TIMESTAMP' })
    createdAt!: Date;
}