import "reflect-metadata";
import { DataSource } from "typeorm";
import path from 'path';
import { app } from 'electron';

import { UserEntity } from "./backend/entities/user";
import { StudentEntity } from "./backend/entities/students";
import { ParentEntity } from "./backend/entities/parents";
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
import { ScheduleConfigEntity } from "./backend/entities/scheduleConfig";
import { ScheduleEntity } from "./backend/entities/schedule";
import { TranchConfigEntity } from "./backend/entities/paymentConfig";
import { InscriptionFeeEntity } from "./backend/entities/paymentConfig";
import { TrancheEntryEntity } from "./backend/entities/paymentConfig";
import { PaymentAnnualConfigEntity } from "./backend/entities/paymentConfig";
import { DocumentContentEntity } from "./backend/entities/documentContent";
import { GradingConfigEntity, EvaluationCategoryEntity } from "./backend/entities/configNote";
import { GradeEntryEntity, CalculatedGradeEntity } from "./backend/entities/gradeEntry";
import { AuditLogEntity } from "./backend/entities/audit-log";
import { AccountingVaultEntity } from "./backend/entities/accounting-vault";
import {
    ExpenseEntity, CashRegisterEntity, CashMovementEntity, CashClosureEntity,
    BankAccountEntity, BankTransactionEntity, TeacherHourLogEntity, SalarySlipEntity,
    ReceiptCounterEntity, ProfessorPaymentCounterEntity, FeeItemEntity
} from "./backend/entities/accounting";


import { Baseline1700000000000 } from "./migrations/1700000000000-Baseline";
import { DriftCatchup1710000000000 } from "./migrations/1710000000000-DriftCatchup";
import { BackfillCounters1720000000000 } from "./migrations/1720000000000-BackfillCounters";
import { YearStatusSchoolYear1730000000000 } from "./migrations/1730000000000-YearStatusSchoolYear";
import { TranchConfigPrecision1740000000000 } from "./migrations/1740000000000-TranchConfigPrecision";
import { DriftCatchup2175000000000 } from "./migrations/1750000000000-DriftCatchup2";
import { RoleLegacyFix1760000000000 } from "./migrations/1760000000000-RoleLegacyFix";
import { DriftCatchup3177000000000 } from "./migrations/1770000000000-DriftCatchup3";
import { ThreeLevels1780000000000 } from "./migrations/1780000000000-ThreeLevels";
import { ParentTable1790000000000 } from "./migrations/1790000000000-ParentTable";

const migrations = [
    Baseline1700000000000,
    DriftCatchup1710000000000,
    BackfillCounters1720000000000,
    YearStatusSchoolYear1730000000000,
    TranchConfigPrecision1740000000000,
    DriftCatchup2175000000000,
    RoleLegacyFix1760000000000,
    DriftCatchup3177000000000,
    ThreeLevels1780000000000,
    ParentTable1790000000000,
];

const entities = [
    UserEntity,
    FileEntity,
    StudentEntity,
    ParentEntity,
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
    ScheduleEntity,
    ScheduleConfigEntity,
    PaymentAnnualConfigEntity,
    TranchConfigEntity,
    TrancheEntryEntity,
    InscriptionFeeEntity,
    DocumentContentEntity, 
    GradingConfigEntity,
    EvaluationCategoryEntity,
    GradeEntryEntity,
    CalculatedGradeEntity,
    AuditLogEntity,
    AccountingVaultEntity,
    ExpenseEntity,
    CashRegisterEntity,
    CashMovementEntity,
    CashClosureEntity,
    BankAccountEntity,
    BankTransactionEntity,
    TeacherHourLogEntity,
    SalarySlipEntity,
    ReceiptCounterEntity,
    ProfessorPaymentCounterEntity,
    FeeItemEntity
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

        // Fix 1.1.31 : synchronize OFF par défaut (migrations seules).
        // synchronize:true AVANT runMigrations déclenchait le copy-swap
        // TypeORM (CREATE TABLE temporary_* SANS IF NOT EXISTS) → fantôme
        // après interruption → "already exists" en boucle avant backup.
        // Opt-in explicite : E_SCHOOL_SYNC="1" uniquement pour debug ciblé.
        // dropSchema must never be true to avoid wiping user data on onboarding replay.
        // migrationsRun reste false : c'est migration-runner.ts qui orchestre
        // (backup VACUUM INTO + ensureBaseline + runMigrations each + vérifs).
        const syncEnv = process.env.E_SCHOOL_SYNC;
        const synchronize = syncEnv === "1";
        console.log(`[DataSource] synchronize=${synchronize} (E_SCHOOL_SYNC=${syncEnv ?? "<unset→0>"})`);
        this.instance = new DataSource({
            type: "better-sqlite3",
            synchronize,
            dropSchema: false,
            database: dbPath,
            logging: false,
            entities: entities,
            migrations,
            migrationsRun: false,
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

    /**
     * Réouverture après remplacement à froid (restore/import LocalBackupService).
     * `replaceDbAndUploads()` fait `destroy()` (SQLite interdit le swap d'un fichier
     * ouvert) puis swap les fichiers ; sans ce `reinitialize()`, le main reste avec
     * une connexion détruite et `getSchool()` échoue avec
     * `database connection is not open` — visible en dev où le backend ne fait
     * qu'un reload fenêtre (pas de relaunch → pas de `initialize()` au boot).
     * `isFirstLaunch=false` : la DB existe déjà (jamais de reset onboarding).
     */
    static async reinitialize(): Promise<DataSource> {
        if (this.instance && this.instance.isInitialized) {
            return this.instance;
        }
        return this.initialize(false);
    }
}
