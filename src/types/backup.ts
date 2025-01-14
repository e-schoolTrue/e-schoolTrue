export type BackupFrequency = 'daily' | 'weekly' | 'monthly';
export type BackupStatus = 'success' | 'error' | 'pending';
export type BackupType = 'local' | 'supabase';

export interface BackupConfig {
  autoBackup: boolean;
  frequency: BackupFrequency;
  maxBackups: number;
  includeFiles: boolean;
  useSupabase: boolean;
  notifyBeforeBackup: boolean;
  backupTime: string;
  retentionDays: number;
}

export interface BackupHistory {
  id: string;
  name: string;
  type: BackupType;
  status: BackupStatus;
  size: number;
  createdAt: string;
  path?: string;
  supabaseUrl?: string;
  error?: string;
  metadata?: {
    databaseVersion?: string;
    totalRecords?: number;
    tables?: string[];
    fileCount?: number;
  };
}

export interface BackupStats {
  lastBackup?: string;
  nextBackup?: string;
  totalBackups: number;
  storageUsed: {
    local: number;
    supabase: number;
    total: number;
  };
  backupSuccess: number;
  backupErrors: number;
}

export interface BackupNotification {
  type: 'warning' | 'error' | 'info' | 'success';
  message: string;
  description?: string;
  timestamp: string;
  read: boolean;
}

export interface BackupValidation {
  isValid: boolean;
  canRestore: boolean;
  errors: string[];
  warnings: string[];
  details: {
    tablesCount: number;
    recordsCount: number;
    fileSize: number;
    integrityCheck: boolean;
  };
}

// Types pour les événements de sauvegarde
export interface BackupEvent {
  type: 'start' | 'progress' | 'complete' | 'error';
  timestamp: string;
  details: {
    progress?: number;
    currentTask?: string;
    error?: string;
  };
}

// Types pour la configuration de Supabase
export interface SupabaseConfig {
  url: string;
  key: string;
  bucket: string;
  maxSize: number;
  enabled: boolean;
}

// Types pour les tâches planifiées
export interface BackupSchedule {
  id: string;
  frequency: BackupFrequency;
  time: string;
  lastRun?: string;
  nextRun: string;
  enabled: boolean;
  config: Partial<BackupConfig>;
}

// Types pour les erreurs spécifiques
export interface BackupError extends Error {
  code: string;
  details?: any;
  recoverable: boolean;
} 