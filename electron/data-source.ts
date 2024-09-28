import {DataSource} from "typeorm";
import {User} from "./backend/entities/auth.ts";
import {StudentEntity} from "./backend/entities/students.ts";
import {FileEntity} from "./backend/entities/file.ts";
import {BranchEntity, ClassRoomEntity, GradeEntity} from "#electron/backend/entities/grade.ts";
import {app} from "electron";
import {CourseEntity, ObservationEntity} from "#electron/backend/entities/course.ts";

export class AppDataSource{
    private static instance: DataSource;
    private constructor(){}
    static getInstance(): DataSource {
        if (!AppDataSource.instance) {
            AppDataSource.instance = new DataSource({
                type: "better-sqlite3",
                synchronize: true,
                database: app.getAppPath()+"database.db",
                logging: true,
                entities: [User, FileEntity, StudentEntity, GradeEntity , ClassRoomEntity , BranchEntity , CourseEntity , ObservationEntity],
                subscribers: [],
                migrations: [],
            });
        }
        return AppDataSource.instance;
    }
}

