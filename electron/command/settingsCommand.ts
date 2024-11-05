import {GradeEntity} from "@electron/entities/grade.ts";

class SettingCommand{
    id?: number;
    name?: string;
    code?: string;
}
export class GradeCommand extends SettingCommand{}
export class BranchCommand extends SettingCommand{
    grade?:GradeEntity
}
export class ClassRoomCommand extends SettingCommand{
    grade?:GradeEntity
    capacity?:number
}
export class SubCourseCommand extends SettingCommand{
    coefficient?:number
    isInGroupement?:boolean
}
export class CourseCommand extends SettingCommand{
    coefficient?:number
    groupement?:SubCourseCommand
    isInGroupement?:boolean
}