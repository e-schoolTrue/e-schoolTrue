export interface ScheduleCommand {
    professorId: number;
    courseId: number;
    classId: number;
    day: string; // 'lundi', 'mardi', etc.
    timeSlot: string; // '8-9', '9-10', etc.
    teachingId:number;
}