import { createClient } from '@supabase/supabase-js';
import type { BackupConfig, BackupHistory, BackupService } from '@/types/backup';

// Supabase configuration
const SUPABASE_URL = 'https://xebukndcynlvjpguwrcb.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhlYnVrbmRjeW5sdmpwZ3V3cmNiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDY3NDQ5ODcsImV4cCI6MjA2MjMyMDk4N30.N6avpTRmQ-OPAoLuWviaKJVMJ7Eq-Q7j5sjDY04tEVE';
const BACKUP_BUCKET = 'backups';

// Default backup configuration
const DEFAULT_CONFIG: BackupConfig = {
  autoBackup: true,
  frequency: 'daily',
  backupTime: '02:00',
  maxBackups: 5,
  includeFiles: true,
  useSupabase: true,
  notifyBeforeBackup: true,
  retentionDays: 30
};

class SupabaseBackupService implements BackupService {
  private supabase;
  private configKey = 'backup_config';

  constructor() {
    this.supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  }

  /**
   * Create a new backup
   */
  async createBackup(name?: string): Promise<{ success: boolean; data?: BackupHistory; error?: string }> {
    try {
      // Generate backup name if not provided
      const backupName = name || `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
      
      // Get database data (this is a simplified example - in a real app,
      // you would export actual database data)
      const tables = ['students', 'professors', 'grades', 'courses'];
      const backupData = {};
      
      for (const table of tables) {
        const { data, error } = await this.supabase
          .from(table)
          .select('*');
          
        if (error) throw new Error(`Error fetching ${table}: ${error.message}`);
        backupData[table] = data;
      }
      
      // Create a JSON string of the data
      const backupContent = JSON.stringify(backupData);
      const backupBlob = new Blob([backupContent], { type: 'application/json' });
      
      // Upload to Supabase Storage
      const { data, error } = await this.supabase.storage
        .from(BACKUP_BUCKET)
        .upload(`${backupName}.json`, backupBlob);
        
      if (error) throw new Error(`Error uploading backup: ${error.message}`);
      
      // Create a record in the backups table
      const backupRecord: BackupHistory = {
        id: data?.path || backupName,
        name: backupName,
        createdAt: new Date().toISOString(),
        size: backupBlob.size,
        type: 'cloud',
        status: 'success',
        metadata: {
          tables,
          fileCount: tables.length,
          version: '1.0'
        }
      };
      
      const { error: insertError } = await this.supabase
        .from('backups')
        .insert(backupRecord);
        
      if (insertError) throw new Error(`Error recording backup: ${insertError.message}`);
      
      return { success: true, data: backupRecord };
    } catch (error) {
      console.error('Backup creation failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error during backup creation'
      };
    }
  }

  /**
   * Restore data from a backup
   */
  async restoreBackup(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the backup record
      const { data: backupRecord, error: recordError } = await this.supabase
        .from('backups')
        .select('*')
        .eq('id', id)
        .single();
        
      if (recordError) throw new Error(`Error finding backup: ${recordError.message}`);
      if (!backupRecord) throw new Error('Backup not found');
      
      // Download the backup file
      const { data, error } = await this.supabase.storage
        .from(BACKUP_BUCKET)
        .download(backupRecord.id);
        
      if (error) throw new Error(`Error downloading backup: ${error.message}`);
      
      // Parse the backup data
      const backupContent = await data.text();
      const backupData = JSON.parse(backupContent);
      
      // Restore data to each table
      for (const [table, records] of Object.entries(backupData)) {
        // First delete existing data
        await this.supabase.from(table).delete().neq('id', 0);
        
        // Then insert the backup data if there are records
        if (Array.isArray(records) && records.length > 0) {
          const { error: insertError } = await this.supabase
            .from(table)
            .insert(records);
            
          if (insertError) throw new Error(`Error restoring ${table}: ${insertError.message}`);
        }
      }
      
      return { success: true };
    } catch (error) {
      console.error('Backup restoration failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error during backup restoration'
      };
    }
  }

  /**
   * Delete a backup
   */
  async deleteBackup(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Delete from storage
      const { error: storageError } = await this.supabase.storage
        .from(BACKUP_BUCKET)
        .remove([id]);
        
      if (storageError) throw new Error(`Error deleting backup file: ${storageError.message}`);
      
      // Delete the record
      const { error: recordError } = await this.supabase
        .from('backups')
        .delete()
        .eq('id', id);
        
      if (recordError) throw new Error(`Error deleting backup record: ${recordError.message}`);
      
      return { success: true };
    } catch (error) {
      console.error('Backup deletion failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error during backup deletion'
      };
    }
  }

  /**
   * Download a backup
   */
  async downloadBackup(id: string): Promise<{ success: boolean; url?: string; error?: string }> {
    try {
      // Get a signed URL for the backup
      const { data, error } = await this.supabase.storage
        .from(BACKUP_BUCKET)
        .createSignedUrl(id, 60 * 60); // 1 hour expiry
        
      if (error) throw new Error(`Error generating download URL: ${error.message}`);
      if (!data?.signedUrl) throw new Error('Failed to generate download URL');
      
      return { success: true, url: data.signedUrl };
    } catch (error) {
      console.error('Backup download failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error during backup download'
      };
    }
  }

  /**
   * Get backup history
   */
  async getBackupHistory(): Promise<{ success: boolean; data?: BackupHistory[]; error?: string }> {
    try {
      const { data, error } = await this.supabase
        .from('backups')
        .select('*')
        .order('createdAt', { ascending: false });
        
      if (error) throw new Error(`Error fetching backup history: ${error.message}`);
      
      return { success: true, data: data || [] };
    } catch (error) {
      console.error('Fetching backup history failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error fetching backup history',
        data: []
      };
    }
  }

  /**
   * Update backup configuration
   */
  async updateConfig(config: BackupConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // Store in Supabase
      const { error } = await this.supabase
        .from('settings')
        .upsert({ key: this.configKey, value: config }, { onConflict: 'key' });
        
      if (error) throw new Error(`Error updating backup config: ${error.message}`);
      
      // Also store in localStorage for offline access
      localStorage.setItem(this.configKey, JSON.stringify(config));
      
      return { success: true };
    } catch (error) {
      console.error('Updating backup config failed:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error updating backup configuration'
      };
    }
  }

  /**
   * Get backup configuration
   */
  async getConfig(): Promise<{ success: boolean; data?: BackupConfig; error?: string }> {
    try {
      // Try to get from Supabase
      const { data, error } = await this.supabase
        .from('settings')
        .select('value')
        .eq('key', this.configKey)
        .single();
      
      // If found in Supabase, return it
      if (!error && data?.value) {
        return { success: true, data: data.value as BackupConfig };
      }
      
      // If not in Supabase, try localStorage
      const localConfig = localStorage.getItem(this.configKey);
      if (localConfig) {
        return { success: true, data: JSON.parse(localConfig) as BackupConfig };
      }
      
      // If not found anywhere, return default config
      return { success: true, data: DEFAULT_CONFIG };
    } catch (error) {
      console.error('Fetching backup config failed:', error);
      // On error, return default config
      return { 
        success: true, 
        data: DEFAULT_CONFIG
      };
    }
  }
}

export const supabaseBackupService = new SupabaseBackupService();
export default supabaseBackupService;