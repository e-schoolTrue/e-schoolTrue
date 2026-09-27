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

// --- MIGRATIONS (imports explicites, PAS de glob) ---
// Le main tourne depuis dist-electron/ (buildé) en dev comme en prod :
// un glob vers 'migrations/*.{ts,js}' ne résout rien là-bas, donc les
// migrations ne s'exécutaient jamais (silencieux). En les important ici,
// vite les bundle dans le main et TypeORM les joue au boot via
// migration-runner.ts. RÈGLE : toute nouvelle migration DOIT être ajoutée
// à ce tableau (vérifié par __tests__/migration-registration.spec.ts).
import { Baseline1700000000000 } from "./migrations/1700000000000-Baseline";
import { DriftCatchup1710000000000 } from "./migrations/1710000000000-DriftCatchup";
import { BackfillCounters1720000000000 } from "./migrations/1720000000000-BackfillCounters";
import { YearStatusSchoolYear1730000000000 } from "./migrations/1730000000000-YearStatusSchoolYear";
import { TranchConfigPrecision1740000000000 } from "./migrations/1740000000000-TranchConfigPrecision";

const migrations = [
    Baseline1700000000000,
    DriftCatchup1710000000000,
    BackfillCounters1720000000000,
    YearStatusSchoolYear1730000000000,
    TranchConfigPrecision1740000000000,
];

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
}
