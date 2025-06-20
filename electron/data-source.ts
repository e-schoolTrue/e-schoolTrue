import "reflect-metadata";
import { DataSource } from "typeorm";
import path from 'path';
import { app } from 'electron';

// --- ENTITÉS ---
import { UserEntity } from "./backend/entities/user";
import { StudentEntity } from "./backend/entities/students";
import { FileEntity } from "./backend/entities/file";
import { ProfessorEntity, QualificationEntity, DiplomaEntity } from "./backend/entities/professor";
import { AbsenceEntity } from "./backend/entities/absence";
import { PaymentEntity } from "./backend/entities/payment";
import { PaymentConfigEntity } from "./backend/entities/paymentConfig";
import { BranchEntity, ClassRoomEntity, GradeEntity } from "./backend/entities/grade";
import { CourseEntity, ObservationEntity } from "./backend/entities/course";
import { SchoolEntity, SchoolSettingsEntity } from "./backend/entities/school";
import { YearRepartitionEntity } from "./backend/entities/yearRepartition";
import { ReportCardEntity } from "./backend/entities/report";
import { TeachingAssignmentEntity } from "./backend/entities/teaching";
import { ProfessorPaymentEntity } from "./backend/entities/professorPayment";
import { HomeworkEntity } from "./backend/entities/homework";
import { VacationEntity } from "./backend/entities/vacation";
import { ScholarshipEntity } from "./backend/entities/scholarship";
import { PreferenceEntity } from "./backend/entities/preference";
import { GradeConfigEntity } from "./backend/entities/gradeConfig";
import { License } from "./backend/entities/licence";
import { BackupEntity } from "./backend/entities/backup";

// --- ENSEMBLE DES ENTITÉS ---
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
    SchoolSettingsEntity,
    License,
    BackupEntity
];

export class AppDataSource {
    private static instance: DataSource;
    private constructor() {}

    // Initialisation unique avec gestion du premier lancement
    static async initialize(isFirstLaunch: boolean): Promise<DataSource> {
        if (this.instance && this.instance.isInitialized) {
            return this.instance;
        }

        const dbPath = path.join(app.getPath('userData'), 'database.db');
        console.log(`[DataSource] Initialisation avec isFirstLaunch = ${isFirstLaunch}`);
        console.log(`[DataSource] Chemin de la base de données : ${dbPath}`);

        this.instance = new DataSource({
            type: "better-sqlite3",
            synchronize: true,
            dropSchema: isFirstLaunch,
            database: dbPath,
            logging: true,
            entities: entities,
            migrationsRun: true,
            subscribers: [],
            cache: false
        });

        try {
            await this.instance.initialize();
            console.log("[DataSource] Initialisation de TypeORM terminée.");
        } catch (error) {
            console.error("[DataSource] Erreur lors de l'initialisation de TypeORM:", error);
            throw error;
        }

        return this.instance;
    }

    // Doit être appelé uniquement APRÈS initialize()
    static getInstance(): DataSource {
        if (!this.instance || !this.instance.isInitialized) {
            throw new Error("Erreur critique: AppDataSource.getInstance() appelé avant AppDataSource.initialize().");
        }
        return this.instance;
    }
}
