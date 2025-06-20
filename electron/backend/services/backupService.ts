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
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabaseClient';
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
import { getCurrentSupabaseUserId } from "../lib/session";


// --- Définitions de types et interfaces ---

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
  syncIntervalMinutes?: number; // Pour synchronisation périodique
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
  supabaseTable: string; // Nom de la table sur Supabase
  dependsOn?: (new () => BaseSyncEntity)[]; // Pour l'ordre de synchro
  relationsToLoad?: string[]; // Pour charger les relations avant l'upload
  identifyingFields?: string[]; // Champs utilisés pour identifier l'entité (matricule, code, etc.)
  transformToSupabase: (localEntity: T) => any;
  transformFromSupabase: (supabaseData: any) => Partial<T>;
}

const DEFAULT_SYNC_CONFIG: SyncConfig = {
  autoSyncOnConnect: true,
  notifyBeforeSync: true,
  syncIntervalMinutes: 60, // Exemple: synchroniser toutes les heures si autoSync
};

type MockSupabaseClient = any; // Pour la compilation, à remplacer si vous avez un vrai mock

// --- CloudSyncService ---

export class CloudSyncService {
  // MODIFIÉ: Utilise directement l'instance partagée
  private supabase: SupabaseClient = supabase;
  private electronStore: ElectronStore;
  private configKey = 'cloud_sync_config_v3';
  private supabaseAvailable = false;
  private appDataSourceInstance: DataSource;
  private entitySyncMetas: EntitySyncMeta<any>[] = [];
  private isSyncing = false;
  private syncHistoryDir: string;
  private syncTimerId: NodeJS.Timeout | null = null;

  constructor() {
    this.electronStore = new ElectronStore();
    // Le client partagé est déjà assigné à this.supabase

    // Cette vérification est maintenant une sécurité
    const dataSourceInstance = AppDataSource.getInstance();
    if (!dataSourceInstance || !dataSourceInstance.isInitialized) {

      console.error("CloudSyncService FATAL: AppDataSource n'est pas initialisée au moment de la création du service. L'ordre d'initialisation dans main.ts est incorrect.");

      this.initializeMockClient();
      return;
    }

    this.appDataSourceInstance = dataSourceInstance;
    this.syncHistoryDir = path.join(app.getPath('userData'), 'sync_history');
    if (!fs.existsSync(this.syncHistoryDir)) fs.mkdirSync(this.syncHistoryDir, { recursive: true });

    this.populateEntitySyncMetas();


    // Le client réel est déjà défini. On vérifie juste son état.
    this.checkSupabaseAvailability().then(async (isAvailable) => {
      if (isAvailable) {
        const user = await this.getSupabaseAuthUser();
        console.log(`Cloud Sync: Client Supabase initialisé. Utilisateur connecté: ${!!user}`);
        await this.startPeriodicSyncTimer();

        const config = await this.loadSyncConfig();
        if (config.autoSyncOnConnect && user?.id) {
          console.log("Auto-synchronisation à la connexion...");
          this.checkForSyncOpportunity(user.id);
        }
      } else {
        console.warn('Cloud Sync: Client Supabase initialisé, mais aucun utilisateur connecté.');
      }
    }).catch(error => {
      console.error('Cloud Sync: Erreur lors de l\'initialisation de Supabase:', error);
      // On peut quand même charger la config locale
      this.loadSyncConfig();
    });
  }




