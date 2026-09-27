/**
 * cli-datasource — DataSource isolé pour CLI/outils (sans electron/app).
 *
 * Pourquoi isolé : `electron/data-source.ts` importe `app` d'Electron
 * (app.getPath('userData')) → inutilisable en CLI pur (tsx/node).
 * Ce module duplique la liste d'entités SANS dépendance Electron,
 * avec synchronize:false (les CLI ne doivent jamais muter le schéma
 * implicitement) et migrationsRun:false (le runner décide).
 *
 * Usage :
 *   import { createCliDataSource } from "./cli-datasource";
 *   const ds = createCliDataSource("/tmp/probe.db");
 *   await ds.initialize();
 *   ...
 *   await ds.destroy();
 */
import "reflect-metadata";
import { DataSource } from "typeorm";
import path from "node:path";

import { UserEntity } from "../backend/entities/user";
import { StudentEntity } from "../backend/entities/students";
import { FileEntity } from "../backend/entities/file";
import { ProfessorEntity, QualificationEntity, DiplomaEntity } from "../backend/entities/professor";
import { AbsenceEntity } from "../backend/entities/absence";
import { PaymentEntity } from "../backend/entities/payment";
import { PaymentConfigEntity } from "../backend/entities/paymentConfig";
import { BranchEntity, ClassRoomEntity, GradeEntity } from "../backend/entities/grade";
import { CourseEntity, ObservationEntity } from "../backend/entities/course";
import { SchoolEntity, SchoolSettingsEntity } from "../backend/entities/school";
import { YearRepartitionEntity } from "../backend/entities/yearRepartition";
import { ReportCardEntity } from "../backend/entities/report";
import { TeachingAssignmentEntity } from "../backend/entities/teaching";
import { ProfessorPaymentEntity } from "../backend/entities/professorPayment";
import { HomeworkEntity } from "../backend/entities/homework";
import { VacationEntity } from "../backend/entities/vacation";
import { ScholarshipEntity } from "../backend/entities/scholarship";
import { PreferenceEntity } from "../backend/entities/preference";
import { GradeConfigEntity } from "../backend/entities/gradeConfig";
import { License } from "../backend/entities/licence";
import { ScheduleConfigEntity } from "../backend/entities/scheduleConfig";
import { ScheduleEntity } from "../backend/entities/schedule";
import { TranchConfigEntity } from "../backend/entities/paymentConfig";
import { InscriptionFeeEntity } from "../backend/entities/paymentConfig";
import { TrancheEntryEntity } from "../backend/entities/paymentConfig";
import { PaymentAnnualConfigEntity } from "../backend/entities/paymentConfig";
import { DocumentContentEntity } from "../backend/entities/documentContent";
import { GradingConfigEntity, EvaluationCategoryEntity } from "../backend/entities/configNote";
import { GradeEntryEntity, CalculatedGradeEntity } from "../backend/entities/gradeEntry";
import { AuditLogEntity } from "../backend/entities/audit-log";
import { AccountingVaultEntity } from "../backend/entities/accounting-vault";
import {
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
  FeeItemEntity,
} from "../backend/entities/accounting";

export const cliEntities = [
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
  FeeItemEntity,
];

export function resolveMigrationsGlob(): string {
  // En dev (tsx) : electron/migrations/*.ts ; en prod (dist-electron) : *.js compilés.
  return path.join(__dirname, "..", "migrations", "*.{ts,js}");
}

export function createCliDataSource(dbPath: string): DataSource {
  const database = dbPath?.trim() ? dbPath : ":memory:";
  // Fix 1.1.31 : synchronize TOUJOURS false en CLI (jamais d'env override).
  // Le schéma n'évolue que via migrations explicites (runner / dryrun).
  const synchronize = false;
  return new DataSource({
    type: "better-sqlite3",
    database,
    synchronize,
    migrationsRun: false,
    logging: false,
    entities: cliEntities,
    migrations: [resolveMigrationsGlob()],
    subscribers: [],
    cache: false,
  });
}
