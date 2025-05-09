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
  createdAt: string;
  size: number;
  type: 'local' | 'cloud';
  status: 'success' | 'error' | 'pending';
  metadata?: {
    tables?: string[];
    fileCount?: number;
    version?: string;
  };
}

export interface BackupService {
  createBackup(name?: string): Promise<{ success: boolean; data?: BackupHistory; error?: string }>;
  restoreBackup(id: string): Promise<{ success: boolean; error?: string }>;
  deleteBackup(id: string): Promise<{ success: boolean; error?: string }>;
  downloadBackup(id: string): Promise<{ success: boolean; url?: string; error?: string }>;
  getBackupHistory(): Promise<{ success: boolean; data?: BackupHistory[]; error?: string }>;
  updateConfig(config: BackupConfig): Promise<{ success: boolean; error?: string }>;
  getConfig(): Promise<{ success: boolean; data?: BackupConfig; error?: string }>;
}

export interface SupabaseBackupConfig {
  url: string;
  key: string;
  bucket: string;
}
