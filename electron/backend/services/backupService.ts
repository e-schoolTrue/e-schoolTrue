import { AppDataSource } from '../../data-source';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/supabase-js';
import type { StorageError } from '@supabase/storage-js';
import { supabaseConfig } from '../../config/supabase';
import type { Database as SupabaseDatabase } from '../../types/supabase';
import { randomUUID } from 'crypto';

// Types
export interface BackupConfig {
  autoBackup: boolean;
  frequency: 'daily' | 'weekly' | 'monthly';
  backupTime: string;
  maxBackups: number;
  includeFiles: boolean;
  useSupabase: boolean;
  notifyBeforeBackup: boolean;
  retentionDays: number;
}

export interface BackupHistory {
  id: string;
  name: string;
  created_at: string;
  size: number;
  type: 'local' | 'cloud';
  status: 'success' | 'error' | 'pending';
  user_id: string;
  school_id?: string;
  school_name?: string;
  backup_status: 'pending' | 'in_progress' | 'completed' | 'failed';
  metadata?: {
    tables?: string[];
    fileCount?: number;
    version?: string;
    publicURL?: string;
    description?: string;
    school_info?: {
      id: string;
      name: string;
    };
  };
}

// Default backup configuration
const DEFAULT_CONFIG: BackupConfig = {
  autoBackup: true,
  frequency: 'daily',
  backupTime: '02:00',
  maxBackups: 5,
  includeFiles: true,
  useSupabase: false,
  notifyBeforeBackup: true,
  retentionDays: 30
};

// Define a more complete type for the mock Supabase client
type MockSupabaseStorageFrom = {
  upload: (path: string, body: any, options?: any) => Promise<{ data: { path: string } | null; error: StorageError | Error | null }>;
  download: (path: string) => Promise<{ data: Blob | null; error: StorageError | Error | null }>;
  remove: (paths: string[]) => Promise<{ data: any[] | null; error: StorageError | Error | null }>;
  getPublicUrl: (path: string) => { data: { publicUrl: string }; error: null };
  setPublic: (isPublic: boolean) => Promise<{ data: any; error: StorageError | Error | null }>;
  list: (path?: string, options?: any) => Promise<{ data: any[] | null; error: StorageError | Error | null }>;
};

type MockSupabaseClient = {
  storage: {
    from: (bucketId: string) => MockSupabaseStorageFrom;
    listBuckets: () => Promise<{ data: any[] | null; error: StorageError | Error | null }>;
    createBucket: (bucketId: string, options?: any) => Promise<{ data: { name: string } | null; error: StorageError | Error | null }>;
  };
  from: (table: string) => {
    select: (columns?: string) => any; // Simplified for brevity, make more specific if needed
    insert: (rows: any, options?: any) => Promise<{ data: any[] | null; error: PostgrestError | Error | null }>;
    delete: (options?: any) => any; // Simplified
    upsert: (rows: any, options?: any) => Promise<{ data: any[] | null; error: PostgrestError | Error | null }>;
  };
  auth: {
    getUser: () => Promise<{ data: { user: { id: string } }; error: null }>;
  };
};


export class BackupService {
  private supabase!: SupabaseClient | MockSupabaseClient;
  private configKey = 'backup_config';
  private backupDir!: string;
  private dbPath!: string;
  private supabaseAvailable = false;

  constructor() {
    try {
      if (!supabaseConfig.url || !supabaseConfig.key) {
        throw new Error('Supabase URL or Key is not defined');
      }
      
      // Initialiser les chemins
      this.backupDir = path.join(app.getPath('userData'), 'backups');
      this.dbPath = path.join(app.getPath('userData'), 'database.db');
      
      // Initialiser avec le client mock par défaut
      this.initializeMockClient();
      
      // Tenter d'établir une vraie connexion immédiatement
      this.checkSupabaseAvailability().then(() => {
        if (this.supabaseAvailable) {
          console.log('Real Supabase client initialized successfully');
          this.initSupabaseBucket();
        } else {
          console.warn('Failed to initialize real Supabase client, using mock');
        }
      }).catch(error => {
        console.error('Error during Supabase initialization:', error);
      this.supabaseAvailable = false;
      });

      // Créer le dossier de sauvegarde s'il n'existe pas
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    try {
        const ds = AppDataSource as any;
      if (ds && ds.options && typeof ds.options.database === 'string') {
        this.dbPath = ds.options.database;
      } else {
        console.warn('AppDataSource.options.database not found or not a string, using default dbPath:', this.dbPath);
      }
    } catch (error) {
      console.error('Error accessing AppDataSource.options, using default dbPath:', this.dbPath, error);
      }
    } catch (error) {
      console.error('Error in BackupService constructor:', error);
      this.supabaseAvailable = false;
    }
  }

