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
     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
     @Column({ type: "varchar", length: 36, nullable: true })
     user_id?: string;
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
