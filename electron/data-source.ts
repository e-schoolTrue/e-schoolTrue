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
import { ReportCardEntity } from "./backend/entities/report";
import path from 'path';
import { TeachingAssignmentEntity } from "./backend/entities/teaching";
import { ProfessorPaymentEntity } from "./backend/entities/professorPayment";
import { HomeworkEntity } from "./backend/entities/homework";
import { VacationEntity } from "./backend/entities/vacation";
import { ScholarshipEntity } from "./backend/entities/scholarship";
import { PreferenceEntity } from "./backend/entities/preference";
import { GradeConfigEntity } from "./backend/entities/gradeConfig";
import fs from 'fs';

// Liste de toutes les entités
const entities = [
    UserEntity,
    FileEntity,
    StudentEntity,
    GradeEntity,
    ClassRoomEntity,
    BranchEntity,
    CourseEntity,
    ObservationEntity,
    AbsenceEntity,
    PaymentEntity,
    PaymentConfigEntity,
    SchoolEntity,
    YearRepartitionEntity,
    ProfessorEntity,
    QualificationEntity,
    DiplomaEntity,
    TeachingAssignmentEntity,
    ProfessorPaymentEntity,
    HomeworkEntity,
    VacationEntity,
    ReportCardEntity,
    ScholarshipEntity,
    PreferenceEntity,
    GradeConfigEntity
];

export class AppDataSource {
    private static instance: DataSource;
    private constructor() {}

    static getInstance(): DataSource {
        if (!AppDataSource.instance) {
            const dbPath = path.join(app.getPath('userData'), 'database.db');
            const isFirstLaunch = !fs.existsSync(dbPath);
            
            console.log('Configuration de la DataSource...');
            console.log('Chemin de la base de données:', dbPath);
            console.log('Premier lancement:', isFirstLaunch);
            
            AppDataSource.instance = new DataSource({
                type: "better-sqlite3",
                synchronize: true, // Toujours synchroniser pour s'assurer que les tables sont créées
                dropSchema: false, // Ne jamais supprimer le schéma
                database: dbPath,
                logging: true,
                entities: entities,
                subscribers: [],
                migrationsRun: true
            });
        }
        return AppDataSource.instance;
    }

    static async initialize(): Promise<DataSource> {
        const instance = AppDataSource.getInstance();
        if (!instance.isInitialized) {
            try {
                console.log('Initialisation de la base de données...');
                await instance.initialize();
                
                // Vérifier que toutes les entités sont bien chargées
                const entityMetadatas = instance.entityMetadatas;
                console.log('Entités chargées:', entityMetadatas.map(metadata => metadata.name));
                
                // Forcer la synchronisation du schéma
                console.log('Synchronisation du schéma...');
                await instance.synchronize();
                
                console.log("Base de données initialisée avec succès.");
            } catch (error) {
                console.error("Erreur lors de l'initialisation de la base de données:", error);
                throw error;
            }
        }
        return instance;
    }
}

