import { AppDataSource } from '../../data-source';
import { ResultType } from '#electron/command';
import * as fs from 'fs/promises';
import * as path from 'path';
import { app } from 'electron';
import { createClient } from '@supabase/supabase-js';
import { FileService } from './fileService';
import type { 
  BackupConfig, 
  BackupHistory, 
  BackupStats,
  SupabaseConfig 
} from '#electron/types/backup';
import { supabaseConfig } from '../../config/supabase';

export class BackupService {
  private backupDir: string;
  private configPath: string;
  private fileService: FileService;
  private supabase: any | null = null;

  constructor() {
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    this.configPath = path.join(app.getPath('userData'), 'backup-config.json');
    this.fileService = new FileService();
    this.initialize();
    this.supabase = createClient(
      supabaseConfig.url,
      supabaseConfig.key
    );
  }

  private async initialize() {
    try {
      await fs.mkdir(this.backupDir, { recursive: true });
      await this.loadConfig();
    } catch (error) {
      console.error('Erreur lors de l\'initialisation du service de sauvegarde:', error);
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const configExists = await fs.access(this.configPath)
        .then(() => true)
        .catch(() => false);

      if (!configExists) {
        await this.saveConfig(this.getDefaultConfig());
      }
    } catch (error) {
      console.error('Erreur lors du chargement de la configuration:', error);
    }
  }

  private getDefaultConfig(): BackupConfig {
    return {
      autoBackup: true,
      frequency: 'daily',
      maxBackups: 5,
      includeFiles: true,
      useSupabase: false,
      notifyBeforeBackup: true,
      backupTime: '23:00',
      retentionDays: 30,
    };
  }

  private async saveConfig(config: BackupConfig): Promise<void> {
    await fs.writeFile(this.configPath, JSON.stringify(config, null, 2));
  }

  private async initSupabase(config: SupabaseConfig) {
    if (config.enabled && config.url && config.key) {
      this.supabase = createClient(config.url, config.key);
    }
  }

