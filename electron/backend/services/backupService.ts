import { AppDataSource } from '../../data-source';
import {
  DataSource,
  Repository,
  IsNull,
  MoreThan,
  FindOptionsWhere,
  Not,
  In,
} from 'typeorm';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { supabase, getSchemaClient } from '../lib/supabaseClient';
import { ElectronStore } from '../utils/electronStore';
import { BackupEntity } from '../entities/backup';
import { BranchEntity, ClassRoomEntity, GradeEntity } from '../entities/grade';
import { DiplomaEntity, ProfessorEntity, QualificationEntity } from '../entities/professor';
import { CourseEntity, ObservationEntity } from '../entities/course';
import { StudentEntity } from '../entities/students';
import { FileEntity } from '../entities/file';
import { TeachingAssignmentEntity } from '../entities/teaching';
import { VacationEntity } from '../entities/vacation';
import { PaymentEntity } from '../entities/payment';
import { ProfessorPaymentEntity } from '../entities/professorPayment';
import { SchoolEntity } from '../entities/school';
import { AbsenceEntity } from '../entities/absence';
import { HomeworkEntity } from '../entities/homework';
import { ScheduleEntity } from '../entities/schedule';
import { ScholarshipEntity } from '../entities/scholarship';
import { GradeConfigEntity } from '../entities/gradeConfig';
import { GradingConfigEntity, EvaluationCategoryEntity } from '../entities/configNote';
import { GradeEntryEntity, CalculatedGradeEntity } from '../entities/gradeEntry';
import { YearRepartitionEntity } from '../entities/yearRepartition';
import {
  PaymentConfigEntity,
  InscriptionFeeEntity,
  PaymentAnnualConfigEntity,
  TranchConfigEntity,
  TrancheEntryEntity,
} from '../entities/paymentConfig';
import { getCurrentSupabaseUserId, getCurrentSchemaName } from '../lib/session';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isValidUuid(value: any): boolean {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

// --- Type definitions ---

export abstract class BaseSyncEntity {
  id?: number;
  remote_id?: string | null;
  user_id?: string;
  created_at?: Date;
  updated_at?: Date;
  deleted_at?: Date | null;
}

export interface SyncConfig {
  autoSyncOnConnect: boolean;
  notifyBeforeSync: boolean;
  syncIntervalMinutes?: number;
}

export interface SyncHistory {
  id: string;
  sync_started_at: string;
  sync_ended_at?: string;
  direction: 'local_to_cloud' | 'cloud_to_local' | 'bidirectional';
  status: 'success' | 'partial_success' | 'failed' | 'in_progress' | 'skipped';
  user_id: string;
  records_synced_up?: number;
  records_synced_down?: number;
  tables_processed?: string[];
  error_message?: string;
  conflict_count?: number;
}

interface EntitySyncMeta<T extends BaseSyncEntity> {
  entity: new () => T;
  localRepository: Repository<T>;
  supabaseTable: string;
  dependsOn?: (new () => BaseSyncEntity)[];
  relationsToLoad?: string[];
  identifyingFields?: string[];
  /** false if the remote Supabase table has no updated_at column (default true) */
  hasRemoteUpdatedAt?: boolean;
  /** Override onConflict for tables with composite unique constraints (default 'id') */
  upsertConflict?: string;
  transformToSupabase: (localEntity: T) => any;
  transformFromSupabase: (supabaseData: any) => Partial<T>;
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  autoSyncOnConnect: true,
  notifyBeforeSync: true,
  syncIntervalMinutes: 60,
};

// --- CloudSyncService ---

export class CloudSyncService {
  private supabase: SupabaseClient = supabase;
  private electronStore: ElectronStore;
  private configKey = 'cloud_sync_config_v3';
  private supabaseAvailable = false;
  private appDataSourceInstance: DataSource;
  private entitySyncMetas: EntitySyncMeta<any>[] = [];
  private isSyncing = false;
  private syncHistoryDir: string;
  private syncTimerId: NodeJS.Timeout | null = null;
  private activeSchoolId: string | null = null;
  private activeSchemaName: string | null = null;

  constructor() {
    this.electronStore = new ElectronStore();

    const dataSourceInstance = AppDataSource.getInstance();
    if (!dataSourceInstance || !dataSourceInstance.isInitialized) {
      console.error("CloudSyncService FATAL: AppDataSource n'est pas initialisee.");
      this.initializeMockClient();
      return;
    }

    this.appDataSourceInstance = dataSourceInstance;
    this.syncHistoryDir = path.join(app.getPath('userData'), 'sync_history');
    if (!fs.existsSync(this.syncHistoryDir)) fs.mkdirSync(this.syncHistoryDir, { recursive: true });

    this.populateEntitySyncMetas();

    this.checkSupabaseAvailability().then(async (isAvailable) => {
      if (isAvailable) {
        const user = await this.getSupabaseAuthUser();
        console.log(`Cloud Sync: Client Supabase initialise. Utilisateur connecte: ${!!user}`);
        await this.startPeriodicSyncTimer();

        const config = await this.loadSyncConfig();
        if (config.autoSyncOnConnect && user?.id) {
          console.log("Auto-synchronisation a la connexion...");
          this.checkForSyncOpportunity(user.id);
        }
      } else {
        console.warn('Cloud Sync: Aucun utilisateur connecte.');
      }
    }).catch(error => {
      console.error('Cloud Sync: Erreur init Supabase:', error);
      this.loadSyncConfig();
    });
  }

  // ==========================================
  // ENTITY SYNC META DEFINITIONS
  // ==========================================

  private populateEntitySyncMetas() {
    this.entitySyncMetas = [

      // --- NIVEAU 0 : Aucune dependance ---

      {
        entity: GradeEntity,
        localRepository: this.appDataSourceInstance.getRepository(GradeEntity),
        supabaseTable: 'grade',
        identifyingFields: ['code'],
        transformToSupabase: (e: GradeEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          name: e.name,
          code: e.code,
          type: e.type,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          name: d.name,
          code: d.code,
          type: d.type,
        }),
      },
      {
        entity: DiplomaEntity,
        localRepository: this.appDataSourceInstance.getRepository(DiplomaEntity),
        supabaseTable: 'diploma',
        identifyingFields: ['name'],
        transformToSupabase: (e: DiplomaEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          name: e.name,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          name: d.name,
        }),
      },
      {
        entity: QualificationEntity,
        localRepository: this.appDataSourceInstance.getRepository(QualificationEntity),
        supabaseTable: 'qualification',
        identifyingFields: ['name'],
        transformToSupabase: (e: QualificationEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          name: e.name,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          name: d.name,
        }),
      },
      {
        entity: YearRepartitionEntity,
        localRepository: this.appDataSourceInstance.getRepository(YearRepartitionEntity),
        supabaseTable: 'year_repartition',
        identifyingFields: ['school_year'],
        transformToSupabase: (e: YearRepartitionEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          school_year: e.schoolYear,
          period_configurations: e.periodConfigurations,
          is_current: e.isCurrent ?? false,
        }),
        transformFromSupabase: (d: any) => ({
          schoolYear: d.school_year,
          periodConfigurations: d.period_configurations,
          isCurrent: d.is_current,
        }),
      },
      {
        entity: PaymentConfigEntity,
        localRepository: this.appDataSourceInstance.getRepository(PaymentConfigEntity),
        supabaseTable: 'payment_config',
        identifyingFields: ['class_id'],
        transformToSupabase: (e: PaymentConfigEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          class_id: e.classId,
          class_name: e.className,
          annual_amount: e.annualAmount,
          inscription_fee: e.inscriptionFee,
          re_inscription_fee: e.reInscriptionFee,
          allow_scholarship: e.allowScholarship,
          scholarship_percentages: e.scholarshipPercentages,
          scholarship_criteria: e.scholarshipCriteria,
        }),
        transformFromSupabase: (d: any) => ({
          classId: d.class_id,
          className: d.class_name,
          annualAmount: d.annual_amount,
          inscriptionFee: d.inscription_fee,
          reInscriptionFee: d.re_inscription_fee,
          allowScholarship: d.allow_scholarship,
          scholarshipPercentages: d.scholarship_percentages,
          scholarshipCriteria: d.scholarship_criteria,
        }),
      },
      {
        entity: GradingConfigEntity as any,
        localRepository: this.appDataSourceInstance.getRepository(GradingConfigEntity),
        supabaseTable: 'grading_config',
        identifyingFields: [],
        upsertConflict: 'school_id_local,class_id,subject_id',
        transformToSupabase: (e: any) => ({
          ...(e.remote_id && { id: e.remote_id }),
          school_id_local: e.schoolId,
          class_id: e.classId,
          subject_id: e.subjectId,
          final_grade_base: e.finalGradeBase,
          calculation_strategy: e.calculationStrategy,
          normalize_scores: e.normalizeScores,
          description: e.description,
        }),
        transformFromSupabase: (d: any) => ({
          schoolId: d.school_id_local,
          classId: d.class_id,
          subjectId: d.subject_id,
          finalGradeBase: d.final_grade_base,
          calculationStrategy: d.calculation_strategy,
          normalizeScores: d.normalize_scores,
          description: d.description,
        }),
      },

      // --- NIVEAU 1 : FK vers niveau 0 ---

      {
        entity: BranchEntity,
        localRepository: this.appDataSourceInstance.getRepository(BranchEntity),
        supabaseTable: 'branch',
        dependsOn: [GradeEntity],
        relationsToLoad: ['grade'],
        identifyingFields: ['code'],
        transformToSupabase: (e: BranchEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          name: e.name,
          code: e.code,
          grade_id: e.grade?.remote_id,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          name: d.name,
          code: d.code,
          _grade_remote_id: d.grade_id,
        }),
      },
      {
        entity: CourseEntity,
        localRepository: this.appDataSourceInstance.getRepository(CourseEntity),
        supabaseTable: 'course',
        dependsOn: [GradeEntity, CourseEntity],
        relationsToLoad: ['groupement', 'grade'],
        identifyingFields: ['code'],
        transformToSupabase: (e: CourseEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          code: e.code,
          name: e.name,
          coefficient: e.coefficient,
          is_in_groupement: e.isInGroupement,
          groupement_id: e.groupement?.remote_id,
          grade_id: e.grade?.remote_id,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          code: d.code,
          name: d.name,
          coefficient: d.coefficient,
          isInGroupement: d.is_in_groupement,
          _groupement_remote_id: d.groupement_id,
          _grade_remote_id: d.grade_id,
        }),
      },
      {
        entity: ProfessorEntity,
        localRepository: this.appDataSourceInstance.getRepository(ProfessorEntity),
        supabaseTable: 'professor',
        dependsOn: [DiplomaEntity, QualificationEntity],
        relationsToLoad: ['diploma', 'qualification'],
        identifyingFields: ['matricule'],
        transformToSupabase: (e: ProfessorEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          firstname: e.firstname,
          lastname: e.lastname,
          matricule: e.matricule,
          civility: e.civility,
          nbr_child: e.nbr_child,
          family_situation: e.family_situation,
          birth_date: e.birth_date,
          birth_town: e.birth_town,
          address: e.address,
          town: e.town,
          cni_number: e.cni_number,
          diploma_id: e.diploma?.remote_id,
          qualification_id: e.qualification?.remote_id,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          firstname: d.firstname,
          lastname: d.lastname,
          matricule: d.matricule,
          civility: d.civility,
          nbr_child: d.nbr_child,
          family_situation: d.family_situation,
          birth_date: d.birth_date,
          birth_town: d.birth_town,
          address: d.address,
          town: d.town,
          cni_number: d.cni_number,
          _diploma_remote_id: d.diploma_id,
          _qualification_remote_id: d.qualification_id,
        }),
      },
      {
        entity: StudentEntity,
        localRepository: this.appDataSourceInstance.getRepository(StudentEntity),
        supabaseTable: 'student',
        dependsOn: [GradeEntity],
        relationsToLoad: ['grade'],
        identifyingFields: ['matricule'],
        transformToSupabase: (e: StudentEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          firstname: e.firstname,
          lastname: e.lastname,
          matricule: e.matricule,
          father_firstname: e.fatherFirstname,
          father_lastname: e.fatherLastname,
          mother_firstname: e.motherFirstname,
          mother_lastname: e.motherLastname,
          birth_day: e.birthDay,
          birth_place: e.birthPlace,
          address: e.address,
          familly_phone: e.famillyPhone,
          personal_phone: e.personalPhone,
          sex: e.sex,
          school_year: e.schoolYear,
          is_new: e.isNew,
          grade_id: e.grade?.remote_id,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          firstname: d.firstname,
          lastname: d.lastname,
          matricule: d.matricule,
          fatherFirstname: d.father_firstname,
          fatherLastname: d.father_lastname,
          motherFirstname: d.mother_firstname,
          motherLastname: d.mother_lastname,
          birthDay: d.birth_day,
          birthPlace: d.birth_place,
          address: d.address,
          famillyPhone: d.familly_phone,
          personalPhone: d.personal_phone,
          sex: d.sex,
          schoolYear: d.school_year,
          isNew: d.is_new,
          _grade_remote_id: d.grade_id,
        }),
      },
      {
        entity: InscriptionFeeEntity as any,
        localRepository: this.appDataSourceInstance.getRepository(InscriptionFeeEntity),
        supabaseTable: 'inscription_fee',
        dependsOn: [GradeEntity],
        relationsToLoad: ['grade'],
        identifyingFields: [],
        hasRemoteUpdatedAt: false,
        transformToSupabase: (e: any) => ({
          ...(e.remote_id && { id: e.remote_id }),
          inscription_fee_amount: e.inscriptionFeeAmount,
          grade_id: e.grade?.remote_id,
        }),
        transformFromSupabase: (d: any) => ({
          inscriptionFeeAmount: d.inscription_fee_amount,
          _grade_remote_id: d.grade_id,
        }),
      },
      {
        entity: PaymentAnnualConfigEntity as any,
        localRepository: this.appDataSourceInstance.getRepository(PaymentAnnualConfigEntity),
        supabaseTable: 'payment_annual_config',
        dependsOn: [GradeEntity],
        relationsToLoad: ['grade'],
        identifyingFields: [],
        hasRemoteUpdatedAt: false,
        transformToSupabase: (e: any) => ({
          ...(e.remote_id && { id: e.remote_id }),
          tranche_count: e.trancheCount,
          grade_id: e.grade?.remote_id,
        }),
        transformFromSupabase: (d: any) => ({
          trancheCount: d.tranche_count,
          _grade_remote_id: d.grade_id,
        }),
      },
      {
        entity: GradeConfigEntity as any,
        localRepository: this.appDataSourceInstance.getRepository(GradeConfigEntity),
        supabaseTable: 'grade_config',
        dependsOn: [GradeEntity],
        relationsToLoad: ['grade'],
        identifyingFields: [],
        hasRemoteUpdatedAt: false,
        transformToSupabase: (e: any) => ({
          ...(e.remote_id && { id: e.remote_id }),
          number_of_assignments: e.numberOfAssignments,
          assignment_weight: e.assignmentWeight,
          exam_weight: e.examWeight,
          formula: e.formula,
          grade_id: e.grade?.remote_id,
        }),
        transformFromSupabase: (d: any) => ({
          numberOfAssignments: d.number_of_assignments,
          assignmentWeight: d.assignment_weight,
          examWeight: d.exam_weight,
          formula: d.formula,
          _grade_remote_id: d.grade_id,
        }),
      },
      {
        entity: EvaluationCategoryEntity as any,
        localRepository: this.appDataSourceInstance.getRepository(EvaluationCategoryEntity),
        supabaseTable: 'evaluation_category',
        dependsOn: [GradingConfigEntity],
        relationsToLoad: ['config'],
        identifyingFields: ['name'],
        hasRemoteUpdatedAt: false,
        transformToSupabase: (e: any) => ({
          ...(e.remote_id && { id: e.remote_id }),
          name: e.name,
          code: e.code,
          weight: e.weight,
          default_max_score: e.defaultMaxScore,
          min_entries: e.minEntries,
          max_entries: e.maxEntries,
          color: e.color,
          display_order: e.displayOrder,
          is_exam: e.isExam,
          config_id: e.config?.remote_id,
        }),
        transformFromSupabase: (d: any) => ({
          name: d.name,
          code: d.code,
          weight: d.weight,
          defaultMaxScore: d.default_max_score,
          minEntries: d.min_entries,
          maxEntries: d.max_entries,
          color: d.color,
          displayOrder: d.display_order,
          isExam: d.is_exam,
          _config_remote_id: d.config_id,
        }),
      },

      // --- NIVEAU 2 : FK vers niveau 1 ---

      {
        entity: ClassRoomEntity,
        localRepository: this.appDataSourceInstance.getRepository(ClassRoomEntity),
        supabaseTable: 'class_room',
        dependsOn: [GradeEntity, BranchEntity],
        relationsToLoad: ['grade', 'branch'],
        identifyingFields: ['code'],
        transformToSupabase: (e: ClassRoomEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          name: e.name,
          code: e.code,
          capacity: e.capacity,
          grade_id: e.grade?.remote_id,
          branch_id: e.branch?.remote_id,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          name: d.name,
          code: d.code,
          capacity: d.capacity,
          _grade_remote_id: d.grade_id,
          _branch_remote_id: d.branch_id,
        }),
      },
      {
        entity: ObservationEntity,
        localRepository: this.appDataSourceInstance.getRepository(ObservationEntity),
        supabaseTable: 'observation',
        dependsOn: [CourseEntity],
        relationsToLoad: ['course'],
        identifyingFields: [],
        transformToSupabase: (e: ObservationEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          observation: e.observation,
          note: e.note,
          course_id: e.course?.remote_id,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          observation: d.observation,
          note: d.note,
          _course_remote_id: d.course_id,
        }),
      },
      {
        entity: FileEntity,
        localRepository: this.appDataSourceInstance.getRepository(FileEntity),
        supabaseTable: 'file',
        dependsOn: [StudentEntity, ProfessorEntity],
        relationsToLoad: ['student', 'professor'],
        identifyingFields: ['name'],
        transformToSupabase: (e: FileEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          name: e.name,
          path: e.path,
          type: e.type,
          student_id: e.student?.remote_id,
          professor_id: e.professor?.remote_id,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          name: d.name,
          path: d.path,
          type: d.type,
          _student_remote_id: d.student_id,
          _professor_remote_id: d.professor_id,
        }),
      },
      {
        entity: TeachingAssignmentEntity,
        localRepository: this.appDataSourceInstance.getRepository(TeachingAssignmentEntity),
        supabaseTable: 'teaching_assignment',
        dependsOn: [ProfessorEntity, CourseEntity, GradeEntity],
        relationsToLoad: ['professor', 'course', 'class'],
        identifyingFields: [],
        transformToSupabase: (e: TeachingAssignmentEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          professor_id: e.professor?.remote_id,
          course_id: e.course?.remote_id,
          class_id: (e as any).class?.remote_id,
          teaching_type: (e as any).teachingType,
          school_type: (e as any).schoolType,
          grade_ids: (e as any).gradeIds,
          grade_names: (e as any).gradeNames,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          teachingType: d.teaching_type,
          schoolType: d.school_type,
          gradeIds: d.grade_ids,
          gradeNames: d.grade_names,
          _professor_remote_id: d.professor_id,
          _course_remote_id: d.course_id,
          _class_remote_id: d.class_id,
        }),
      },
      {
        entity: VacationEntity,
        localRepository: this.appDataSourceInstance.getRepository(VacationEntity),
        supabaseTable: 'vacation',
        dependsOn: [ProfessorEntity, StudentEntity],
        relationsToLoad: ['professor', 'student'],
        identifyingFields: [],
        transformToSupabase: (e: VacationEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          professor_id: e.professor?.remote_id,
          student_id: (e as any).student?.remote_id,
          start_date: e.startDate,
          end_date: e.endDate,
          reason: e.reason,
          status: e.status,
          comment: (e as any).comment,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          startDate: d.start_date,
          endDate: d.end_date,
          reason: d.reason,
          status: d.status,
          comment: d.comment,
          _professor_remote_id: d.professor_id,
          _student_remote_id: d.student_id,
        }),
      },
      {
        entity: ScholarshipEntity as any,
        localRepository: this.appDataSourceInstance.getRepository(ScholarshipEntity),
        supabaseTable: 'scholarship',
        dependsOn: [StudentEntity, PaymentConfigEntity],
        relationsToLoad: ['student', 'config'],
        identifyingFields: [],
        transformToSupabase: (e: any) => ({
          ...(e.remote_id && { id: e.remote_id }),
          student_id: e.student?.remote_id,
          config_id: e.config?.remote_id,
          percentage: e.percentage,
          is_active: e.isActive,
          school_year: e.schoolYear,
          reason: e.reason,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          percentage: d.percentage,
          isActive: d.is_active,
          schoolYear: d.school_year,
          reason: d.reason,
          _student_remote_id: d.student_id,
          _config_remote_id: d.config_id,
        }),
      },
      {
        entity: PaymentEntity,
        localRepository: this.appDataSourceInstance.getRepository(PaymentEntity),
        supabaseTable: 'payment',
        dependsOn: [StudentEntity, ScholarshipEntity as any],
        relationsToLoad: ['student', 'scholarship'],
        identifyingFields: [],
        transformToSupabase: (e: PaymentEntity) => {
          if (!e.student || !e.student.remote_id) {
            console.warn(`Paiement ID ${e.id} ignore: etudiant inexistant ou sans remote_id`);
            return null;
          }
          return {
            ...(e.remote_id && { id: e.remote_id }),
            student_id: e.student.remote_id,
            scholarship_id: e.scholarship?.remote_id,
            amount: e.amount,
            payment_type: e.paymentType,
            payment_method: e.paymentMethod,
            installment_number: e.installmentNumber,
            school_year: e.schoolYear,
            comment: e.comment,
            base_amount: e.baseAmount,
            scholarship_amount: e.scholarshipAmount,
            adjusted_amount: e.adjustedAmount,
            scholarship_percentage: e.scholarshipPercentage,
            updated_at: e.updated_at,
          };
        },
        transformFromSupabase: (d: any) => ({
          amount: d.amount,
          paymentType: d.payment_type,
          paymentMethod: d.payment_method,
          installmentNumber: d.installment_number,
          schoolYear: d.school_year,
          comment: d.comment,
          baseAmount: d.base_amount,
          scholarshipAmount: d.scholarship_amount,
          adjustedAmount: d.adjusted_amount,
          scholarshipPercentage: d.scholarship_percentage,
          _student_remote_id: d.student_id,
          _scholarship_remote_id: d.scholarship_id,
        }),
      },
      {
        entity: ProfessorPaymentEntity,
        localRepository: this.appDataSourceInstance.getRepository(ProfessorPaymentEntity),
        supabaseTable: 'professor_payment',
        dependsOn: [ProfessorEntity],
        relationsToLoad: ['professor'],
        identifyingFields: [],
        transformToSupabase: (e: ProfessorPaymentEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          professor_id: e.professor?.remote_id,
          amount: e.amount,
          type: e.type,
          payment_method: e.paymentMethod,
          month: (e as any).month,
          reference: (e as any).reference,
          comment: (e as any).comment,
          is_paid: (e as any).isPaid,
          gross_amount: (e as any).grossAmount,
          net_amount: (e as any).netAmount,
          deductions: (e as any).deductions,
          additions: (e as any).additions,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          amount: d.amount,
          type: d.type,
          paymentMethod: d.payment_method,
          month: d.month,
          reference: d.reference,
          comment: d.comment,
          isPaid: d.is_paid,
          grossAmount: d.gross_amount,
          netAmount: d.net_amount,
          deductions: d.deductions,
          additions: d.additions,
          _professor_remote_id: d.professor_id,
        }),
      },
      {
        entity: AbsenceEntity as any,
        localRepository: this.appDataSourceInstance.getRepository(AbsenceEntity),
        supabaseTable: 'absence',
        dependsOn: [StudentEntity, ProfessorEntity, GradeEntity, CourseEntity],
        relationsToLoad: ['student', 'professor', 'grade', 'course', 'document'],
        identifyingFields: [],
        transformToSupabase: (e: any) => ({
          ...(e.remote_id && { id: e.remote_id }),
          date: e.date,
          reason: e.reason,
          reason_type: e.reasonType,
          absence_type: e.absenceType,
          justified: e.justified,
          start_time: e.startTime,
          end_time: e.endTime,
          comments: e.comments,
          parent_notified: e.parentNotified,
          type: e.type,
          student_id: e.student?.remote_id,
          professor_id: e.professor?.remote_id,
          grade_id: e.grade?.remote_id,
          course_id: e.course?.remote_id,
          document_id: e.document?.remote_id,
          updated_at: e.updated_at,
        }),
        transformFromSupabase: (d: any) => ({
          date: d.date,
          reason: d.reason,
          reasonType: d.reason_type,
          absenceType: d.absence_type,
          justified: d.justified,
          startTime: d.start_time,
          endTime: d.end_time,
          comments: d.comments,
          parentNotified: d.parent_notified,
          type: d.type,
          _student_remote_id: d.student_id,
          _professor_remote_id: d.professor_id,
          _grade_remote_id: d.grade_id,
          _course_remote_id: d.course_id,
          _document_remote_id: d.document_id,
        }),
      },
      {
        entity: HomeworkEntity as any,
        localRepository: this.appDataSourceInstance.getRepository(HomeworkEntity),
        supabaseTable: 'homework',
        dependsOn: [CourseEntity, GradeEntity, ProfessorEntity],
        relationsToLoad: ['course', 'grade', 'professor'],
        identifyingFields: [],
        hasRemoteUpdatedAt: false,
        transformToSupabase: (e: any) => ({
          ...(e.remote_id && { id: e.remote_id }),
          description: e.description,
          due_date: e.dueDate,
          is_completed: e.isCompleted,
          course_id: e.course?.remote_id,
          grade_id: e.grade?.remote_id,
          professor_id: e.professor?.remote_id,
        }),
        transformFromSupabase: (d: any) => ({
          description: d.description,
          dueDate: d.due_date,
          isCompleted: d.is_completed,
          _course_remote_id: d.course_id,
          _grade_remote_id: d.grade_id,
          _professor_remote_id: d.professor_id,
        }),
      },
      {
        entity: ScheduleEntity as any,
        localRepository: this.appDataSourceInstance.getRepository(ScheduleEntity),
        supabaseTable: 'schedule',
        dependsOn: [ProfessorEntity, CourseEntity, GradeEntity],
        relationsToLoad: ['professor', 'course', 'class'],
        identifyingFields: [],
        upsertConflict: 'class_id,day,time_slot',
        transformToSupabase: (e: any) => ({
          ...(e.remote_id && { id: e.remote_id }),
          professor_id: e.professor?.remote_id,
          course_id: e.course?.remote_id,
          class_id: e.class?.remote_id,
          day: e.day,
          time_slot: e.timeSlot,
          updated_at: e.updatedAt,
        }),
        transformFromSupabase: (d: any) => ({
          day: d.day,
          timeSlot: d.time_slot,
          _professor_remote_id: d.professor_id,
          _course_remote_id: d.course_id,
          _class_remote_id: d.class_id,
        }),
      },
      {
        entity: GradeEntryEntity as any,
        localRepository: this.appDataSourceInstance.getRepository(GradeEntryEntity),
        supabaseTable: 'grade_entry',
        dependsOn: [StudentEntity, CourseEntity],
        relationsToLoad: ['student', 'course'],
        identifyingFields: [],
        transformToSupabase: (e: any) => ({
          ...(e.remote_id && { id: e.remote_id }),
          student_id: e.student?.remote_id,
          course_id: e.course?.remote_id,
          category_id: e.categoryId,
          period: e.period,
          score: e.score,
          max_score: e.maxScore,
          label: e.label,
          evaluation_date: e.evaluationDate,
          comment: e.comment,
        }),
        transformFromSupabase: (d: any) => ({
          categoryId: d.category_id,
          period: d.period,
          score: d.score,
          maxScore: d.max_score,
          label: d.label,
          evaluationDate: d.evaluation_date,
          comment: d.comment,
          _student_remote_id: d.student_id,
          _course_remote_id: d.course_id,
        }),
      },
      {
        entity: CalculatedGradeEntity as any,
        localRepository: this.appDataSourceInstance.getRepository(CalculatedGradeEntity),
        supabaseTable: 'calculated_grade',
        dependsOn: [StudentEntity, CourseEntity],
        relationsToLoad: ['student', 'course'],
        identifyingFields: [],
        upsertConflict: 'student_id,course_id,period',
        transformToSupabase: (e: any) => ({
          ...(e.remote_id && { id: e.remote_id }),
          student_id: e.student?.remote_id,
          course_id: e.course?.remote_id,
          period: e.period,
          final_average: e.finalAverage,
          config_id: e.configId,
          category_breakdown: e.categoryBreakdown,
          appreciation: e.appreciation,
        }),
        transformFromSupabase: (d: any) => ({
          period: d.period,
          finalAverage: d.final_average,
          configId: d.config_id,
          categoryBreakdown: d.category_breakdown,
          appreciation: d.appreciation,
          _student_remote_id: d.student_id,
          _course_remote_id: d.course_id,
        }),
      },
      {
        entity: TranchConfigEntity as any,
        localRepository: this.appDataSourceInstance.getRepository(TranchConfigEntity),
        supabaseTable: 'tranch_config',
        dependsOn: [PaymentAnnualConfigEntity as any],
        relationsToLoad: ['paymentAnnualConfig'],
        identifyingFields: [],
        hasRemoteUpdatedAt: false,
        transformToSupabase: (e: any) => ({
          ...(e.remote_id && { id: e.remote_id }),
          tranch_name: e.tranchName,
          amount: e.amount,
          tranch_month_count: e.tranchMonthCount,
          payment_annual_config_id: e.paymentAnnualConfig?.remote_id,
        }),
        transformFromSupabase: (d: any) => ({
          tranchName: d.tranch_name,
          amount: d.amount,
          tranchMonthCount: d.tranch_month_count,
          _paymentAnnualConfig_remote_id: d.payment_annual_config_id,
        }),
      },
      {
        entity: TrancheEntryEntity as any,
        localRepository: this.appDataSourceInstance.getRepository(TrancheEntryEntity),
        supabaseTable: 'mensuality_tranch',
        dependsOn: [TranchConfigEntity as any],
        relationsToLoad: ['tranchConfig'],
        identifyingFields: [],
        hasRemoteUpdatedAt: false,
        transformToSupabase: (e: any) => ({
          ...(e.remote_id && { id: e.remote_id }),
          start_date: e.startDate,
          end_date: e.endDate,
          tranch_config_id: e.tranchConfig?.remote_id,
        }),
        transformFromSupabase: (d: any) => ({
          startDate: d.start_date,
          endDate: d.end_date,
          _tranchConfig_remote_id: d.tranch_config_id,
        }),
      },
    ];
  }

  // ==========================================
  // SCHOOL SCHEMA PROVISIONING
  // ==========================================

  /**
   * Provisions a new school schema on Supabase via the provision_school RPC.
   * Returns the schema_name to be stored locally on the SchoolEntity.
   */
  async provisionSchoolSchema(schoolName: string): Promise<{ school_id: string; schema_name: string } | null> {
    if (this.isMockClient()) return null;

    try {
      const { data, error } = await this.supabase.rpc('provision_school', { p_name: schoolName });
      if (error) {
        console.error('[SYNC] Erreur provisionnement schema:', error);
        return null;
      }
      console.log('[SYNC] Schema provisionne:', data);
      return {
        school_id: data.school_id,
        schema_name: data.schema_name,
      };
    } catch (error) {
      console.error('[SYNC] Exception provisionnement schema:', error);
      return null;
    }
  }

  /**
   * Retrieves existing school schemas for the current user.
   */
  async getMySchools(): Promise<Array<{ id: string; name: string; schema_name: string }>> {
    if (this.isMockClient()) return [];

    try {
      const { data, error } = await this.supabase.rpc('get_my_schools');
      if (error) {
        console.error('[SYNC] Erreur recuperation ecoles:', error);
        return [];
      }
      return data || [];
    } catch (error) {
      console.error('[SYNC] Exception recuperation ecoles:', error);
      return [];
    }
  }

  /**
   * Ensures the current school has a provisioned schema on Supabase.
   * If not, provisions one and stores schema_name locally.
   */
  private async ensureSchemaProvisioned(): Promise<void> {
    if (this.activeSchemaName) return;

    const schoolRepo = this.appDataSourceInstance.getRepository(SchoolEntity);
    const school = await schoolRepo.findOne({ where: {} });
    if (!school) {
      console.warn('[SYNC] Aucune ecole locale trouvee.');
      return;
    }

    if (school.schema_name) {
      this.activeSchemaName = school.schema_name;
      console.log(`[SYNC] Schema existant charge: ${school.schema_name}`);
      return;
    }

    // Check if a schema already exists on Supabase for this user
    const remoteSchools = await this.getMySchools();
    if (remoteSchools.length > 0) {
      const match = remoteSchools.find(rs => rs.name === school.name) || remoteSchools[0];
      school.schema_name = match.schema_name;
      school.remote_id = match.id;
      await schoolRepo.save(school);
      this.activeSchemaName = match.schema_name;
      console.log(`[SYNC] Schema distant existant lie: ${match.schema_name}`);
      return;
    }

    // Provision a new schema
    console.log(`[SYNC] Provisionnement d'un nouveau schema pour: ${school.name}`);
    const result = await this.provisionSchoolSchema(school.name);
    if (result) {
      school.schema_name = result.schema_name;
      school.remote_id = result.school_id;
      await schoolRepo.save(school);
      this.activeSchemaName = result.schema_name;
      console.log(`[SYNC] Nouveau schema provisionne: ${result.schema_name}`);
    } else {
      console.error('[SYNC] Echec du provisionnement du schema.');
    }
  }

  // ==========================================
  // SCHEMA-AWARE CLIENT
  // ==========================================

  private getActiveSchemaClient(): SupabaseClient | null {
    const schemaName = this.activeSchemaName || getCurrentSchemaName();
    if (!schemaName) {
      console.warn('[SYNC] Aucun schema actif. Synchronisation impossible.');
      return null;
    }
    return getSchemaClient(schemaName);
  }

  // ==========================================
  // COURSE_GRADES JUNCTION TABLE SYNC
  // ==========================================

  private async syncCourseGradesUp(schemaClient: SupabaseClient): Promise<number> {
    const courseRepo = this.appDataSourceInstance.getRepository(CourseEntity);
    const courses = await courseRepo.find({
      relations: ['grades'],
      where: { remote_id: Not(IsNull()) },
    });

    let synced = 0;
    for (const course of courses) {
      if (!course.grades || course.grades.length === 0 || !course.remote_id) continue;

      const pairs = course.grades
        .filter(g => g.remote_id)
        .map(g => ({
          course_id: course.remote_id,
          grade_id: g.remote_id,
        }));

      if (pairs.length === 0) continue;

      const { error } = await schemaClient
        .from('course_grades')
        .upsert(pairs, { onConflict: 'course_id,grade_id' });

      if (error) {
        console.error(`[SYNC] Erreur upsert course_grades pour course ${course.id}:`, error);
      } else {
        synced += pairs.length;
      }
    }
    return synced;
  }

  private async syncCourseGradesDown(schemaClient: SupabaseClient): Promise<number> {
    const { data, error } = await schemaClient.from('course_grades').select('*');
    if (error || !data) {
      console.error('[SYNC] Erreur fetch course_grades:', error);
      return 0;
    }

    const courseRepo = this.appDataSourceInstance.getRepository(CourseEntity);
    const gradeRepo = this.appDataSourceInstance.getRepository(GradeEntity);
    let synced = 0;

    for (const row of data) {
      const localCourse = await courseRepo.findOne({
        where: { remote_id: row.course_id },
        relations: ['grades'],
      });
      const localGrade = await gradeRepo.findOne({
        where: { remote_id: row.grade_id },
      });

      if (!localCourse || !localGrade) continue;

      const alreadyLinked = localCourse.grades?.some(g => g.id === localGrade.id);
      if (!alreadyLinked) {
        if (!localCourse.grades) localCourse.grades = [];
        localCourse.grades.push(localGrade);
        await courseRepo.save(localCourse);
        synced++;
      }
    }
    return synced;
  }

  // ==========================================
  // INIT / AUTH / AVAILABILITY
  // ==========================================

  private initializeMockClient(): void {
    this.supabase = { auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as any;
    this.supabaseAvailable = false;
    console.log("Cloud Sync: Mock Supabase client active.");
  }

  private isMockClient(): boolean {
    return !this.supabase || !('rpc' in this.supabase);
  }

  async getSupabaseAuthUser(): Promise<{ id: string } | null> {
    if (this.isMockClient()) return null;
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();
      if (error || !user) return null;
      return { id: user.id };
    } catch (error) {
      console.error("Erreur recuperation utilisateur:", error);
      return null;
    }
  }

  async checkSupabaseAvailability(): Promise<boolean> {
    if (this.isMockClient()) {
      this.supabaseAvailable = false;
      return false;
    }
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();
      if (error) {
        this.supabaseAvailable = false;
        return false;
      }
      this.supabaseAvailable = !!user;
      return this.supabaseAvailable;
    } catch (error) {
      this.supabaseAvailable = false;
      return false;
    }
  }

  // ==========================================
  // SYNC CONFIG
  // ==========================================

  async loadSyncConfig(): Promise<SyncConfig> {
    const localConfigPath = path.join(this.syncHistoryDir, 'sync_config.json');
    let config = { ...DEFAULT_SYNC_CONFIG };
    if (fs.existsSync(localConfigPath)) {
      try {
        config = { ...config, ...JSON.parse(fs.readFileSync(localConfigPath, 'utf8')) };
      } catch (e) { console.error("Erreur lecture config locale:", e); }
    }
    return config;
  }

  async updateSyncConfig(newConfig: Partial<SyncConfig>): Promise<void> {
    const currentConfig = await this.loadSyncConfig();
    const updatedConfig = { ...currentConfig, ...newConfig };
    const localConfigPath = path.join(this.syncHistoryDir, 'sync_config.json');
    try {
      fs.writeFileSync(localConfigPath, JSON.stringify(updatedConfig, null, 2));
    } catch (e) { console.error("Erreur sauvegarde config locale:", e); }
    this.stopPeriodicSyncTimer();
    await this.startPeriodicSyncTimer();
  }

  // ==========================================
  // SYNC OPPORTUNITY CHECK
  // ==========================================

  async checkForSyncOpportunity(onlineAuthUserId: string): Promise<void> {
    if (this.isSyncing) return;
    if (this.entitySyncMetas.length === 0) {
      console.warn("Cloud Sync: Aucune entite configuree.");
      return;
    }

    // Re-check availability in case user logged in after init
    if (!this.supabaseAvailable) {
      await this.checkSupabaseAvailability();
    }
    if (!this.supabaseAvailable || this.isMockClient()) return;

    const config = await this.loadSyncConfig();
    if (config.notifyBeforeSync) {
      const userConfirmed = await this.promptUserForSyncDialog();
      if (!userConfirmed) return;
    }

    await this.performBidirectionalSync(onlineAuthUserId);
  }

  private async promptUserForSyncDialog(): Promise<boolean> {
    console.warn("promptUserForSyncDialog: UI a implementer via IPC.");
    return true;
  }

  private async getLastSyncTimestamp(userId: string): Promise<Date> {
    const localHistory = await this.getLocalSyncHistory(userId);
    const lastSuccess = localHistory
      .filter(h => h.status === 'success' || h.status === 'partial_success')
      .sort((a, b) => new Date(b.sync_ended_at!).getTime() - new Date(a.sync_ended_at!).getTime());

    if (lastSuccess.length > 0 && lastSuccess[0].sync_ended_at) {
      return new Date(lastSuccess[0].sync_ended_at);
    }
    return new Date(0);
  }

  async hasLocalChanges(since: Date): Promise<boolean> {
    for (const meta of this.entitySyncMetas) {
      const count = await meta.localRepository.count({
        where: [
          { remote_id: IsNull(), deleted_at: IsNull() },
          { updated_at: MoreThan(since), remote_id: Not(IsNull()) },
        ] as FindOptionsWhere<BaseSyncEntity>[],
      });
      if (count > 0) return true;
    }
    return false;
  }

  async hasRemoteChanges(schemaClient: SupabaseClient, since: Date): Promise<boolean> {
    for (const meta of this.entitySyncMetas) {
      const { error, count } = await schemaClient
        .from(meta.supabaseTable)
        .select('id', { count: 'exact', head: true })
        .gt('updated_at', since.toISOString());
      if (error) { continue; }
      if (count && count > 0) return true;
    }
    return false;
  }

  // ==========================================
  // BIDIRECTIONAL SYNC
  // ==========================================

  async performBidirectionalSync(onlineAuthUserId: string): Promise<SyncHistory> {
    if (this.isSyncing) {
      console.log('[SYNC] Synchronisation deja en cours, ignoree.');
      return {
        id: randomUUID(), user_id: onlineAuthUserId, direction: 'bidirectional',
        status: 'skipped', error_message: 'Synchronisation deja en cours',
        sync_started_at: new Date().toISOString(), sync_ended_at: new Date().toISOString(),
      };
    }

    this.isSyncing = true;
    console.log('[SYNC] Debut synchronisation bidirectionnelle');

    // Re-check availability in case user logged in after service init
    if (!this.supabaseAvailable) {
      await this.checkSupabaseAvailability();
    }

    if (!this.supabaseAvailable || this.isMockClient()) {
      this.isSyncing = false;
      const errEvt: SyncHistory = {
        id: randomUUID(), user_id: onlineAuthUserId, direction: 'bidirectional',
        status: 'failed', error_message: 'Supabase non disponible',
        sync_started_at: new Date().toISOString(), sync_ended_at: new Date().toISOString(),
      };
      await this.createSyncHistoryEvent(errEvt);
      return errEvt;
    }

    // Auto-provision schema if not yet set
    await this.ensureSchemaProvisioned();

    const schemaClient = this.getActiveSchemaClient();
    if (!schemaClient) {
      this.isSyncing = false;
      const errEvt: SyncHistory = {
        id: randomUUID(), user_id: onlineAuthUserId, direction: 'bidirectional',
        status: 'failed', error_message: 'Schema non provisionne. Impossible de synchroniser.',
        sync_started_at: new Date().toISOString(), sync_ended_at: new Date().toISOString(),
      };
      await this.createSyncHistoryEvent(errEvt);
      return errEvt;
    }

    const historyId = randomUUID();
    let h: SyncHistory = {
      id: historyId, sync_started_at: new Date().toISOString(), direction: 'bidirectional',
      status: 'in_progress', user_id: onlineAuthUserId, tables_processed: [],
      records_synced_up: 0, records_synced_down: 0, conflict_count: 0,
    };
    await this.createSyncHistoryEvent(h);

    try {
      const lastSyncTime = await this.getLastSyncTimestamp(onlineAuthUserId);
      const currentSyncStartTime = new Date(h.sync_started_at);

      // ================================
      // PHASE 1: Local -> Cloud
      // ================================
      console.log("SYNC PHASE 1: Local -> Cloud");

      for (const meta of this.getOrderedMetasForUpload()) {
        const localChanges = await this.findLocalChanges(meta, lastSyncTime);

        if (localChanges.length === 0) continue;

        const toUpsert: any[] = [];
        const toDeleteRemote: string[] = [];
        const recordsToUpdateLocally: BaseSyncEntity[] = [];

        for (const lc of localChanges) {
          const payload = meta.transformToSupabase(lc);
          if (!payload) continue;

          delete payload.created_at;

          // Validate that id (remote_id) is a proper UUID; discard if not
          if (payload.id && !isValidUuid(payload.id)) {
            console.warn(`[L->C] ${meta.supabaseTable} ID local ${lc.id}: remote_id invalide "${payload.id}", traite comme nouveau`);
            delete payload.id;
            lc.remote_id = null;
          }

          // Skip records where a loaded relation exists but hasn't been synced (no remote_id)
          const unresolvedRel = (meta.relationsToLoad || []).find(relName => {
            const relValue = (lc as any)[relName];
            return relValue != null && !relValue.remote_id;
          });
          if (unresolvedRel) {
            console.warn(`[L->C] ${meta.supabaseTable} ID local ${lc.id}: relation "${unresolvedRel}" sans remote_id, reporte`);
            continue;
          }

          // Strip undefined values so nullable FKs don't get sent as null
          for (const key of Object.keys(payload)) {
            if (payload[key] === undefined) delete payload[key];
          }

          if (lc.deleted_at && lc.remote_id && isValidUuid(lc.remote_id)) {
            toDeleteRemote.push(lc.remote_id);
          } else if (!lc.deleted_at) {
            toUpsert.push(payload);
          }
        }

        if (toDeleteRemote.length > 0) {
          const { error } = await schemaClient
            .from(meta.supabaseTable)
            .delete()
            .in('id', toDeleteRemote);

          if (error) throw new Error(`[L->C] Erreur suppression ${meta.supabaseTable}: ${error.message}`);
          h.records_synced_up! += toDeleteRemote.length;
        }

        if (toUpsert.length > 0) {
          console.log(`[L->C] Upsert ${meta.supabaseTable}: ${toUpsert.length} enregistrements`);

          const selectFields = ['id', ...(meta.hasRemoteUpdatedAt !== false ? ['updated_at'] : []), ...(meta.identifyingFields || [])];
          const supabaseResponse = await schemaClient
            .from(meta.supabaseTable)
            .upsert(toUpsert, { onConflict: meta.upsertConflict || 'id' })
            .select(selectFields.join(', '));

          if (supabaseResponse.error) {
            console.error(`[SYNC] Echec upsert ${meta.supabaseTable}:`, supabaseResponse.error);
            h.error_message = (h.error_message || '') + `[L->C] ${meta.supabaseTable}: ${supabaseResponse.error.message}; `;
            continue;
          }

          const upsertResults = supabaseResponse.data as any[];
          if (upsertResults && Array.isArray(upsertResults)) {
            for (const remoteResult of upsertResults) {
              const localRecord = localChanges.find(l => {
                if (l.remote_id && l.remote_id === remoteResult.id) return true;
                if (!l.remote_id) {
                  // Match via payload: transform local and compare identifying fields
                  const localPayload = meta.transformToSupabase(l);
                  if (!localPayload) return false;
                  for (const field of (meta.identifyingFields || [])) {
                    if (remoteResult[field] && localPayload[field] === remoteResult[field]) return true;
                  }
                }
                return false;
              });

              if (localRecord) {
                localRecord.remote_id = remoteResult.id;
                // Update the appropriate timestamp column
                const hasUpdatedAt = 'updated_at' in localRecord;
                if (hasUpdatedAt && remoteResult.updated_at) {
                  localRecord.updated_at = new Date(remoteResult.updated_at);
                }
                recordsToUpdateLocally.push(localRecord);
              }
            }
          }
          h.records_synced_up! += toUpsert.length;
        }

        if (recordsToUpdateLocally.length > 0) {
          const uniqueRecords = [...new Map(recordsToUpdateLocally.map(item => [item.id, item])).values()];
          await meta.localRepository.save(uniqueRecords);
          console.log(`[L->C] ${meta.supabaseTable}: ${uniqueRecords.length} remote_id sauvegardés localement`);
        }

        h.tables_processed!.push(meta.supabaseTable);
      }

      // Sync course_grades junction table (Local -> Cloud)
      const courseGradesSynced = await this.syncCourseGradesUp(schemaClient);
      if (courseGradesSynced > 0) {
        h.records_synced_up! += courseGradesSynced;
        h.tables_processed!.push('course_grades');
      }

      // ================================
      // PHASE 2: Cloud -> Local
      // ================================
      console.log("SYNC PHASE 2: Cloud -> Local");

      for (const meta of this.getOrderedMetasForDownload()) {
        let query = schemaClient.from(meta.supabaseTable).select('*');

        if (meta.hasRemoteUpdatedAt !== false) {
          query = query.gt('updated_at', lastSyncTime.toISOString());
        } else {
          // Tables without updated_at: fetch records created since last sync
          query = query.gt('created_at', lastSyncTime.toISOString());
        }

        const { data: remoteChanges, error: fetchError } = await query;

        if (fetchError) {
          console.error(`[C->L] Erreur fetch ${meta.supabaseTable}:`, fetchError);
          h.error_message = (h.error_message || '') + `[C->L] ${meta.supabaseTable}: ${fetchError.message}; `;
          continue;
        }
        if (!remoteChanges || remoteChanges.length === 0) continue;

        console.log(`  [C->L] ${meta.supabaseTable}: ${remoteChanges.length} changements distants.`);

        const fkMaps = await this.buildForeignKeyMaps(meta, remoteChanges);

        for (const remoteRecord of remoteChanges) {
          const transformed = meta.transformFromSupabase(remoteRecord);

          this.resolveForeignKeys(transformed, fkMaps);

          let localRecord = await meta.localRepository.findOne({
            where: { remote_id: remoteRecord.id } as FindOptionsWhere<BaseSyncEntity>,
          });

          if (localRecord) {
            const remoteUpdatedAt = remoteRecord.updated_at ? new Date(remoteRecord.updated_at) : null;
            const localUpdatedAt = (localRecord as any).updated_at ?? (localRecord as any).updatedAt ?? null;
            const shouldUpdate = !remoteUpdatedAt || !localUpdatedAt || remoteUpdatedAt > localUpdatedAt;

            if (shouldUpdate) {
              const timestampUpdate: any = {};
              if (remoteUpdatedAt) {
                if ('updated_at' in localRecord) timestampUpdate.updated_at = remoteUpdatedAt;
                else if ('updatedAt' in localRecord) timestampUpdate.updatedAt = remoteUpdatedAt;
              }
              Object.assign(localRecord, transformed, timestampUpdate);
              await meta.localRepository.save(localRecord);
              h.records_synced_down!++;
            }
          } else {
            const newData: any = {
              ...transformed,
              remote_id: remoteRecord.id,
            };
            if (remoteRecord.created_at) newData.created_at = new Date(remoteRecord.created_at);
            if (remoteRecord.updated_at) newData.updated_at = new Date(remoteRecord.updated_at);

            const newLocal = meta.localRepository.create(newData as any);
            try {
              await meta.localRepository.save(newLocal);
              h.records_synced_down!++;
            } catch (saveError: any) {
              console.warn(`[C->L] Erreur creation ${meta.supabaseTable} (remote_id: ${remoteRecord.id}):`, saveError.message);
              h.conflict_count!++;
            }
          }
        }

        if (!h.tables_processed!.includes(meta.supabaseTable)) {
          h.tables_processed!.push(meta.supabaseTable);
        }
      }

      // Sync course_grades junction table (Cloud -> Local)
      const courseGradesDownSynced = await this.syncCourseGradesDown(schemaClient);
      h.records_synced_down! += courseGradesDownSynced;

      h.status = h.conflict_count! > 0 ? 'partial_success' : 'success';

    } catch (error: any) {
      console.error("Erreur durant performBidirectionalSync:", error);
      h.status = 'failed';
      h.error_message = error.message;
    } finally {
      h.sync_ended_at = new Date().toISOString();
      h.tables_processed = [...new Set(h.tables_processed)];
      await this.createSyncHistoryEvent(h);
      this.isSyncing = false;
      console.log("Synchronisation terminee. Statut:", h.status, "Conflits:", h.conflict_count);
    }

    return h;
  }

  // ==========================================
  // FK RESOLUTION (GENERIC)
  // ==========================================

  /**
   * Resolves `_xxx_remote_id` fields in a transformed object to local entity IDs
   * by looking up the local record matching that remote_id, then setting the
   * corresponding relation property.
   */
  private resolveForeignKeys(transformed: any, fkMaps: Record<string, Map<string, number>>): void {
    const keysToDelete: string[] = [];

    for (const key of Object.keys(transformed)) {
      if (!key.startsWith('_') || !key.endsWith('_remote_id')) continue;

      const remoteId = transformed[key];
      keysToDelete.push(key);

      if (!remoteId) continue;

      // Extract relation name: _student_remote_id -> student
      const relationName = key.slice(1, -('_remote_id'.length));
      const localId = fkMaps[key]?.get(remoteId);

      if (localId) {
        transformed[relationName] = { id: localId };
      }
    }

    for (const key of keysToDelete) {
      delete transformed[key];
    }
  }

  private async buildForeignKeyMaps(meta: EntitySyncMeta<any>, remoteChanges: any[]): Promise<Record<string, Map<string, number>>> {
    const fkMaps: Record<string, Map<string, number>> = {};

    const remoteIdLookups: Record<string, Set<string>> = {};
    for (const remoteRecord of remoteChanges) {
      const transformed = meta.transformFromSupabase(remoteRecord);
      for (const key in transformed) {
        if (key.startsWith('_') && key.endsWith('_remote_id')) {
          const fkRemoteId = (transformed as any)[key];
          if (fkRemoteId) {
            if (!remoteIdLookups[key]) remoteIdLookups[key] = new Set();
            remoteIdLookups[key].add(fkRemoteId);
          }
        }
      }
    }

    for (const lookupKey in remoteIdLookups) {
      const entityName = lookupKey.replace(/^_|_remote_id$/g, '');
      const dependencyMeta = this.entitySyncMetas.find(m => {
        const tableName = m.localRepository.metadata.tableName.toLowerCase();
        return tableName.includes(entityName.toLowerCase()) ||
               tableName === entityName.toLowerCase();
      });

      if (dependencyMeta) {
        const localEntities = await dependencyMeta.localRepository.find({
          where: { remote_id: In([...remoteIdLookups[lookupKey]]) } as any,
          select: ['id', 'remote_id'] as any,
        });
        fkMaps[lookupKey] = new Map(localEntities.map((e: any) => [e.remote_id, e.id]));
      } else {
        console.warn(`[C->L] Pas de meta trouve pour la FK: ${lookupKey} (entity: ${entityName})`);
      }
    }
    return fkMaps;
  }

  // ==========================================
  // ENTITY-AWARE LOCAL QUERY
  // ==========================================

  private async findLocalChanges(meta: EntitySyncMeta<any>, lastSyncTime: Date): Promise<any[]> {
    const columns = meta.localRepository.metadata.columns.map(c => c.propertyName);
    const hasDeletedAt = columns.includes('deleted_at');
    const hasUpdatedAt = columns.includes('updated_at');
    const hasUpdatedAtCamel = columns.includes('updatedAt');
    const hasRemoteId = columns.includes('remote_id');

    if (!hasRemoteId) {
      // Entity without remote_id: sync all records
      return meta.localRepository.find({
        relations: meta.relationsToLoad || [],
      });
    }

    const updatedAtCol = hasUpdatedAt ? 'updated_at' : hasUpdatedAtCamel ? 'updatedAt' : null;

    const whereNew: any = { remote_id: IsNull() };
    if (hasDeletedAt) whereNew.deleted_at = IsNull();

    const conditions: any[] = [whereNew];

    if (updatedAtCol) {
      const whereUpdated: any = { remote_id: Not(IsNull()) };
      whereUpdated[updatedAtCol] = MoreThan(lastSyncTime);
      conditions.push(whereUpdated);
    } else {
      // No updated_at: include all records with remote_id (they'll be upserted)
      conditions.push({ remote_id: Not(IsNull()) });
    }

    return meta.localRepository.find({
      where: conditions,
      relations: meta.relationsToLoad || [],
    });
  }

  // ==========================================
  // ORDERING
  // ==========================================

  private getOrderedMetasForUpload(): EntitySyncMeta<any>[] {
    const sorted: EntitySyncMeta<any>[] = [];
    const metas = new Set(this.entitySyncMetas);

    while (metas.size > 0) {
      let hasChanged = false;
      metas.forEach(meta => {
        const dependencies = meta.dependsOn || [];
        const allDependenciesMet = dependencies.every(dep =>
          dep === meta.entity || sorted.some(s => s.entity === dep)
        );
        if (allDependenciesMet) {
          sorted.push(meta);
          metas.delete(meta);
          hasChanged = true;
        }
      });
      if (!hasChanged) {
        console.error("[SYNC] Dependances non resolues:", [...metas].map(m => m.supabaseTable));
        sorted.push(...metas);
        break;
      }
    }

    console.log('[SYNC] Ordre upload:', sorted.map(m => m.supabaseTable));
    return sorted;
  }

  private getOrderedMetasForDownload(): EntitySyncMeta<any>[] {
    return this.getOrderedMetasForUpload();
  }

  // ==========================================
  // SYNC HISTORY
  // ==========================================

  async createSyncHistoryEvent(eventData: SyncHistory): Promise<void> {
    const historyFilePath = path.join(this.syncHistoryDir, `${eventData.user_id}_sync_history.json`);
    let localHistory: SyncHistory[] = [];
    if (fs.existsSync(historyFilePath)) {
      try { localHistory = JSON.parse(fs.readFileSync(historyFilePath, 'utf8')); }
      catch (e) { console.error("Erreur lecture historique local:", e); }
    }
    const existingIdx = localHistory.findIndex(h => h.id === eventData.id);
    if (existingIdx > -1) localHistory[existingIdx] = eventData;
    else localHistory.unshift(eventData);
    localHistory = localHistory.slice(0, 50);
    try {
      fs.writeFileSync(historyFilePath, JSON.stringify(localHistory, null, 2));
    } catch (e) { console.error("Erreur ecriture historique local:", e); }

    if (this.supabaseAvailable && !this.isMockClient()) {
      try {
        const { error } = await this.supabase.from('sync_history').upsert(eventData);
        if (error) console.error("Erreur sauvegarde historique Supabase:", error);
      } catch (e) { console.error("Exception sauvegarde historique Supabase:", e); }
    }
  }

  async getLocalSyncHistory(userId: string): Promise<SyncHistory[]> {
    const historyFilePath = path.join(this.syncHistoryDir, `${userId}_sync_history.json`);
    if (fs.existsSync(historyFilePath)) {
      try { return JSON.parse(fs.readFileSync(historyFilePath, 'utf8')); }
      catch (e) { console.error("Erreur lecture historique local:", e); }
    }
    return [];
  }

  // ==========================================
  // PERIODIC SYNC TIMER
  // ==========================================

  async startPeriodicSyncTimer() {
    if (this.syncTimerId) clearInterval(this.syncTimerId);
    const config = await this.loadSyncConfig();
    const user = await this.getSupabaseAuthUser();

    if (config.autoSyncOnConnect && config.syncIntervalMinutes && config.syncIntervalMinutes > 0 && user?.id) {
      console.log(`Cloud Sync: Timer synchro toutes les ${config.syncIntervalMinutes} minutes.`);
      this.syncTimerId = setInterval(async () => {
        const currentUser = await this.getSupabaseAuthUser();
        if (currentUser?.id) {
          await this.checkForSyncOpportunity(currentUser.id);
        } else {
          this.stopPeriodicSyncTimer();
        }
      }, config.syncIntervalMinutes * 60 * 1000);
    }
  }

  stopPeriodicSyncTimer() {
    if (this.syncTimerId) {
      clearInterval(this.syncTimerId);
      this.syncTimerId = null;
    }
  }

  // ==========================================
  // BACKUP API (preserved from original)
  // ==========================================

  async createBackup(name?: string): Promise<{ success: boolean; data: any; error: string | null }> {
    try {
      const isAuthenticated = await this.checkSupabaseAvailability();
      if (!isAuthenticated) return { success: false, data: null, error: "NOT_AUTHENTICATED" };

      const authUser = await this.getSupabaseAuthUser();
      if (!authUser) return { success: false, data: null, error: "NO_AUTH_USER" };

      try {
        const syncResult = await this.performBidirectionalSync(authUser.id);
        return { success: true, data: syncResult, error: null };
      } catch (error) {
        return {
          success: false, data: null,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      return { success: false, data: null, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  async deleteBackup(id: string): Promise<boolean> {
    try {
      const authUser = await this.getSupabaseAuthUser();
      if (!authUser) throw new Error('Utilisateur non authentifie');

      let deleted = false;
      const backupRepository = AppDataSource.getInstance().getRepository(BackupEntity);
      const backup = await backupRepository.findOne({ where: { id, user_id: authUser.id } });

      if (backup) {
        await backupRepository.remove(backup);
        deleted = true;
      }

      if (this.supabase) {
        try {
          await this.supabase.rpc('delete_backup', { backup_id: id });
          deleted = true;
        } catch (error) {
          console.error('Erreur suppression Supabase:', error);
        }
      }

      if (!deleted) throw new Error('Sauvegarde non trouvee');
      return true;
    } catch (error) {
      console.error('Erreur suppression sauvegarde:', error);
      throw error;
    }
  }

  async getBackups(): Promise<any[]> {
    try {
      const authUser = await this.getSupabaseAuthUser();
      if (!authUser) return [];

      const backupRepository = AppDataSource.getInstance().getRepository(BackupEntity);
      const localBackups = await backupRepository.find({
        where: { user_id: authUser.id },
        order: { created_at: 'DESC' },
      });

      let supabaseBackups: any[] = [];
      if (this.supabase && this.supabaseAvailable) {
        try {
          const { data, error } = await this.supabase
            .from('backups')
            .select('*')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false });
          if (!error) supabaseBackups = data || [];
        } catch (error) {
          console.error('Erreur recuperation sauvegardes Supabase:', error);
        }
      }

      const allBackups = [...localBackups];
      for (const sb of supabaseBackups) {
        if (!allBackups.some(b => b.id === sb.id)) {
          allBackups.push({ ...sb, source: 'cloud' });
        }
      }

      return allBackups.sort((a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
    } catch (error) {
      console.error('Erreur recuperation sauvegardes:', error);
      return [];
    }
  }

  // ==========================================
  // SCHOOL MANAGEMENT
  // ==========================================

  public setActiveSchool(schoolId: string, schemaName?: string) {
    this.activeSchoolId = schoolId;
    this.activeSchemaName = schemaName || null;
    console.log(`Cloud Sync: Ecole active: ${schoolId}, schema: ${schemaName ?? '(non defini)'}`);
  }

  private getCurrentSessionUserId(): string | null {
    return getCurrentSupabaseUserId();
  }
}
