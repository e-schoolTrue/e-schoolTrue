import { Entity, PrimaryGeneratedColumn, Column, OneToOne } from "typeorm";
import { ProfessorEntity } from "./professor";
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

    @OneToOne(() => ProfessorEntity, professor => professor.user)
    professor?: ProfessorEntity;
}