import {GradeEntity, GradeType} from "#electron/backend/entities/grade";


class SettingCommand {
    id?: number;
    name?: string;
    code?: string;
}

export class GradeCommand extends SettingCommand {
    declare id?: number;
    declare name: string;
    declare code: string;
    declare type?: GradeType;  // ✅ type basé sur l'enum
}

export class BranchCommand extends SettingCommand {
    declare id?: number;
    declare name: string;
    declare code: string;
    declare gradeId?: number;
    grade?: GradeEntity;
}

export class ClassRoomCommand extends SettingCommand {
    declare id?: number;
    declare name: string;
    declare code: string;
    declare capacity: number;
    declare gradeId: number;
    declare branchId?: number;
}

export class SubCourseCommand extends SettingCommand {
    declare id?: number;
    declare name: string;
    declare code: string;
    declare coefficient?: number;
    declare isInGroupement?: boolean;
}

export class CourseCommand extends SettingCommand {
    declare id?: number;
    declare name: string;
    declare code: string;
    declare coefficient: number;
    declare groupementId?: number;
    groupement?: SubCourseCommand;
    declare isInGroupement?: boolean;
}