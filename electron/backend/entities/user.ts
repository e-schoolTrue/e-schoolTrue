import { Entity, PrimaryGeneratedColumn, Column } from "typeorm";
import { ROLE } from "#electron/command";

@Entity("user")
export class UserEntity {
    @PrimaryGeneratedColumn()
    id!: number;

    @Column({ type: 'varchar', length: 255 })
    username!: string;

    @Column({ type: 'varchar', length: 255 })
    password!: string;

    @Column({ 
        type: 'varchar',
        enum: ROLE,
        default: ROLE.student
    })
    role!: ROLE;

}