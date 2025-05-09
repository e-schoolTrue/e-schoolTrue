import { AppDataSource } from '../../data-source';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { PostgrestError } from '@supabase/supabase-js';
import type { StorageError } from '@supabase/storage-js';
import { supabaseConfig } from '../../config/supabase';

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
  metadata?: {
    tables?: string[];
    fileCount?: number;
    version?: string;
    publicURL?: string; // Added for error 14
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
};


export class BackupService {
  private supabase: SupabaseClient | MockSupabaseClient;
  private configKey = 'backup_config';
  private backupDir: string;
  private dbPath: string;
  private supabaseAvailable = false;

  constructor() {
    try {
      if (!supabaseConfig.url || !supabaseConfig.key) {
        throw new Error('Supabase URL or Key is not defined');
      }
      this.supabase = createClient(supabaseConfig.url, supabaseConfig.key, {
        auth: {
          persistSession: false
        },
        db: {
          schema: 'public'
        }
      });
      console.log('Real Supabase client initialized.');
      this.checkSupabaseAvailability().then(() => {
        if (this.supabaseAvailable) {
          this.initSupabaseBucket();
        }
      });
    } catch (error) {
      console.warn('Failed to initialize real Supabase client, using mock:', error instanceof Error ? error.message : String(error));
      // Create a more complete mock client
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
      };
      this.supabaseAvailable = false;
    }