  private populateEntitySyncMetas() {
    this.entitySyncMetas = [
      // --- NIVEAU 0 ---
      {
        entity: GradeEntity,
        localRepository: this.appDataSourceInstance.getRepository(GradeEntity),
        supabaseTable: 'grade',
        identifyingFields: ['code'],
        transformToSupabase: (e: GradeEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          name: e.name,
          code: e.code,
          updated_at: e.updated_at
        }),
        transformFromSupabase: (d: any) => ({
          name: d.name,
          code: d.code,
          user_id: d.user_id
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
          updated_at: e.updated_at
        }),
        transformFromSupabase: (d: any) => ({ name: d.name }),
      },
  
      // --- NIVEAU 1 ---
      {
        entity: BranchEntity,
        localRepository: this.appDataSourceInstance.getRepository(BranchEntity),
        supabaseTable: 'branch',
        dependsOn: [GradeEntity],
        relationsToLoad: ['grade'],
        identifyingFields: ['code'],
        transformToSupabase: (e: BranchEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          user_id: e.user_id,
          name: e.name,
          code: e.code,
          grade_id: e.grade?.remote_id,
          updated_at: e.updated_at
        }),
        transformFromSupabase: (d: any) => ({
          name: d.name,
          code: d.code,
          user_id: d.user_id,
          _grade_remote_id: d.grade_id
        }),
      },
      {
        entity: CourseEntity,
        localRepository: this.appDataSourceInstance.getRepository(CourseEntity),
        supabaseTable: 'course',
        dependsOn: [CourseEntity],
        relationsToLoad: ['groupement'],
        identifyingFields: ['code'],
        transformToSupabase: (e: CourseEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          user_id: e.user_id,
          code: e.code,
          name: e.name,
          coefficient: e.coefficient,
          isInGroupement: e.isInGroupement,
          groupement_id: e.groupement?.remote_id,
          updated_at: e.updated_at
        }),
        transformFromSupabase: (d: any) => ({
          code: d.code,
          name: d.name,
          coefficient: d.coefficient,
          user_id: d.user_id,
          isInGroupement: d.isInGroupement,
          _groupement_remote_id: d.groupement_id
        }),
      },
      {
        entity: ProfessorEntity,
        localRepository: this.appDataSourceInstance.getRepository(ProfessorEntity),
        supabaseTable: 'professors',
        dependsOn: [DiplomaEntity, QualificationEntity],
        relationsToLoad: ['diploma', 'qualification'],
        identifyingFields: ['matricule'],
        transformToSupabase: (e: ProfessorEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          user_id: this.resolveUserId(e.user_id),
          firstname: e.firstname,
          lastname: e.lastname,
          matricule: e.matricule,
          diploma_id: e.diploma?.remote_id,
          qualification_id: e.qualification?.remote_id,
          updated_at: e.updated_at
        }),
        transformFromSupabase: (d: any) => ({
          firstname: d.firstname,
          lastname: d.lastname,
          matricule: d.matricule,
          user_id: d.user_id,
          _diploma_remote_id: d.diploma_id,
          _qualification_remote_id: d.qualification_id
        }),
      },
      {
        entity: StudentEntity,
        localRepository: this.appDataSourceInstance.getRepository(StudentEntity),
        supabaseTable: 'T_student',
        dependsOn: [GradeEntity],
        relationsToLoad: ['grade'],
        identifyingFields: ['matricule'],
        transformToSupabase: (e: StudentEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          user_id: e.user_id,
          firstname: e.firstname,
          lastname: e.lastname,
          matricule: e.matricule,
          grade_id: e.grade?.remote_id,
          updated_at: e.updated_at
        }),
        transformFromSupabase: (d: any) => ({
          firstname: d.firstname,
          lastname: d.lastname,
          matricule: d.matricule,
          user_id: d.user_id,
          _grade_remote_id: d.grade_id
        }),
      },
  
      // --- NIVEAU 2 ---
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
          updated_at: e.updated_at
        }),
        transformFromSupabase: (d: any) => ({
          observation: d.observation,
          note: d.note,
          _course_remote_id: d.course_id
        }),
      },
      {
        entity: ClassRoomEntity,
        localRepository: this.appDataSourceInstance.getRepository(ClassRoomEntity),
        supabaseTable: 'class_room',
        dependsOn: [GradeEntity, BranchEntity],
        relationsToLoad: ['grade', 'branch'],
        identifyingFields: ['code'],
        transformToSupabase: (e: ClassRoomEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          user_id: e.user_id,
          name: e.name,
          code: e.code,
          capacity: e.capacity,
          grade_id: e.grade?.remote_id,
          branch_id: e.branch?.remote_id,
          updated_at: e.updated_at
        }),
        transformFromSupabase: (d: any) => ({
          name: d.name,
          code: d.code,
          capacity: d.capacity,
          user_id: d.user_id,
          _grade_remote_id: d.grade_id,
          _branch_remote_id: d.branch_id
        }),
      },
      {
        entity: FileEntity,
        localRepository: this.appDataSourceInstance.getRepository(FileEntity),
        supabaseTable: 'T_file',
        dependsOn: [StudentEntity, ProfessorEntity],
        relationsToLoad: ['student', 'professor'],
        identifyingFields: ['name'],
        transformToSupabase: (e: FileEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          user_id: e.user_id,
          name: e.name,
          path: e.path,
          type: e.type,
          student_id: e.student?.remote_id,
          professor_id: e.professor?.remote_id,
          updated_at: e.updated_at
        }),
        transformFromSupabase: (d: any) => ({
          name: d.name,
          path: d.path,
          type: d.type,
          user_id: d.user_id,
          _student_remote_id: d.student_id,
          _professor_remote_id: d.professor_id
        }),
      },
      {
        entity: TeachingAssignmentEntity,
        localRepository: this.appDataSourceInstance.getRepository(TeachingAssignmentEntity),
        supabaseTable: 'teaching_assignment',
        dependsOn: [ProfessorEntity, CourseEntity],
        relationsToLoad: ['professor', 'course'],
        identifyingFields: [],
        transformToSupabase: (e: TeachingAssignmentEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          user_id: e.user_id,
          professor_id: e.professor?.remote_id,
          course_id: e.course?.remote_id,
          updated_at: e.updated_at
        }),
        transformFromSupabase: (d: any) => ({
          _professor_remote_id: d.professor_id,
          _course_remote_id: d.course_id
        }),
      },
      {
        entity: VacationEntity,
        localRepository: this.appDataSourceInstance.getRepository(VacationEntity),
        supabaseTable: 'vacation',
        dependsOn: [ProfessorEntity],
        relationsToLoad: ['professor'],
        identifyingFields: [],
        transformToSupabase: (e: VacationEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          user_id: e.user_id,
          professor_id: e.professor?.remote_id,
          updated_at: e.updated_at
        }),
        transformFromSupabase: (d: any) => ({
          _professor_remote_id: d.professor_id
        }),
      },
      {
        entity: PaymentEntity,
        localRepository: this.appDataSourceInstance.getRepository(PaymentEntity),
        supabaseTable: 'payments',
        dependsOn: [StudentEntity],
        relationsToLoad: ['student'],
        identifyingFields: [],
        transformToSupabase: (e: PaymentEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          user_id: e.user_id,
          student_id: e.student?.remote_id,
          updated_at: e.updated_at
        }),
        transformFromSupabase: (d: any) => ({
          _student_remote_id: d.student_id
        }),
      },
      {
        entity: ProfessorPaymentEntity,
        localRepository: this.appDataSourceInstance.getRepository(ProfessorPaymentEntity),
        supabaseTable: 'professor_payments',
        dependsOn: [ProfessorEntity],
        relationsToLoad: ['professor'],
        identifyingFields: [],
        transformToSupabase: (e: ProfessorPaymentEntity) => ({
          ...(e.remote_id && { id: e.remote_id }),
          user_id: e.user_id,
          professor_id: e.professor?.remote_id,
          updated_at: e.updated_at
        }),
        transformFromSupabase: (d: any) => ({
          _professor_remote_id: d.professor_id
        }),
      },
    ];
  }
  



  private initializeMockClient(): void {
    // On s'assure de bien réassigner le mock à la propriété de la classe
    this.supabase = { auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as MockSupabaseClient;
    this.supabaseAvailable = false;
    console.log("Cloud Sync: Mock Supabase client activé.");
  }


  private isMockClient(): boolean {
    return !this.supabase || !('rpc' in this.supabase);
  }

  // Cette méthode fonctionnera maintenant correctement
  async getSupabaseAuthUser(): Promise<{ id: string } | null> {
    if (this.isMockClient()) return null;

    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();
      if (error || !user) {
        if (error) console.warn("Erreur getUser:", error.message);
        return null;
      }
      return { id: user.id };
    } catch (error) {
      console.error("Erreur lors de la récupération de l'utilisateur:", error);
      return null;
    }
  }

  // Cette méthode est maintenant plus fiable car elle vérifie la session du client partagé
  async checkSupabaseAvailability(): Promise<boolean> {
    if (this.isMockClient()) {
      this.supabaseAvailable = false;
      return false;
    }
    try {
      const { data: { user }, error } = await this.supabase.auth.getUser();
      if (error) {
        console.error("Erreur de session Supabase:", error.message);
        this.supabaseAvailable = false;
        return false;
      }
      this.supabaseAvailable = !!user;
      return this.supabaseAvailable;
    } catch (error) {
      console.error("Erreur de connectivité Supabase:", error);
      this.supabaseAvailable = false;
      return false;
    }
  }


  async loadSyncConfig(): Promise<SyncConfig> {
    const localConfigPath = path.join(this.syncHistoryDir, 'sync_config.json');
    let config = { ...DEFAULT_SYNC_CONFIG };
    if (fs.existsSync(localConfigPath)) {
      try {
        config = { ...config, ...JSON.parse(fs.readFileSync(localConfigPath, 'utf8')) };
      } catch (e) { console.error("Erreur lecture config locale:", e); }
    }
    // TODO: Charger depuis Supabase si l'utilisateur est connecté et config.useSupabase est true
    return config;
  }

  async updateSyncConfig(newConfig: Partial<SyncConfig>): Promise<void> {
    const currentConfig = await this.loadSyncConfig();
    const updatedConfig = { ...currentConfig, ...newConfig };
    const localConfigPath = path.join(this.syncHistoryDir, 'sync_config.json');
    try {
      fs.writeFileSync(localConfigPath, JSON.stringify(updatedConfig, null, 2));
    } catch (e) { console.error("Erreur sauvegarde config locale:", e); }
    // TODO: Sauvegarder sur Supabase si l'utilisateur est connecté
    this.stopPeriodicSyncTimer(); // Arrêter l'ancien timer
    await this.startPeriodicSyncTimer(); // Redémarrer avec la nouvelle config
  }


  async checkForSyncOpportunity(onlineAuthUserId: string): Promise<void> {
    if (!this.supabaseAvailable || this.isMockClient() || this.isSyncing) return;
    if (this.entitySyncMetas.length === 0) {
      console.warn("Cloud Sync: Aucune entité configurée pour la synchronisation. Vérifiez populateEntitySyncMetas.");
      return;
    }

    this.isSyncing = true; // Verrouiller avant les opérations asynchrones
    console.log("Vérification de la nécessité de synchronisation pour l'utilisateur:", onlineAuthUserId);
    const config = await this.loadSyncConfig();
    const lastSyncTime = await this.getLastSyncTimestamp(onlineAuthUserId);

    const hasLocal = await this.hasLocalChanges(onlineAuthUserId, lastSyncTime);
    const hasRemote = await this.hasRemoteChanges(onlineAuthUserId, lastSyncTime);

    if (!hasLocal && !hasRemote) {
      console.log("Aucun changement local ou distant détecté.");
      await this.createSyncHistoryEvent({ /* ... status: 'skipped' ... */ } as SyncHistory);
      this.isSyncing = false;
      return;
    }
    console.log(`Changements: Local=${hasLocal}, Distant=${hasRemote}`);

    if (config.notifyBeforeSync) {
      const userConfirmed = await this.promptUserForSyncDialog();
      if (!userConfirmed) { console.log("Synchro annulée par l'utilisateur."); this.isSyncing = false; return; }
    }
    await this.performBidirectionalSync(onlineAuthUserId); // isSyncing est remis à false à la fin de cette méthode
  }

  private async promptUserForSyncDialog(): Promise<boolean> {
    console.warn("promptUserForSyncDialog: UI à implémenter via IPC.");
    return true; // Assume confirmation pour test
  }

  private async getLastSyncTimestamp(userId: string): Promise<Date> {
    const localHistory = await this.getLocalSyncHistory(userId);
    const lastSuccess = localHistory
      .filter(h => h.status === 'success' || h.status === 'partial_success')
      .sort((a, b) => new Date(b.sync_ended_at!).getTime() - new Date(a.sync_ended_at!).getTime());

    if (lastSuccess.length > 0 && lastSuccess[0].sync_ended_at) {
      return new Date(lastSuccess[0].sync_ended_at);
    }
    // Si Supabase est dispo, vérifier là aussi, mais le local devrait suffire si bien géré.
    return new Date(0);
  }

  async hasLocalChanges(userId: string, since: Date): Promise<boolean> {
    for (const meta of this.entitySyncMetas) {
      const count = await meta.localRepository.count({
        where: [
          { remote_id: IsNull(), user_id: userId, deleted_at: IsNull() },
          { updated_at: MoreThan(since), user_id: userId, remote_id: Not(IsNull()) }, // Inclut soft-deleted
        ] as FindOptionsWhere<BaseSyncEntity>[],
      });
      if (count > 0) return true;
    }
    return false;
  }

  async hasRemoteChanges(userId: string, since: Date): Promise<boolean> {
    if (!this.supabaseAvailable || this.isMockClient()) return false;
    for (const meta of this.entitySyncMetas) {
      const { error, count } = await (this.supabase as SupabaseClient)
        .from(meta.supabaseTable).select('id', { count: 'exact', head: true })
        .eq('user_id', userId).gt('updated_at', since.toISOString());
      if (error) { console.error(`Erreur vérif remote ${meta.supabaseTable}:`, error); continue; }
      if (count && count > 0) return true;
    }
    return false;
  }

  async performBidirectionalSync(onlineAuthUserId: string): Promise<SyncHistory> {
    if (!this.supabaseAvailable || this.isMockClient()) {
      const errEvt = {
        id: randomUUID(), user_id: onlineAuthUserId, direction: 'bidirectional',
        status: 'failed', error_message: 'Supabase not available',
        sync_started_at: new Date().toISOString(), sync_ended_at: new Date().toISOString()
      } as SyncHistory;
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
        const localChanges = await meta.localRepository.find({
          where: [
            { remote_id: IsNull(), deleted_at: IsNull() },
            { updated_at: MoreThan(lastSyncTime), remote_id: Not(IsNull()) },
          ],
          relations: meta.relationsToLoad || [],
        });
  
        if (localChanges.length === 0) continue;
  
        const toUpsert: any[] = [];
        const toDeleteRemote: string[] = [];
        const recordsToUpdateLocally: BaseSyncEntity[] = [];
  
        for (const lc of localChanges) {
          const userIdForSync = lc.user_id || onlineAuthUserId;
  
          if (userIdForSync !== onlineAuthUserId) continue;
  
          const payload = meta.transformToSupabase(lc);
          payload.user_id = userIdForSync;
          delete payload.created_at;
  
          if (lc.deleted_at && lc.remote_id) {
            toDeleteRemote.push(lc.remote_id);
          } else if (!lc.deleted_at) {
            toUpsert.push(payload);
          }
        }
  
        if (toDeleteRemote.length > 0) {
          const { error } = await (this.supabase as SupabaseClient)
            .from(meta.supabaseTable)
            .delete()
            .in('id', toDeleteRemote)
            .eq('user_id', onlineAuthUserId);
  
          if (error) throw new Error(`[L->C] Erreur suppression ${meta.supabaseTable}: ${error.message}`);
  
          h.records_synced_up! += toDeleteRemote.length;
          await meta.localRepository.update(
            { remote_id: In(toDeleteRemote) } as FindOptionsWhere<BaseSyncEntity>,
            { updated_at: currentSyncStartTime }
          );
        }
  
        if (toUpsert.length > 0) {
          // Construire dynamiquement les champs de sélection
          const selectFields = ['id', 'updated_at', ...(meta.identifyingFields || [])];
          const selectString = selectFields.join(', ');
          
          const { data, error } = await (this.supabase as SupabaseClient)
            .from(meta.supabaseTable)
            .upsert(toUpsert, { onConflict: 'id' })
            .select(selectString);
  
          if (error) throw new Error(`[L->C] Erreur upsert ${meta.supabaseTable}: ${error.message}`);
  
          if (data) {
            for (const remoteResult of data) {
              // Typage explicite pour éviter les erreurs TypeScript
              const result = remoteResult as any & { 
                id: string; 
                updated_at: string; 
                matricule?: string; 
                code?: string; 
                name?: string; 
              };
              
              const localRecord = localChanges.find(l => {
                if (l.remote_id && l.remote_id === result.id) return true;
                if (!l.remote_id) {
                  if (result.matricule && (l as any).matricule === result.matricule) return true;
                  if (result.code && (l as any).code === result.code) return true;
                  if (result.name && (l as any).name === result.name) return true;
                }
                return false;
              });
  
              if (localRecord) {
                localRecord.remote_id = result.id;
                localRecord.updated_at = new Date(result.updated_at);
                localRecord.user_id = onlineAuthUserId;
                recordsToUpdateLocally.push(localRecord);
              } else {
                console.warn(`[L->C] Aucune correspondance locale trouvée pour le résultat Supabase (id: ${result.id})`);
              }
            }
          }
  
          h.records_synced_up! += toUpsert.length;
        }
  
        if (recordsToUpdateLocally.length > 0) {
          const uniqueRecords = [...new Map(recordsToUpdateLocally.map(item => [item.id, item])).values()];
          console.log(`  [L->C] Correction de ${uniqueRecords.length} enregistrements locaux pour la table ${meta.supabaseTable}.`);
          await meta.localRepository.save(uniqueRecords);
        }
  
        h.tables_processed!.push(meta.supabaseTable);
      }
  
      // ================================
      // PHASE 2: Cloud -> Local
      // ================================
      console.log("SYNC PHASE 2: Cloud -> Local");
  
      for (const meta of this.getOrderedMetasForDownload()) {
        const { data: remoteChanges, error: fetchError } = await (this.supabase as SupabaseClient)
          .from(meta.supabaseTable)
          .select('*')
          .eq('user_id', onlineAuthUserId)
          .gt('updated_at', lastSyncTime.toISOString());
  
        if (fetchError) throw new Error(`[C->L] Erreur fetch ${meta.supabaseTable}: ${fetchError.message}`);
        if (!remoteChanges || remoteChanges.length === 0) continue;
  
        console.log(`  [C->L] ${meta.supabaseTable}: ${remoteChanges.length} changements distants.`);
  
        const fkMaps = await this.buildForeignKeyMaps(meta, remoteChanges);
  
        for (const remoteRecord of remoteChanges) {
          const transformed = meta.transformFromSupabase(remoteRecord);
  
          for (const key in fkMaps) {
            const entityName = key.replace('_', '').replace('_remote_id', '');
            const remoteId = (transformed as any)[key];
            delete (transformed as any)[key];
            if (remoteId && fkMaps[key].has(remoteId)) {
              (transformed as any)[entityName] = { id: fkMaps[key].get(remoteId) };
            }
          }
  
          let localRecord = await meta.localRepository.findOne({
            where: { remote_id: remoteRecord.id } as FindOptionsWhere<BaseSyncEntity>
          });
  
          if (localRecord) {
            if (remoteRecord.deleted_at && !localRecord.deleted_at) {
              await meta.localRepository.softDelete({ id: localRecord.id } as any);
            } else if (new Date(remoteRecord.updated_at) > localRecord.updated_at!) {
              Object.assign(localRecord, transformed, { updated_at: new Date(remoteRecord.updated_at) });
              await meta.localRepository.save(localRecord);
            }
          } else if (!remoteRecord.deleted_at) {
            const newLocal = meta.localRepository.create({
              ...transformed,
              remote_id: remoteRecord.id,
              created_at: new Date(remoteRecord.created_at),
              updated_at: new Date(remoteRecord.updated_at),
            } as any);
            await meta.localRepository.save(newLocal);
          }
  
          h.records_synced_down!++;
        }
  
        if (!h.tables_processed!.includes(meta.supabaseTable)) {
          h.tables_processed!.push(meta.supabaseTable);
        }
      }
  
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
      console.log("Synchronisation terminée. Statut:", h.status, "Conflits:", h.conflict_count);
    }
  
    return h;
  }
  
  private async buildForeignKeyMaps(meta: EntitySyncMeta<any>, remoteChanges: any[]): Promise<Record<string, Map<string, number>>> {
    const fkMaps: Record<string, Map<string, number>> = {};
    if (!meta.dependsOn || meta.dependsOn.length === 0) {
      return fkMaps;
    }

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
      const dependencyMeta = this.entitySyncMetas.find(m => m.localRepository.metadata.tableName.includes(entityName));
      if (dependencyMeta) {
        const localEntities = await dependencyMeta.localRepository.find({
          where: { remote_id: In([...remoteIdLookups[lookupKey]]) } as any,
          select: ['id', 'remote_id'] as any,
        });
        fkMaps[lookupKey] = new Map(localEntities.map((e: any) => [e.remote_id, e.id]));
      }
    }
    return fkMaps;
  }


  private getOrderedMetasForDownload(): EntitySyncMeta<any>[] {
    return this.getOrderedMetasForUpload(); // Souvent le même ordre est ok, ou l'inverse si création stricte
  }

  // --- Gestion de l'historique des synchronisations ---
  async createSyncHistoryEvent(eventData: SyncHistory): Promise<void> {
    // Sauvegarder dans Supabase table 'sync_history' et/ou localement
    const historyFilePath = path.join(this.syncHistoryDir, `${eventData.user_id}_sync_history.json`);
    let localHistory: SyncHistory[] = [];
    if (fs.existsSync(historyFilePath)) {
      try { localHistory = JSON.parse(fs.readFileSync(historyFilePath, 'utf8')); }
      catch (e) { console.error("Erreur lecture historique local:", e); }
    }
    const existingIdx = localHistory.findIndex(h => h.id === eventData.id);
    if (existingIdx > -1) localHistory[existingIdx] = eventData;
    else localHistory.unshift(eventData); // Ajouter au début
    localHistory = localHistory.slice(0, 50); // Garder les 50 derniers événements
    try {
      fs.writeFileSync(historyFilePath, JSON.stringify(localHistory, null, 2));
    } catch (e) { console.error("Erreur écriture historique local:", e); }

    if (this.supabaseAvailable && !this.isMockClient()) {
      try {
        const { error } = await (this.supabase as SupabaseClient).from('sync_history').upsert(eventData);
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

  // --- Gestion du Timer de Synchro Périodique ---
  async startPeriodicSyncTimer() {
    if (this.syncTimerId) clearInterval(this.syncTimerId);
    const config = await this.loadSyncConfig();
    const user = await this.getSupabaseAuthUser();

    if (config.autoSyncOnConnect && config.syncIntervalMinutes && config.syncIntervalMinutes > 0 && user?.id) {
      console.log(`Cloud Sync: Démarrage du timer de synchro toutes les ${config.syncIntervalMinutes} minutes.`);
      this.syncTimerId = setInterval(async () => {
        const currentUser = await this.getSupabaseAuthUser(); // Vérifier si toujours connecté
        if (currentUser?.id) {
          console.log("Cloud Sync: Exécution de la synchro périodique...");
          await this.checkForSyncOpportunity(currentUser.id);
        } else {
          console.log("Cloud Sync: Utilisateur non connecté, synchro périodique annulée.");
          this.stopPeriodicSyncTimer();
        }
      }, config.syncIntervalMinutes * 60 * 1000);
    }
  }

  stopPeriodicSyncTimer() {
    if (this.syncTimerId) {
      clearInterval(this.syncTimerId);
      this.syncTimerId = null;
      console.log("Cloud Sync: Timer de synchro périodique arrêté.");
    }
  }

  async createBackup(name?: string, schoolInfo?: { id: string; name: string }): Promise<{
    success: boolean;
    data: any;
    error: string | null;
  }> {
    try {
      // Vérifier l'authentification d'abord
      const isAuthenticated = await this.checkSupabaseAvailability();
      if (!isAuthenticated) {
        return {
          success: false,
          data: null,
          error: "NOT_AUTHENTICATED"
        };
      }

      const authUser = await this.getSupabaseAuthUser();
      if (!authUser) {
        return {
          success: false,
          data: null,
          error: "NO_AUTH_USER"
        };
      }

      // Generate backup name if not provided
      const backupName = name || `Backup_${format(new Date(), 'yyyy-MM-dd_HH-mm-ss')}`;

      // Create backup entry in history
      const backupHistory: SyncHistory = {
        id: uuidv4(),
        sync_started_at: new Date().toISOString(),
        direction: 'local_to_cloud',
        status: 'in_progress',
        user_id: authUser.id,
        tables_processed: [],
        records_synced_up: 0,
        conflict_count: 0
      };

      try {
        // Perform backup logic here
        await this.performBidirectionalSync(authUser.id);

        // Update backup history with success
        backupHistory.sync_ended_at = new Date().toISOString();
        backupHistory.status = 'success';

        return {
          success: true,
          data: backupHistory,
          error: null
        };
      } catch (error) {
        // Update backup history with failure
        backupHistory.sync_ended_at = new Date().toISOString();
        backupHistory.status = 'failed';
        backupHistory.error_message = error instanceof Error ? error.message : 'Unknown error';

        return {
          success: false,
          data: null,
          error: backupHistory.error_message
        };
      }
    } catch (error) {
      console.error('Error creating backup:', error);
      return {
        success: false,
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  async deleteBackup(id: string): Promise<boolean> {
    try {
      const authUser = await this.getSupabaseAuthUser();
      if (!authUser) {
        throw new Error('Utilisateur non authentifié');
      }

      let deleted = false;

      // Essayer de supprimer localement
      const backupRepository = AppDataSource.getInstance().getRepository(BackupEntity);
      const backup = await backupRepository.findOne({
        where: {
          id,
          user_id: authUser.id
        }
      });

      if (backup) {
        await backupRepository.remove(backup);
        deleted = true;
      }

      // Essayer de supprimer dans Supabase même si non trouvé localement
      if (this.supabase) {
        try {
          await this.supabase.rpc('delete_backup', { backup_id: id });
          deleted = true;
        } catch (error) {
          console.error('Erreur lors de la suppression Supabase:', error);
        }
      }

      if (!deleted) {
        throw new Error('Sauvegarde non trouvée ou impossible à supprimer');
      }

      return true;
    } catch (error) {
      console.error('Erreur lors de la suppression de la sauvegarde:', error);
      throw error;
    }
  }

  async getBackups(): Promise<any[]> {
    try {
      const authUser = await this.getSupabaseAuthUser();
      if (!authUser) {
        console.log('Utilisateur non authentifié');
        return [];
      }

      // Récupérer les sauvegardes locales
      const backupRepository = AppDataSource.getInstance().getRepository(BackupEntity);
      const localBackups = await backupRepository.find({
        where: { user_id: authUser.id },
        order: { created_at: 'DESC' }
      });

      // Récupérer les sauvegardes Supabase
      let supabaseBackups: any[] = [];
      if (this.supabase && this.supabaseAvailable) {
        try {
          const { data, error } = await this.supabase
            .from('backups')
            .select('*')
            .eq('user_id', authUser.id)
            .order('created_at', { ascending: false });

          if (error) {
            console.error('Erreur Supabase:', error);
          } else {
            supabaseBackups = data || [];
          }
        } catch (error) {
          console.error('Erreur lors de la récupération des sauvegardes Supabase:', error);
        }
      }

      // Fusionner les sauvegardes locales et Supabase
      const allBackups = [...localBackups];

      // Ajouter les sauvegardes Supabase qui n'existent pas localement
      for (const supabackup of supabaseBackups) {
        if (!allBackups.some(b => b.id === supabackup.id)) {
          allBackups.push({
            ...supabackup,
            source: 'cloud'
          });
        }
      }

      // Trier par date de création
      return allBackups.sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA;
      });

    } catch (error) {
      console.error('Erreur lors de la récupération des sauvegardes:', error);
      return [];
    }
  }

  private getOrderedMetasForUpload(): EntitySyncMeta<any>[] {
    const sorted: EntitySyncMeta<any>[] = [];
    const metas = new Set(this.entitySyncMetas);

    while (metas.size > 0) {
      let hasChanged = false;
      metas.forEach(meta => {
        const dependencies = meta.dependsOn || [];
        const allDependenciesMet = dependencies.every(dep => sorted.some(s => s.entity === dep));
        if (allDependenciesMet) {
          sorted.push(meta);
          metas.delete(meta);
          hasChanged = true;
        }
      });
      if (!hasChanged) {
        console.error("Dépendance circulaire ou manquante détectée dans entitySyncMetas!", [...metas].map(m => m.supabaseTable));
        break;
      }
    }
    return sorted;
  }

  /**
   * Récupère l'ID utilisateur courant depuis la session
   * Utilisé comme fallback quand user_id local est null
   */
  private getCurrentSessionUserId(): string | null {
    return getCurrentSupabaseUserId();
  }

  /**
   * Résout le user_id en priorité depuis l'entité, sinon depuis la session
   */
  private resolveUserId(entityUserId?: string | null): string {
    const userId = entityUserId || this.getCurrentSessionUserId();
    if (!userId) {
      throw new Error("Impossible de déterminer l'ID utilisateur - session invalide");
    }
    return userId;
  }
}