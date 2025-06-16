import {
    Column,
    CreateDateColumn,
    Entity, JoinColumn,
    ManyToOne, OneToMany,
    OneToOne,
    PrimaryGeneratedColumn,
    UpdateDateColumn
} from "typeorm";
import { StudentEntity } from "./students";


@Entity('grade')
export class GradeEntity {
    @PrimaryGeneratedColumn()
    id?: number;
     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
    @Column({type: 'text'})
    name!: string;
    @Column({type: 'text'})
    code!: string;
    @OneToMany(() => StudentEntity, (student) => student.grade)
    students?: StudentEntity[];
    @OneToMany(() => BranchEntity , branch => branch.grade)
    branches?: BranchEntity[];
    @OneToMany(() => ClassRoomEntity, classRoom => classRoom.grade)
    classRooms?: ClassRoomEntity[];
    @CreateDateColumn()
    createdAt?: Date;
    @UpdateDateColumn()
    updatedAt?: Date;
}

@Entity('class_room')
export class ClassRoomEntity {
    @PrimaryGeneratedColumn()
    id?: number;
     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
    @Column({type: 'text'})
    name?: string;
    @Column({type: 'text'})
    code?: string;
    @Column({type: 'numeric'})
    capacity?: number;
    @ManyToOne(() => GradeEntity, {onDelete: 'CASCADE'})
    @JoinColumn()
    grade?: GradeEntity;
    @OneToOne(() => BranchEntity , {onDelete: 'CASCADE'})
    @JoinColumn()
    branch?: BranchEntity;
    @CreateDateColumn()
    createdAt?: Date;
    @UpdateDateColumn()
    updatedAt?: Date;
}

@Entity('branch')
export class BranchEntity {
    @PrimaryGeneratedColumn()
    id?: number;
     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
    @Column({type: 'text'})
    name?: string;
    @Column({type: 'text'})
    code?: string;
    @ManyToOne(() => GradeEntity , grade => grade.branches , {onDelete: 'CASCADE'})
    grade?: GradeEntity;
    @CreateDateColumn()
    createdAt?: Date;
    @UpdateDateColumn()
    updatedAt?: Date;
}