import {Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn, UpdateDateColumn} from "typeorm";

@Entity("course")
export class CourseEntity{
    @PrimaryGeneratedColumn()
    id?:number
     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
     @Column({ type: "varchar", length: 36, nullable: true })
     user_id?: string;
    @Column({type:"text"})
    code?:string
    @Column({type:"text"})
    name?:string
    @Column({type:"numeric"})
    coefficient?:number
    @Column({type:"boolean" , default:false})
    isInGroupement?:boolean ;
    @ManyToOne(()=>CourseEntity , (course)=>course.courses , {onDelete:"CASCADE"}) 
    groupement?:CourseEntity ;
    @OneToMany(()=>ObservationEntity , (observation)=>observation.course)
    observations?:ObservationEntity[]
    @OneToMany(()=>CourseEntity , (course)=>course.groupement)
    courses?:CourseEntity[] ;
    @DeleteDateColumn()     
    deleted_at?: Date;
    @CreateDateColumn()
    created_at?: Date;
    @UpdateDateColumn()
    updated_at?: Date;
}

@Entity("observation")
export class ObservationEntity{
    @PrimaryGeneratedColumn()
    id?:number
     // ✅ UUID de Supabase (ajouté pour synchronisation distante)
     @Column({ type: "varchar", length: 36, nullable: true, unique: true })
     remote_id?: string;
     @Column({ type: "varchar", length: 36, nullable: true })
     user_id?: string;
    @Column({type:"text"})
    observation?:string
    @Column({type:"numeric"})
    note?:number
    @ManyToOne(()=>CourseEntity , (course)=>course.observations ,  {onDelete:"CASCADE"})
    course?:CourseEntity
    @DeleteDateColumn()
    deleted_at?: Date;
    @CreateDateColumn()
    created_at?: Date;
    @UpdateDateColumn()
    updated_at?: Date;
}