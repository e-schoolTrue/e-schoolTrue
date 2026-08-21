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

    @Column({ name: 'start_minutes', type: 'int', default: 0 })
    startMinutes: number = 0;

    @Column({ name: 'end_minutes', type: 'int', default: 0 })
    endMinutes: number = 0;

    @Column({ name: 'lunch_start_minutes', type: 'int', default: 0 })
    lunchStartMinutes: number = 0;

    @Column({ name: 'lunch_end_minutes', type: 'int', default: 0 })
    lunchEndMinutes: number = 0;

    @CreateDateColumn({ name: 'created_at' })
    createdAt: Date;

    @UpdateDateColumn({ name: 'updated_at' })
    updatedAt: Date;
}
