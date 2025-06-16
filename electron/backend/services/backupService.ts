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
import { supabaseConfig } from '../../config/supabase';
import { randomUUID } from 'crypto';
import { app } from 'electron'; 
import * as fs from 'fs';
import * as path from 'path';
import { format } from 'date-fns';
import { v4 as uuidv4 } from 'uuid';
import { supabase } from '../lib/supabaseClient';
import { ElectronStore } from '../utils/electronStore';

// --- Définitions de types et interfaces ---

export abstract class BaseSyncEntity {
  id!: number;
  remote_id?: string | null;
  user_id!: string; // Doit être l'ID de l'utilisateur Supabase
  created_at!: Date;
  updated_at!: Date;
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
  supabaseTable: string;
  dependsOn?: (new () => BaseSyncEntity)[]; // Pour l'ordre de synchro
  transformToSupabase?: (localEntity: T) => any;
  transformFromSupabase?: (supabaseData: any) => Partial<T>;
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

    // Cette vérification est maintenant une sécurité, mais ne devrait plus être déclenchée
    const dataSourceInstance = AppDataSource.getInstance();
    if (!dataSourceInstance || !dataSourceInstance.isInitialized) {
      // Si cela se produit encore, c'est une erreur de logique fatale
      console.error("CloudSyncService FATAL: AppDataSource n'est pas initialisée au moment de la création du service. L'ordre d'initialisation dans main.ts est incorrect.");
      // On peut toujours activer le mock comme fallback, mais c'est un symptôme d'un problème plus grave.
      this.initializeMockClient(); 
      return;
    }
    
    this.appDataSourceInstance = dataSourceInstance;
    this.syncHistoryDir = path.join(app.getPath('userData'), 'sync_history');
    if (!fs.existsSync(this.syncHistoryDir)) fs.mkdirSync(this.syncHistoryDir, { recursive: true });

    this.populateEntitySyncMetas();
    
    // NETTOYÉ: Logique d'initialisation simplifiée.
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

  // SUPPRIMÉ: Cette méthode n'est plus nécessaire car le client est partagé.
  // private initSupabase() { ... }

  // La méthode populateEntitySyncMetas reste inchangée
  private populateEntitySyncMetas() {
    // ... votre code ici ...
  }

  // La méthode initializeMockClient reste inchangée
  private initializeMockClient(): void {
    // On s'assure de bien réassigner le mock à la propriété de la classe
    this.supabase = { auth: { getUser: async () => ({ data: { user: null }, error: null }) } } as MockSupabaseClient;
    this.supabaseAvailable = false;
    console.log("Cloud Sync: Mock Supabase client activé.");
  }

