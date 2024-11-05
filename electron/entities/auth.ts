import {
    BaseEntity,
    Column,
    CreateDateColumn,
    DeleteDateColumn,
    Entity,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from "typeorm";


@Entity()
export class User extends BaseEntity{

    @PrimaryGeneratedColumn()
    id?: number
    @Column({type: "text"})
    username?: string
    @Column({type: "text"})
    password?: string
    @CreateDateColumn()
    createdAt?: Date
    @UpdateDateColumn()
    updatedAt?: Date
    @DeleteDateColumn()
    deletedAt?: Date
}
