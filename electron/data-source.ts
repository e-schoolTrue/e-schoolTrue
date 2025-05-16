import "reflect-metadata";
import {DataSource} from "typeorm";
import {UserEntity} from "./backend/entities/user";
import {StudentEntity} from "./backend/entities/students";
import {FileEntity} from "./backend/entities/file";
import {ProfessorEntity, QualificationEntity,DiplomaEntity} from  "./backend/entities/professor";
import {AbsenceEntity} from "./backend/entities/absence";
import {PaymentEntity} from "./backend/entities/payment";
import {PaymentConfigEntity} from "./backend/entities/paymentConfig";
import {BranchEntity, ClassRoomEntity, GradeEntity} from "./backend/entities/grade";
import { app } from 'electron';
import {CourseEntity, ObservationEntity} from "./backend/entities/course";
import { SchoolEntity, SchoolSettingsEntity } from "./backend/entities/school";
import {YearRepartitionEntity} from "./backend/entities/yearRepartition";
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
    GradeConfigEntity,
    SchoolSettingsEntity
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
                synchronize: true,
                dropSchema: isFirstLaunch,
                database: dbPath,
                logging: true,
                entities: entities,
                subscribers: [],
                migrationsRun: true,
                cache: false 
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
                
                // Vérifier la connexion
                if (!instance.isInitialized) {
                    throw new Error('La DataSource n\'a pas été correctement initialisée');
                }
                
                console.log("Base de données initialisée avec succès.");
            } catch (error) {
                console.error("Erreur lors de l'initialisation de la base de données:", error);
                throw error;
            }
        }
        return instance;
    }
}