  private isMockClient(): boolean {
    return !('auth' in this.supabase);  // Real clients have auth, mock clients don't
  }

  private async manageDbConnection(operation: 'close' | 'reopen'): Promise<void> {
    const ds = AppDataSource as any; // Use 'as any' for simplicity with dynamic checks
    try {
      if (operation === 'close') {
        if (ds && ds.isInitialized && typeof ds.destroy === 'function') {
          await ds.destroy();
        }
      } else if (operation === 'reopen') {
        if (ds && !ds.isInitialized && typeof ds.initialize === 'function') {
          await ds.initialize();
        }
      }
    } catch (error) {
      console.warn(`Error during DB connection management (${operation}):`, error);
    }
  }

  private initializeMockClient() {
    const mockError = (op: string) => new Error(`Supabase mock: ${op} not available`);
    const mockStorageFromMethods: MockSupabaseStorageFrom = {
      upload: async () => ({ data: null, error: mockError('upload') }),
      download: async () => ({ data: null, error: mockError('download') }),
      remove: async () => ({ data: null, error: mockError('remove') }),
      getPublicUrl: () => ({ data: { publicUrl: 'mocked-url' }, error: null }),
      setPublic: async () => ({ data: null, error: mockError('setPublic') }),
      list: async () => ({ data: [], error: mockError('list') }),
    };

    this.supabase = {
      storage: {
        from: (_bucketId: string) => mockStorageFromMethods,
        listBuckets: async () => ({ data: [], error: mockError('listBuckets') }),
        createBucket: async (_bucketId: string, _options?: any) => ({ data: null, error: mockError('createBucket') }),
      },
      auth: {
        getUser: async () => ({ 
          data: { 
            user: { 
              id: randomUUID() // Générer un UUID unique à chaque fois
            } 
          }, 
          error: null 
        })
      },
      from: (_table: string) => ({
        select: (_columns?: string) => ({
          order: () => ({
            then: () => Promise.resolve({ data: [], error: null }),
            eq: () => ({ // Added for .eq('key', this.configKey)
              single: () => Promise.resolve({ data: null, error: mockError('select.single') })
            })
          })
        }),
        insert: async (_rows: any, _options?: any) => ({ data: null, error: mockError('insert') }),
        delete: (_options?: any) => ({ // Make delete also return a promise-like structure
          then: () => Promise.resolve({ data: null, error: mockError('delete') })
        }),
        upsert: async (_rows: any, _options?: any) => ({ data: null, error: mockError('upsert') }),
      })
    } as MockSupabaseClient;

    this.supabaseAvailable = false;
    console.log('Mock Supabase client initialized');
  }

