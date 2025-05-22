import {Column, Entity, ManyToOne, OneToMany, PrimaryGeneratedColumn} from "typeorm";

@Entity("course")
export class CourseEntity{
    @PrimaryGeneratedColumn()
    id?:number
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
}

@Entity("observation")
export class ObservationEntity{
    @PrimaryGeneratedColumn()
    id?:number
    @Column({type:"text"})
    observation?:string
    @Column({type:"numeric"})
    note?:number
    @ManyToOne(()=>CourseEntity , (course)=>course.observations ,  {onDelete:"CASCADE"})
    course?:CourseEntity
}