// #electron/backend/entities/schedule.ts
import { 
    Entity, 
    PrimaryGeneratedColumn, 
    Column, 
    ManyToOne, 
    JoinColumn, 
    CreateDateColumn, 
    UpdateDateColumn,
    Index
} from "typeorm";
import { ProfessorEntity } from "./professor";
import { CourseEntity } from "./course";
import { GradeEntity } from "./grade";

@Entity('schedules')
@Index(['professorId', 'day', 'timeSlot'], { unique: false }) // Index pour optimiser les requêtes de conflit
@Index(['classId', 'day', 'timeSlot'], { unique: true }) // Index unique pour éviter les doublons par classe
export class ScheduleEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @Column({ 
        name: 'professor_id', 
        type: 'int',
        nullable: false
    })
    professorId: number;

    @Column({ 
        name: 'course_id', 
        type: 'int',
        nullable: true // Allow null for primary school schedules
    })
    courseId: number;

    @Column({ 
        name: 'class_id', 
        type: 'int',
        nullable: false
    })
    classId: number;

    @Column({ 
        type: 'varchar', 
        length: 20,
        nullable: false
    })
    day: string; // 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'

    @Column({ 
        name: 'time_slot', 
        type: 'varchar', 
        length: 20,
        nullable: false
    })
    timeSlot: string; // '8-9', '9-10', '10-11', etc.

    @CreateDateColumn({ 
        name: 'created_at',
        type: 'datetime'
    })
    createdAt: Date;

    @UpdateDateColumn({ 
        name: 'updated_at',
        type: 'datetime'
    })
    updatedAt: Date;

    // Relations
    @ManyToOne(() => ProfessorEntity, professor => professor.schedules, {
        onDelete: 'CASCADE', // Si un professeur est supprimé, supprimer ses créneaux
        eager: false
    })
    @JoinColumn({ name: 'professor_id' })
    professor: ProfessorEntity;

    @ManyToOne(() => CourseEntity, course => course.schedules, {
        onDelete: 'CASCADE', // Si une matière est supprimée, supprimer les créneaux associés
        eager: false
    })
    @JoinColumn({ name: 'course_id' })
    course: CourseEntity;

    @ManyToOne(() => GradeEntity, gradeEntity => gradeEntity.schedules, {
        onDelete: 'CASCADE', // Si une classe est supprimée, supprimer son emploi du temps
        eager: false
    })
    @JoinColumn({ name: 'grade_id' })
    class: GradeEntity;
}