  async createBackup(type: 'local' | 'supabase', config: BackupConfig): Promise<ResultType> {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupName = `backup-${timestamp}`;
      const backupPath = path.join(this.backupDir, backupName);

      // Créer le dossier de sauvegarde
      await fs.mkdir(backupPath, { recursive: true });

      // Sauvegarder la base de données
      const dataSource = AppDataSource.getInstance();
      const dbPath = path.join(app.getPath('userData'), 'database.db');
      const backupDbPath = path.join(backupPath, 'database.db');

      // Copier la base de données
      await fs.copyFile(dbPath, backupDbPath);

      // Sauvegarder les fichiers si nécessaire
      if (config.includeFiles) {
        const filesDir = path.join(app.getPath('userData'), 'files');
        const backupFilesDir = path.join(backupPath, 'files');
        await this.fileService.copyDirectory(filesDir, backupFilesDir);
      }

      // Créer le fichier manifest
      const manifest = {
        timestamp,
        type,
        config,
        databaseVersion: '1.0',
        includesFiles: config.includeFiles,
      };

      await fs.writeFile(
        path.join(backupPath, 'manifest.json'),
        JSON.stringify(manifest, null, 2)
      );

      // Si c'est une sauvegarde Supabase
      if (type === 'supabase' && this.supabase) {
        // Compresser le dossier
        const zipPath = await this.fileService.compressDirectory(backupPath, `${backupName}.zip`);
        
        // Uploader vers Supabase
        const { data, error } = await this.supabase.storage
          .from('backups')
          .upload(`${backupName}.zip`, fs.createReadStream(zipPath));

        if (error) throw error;
      }

      // Nettoyer les anciennes sauvegardes
      await this.cleanOldBackups(config.maxBackups);

      const stats = await this.getBackupStats();

      return {
        success: true,
        data: {
          id: timestamp,
          name: backupName,
          type,
          status: 'success',
          size: await this.getDirectorySize(backupPath),
          createdAt: timestamp,
          path: backupPath,
        },
        message: 'Sauvegarde créée avec succès',
        error: null
      };
    } catch (error) {
      console.error('Erreur lors de la création de la sauvegarde:', error);
      return {
        success: false,
        data: null,
        message: 'Erreur lors de la création de la sauvegarde',
        error: error instanceof Error ? error.message : 'Erreur inconnue'
      };
    }
  }

  private async getDirectorySize(dirPath: string): Promise<number> {
    let size = 0;
    const files = await fs.readdir(dirPath, { withFileTypes: true });

    for (const file of files) {
      const filePath = path.join(dirPath, file.name);
      if (file.isDirectory()) {
        size += await this.getDirectorySize(filePath);
      } else {
        const stat = await fs.stat(filePath);
        size += stat.size;
      }
    }

    return size;
  }

  private async cleanOldBackups(maxBackups: number): Promise<void> {
    try {
      const backups = await this.getBackupHistory();
      if (backups.length > maxBackups) {
        const toDelete = backups
          .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
          .slice(maxBackups);

        for (const backup of toDelete) {
          if (backup.path) {
            await fs.rm(backup.path, { recursive: true, force: true });
          }
        }
      }
    } catch (error) {
      console.error('Erreur lors du nettoyage des anciennes sauvegardes:', error);
    }
  }

  async getBackupHistory(): Promise<BackupHistory[]> {
    try {
      const files = await fs.readdir(this.backupDir);
      const history: BackupHistory[] = [];

      for (const file of files) {
        const backupPath = path.join(this.backupDir, file);
        const manifestPath = path.join(backupPath, 'manifest.json');

        try {
          const manifestContent = await fs.readFile(manifestPath, 'utf-8');
          const manifest = JSON.parse(manifestContent);
          const size = await this.getDirectorySize(backupPath);

          history.push({
            id: manifest.timestamp,
            name: file,
            type: manifest.type,
            status: 'success',
            size,
            createdAt: manifest.timestamp,
            path: backupPath,
          });
        } catch (error) {
          console.error(`Erreur lors de la lecture du manifest pour ${file}:`, error);
        }
      }

      return history;
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique:', error);
      return [];
    }
  }

  async getBackupStats(): Promise<BackupStats> {
    try {
      const history = await this.getBackupHistory();
      const localSize = history
        .filter(b => b.type === 'local')
        .reduce((acc, b) => acc + b.size, 0);
      const supabaseSize = history
        .filter(b => b.type === 'supabase')
        .reduce((acc, b) => acc + b.size, 0);

      return {
        totalBackups: history.length,
        storageUsed: {
          local: localSize,
          supabase: supabaseSize,
          total: localSize + supabaseSize,
        },
        backupSuccess: history.filter(b => b.status === 'success').length,
        backupErrors: history.filter(b => b.status === 'error').length,
      };
    } catch (error) {
      console.error('Erreur lors du calcul des statistiques:', error);
      throw error;
    }
  }

  private async uploadToSupabase(filePath: string, fileName: string): Promise<string> {
    try {
      const fileData = await fs.readFile(filePath);
      const { data, error } = await this.supabase.storage
        .from(supabaseConfig.bucket)
        .upload(fileName, fileData, {
          cacheControl: '3600',
          upsert: false
        });

      if (error) throw error;
      
      // Obtenir l'URL publique
      const { data: { publicUrl } } = this.supabase.storage
        .from(supabaseConfig.bucket)
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Erreur lors de l\'upload vers Supabase:', error);
      throw error;
    }
  }

  private async downloadFromSupabase(fileName: string, destinationPath: string): Promise<void> {
    try {
      const { data, error } = await this.supabase.storage
        .from(supabaseConfig.bucket)
        .download(fileName);

      if (error) throw error;

      await fs.writeFile(destinationPath, Buffer.from(await data.arrayBuffer()));
    } catch (error) {
      console.error('Erreur lors du téléchargement depuis Supabase:', error);
      throw error;
    }
  }
} 