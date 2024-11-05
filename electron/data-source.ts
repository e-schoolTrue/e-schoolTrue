import {DataSource} from "typeorm";
import {User} from "@electron/entities/auth.ts";
import {StudentEntity} from "@electron/entities/students.ts";
import {FileEntity} from "@electron/entities/file.ts";
import {AbsenceEntity} from "@electron/entities/absence.ts";
import {PaymentEntity} from "@electron/entities/payment.ts";
import {BranchEntity, ClassRoomEntity, GradeEntity} from "@electron/entities/grade.ts";
import {CourseEntity, ObservationEntity} from "@electron/entities/course.ts";
import {app} from "electron";
import {ProfessorEntity, QualificationEntity} from "@electron/entities/professor.ts";


export class AppDataSource {
    private static instance: DataSource;
    static getInstance(): DataSource {
        if (!AppDataSource.instance) {
            var dbPath = '';
            if(import.meta.env.MODE !== 'test'){
                dbPath = app.getPath("appData")+"/database.db"
            }else{
                dbPath = "./database.db"
            }
            AppDataSource.instance = new DataSource({
                type: "better-sqlite3",
                synchronize: true,
                database: dbPath,
                logging: true,
                entities: [User, FileEntity, StudentEntity,
                    GradeEntity , ClassRoomEntity , BranchEntity ,
                    CourseEntity , ObservationEntity, AbsenceEntity, PaymentEntity,
                    QualificationEntity , ProfessorEntity
                ],
                subscribers: [],
                migrations: [],
            });
        }
        return AppDataSource.instance;
    }
}
