import { Entity, PrimaryGeneratedColumn, Column, JoinColumn, ManyToOne, CreateDateColumn, UpdateDateColumn } from "typeorm";
import { GradeEntity } from "./grade";

@Entity('schedule_configs')
export class ScheduleConfigEntity {
    @PrimaryGeneratedColumn()
    id: number;

    @ManyToOne(() => GradeEntity, { nullable: true, onDelete: 'CASCADE' })
    @JoinColumn({ name: 'class_id' })
    class?: GradeEntity;

    @Column({ name: 'class_id', type: 'int', nullable: true })
    classId?: number;

    @Column({ name: 'start_hour', type: 'int', default: 8 })
    startHour: number;

    @Column({ name: 'end_hour', type: 'int', default: 18 })
    endHour: number;

    @Column({ name: 'slot_duration', type: 'int', default: 60 })
    slotDuration: number;

    @Column({ name: 'lunch_start', type: 'int', default: 12 })
    lunchStart: number;

    @Column({ name: 'lunch_end', type: 'int', default: 14 })
    lunchEnd: number;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
