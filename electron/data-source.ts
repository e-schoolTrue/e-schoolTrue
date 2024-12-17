import {DataSource} from "typeorm";
import {UserEntity} from "./backend/entities/user";
import {StudentEntity} from "./backend/entities/students.ts";
import {FileEntity} from "./backend/entities/file.ts";
import {ProfessorEntity, QualificationEntity,DiplomaEntity} from  "./backend/entities/professor.ts";
import {AbsenceEntity} from "./backend/entities/absence.ts";
import {PaymentEntity} from "./backend/entities/payment.ts";
import {PaymentConfigEntity} from "./backend/entities/paymentConfig.ts";
import {BranchEntity, ClassRoomEntity, GradeEntity} from "#electron/backend/entities/grade.ts";
import {app} from "electron";
import {CourseEntity, ObservationEntity} from "#electron/backend/entities/course.ts";
import { SchoolEntity } from "./backend/entities/school.ts";
import {YearRepartitionEntity} from "#electron/backend/entities/yearRepartition";
import path from 'path';
import { TeachingAssignmentEntity } from "./backend/entities/teaching";
import { ProfessorPaymentEntity } from "./backend/entities/professorPayment";
import { HomeworkEntity } from "./backend/entities/homework";
import { VacationEntity } from "./backend/entities/vacation";

export class AppDataSource {
    private static instance: DataSource;
    private constructor() {}
    static getInstance(): DataSource {
        if (!AppDataSource.instance) {
            const dbPath = path.join(app.getPath('userData'), 'database.db');
            
         
            AppDataSource.instance = new DataSource({
                type: "better-sqlite3",
                synchronize: true,
                dropSchema:false,
                database: dbPath,
                logging: true,
                entities: [UserEntity, FileEntity, StudentEntity, GradeEntity , ClassRoomEntity , BranchEntity , CourseEntity , ObservationEntity, AbsenceEntity, PaymentEntity, PaymentConfigEntity, SchoolEntity, YearRepartitionEntity, ProfessorEntity, QualificationEntity, DiplomaEntity, TeachingAssignmentEntity, ProfessorPaymentEntity, HomeworkEntity, VacationEntity],
                subscribers: [],
                migrationsRun: true
            });
        }
        return AppDataSource.instance;
    }

    static async initialize(): Promise<DataSource> {
        const instance = AppDataSource.getInstance();
        if (!instance.isInitialized) {
            await instance.initialize();
            console.log("Base de données initialisée avec succès.");
        }
        return instance;
    }
}