  async createBackup(name?: string, schoolInfo?: { id: string; name: string }): Promise<{ success: boolean; data?: BackupHistory; error?: string }> {
    try {
      // Vérifier que les informations de l'école sont fournies
      if (!schoolInfo?.id || !schoolInfo?.name) {
        // Si Supabase n'est pas disponible, on peut créer une sauvegarde locale sans école
        if (!this.supabaseAvailable || this.isMockClient()) {
          console.warn('Création d\'une sauvegarde locale sans informations d\'école');
          schoolInfo = {
            id: '00000000-0000-0000-0000-000000000000',
            name: 'École locale'
          };
        } else {
          return { 
            success: false, 
            error: 'Les informations de l\'école sont requises (id et name)' 
          };
        }
      }

      // Générer un ID unique basé sur le timestamp et un UUID
      const uniqueId = `backup_${Date.now()}_${crypto.randomUUID()}`;
      const backupName = name || `Sauvegarde du ${new Date().toLocaleDateString('fr-FR')}`;
      const backupPath = path.join(this.backupDir, `${uniqueId}.sqlite`);

      if (!fs.existsSync(this.dbPath)) {
        console.warn(`Database file not found at ${this.dbPath}, creating an empty backup file.`);
        fs.writeFileSync(backupPath, '');
      } else {
        await this.manageDbConnection('close');
        fs.copyFileSync(this.dbPath, backupPath);
        await this.manageDbConnection('reopen');
      }

      const stats = fs.statSync(backupPath);
      const fileSize = stats.size;

      // Récupérer l'ID de l'utilisateur actuel depuis Supabase
      let userId: string;
      try {
        const { data: { user } } = await this.supabase.auth.getUser();
        userId = user?.id || randomUUID();
      } catch (error) {
        console.warn('Failed to get user ID, generating new UUID:', error);
        userId = randomUUID();
      }

      const backupRecord: BackupHistory = {
        id: uniqueId,
        name: backupName,
        created_at: new Date().toISOString(),
        size: fileSize,
        type: 'local',
        status: 'success',
        user_id: userId,
        school_id: schoolInfo.id,
        school_name: schoolInfo.name,
        backup_status: 'pending',
        metadata: { 
          version: '1.0',
          description: `Sauvegarde créée le ${new Date().toLocaleString('fr-FR')}`,
          school_info: {
            id: schoolInfo.id,
            name: schoolInfo.name
          }
        }
      };

      // Si Supabase n'est pas disponible, on sauvegarde uniquement en local
      if (!this.supabaseAvailable || this.isMockClient()) {
        await this.saveBackupHistory(backupRecord);
        return { success: true, data: backupRecord };
      }

      const configResult = await this.getConfig();
      if (configResult.data?.useSupabase && this.supabaseAvailable) {
        try {
          // Mettre à jour le statut
          backupRecord.backup_status = 'in_progress';
          
          const fileBuffer = fs.readFileSync(backupPath);
          console.log(`Uploading backup to bucket '${supabaseConfig.bucket}'...`);

          const { data: uploadData, error: uploadError } = await this.supabase.storage
            .from(supabaseConfig.bucket)
            .upload(`${uniqueId}.sqlite`, fileBuffer, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.warn(`Error uploading to Supabase: ${uploadError.message}`, uploadError);
            backupRecord.backup_status = 'failed';
          } else if (uploadData) {
            console.log('Backup uploaded successfully to Supabase path:', uploadData.path);
            backupRecord.type = 'cloud';
            backupRecord.backup_status = 'completed';

            // Insérer la nouvelle sauvegarde dans la table backups
            const { error: dbError } = await (this.supabase as SupabaseClient)
              .from('backups')
              .insert(backupRecord);

            if (dbError) {
              console.warn('Error creating backup record in database:', dbError.message);
              backupRecord.backup_status = 'failed';
            } else {
              console.log('Backup record created in database successfully.');
            }

            const { data: publicURLData } = this.supabase.storage
                .from(supabaseConfig.bucket)
              .getPublicUrl(`${uniqueId}.sqlite`);
              
              if (publicURLData && publicURLData.publicUrl) {
                console.log('Public URL:', publicURLData.publicUrl);
                backupRecord.metadata = {
                  ...backupRecord.metadata,
                  publicURL: publicURLData.publicUrl
                };
            }
          }
        } catch (error) {
          console.warn('Error during Supabase upload process:', error);
          backupRecord.type = 'local';
          backupRecord.backup_status = 'failed';
        }
      }

      await this.saveBackupHistory(backupRecord);
      await this.cleanupOldBackups();
      return { success: true, data: backupRecord };

    } catch (error) {
      console.error('Error creating backup:', error);
      await this.manageDbConnection('reopen');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error creating backup'
      };
    }
  }

  async restoreBackup(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const historyResult = await this.getBackupHistory();
      const backup = historyResult.data?.find(b => b.id === id);

      if (!backup) throw new Error('Backup not found');

      let backupPath = '';
      if (backup.type === 'cloud' && this.supabaseAvailable) {
          const { data: downloadData, error: downloadError } = await this.supabase.storage
            .from(supabaseConfig.bucket)
            .download(`${id}.sqlite`);

          if (downloadError) throw new Error(`Error downloading from Supabase: ${downloadError.message}`);
          if (!downloadData) throw new Error('No data downloaded from Supabase');
          
          backupPath = path.join(this.backupDir, `${id}.sqlite`);
          fs.writeFileSync(backupPath, Buffer.from(await downloadData.arrayBuffer()));
      } else {
        backupPath = path.join(this.backupDir, `${id}.sqlite`);
        if (!fs.existsSync(backupPath)) {
          throw new Error('Local backup file not found, and cloud download not possible/attempted.');
        }
      }
      
      await this.manageDbConnection('close');
      if (fs.existsSync(this.dbPath)) {
        const currentBackupName = `pre_restore_${new Date().toISOString().replace(/[:.]/g, '-')}`;
        const currentBackupPath = path.join(this.backupDir, `${currentBackupName}.sqlite`);
        fs.copyFileSync(this.dbPath, currentBackupPath);
      }
      fs.copyFileSync(backupPath, this.dbPath);
      await this.manageDbConnection('reopen');
      
      return { success: true };
    } catch (error) {
      console.error('Error restoring backup:', error);
      await this.manageDbConnection('reopen');
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during restoration'
      };
    }
  }

  async deleteBackup(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      const historyResult = await this.getBackupHistory();
      let backups = historyResult.data || [];
      const backupIndex = backups.findIndex(b => b.id === id);

      if (backupIndex === -1) throw new Error('Backup not found in history');
      
      const backupToDelete = backups[backupIndex];

      const localPath = path.join(this.backupDir, `${id}.sqlite`);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        console.log(`Local backup file ${localPath} deleted.`);
      }

      if (backupToDelete.type === 'cloud' && this.supabaseAvailable) {
        const { error: removeError } = await this.supabase.storage
          .from(supabaseConfig.bucket)
          .remove([`${id}.sqlite`, `metadata/${id}.json`]); // Also remove metadata file
        if (removeError) {
          console.warn(`Error deleting from Supabase: ${removeError.message}`);
          // Don't throw, proceed to update local history
        } else {
          console.log(`Cloud backup ${id}.sqlite and its metadata deleted.`);
          await this.updateBackupIndexAfterDelete(id);
        }
      }
      
      backups = backups.filter(b => b.id !== id);
      await this.saveLocalBackupHistory(backups);
      
      return { success: true };
    } catch (error) {
      console.error('Error deleting backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error deleting backup'
      };
    }
  }

  async downloadBackup(id: string): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      const historyResult = await this.getBackupHistory();
      const backup = historyResult.data?.find(b => b.id === id);

      if (!backup) throw new Error('Backup not found');

      const localPath = path.join(this.backupDir, `${id}.sqlite`);
      if (backup.type === 'local' && fs.existsSync(localPath)) {
        return { success: true, path: localPath };
      }

      if (backup.type === 'cloud' && this.supabaseAvailable) {
          const { data: downloadData, error: downloadError } = await this.supabase.storage
            .from(supabaseConfig.bucket)
            .download(`${id}.sqlite`);
          
          if (downloadError) throw new Error(`Error downloading from Supabase: ${downloadError.message}`);
          if (!downloadData) throw new Error('No data downloaded from Supabase');

          fs.writeFileSync(localPath, Buffer.from(await downloadData.arrayBuffer()));
          return { success: true, path: localPath };
      }
      throw new Error('Backup file not found or cloud download not possible.');
    } catch (error) {
      console.error('Error downloading backup:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error downloading backup'
      };
    }
  }

  async getBackupHistory(): Promise<{ success: boolean; data?: BackupHistory[]; error?: string }> {
    try {
      let backups: BackupHistory[] = [];
      const historyPath = path.join(this.backupDir, 'history.json');
      
      // Lire l'historique local
      if (fs.existsSync(historyPath)) {
        try {
          const historyData = fs.readFileSync(historyPath, 'utf8');
          backups = JSON.parse(historyData);
        } catch (e) {
          console.error('Error parsing local history.json:', e);
        }
      }

      // Si Supabase est disponible, récupérer l'historique depuis la table backups
      if (this.supabaseAvailable && !this.isMockClient()) {
        try {
          const { data: dbBackups, error: dbError } = await (this.supabase as SupabaseClient)
            .from('backups')
            .select('*')
            .order('created_at', { ascending: false });

          if (dbError) {
            console.warn('Error fetching backups from database:', dbError.message);
          } else if (dbBackups) {
            console.log(`Retrieved ${dbBackups.length} backups from database`);
            
            // Fusionner avec les sauvegardes locales, en donnant la priorité aux enregistrements de la base de données
            const mergedBackups: { [id: string]: BackupHistory } = {};
            backups.forEach(b => mergedBackups[b.id] = b);
            dbBackups.forEach(b => mergedBackups[b.id] = b as BackupHistory);
            backups = Object.values(mergedBackups);
          }
        } catch (e) {
          console.warn('Error fetching backups from database:', e);
        }
      }

      backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return { success: true, data: backups };

    } catch (error) {
      console.error('Error getting backup history:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error fetching history',
        data: []
      };
    }
  }

  async updateConfig(newConfig: BackupConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // First check Supabase availability
      if (newConfig.useSupabase && this.supabaseAvailable && supabaseConfig.url) {
        const isConnected = await this.isSupabaseReachable(supabaseConfig.url);
        if (!isConnected) {
          this.supabaseAvailable = false;
          console.log('Supabase inaccessible, config saved locally only.');
        } else if (!this.isMockClient()) {
          const { error: upsertError } = await (this.supabase as SupabaseClient)
            .from('settings')
            .upsert({ key: this.configKey, value: newConfig }, { onConflict: 'key' });
          if (upsertError) console.warn(`Error updating config in Supabase: ${upsertError.message}`);
        }
      } else if (newConfig.useSupabase && !this.supabaseAvailable) {
        console.log('Supabase configured but inaccessible, config saved locally only.');
      }

      const configPath = path.join(this.backupDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2));
      return { success: true };

    } catch (error) {
      console.error('Error updating config:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error updating config'
      };
    }
  }

  private async isSupabaseReachable(url: string): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // Augmenté à 5 secondes
      
      try {
        // Utiliser l'API REST de Supabase pour vérifier la connexion
        const response = await fetch(`${url}/rest/v1/`, { 
          method: 'GET',
          headers: {
            'apikey': supabaseConfig.key,
            'Authorization': `Bearer ${supabaseConfig.key}`
          },
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          console.warn(`Supabase API responded with status: ${response.status}`);
          return false;
        }
        
        return true;
      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
          console.log('Supabase connection check timed out');
          } else {
            console.warn('Error checking Supabase connection:', error.message);
          }
        }
        return false;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (error) {
      console.error('Unexpected error checking Supabase connection:', error);
      return false;
    }
  }

  async checkSupabaseAvailability() {
    if (!supabaseConfig.url || !supabaseConfig.key) {
      this.supabaseAvailable = false;
      console.warn('Supabase URL or key not configured.');
      return false;
    }

    try {
      console.log('Checking Supabase availability...');
      
      // Créer directement le client Supabase
      const testClient = createClient<SupabaseDatabase>(supabaseConfig.url, supabaseConfig.key, supabaseConfig.options);

      // Tester la connexion en essayant d'accéder à la table backups
      const { error } = await testClient
        .from('backups')
        .select('count')
        .limit(1);
      
      if (error) {
        if (error.code === '42P01') { // Table does not exist
          console.log('Table "backups" does not exist, this is expected.');
          this.supabaseAvailable = true;
          this.supabase = testClient as unknown as SupabaseClient | MockSupabaseClient;
          return true;
        } else {
          console.warn('Error checking Supabase connection:', error.message);
          this.supabaseAvailable = false;
          return false;
        }
      }

      console.log('Supabase connection test successful');
      this.supabaseAvailable = true;
      this.supabase = testClient as unknown as SupabaseClient | MockSupabaseClient;
      return true;

    } catch (error) {
      console.error('Error during Supabase availability check:', error);
      this.supabaseAvailable = false;
    }

    if (!this.supabaseAvailable) {
      console.warn('Supabase is inaccessible, offline mode activated for Supabase features.');
    }
    return this.supabaseAvailable;
  }

  private async initSupabaseBucket() {
    try {
      if (!this.supabaseAvailable || !supabaseConfig.url) { // Added URL check
        console.warn('Supabase inaccessible or URL not configured, bucket initialization cancelled.');
        return;
      }

      console.log('Checking Supabase buckets...');
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();

      if (listError) {
        console.warn('Error listing Supabase buckets:', listError.message);
        this.supabaseAvailable = false; return;
      }

      const bucketList = buckets || [];
      console.log('Available buckets:', bucketList.map((b: {name: string}) => b.name).join(', ') || 'none');
      const bucketExists = bucketList.some((bucket: {name: string}) => bucket.name === supabaseConfig.bucket);

      if (!bucketExists) {
        console.log(`Creating bucket '${supabaseConfig.bucket}' in Supabase...`);
        const { error: createError } = await this.supabase.storage.createBucket(supabaseConfig.bucket, {
          public: true,
          fileSizeLimit: 52428800 // 50MB
        });
        if (createError) {
          console.warn(`Error creating bucket '${supabaseConfig.bucket}':`, createError.message);
          this.supabaseAvailable = false;
        } else {
          console.log(`Bucket '${supabaseConfig.bucket}' created successfully.`);
          // Try setting public, but don't fail if it doesn't work (might be mock)
          if (typeof (this.supabase.storage.from(supabaseConfig.bucket) as any).setPublic === 'function') {
             await (this.supabase.storage.from(supabaseConfig.bucket) as any).setPublic(true);
          }
        }
      } else {
        console.log(`Bucket '${supabaseConfig.bucket}' already exists.`);
      }

      // Check metadata folder
      const { data: metadataFiles, error: metadataError } = await this.supabase.storage
        .from(supabaseConfig.bucket)
        .list('metadata');
      if (metadataError) {
        console.warn('Error listing metadata folder:', metadataError.message);
      } else if (!metadataFiles || metadataFiles.length === 0) {
        console.log('Metadata folder is empty or does not exist, will be created on first backup.');
      } else {
        console.log('Metadata folder exists.');
        if (metadataFiles.some((file: {name: string}) => file.name === 'index.json')) {
          console.log('index.json found in metadata folder.');
        } else {
          console.log('index.json not found, will be created on first backup.');
        }
      }
    } catch (error: any) {
      console.error('Error initializing Supabase bucket:', error.message || error);
      this.supabaseAvailable = false;
    }
  }

  async getConfig(): Promise<{ success: boolean; data?: BackupConfig; error?: string }> {
    try {
      if (!this.backupDir) {
        throw new Error('Backup service not properly initialized');
      }

      let config = { ...DEFAULT_CONFIG };
      const configPath = path.join(this.backupDir, 'config.json');
      
      // First try reading from local file
      if (fs.existsSync(configPath)) {
        try {
          const fileContent = fs.readFileSync(configPath, 'utf8');
          config = { ...config, ...JSON.parse(fileContent) };
        } catch (e) {
          console.warn('Error reading local config:', e);
        }
      }
      
      // Then try Supabase if available
      if (config.useSupabase && this.supabaseAvailable && !this.isMockClient()) {
        try {
          const { data: dbConfigData, error: dbConfigError } = await (this.supabase as SupabaseClient)
            .from('settings')
            .select('value')
            .eq('key', this.configKey)
            .maybeSingle(); // Utiliser maybeSingle au lieu de single
            
          if (dbConfigError) {
            console.warn(`Error fetching config from Supabase: ${dbConfigError.message}`);
          } else if (dbConfigData && dbConfigData.value) {
            config = { ...config, ...(dbConfigData.value as Partial<BackupConfig>) };
          }
        } catch (e) {
          console.warn('Error fetching Supabase config:', e);
        }
      } else if (this.isMockClient()) {
        console.log('Using mock Supabase client, skipping remote config fetch');
      }
      
      return { success: true, data: config };
    } catch (error) {
      console.error('Error getting config:', error);
      return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
    }
  }

  private async updateBackupIndexAfterDelete(id: string): Promise<void> {
    if (!this.supabaseAvailable) return;
    try {
      // Supprimer l'enregistrement de la table backups
      const { error: deleteError } = await (this.supabase as SupabaseClient)
        .from('backups')
        .delete()
        .eq('id', id);

      if (deleteError) {
        console.warn('Error deleting backup record:', deleteError.message);
      } else {
        console.log('Backup record deleted successfully from database.');
      }
    } catch (error) {
      console.warn('Error in updateBackupIndexAfterDelete:', error);
    }
  }


  private async saveBackupHistory(backup: BackupHistory): Promise<void> {
    try {
      const historyResult = await this.getBackupHistory(); // This now handles merging
      const backups = historyResult.data || [];
      
      const existingIdx = backups.findIndex(b => b.id === backup.id);
      if (existingIdx >= 0) backups[existingIdx] = backup;
      else backups.push(backup);

      // Sort again after potential addition/update
      backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      await this.saveLocalBackupHistory(backups);
    } catch (error) {
      console.error('Error saving backup history:', error);
    }
  }

  private async saveLocalBackupHistory(backups: BackupHistory[]): Promise<void> {
    try {
      const historyPath = path.join(this.backupDir, 'history.json');
      fs.writeFileSync(historyPath, JSON.stringify(backups, null, 2));
    } catch (error) {
      console.error('Error saving local backup history:', error);
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const configResult = await this.getConfig();
      const maxBackups = configResult.data?.maxBackups || DEFAULT_CONFIG.maxBackups;
      
      const historyResult = await this.getBackupHistory();
      let backups = historyResult.data || [];
      
      if (backups.length <= maxBackups) return;

      // getBackupHistory already sorts, but to be sure for cleanup logic:
      backups.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()); // Oldest first
      const backupsToDelete = backups.slice(0, backups.length - maxBackups);

      for (const backup of backupsToDelete) {
        console.log(`Cleaning up old backup: ${backup.id}`);
        await this.deleteBackup(backup.id); // deleteBackup will handle local and cloud
      }
    } catch (error) {
      console.error('Error cleaning up old backups:', error);
    }
  }

  async testDirectInsert(): Promise<{ success: boolean; data?: any; error?: any }> {
    if (!this.supabaseAvailable || this.isMockClient()) {
      return { success: false, error: 'Supabase not available or mock client in use.' };
    }
    try {
      console.log('Testing direct insert into "backups" table...');
      const testRecord = {
        id: `test-${Date.now()}`, // Unique ID
        name: 'test-backup-direct',
        created_at: new Date().toISOString(),
        size: 1024,
        type: 'cloud' as 'cloud',
        status: 'success' as 'success',
        user_id: '00000000-0000-0000-0000-000000000000',
        metadata: { version: 'test-1.0' }
      };
      
      const { data, error } = await (this.supabase as SupabaseClient) // Cast
        .from('backups') // Assuming you have a 'backups' table
        .insert(testRecord);
        
      if (error) {
        console.error('Direct insert error:', error);
        return { success: false, error };
      }
      console.log('Direct insert successful:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Exception during direct insert test:', error);
      return { success: false, error };
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const configResult = await this.getConfig();
      if (!configResult.success) {
        console.warn('Failed to load config, using default values');
      }
    } catch (error) {
      console.error('Error loading config:', error);
    }
  }

  private async initializeBackupDirectory(): Promise<void> {
    try {
      if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
      }
    } catch (error) {
      console.error('Error initializing backup directory:', error);
      throw error;
    }
  }

  private async scheduleNextBackup(): Promise<void> {
    try {
      const configResult = await this.getConfig();
      if (!configResult.data?.autoBackup) {
        console.log('Auto backup is disabled');
        return;
      }

      // TODO: Implement backup scheduling logic
      console.log('Backup scheduling not yet implemented');
    } catch (error) {
      console.error('Error scheduling next backup:', error);
    }
  }

  private initializePaths() {
    // Initialiser les chemins de base
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    this.dbPath = path.join(app.getPath('userData'), 'database.db');

    // Vérifier et créer le dossier de sauvegarde
    if (!fs.existsSync(this.backupDir)) {
        fs.mkdirSync(this.backupDir, { recursive: true });
    }

    // Vérifier le chemin de la base de données depuis AppDataSource
    try {
        const ds = AppDataSource as any;
        if (ds && ds.options && typeof ds.options.database === 'string') {
            this.dbPath = ds.options.database;
        } else {
            console.warn('AppDataSource.options.database not found or not a string, using default dbPath:', this.dbPath);
        }
    } catch (error) {
        console.error('Error accessing AppDataSource.options, using default dbPath:', this.dbPath, error);
    }
  }

  async initialize() {
    try {
        // Initialiser les chemins en premier
        this.initializePaths();

        // Vérifier la disponibilité de Supabase
        const isAvailable = await this.checkSupabaseAvailability();
        if (!isAvailable) {
            console.warn('Supabase is not available, using mock client');
            this.initializeMockClient();
            return;
        }

        // Si Supabase est disponible, continuer avec l'initialisation normale
        await this.loadConfig();
        await this.initializeBackupDirectory();
        await this.cleanupOldBackups();
        await this.scheduleNextBackup();
    } catch (error) {
        console.error('Error initializing backup service:', error);
        throw error;
    }
  }

  // Méthode pour obtenir les sauvegardes d'une école spécifique
  async getSchoolBackups(schoolId: string): Promise<{ success: boolean; data?: BackupHistory[]; error?: string }> {
    try {
      if (!this.supabaseAvailable || this.isMockClient()) {
        return { success: false, error: 'Supabase not available' };
      }

      const { data: backups, error } = await (this.supabase as SupabaseClient)
        .from('backups')
        .select('*')
        .eq('school_id', schoolId)
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching school backups:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true, data: backups as BackupHistory[] };
    } catch (error) {
      console.error('Error in getSchoolBackups:', error);
      return { success: false, error: 'Unknown error fetching school backups' };
    }
  }

  // Méthode pour vérifier si une école a une sauvegarde en cours
  async isSchoolBackupInProgress(schoolId: string): Promise<{ success: boolean; inProgress: boolean; error?: string }> {
    try {
      if (!this.supabaseAvailable || this.isMockClient()) {
        return { success: false, inProgress: false, error: 'Supabase not available' };
      }

      const { data: backups, error } = await (this.supabase as SupabaseClient)
        .from('backups')
        .select('backup_status')
        .eq('school_id', schoolId)
        .eq('backup_status', 'in_progress')
        .limit(1);

      if (error) {
        console.warn('Error checking school backup status:', error.message);
        return { success: false, inProgress: false, error: error.message };
      }

      return { success: true, inProgress: backups && backups.length > 0 };
    } catch (error) {
      console.error('Error in isSchoolBackupInProgress:', error);
      return { success: false, inProgress: false, error: 'Unknown error checking backup status' };
    }
  }

  // Méthode pour obtenir le statut des sauvegardes de toutes les écoles
  async getAllSchoolsBackupStatus(): Promise<{ success: boolean; data?: { school_id: string; school_name: string; last_backup: string; status: string }[]; error?: string }> {
    try {
      if (!this.supabaseAvailable || this.isMockClient()) {
        return { success: false, error: 'Supabase not available' };
      }

      const { data: backups, error } = await (this.supabase as SupabaseClient)
        .from('backups')
        .select('school_id, school_name, created_at, backup_status')
        .order('created_at', { ascending: false });

      if (error) {
        console.warn('Error fetching all schools backup status:', error.message);
        return { success: false, error: error.message };
      }

      // Grouper par école et prendre la dernière sauvegarde
      const schoolStatus = new Map();
      backups?.forEach(backup => {
        if (!schoolStatus.has(backup.school_id)) {
          schoolStatus.set(backup.school_id, {
            school_id: backup.school_id,
            school_name: backup.school_name,
            last_backup: backup.created_at,
            status: backup.backup_status
          });
        }
      });

      return { 
        success: true, 
        data: Array.from(schoolStatus.values())
      };
    } catch (error) {
      console.error('Error in getAllSchoolsBackupStatus:', error);
      return { success: false, error: 'Unknown error fetching schools backup status' };
    }
  }

  // Méthode pour mettre à jour le statut d'une sauvegarde
  async updateBackupStatus(backupId: string, status: 'pending' | 'in_progress' | 'completed' | 'failed'): Promise<{ success: boolean; error?: string }> {
    try {
      if (!this.supabaseAvailable || this.isMockClient()) {
        return { success: false, error: 'Supabase not available' };
      }

      const { error } = await (this.supabase as SupabaseClient)
        .from('backups')
        .update({ backup_status: status })
        .eq('id', backupId);

      if (error) {
        console.warn('Error updating backup status:', error.message);
        return { success: false, error: error.message };
      }

      return { success: true };
    } catch (error) {
      console.error('Error in updateBackupStatus:', error);
      return { success: false, error: 'Unknown error updating backup status' };
    }
  }
}

export const backupService = new BackupService();
export default backupService;