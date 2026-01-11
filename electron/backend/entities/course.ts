import {Column, CreateDateColumn, DeleteDateColumn, Entity, ManyToOne, OneToMany, ManyToMany, JoinTable, PrimaryGeneratedColumn, UpdateDateColumn, JoinColumn} from "typeorm";
import {ScheduleEntity} from "./schedule"
import {GradeEntity} from "./grade"

@Entity("course")
export class CourseEntity{
    @PrimaryGeneratedColumn()
    id?:number
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
    
    // Relation Many-to-Many avec les classes
    @ManyToMany(() => GradeEntity, (grade) => grade.courses, {cascade: true})
    @JoinTable({
        name: "course_grades",
        joinColumn: { name: "courseId", referencedColumnName: "id" },
        inverseJoinColumn: { name: "gradeId", referencedColumnName: "id" }
    })
    grades?: GradeEntity[];
    
    // Ancienne relation ManyToOne conservée pour compatibilité (deprecated)
    @ManyToOne(()=>GradeEntity, {nullable: true, onDelete:"CASCADE"})
    @JoinColumn()
    grade?:GradeEntity ;
    
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
    @OneToMany(() => ScheduleEntity, schedule => schedule.course)
    schedules: ScheduleEntity[];
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