    this.backupDir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    try {
      // Assuming AppDataSource is an instance of TypeORM DataSource
      const ds = AppDataSource as any; // Use 'as any' to bypass strict type checks if types are problematic
      if (ds && ds.options && typeof ds.options.database === 'string') {
        this.dbPath = ds.options.database;
      } else {
        this.dbPath = path.join(app.getPath('userData'), 'database.db');
        console.warn('AppDataSource.options.database not found or not a string, using default dbPath:', this.dbPath);
      }
    } catch (error) {
      this.dbPath = path.join(app.getPath('userData'), 'database.db');
      console.error('Error accessing AppDataSource.options, using default dbPath:', this.dbPath, error);
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

  async createBackup(name?: string): Promise<{ success: boolean; data?: BackupHistory; error?: string }> {
    try {
      const backupName = name || `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const backupPath = path.join(this.backupDir, `${backupName}.sqlite`);

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

      const backupRecord: BackupHistory = {
        id: backupName,
        name: backupName,
        created_at: new Date().toISOString(),
        size: fileSize,
        type: 'local',
        status: 'success',
        user_id: '00000000-0000-0000-0000-000000000000',
        metadata: { version: '1.0' }
      };

      const configResult = await this.getConfig();
      if (configResult.data?.useSupabase && this.supabaseAvailable) {
        try {
          const fileBuffer = fs.readFileSync(backupPath);
          console.log(`Uploading backup to bucket '${supabaseConfig.bucket}'...`);

          const { data: uploadData, error: uploadError } = await this.supabase.storage
            .from(supabaseConfig.bucket)
            .upload(`${backupName}.sqlite`, fileBuffer, {
              cacheControl: '3600',
              upsert: true
            });

          if (uploadError) {
            console.warn(`Error uploading to Supabase: ${uploadError.message}`, uploadError);
          } else if (uploadData) {
            console.log('Backup uploaded successfully to Supabase path:', uploadData.path);
            backupRecord.type = 'cloud';

            console.log('Saving backup metadata to Supabase (JSON file)...');
            const metadataJson = JSON.stringify(backupRecord, null, 2);
            const metadataBuffer = Buffer.from(metadataJson);
            const metadataResult = await this.supabase.storage
              .from(supabaseConfig.bucket)
              .upload(`metadata/${backupRecord.id}.json`, metadataBuffer, {
                cacheControl: '3600',
                upsert: true
              });

            if (metadataResult.error) {
              console.warn(`Error uploading metadata to Supabase: ${metadataResult.error.message}`, metadataResult.error);
            } else {
              console.log('Backup metadata saved successfully to Supabase.');
              await this.updateBackupIndex(backupRecord);

              const { data: publicURLData } = this.supabase.storage // No await needed for getPublicUrl
                .from(supabaseConfig.bucket)
                .getPublicUrl(`${backupName}.sqlite`);
              
              if (publicURLData && publicURLData.publicUrl) {
                console.log('Public URL:', publicURLData.publicUrl);
                backupRecord.metadata = {
                  ...backupRecord.metadata,
                  publicURL: publicURLData.publicUrl
                };
              }
            }
          }
        } catch (error) {
          console.warn('Error during Supabase upload process:', error);
          backupRecord.type = 'local'; // Revert to local if cloud operations fail
        }
      }

      await this.saveBackupHistory(backupRecord);
      await this.cleanupOldBackups();
      return { success: true, data: backupRecord };

    } catch (error) {
      console.error('Error creating backup:', error);
      await this.manageDbConnection('reopen'); // Ensure DB connection is reopened on error
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
      if (fs.existsSync(historyPath)) {
        try {
          const historyData = fs.readFileSync(historyPath, 'utf8');
          backups = JSON.parse(historyData);
        } catch (e) {
          console.error('Error parsing local history.json:', e);
        }
      }

      const configResult = await this.getConfig();
      if (configResult.data?.useSupabase && this.supabaseAvailable) {
        console.log('Fetching backup index from Supabase...');
        try {
          const { data: indexDownloadData, error: indexError } = await this.supabase.storage
            .from(supabaseConfig.bucket)
            .download('metadata/index.json');

          if (indexError) {
            console.warn(`Error fetching index.json from Supabase: ${indexError.message}`);
          } else if (indexDownloadData) {
            const indexText = await indexDownloadData.text();
            const cloudBackups = JSON.parse(indexText) as BackupHistory[];
            console.log(`Supabase index.json retrieved (${cloudBackups.length} entries)`);

            // Merge, giving precedence to cloud entries if IDs match
            const mergedBackups: { [id: string]: BackupHistory } = {};
            backups.forEach(b => mergedBackups[b.id] = b);
            cloudBackups.forEach(b => mergedBackups[b.id] = b);
            backups = Object.values(mergedBackups);
          }
        } catch (e) {
          console.warn('Error processing Supabase index.json:', e);
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
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      
      try {
        const response = await fetch(url, { 
          method: 'HEAD',
          signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response.ok;
      } catch (error) {
        if (error instanceof Error && error.name === 'AbortError') {
          console.log('Supabase connection check timed out');
        }
        return false;
      } finally {
        clearTimeout(timeoutId);
      }
    } catch {
      return false;
    }
  }

  private async checkSupabaseAvailability() {
    if (!supabaseConfig.url) {
      this.supabaseAvailable = false;
      console.warn('Supabase URL not configured.');
      return;
    }
    this.supabaseAvailable = await this.isSupabaseReachable(supabaseConfig.url);
    if (this.supabaseAvailable) {
      console.log('Supabase connection established.');
    } else {
      console.warn('Supabase is inaccessible, offline mode activated for Supabase features.');
    }
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
            .single();
            
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
      return { success: true, data: { ...DEFAULT_CONFIG } }; // Fallback to default
    }
  }

  private async updateBackupIndexAfterDelete(id: string): Promise<void> {
    if (!this.supabaseAvailable) return;
    try {
      let backupIndex: BackupHistory[] = [];
      const { data: indexDownload, error: downloadError } = await this.supabase.storage
        .from(supabaseConfig.bucket)
        .download('metadata/index.json');

      if (!downloadError && indexDownload) {
        backupIndex = JSON.parse(await indexDownload.text());
      } else if(downloadError && (downloadError as any).statusCode !== 404 && (downloadError as any).message !== 'The resource was not found') { // Don't warn for "not found"
        console.warn('Error downloading index for deletion:', downloadError.message);
        return;
      }

      const updatedIndex = backupIndex.filter(b => b.id !== id);
      if (updatedIndex.length === backupIndex.length) {
        console.log(`Backup ${id} not in index, no update needed.`);
        return;
      }

      const indexJson = JSON.stringify(updatedIndex, null, 2);
      const { error: uploadError } = await this.supabase.storage
        .from(supabaseConfig.bucket)
        .upload('metadata/index.json', Buffer.from(indexJson), { upsert: true });
      if (uploadError) console.warn('Error updating index after delete:', uploadError.message);
      else console.log('Backup index updated after deletion.');

    } catch (error) {
      console.warn('Error in updateBackupIndexAfterDelete:', error);
    }
  }

  private async updateBackupIndex(backup: BackupHistory): Promise<void> {
    if (!this.supabaseAvailable) return;
    try {
      let backupIndex: BackupHistory[] = [];
      const { data: indexDownload, error: downloadError } = await this.supabase.storage
        .from(supabaseConfig.bucket)
        .download('metadata/index.json');

      if (!downloadError && indexDownload) {
        backupIndex = JSON.parse(await indexDownload.text());
      } else if(downloadError && (downloadError as any).statusCode !== 404 && (downloadError as any).message !== 'The resource was not found') {
         console.warn('Error downloading index for update:', downloadError.message);
      }
      
      const existingIdx = backupIndex.findIndex(b => b.id === backup.id);
      if (existingIdx >= 0) backupIndex[existingIdx] = backup;
      else backupIndex.push(backup);

      backupIndex.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

      const indexJson = JSON.stringify(backupIndex, null, 2);
      const { error: uploadError } = await this.supabase.storage
        .from(supabaseConfig.bucket)
        .upload('metadata/index.json', Buffer.from(indexJson), { upsert: true });
      if (uploadError) console.warn('Error updating backup index:', uploadError.message);
      else console.log('Backup index updated successfully.');

    } catch (error) {
      console.warn('Error in updateBackupIndex:', error);
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

  
}

export const backupService = new BackupService();
export default backupService;