  // La méthode isMockClient reste inchangée
  private isMockClient(): boolean {
    return !this.supabase || !('rpc' in this.supabase);
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

  // Cette méthode fonctionnera maintenant correctement
  async getSupabaseAuthUser(): Promise<{ id: string } | null> {
    if (!this.supabaseAvailable || this.isMockClient()) return null;
    
    const { data: { user }, error } = await this.supabase.auth.getUser();
    if (error || !user) {
      if (error) console.warn("Erreur getUser:", error.message);
      return null;
    }
    return { id: user.id };
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
      const errEvt = { id: randomUUID(), user_id: onlineAuthUserId, direction: 'bidirectional', status: 'failed', error_message: 'Supabase not available', sync_started_at: new Date().toISOString(), sync_ended_at: new Date().toISOString() } as SyncHistory;
      await this.createSyncHistoryEvent(errEvt);
      return errEvt;
    }
    // isSyncing est déjà true
    const historyId = randomUUID();
    let h: SyncHistory = {
      id: historyId, sync_started_at: new Date().toISOString(), direction: 'bidirectional',
      status: 'in_progress', user_id: onlineAuthUserId, tables_processed: [],
      records_synced_up: 0, records_synced_down: 0, conflict_count: 0,
    };
    await this.createSyncHistoryEvent(h);

    try {
      const lastSyncTime = await this.getLastSyncTimestamp(onlineAuthUserId); // Timestamp *avant* cette synchro
      const currentSyncStartTime = new Date(h.sync_started_at); // Pour ignorer les changements faits *pendant* cette synchro

      // Phase 1: Local -> Cloud
      console.log("SYNC PHASE 1: Local -> Cloud (Utilisateur:", onlineAuthUserId, "Depuis:", lastSyncTime.toISOString() + ")");
      for (const meta of this.getOrderedMetasForUpload()) {
        const localChanges = await meta.localRepository.find({
          where: [
            { remote_id: IsNull(), user_id: onlineAuthUserId, deleted_at: IsNull() }, // Nouveaux (créés par cet utilisateur)
            { updated_at: MoreThan(lastSyncTime), user_id: onlineAuthUserId, remote_id: Not(IsNull()) }, // Modifiés ou soft-deleted
          ] as FindOptionsWhere<BaseSyncEntity>[],
        });

        if (localChanges.length === 0) continue;
        console.log(`  [L->C] ${meta.supabaseTable}: ${localChanges.length} changements locaux.`);
        const toUpsert: any[] = []; const toDeleteRemote: string[] = [];

        localChanges.forEach(lc => {
          const payload = meta.transformToSupabase ? meta.transformToSupabase(lc) : { ...lc };
          delete payload.id; delete payload.created_at; // Laisser Supabase gérer

          if (lc.deleted_at && lc.remote_id) toDeleteRemote.push(lc.remote_id);
          else if (!lc.deleted_at) {
            toUpsert.push({ ...payload, id: lc.remote_id || undefined, user_id: onlineAuthUserId, deleted_at: null });
          }
        });

        if (toDeleteRemote.length > 0) {
          const { error } = await (this.supabase as SupabaseClient).from(meta.supabaseTable).delete().in('id', toDeleteRemote).eq('user_id', onlineAuthUserId);
          if (error) throw new Error(`[L->C] Erreur suppression ${meta.supabaseTable}: ${error.message}`);
          h.records_synced_up! += toDeleteRemote.length;
          // Mettre à jour localement pour marquer comme supprimé et synchronisé
          await meta.localRepository.update({ remote_id: In(toDeleteRemote) } as FindOptionsWhere<BaseSyncEntity>, { updated_at: currentSyncStartTime });
        }
        if (toUpsert.length > 0) {
          const { data, error } = await (this.supabase as SupabaseClient).from(meta.supabaseTable)
            .upsert(toUpsert, { onConflict: 'id' }).select('id, updated_at'); // 'id' est la PK Supabase
          if (error) throw new Error(`[L->C] Erreur upsert ${meta.supabaseTable}: ${error.message}`);
          if (data) {
            for (const sr of data) {
              const lc = localChanges.find(l => l.remote_id === sr.id); // Simplification de la recherche
              if (lc) {
                lc.remote_id = sr.id; lc.updated_at = new Date(sr.updated_at);
                await meta.localRepository.save(lc);
              }
            }
          }
          h.records_synced_up! += toUpsert.length;
        }
        h.tables_processed!.push(meta.supabaseTable);
      }

      // Phase 2: Cloud -> Local
      console.log("SYNC PHASE 2: Cloud -> Local (Utilisateur:", onlineAuthUserId, "Depuis:", lastSyncTime.toISOString() + ")");
      for (const meta of this.getOrderedMetasForDownload()) {
        const { data: remoteChanges, error: fetchError } = await (this.supabase as SupabaseClient)
          .from(meta.supabaseTable).select('*').eq('user_id', onlineAuthUserId)
          .gt('updated_at', lastSyncTime.toISOString()) // Chgmts sur le cloud depuis la dernière synchro
          .lt('updated_at', currentSyncStartTime.toISOString()); // Ignorer les chgmts qu'on vient de pousser

        if (fetchError) throw new Error(`[C->L] Erreur fetch ${meta.supabaseTable}: ${fetchError.message}`);
        if (!remoteChanges || remoteChanges.length === 0) continue;
        console.log(`  [C->L] ${meta.supabaseTable}: ${remoteChanges.length} changements distants.`);

        for (const rr of remoteChanges) {
          const remoteId = rr.id; const remoteUpdatedAt = new Date(rr.updated_at);
          let lr = await meta.localRepository.findOne({ where: { remote_id: remoteId, user_id: onlineAuthUserId } as FindOptionsWhere<BaseSyncEntity> });
          const transformed = meta.transformFromSupabase ? meta.transformFromSupabase(rr) : rr;
          delete transformed.id; // Ne pas utiliser l'ID Supabase comme PK locale `id`

          if (lr) { // Existe localement
            if (rr.deleted_at) {
              if (!lr.deleted_at) { await meta.localRepository.softDelete({ id: lr.id } as FindOptionsWhere<BaseSyncEntity>); h.records_synced_down!++; }
            } else if (lr.deleted_at) { // Conflit: supprimé localement, actif sur cloud -> restaurer local
              lr.deleted_at = null; Object.assign(lr, transformed); lr.updated_at = remoteUpdatedAt;
              await meta.localRepository.save(lr); h.conflict_count!++; h.records_synced_down!++;
            } else if (remoteUpdatedAt > lr.updated_at) { // Cloud plus récent
              Object.assign(lr, transformed); lr.updated_at = remoteUpdatedAt;
              await meta.localRepository.save(lr); h.records_synced_down!++;
            } else if (remoteUpdatedAt < lr.updated_at) { // Local plus récent (conflit, déjà envoyé en phase 1)
              h.conflict_count!++; console.log(`    [C->L] Conflit ignoré pour ${meta.supabaseTable} remote_id ${remoteId}, local plus récent.`);
            }
          } else if (!rr.deleted_at) { // Nouveau du cloud
            const newLocal: Partial<BaseSyncEntity> = {
              ...(meta.transformFromSupabase ? meta.transformFromSupabase(rr) : rr),
              remote_id: remoteId, user_id: onlineAuthUserId,
              updated_at: remoteUpdatedAt, created_at: new Date(rr.created_at)
            };
            delete (newLocal as any).id;
            await meta.localRepository.save(meta.localRepository.create(newLocal as any));
            h.records_synced_down!++;
          }
        }
        if (!h.tables_processed!.includes(meta.supabaseTable)) h.tables_processed!.push(meta.supabaseTable);
      }
      h.status = h.conflict_count! > 0 ? 'partial_success' : 'success';
    } catch (error: any) {
      console.error("Erreur durant performBidirectionalSync:", error);
      h.status = 'failed'; h.error_message = error.message;
    } finally {
      h.sync_ended_at = new Date().toISOString();
      h.tables_processed = [...new Set(h.tables_processed)];
      await this.createSyncHistoryEvent(h);
      this.isSyncing = false;
      console.log("Synchronisation terminée. Statut:", h.status, "Conflits:", h.conflict_count);
    }
    return h;
  }


  private getOrderedMetasForUpload(): EntitySyncMeta<any>[] {
    // Trier pour que les parents soient avant les enfants
    return [...this.entitySyncMetas].sort((a, b) => {
      if (a.dependsOn?.some(dep => dep === b.entity)) return 1; // a dépend de b, b avant
      if (b.dependsOn?.some(dep => dep === a.entity)) return -1; // b dépend de a, a avant
      return 0;
    });
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
}