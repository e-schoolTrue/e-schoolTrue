import { AppDataSource } from '../../data-source';
import * as fs from 'fs';
import * as path from 'path';
import { app } from 'electron';
import { createClient } from '@supabase/supabase-js';
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
  created_at: string; // Changé de createdAt à created_at pour PostgreSQL
  size: number;
  type: 'local' | 'cloud';
  status: 'success' | 'error' | 'pending';
  user_id: string; // Standardisé en snake_case pour PostgreSQL
  metadata?: {
    tables?: string[];
    fileCount?: number;
    version?: string;
  };
}

// Default backup configuration
const DEFAULT_CONFIG: BackupConfig = {
  autoBackup: true,
  frequency: 'daily',
  backupTime: '02:00',
  maxBackups: 5,
  includeFiles: true,
  useSupabase: false, // Désactivé par défaut pour éviter les erreurs si Supabase n'est pas configuré
  notifyBeforeBackup: true,
  retentionDays: 30
};

export class BackupService {
  private supabase;
  private configKey = 'backup_config';
  private backupDir: string;
  private dbPath: string;
  // Variable pour suivre l'état de la connexion Supabase
  private supabaseAvailable = false;
  // Stockage des résultats de diagnostic
  private diagnosticResults: any = {};
  
  constructor() {
    // Initialiser le client Supabase avec gestion d'erreur
    try {
      // Créer le client avec des options pour désactiver le cache du schéma
      this.supabase = createClient(supabaseConfig.url, supabaseConfig.key, {
        auth: {
          persistSession: false // Désactive la persistance de session
        },
        db: {
          schema: 'public'
        }
      });
      
      console.log('Client Supabase réinitialisé avec cache désactivé');
      
      // Vérifier si Supabase est disponible au démarrage (sans bloquer le constructeur)
      this.checkSupabaseAvailability();
      
      // Initialiser le bucket de stockage si Supabase est disponible (asynchrone)
      this.initSupabaseBucket();
    } catch (error) {
      // Créer un client factice pour éviter les erreurs
      this.supabase = {
        storage: {
          from: () => ({
            upload: async () => ({ error: new Error('Supabase non disponible') }),
            download: async () => ({ error: new Error('Supabase non disponible') }),
            remove: async () => ({ error: new Error('Supabase non disponible') })
          })
        },
        from: () => ({
          select: () => ({
            order: () => ({
              then: () => Promise.resolve({ data: [], error: null })
            })
          }),
          insert: async () => ({ error: new Error('Supabase non disponible') }),
          delete: async () => ({ error: new Error('Supabase non disponible') })
        })
      };
    }
    
    // Créer le dossier de sauvegarde s'il n'existe pas
    this.backupDir = path.join(app.getPath('userData'), 'backups');
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }
    
    // Chemin vers la base de données SQLite
    // Utiliser le même chemin que celui défini dans data-source.ts
    try {
      if (AppDataSource && AppDataSource.options && AppDataSource.options.database) {
        this.dbPath = AppDataSource.options.database as string;
      } else {
        // Chemin par défaut pour la base de données SQLite
        // Utiliser database.db au lieu de database.sqlite pour correspondre à data-source.ts
        this.dbPath = path.join(app.getPath('userData'), 'database.db');
        console.log('Utilisation du chemin par défaut pour la base de données:', this.dbPath);
      }
    } catch (error) {
      // En cas d'erreur, utiliser un chemin par défaut
      this.dbPath = path.join(app.getPath('userData'), 'database.db');
      console.log('Erreur lors de l\'accès à AppDataSource, utilisation du chemin par défaut:', this.dbPath);
    }
  }
  
  /**
   * Crée une sauvegarde de la base de données SQLite
   */
  async createBackup(name?: string): Promise<{ success: boolean; data?: BackupHistory; error?: string }> {
    try {
      // Générer un nom de sauvegarde si non fourni
      const backupName = name || `backup_${new Date().toISOString().replace(/[:.]/g, '-')}`;
      const backupPath = path.join(this.backupDir, `${backupName}.sqlite`);
      
      // Vérifier que le fichier de base de données existe
      if (!fs.existsSync(this.dbPath)) {
        console.warn(`Fichier de base de données non trouvé à ${this.dbPath}, création d'une sauvegarde vide`);
        // Créer un fichier vide pour permettre la sauvegarde même si la base n'existe pas encore
        fs.writeFileSync(backupPath, '');
      } else {
        // Vérifier que la connexion à la base de données est établie
        try {
          if (AppDataSource && typeof AppDataSource.isInitialized !== 'undefined' && !AppDataSource.isInitialized) {
            await AppDataSource.initialize();
          }
          
          // Fermer la connexion pour pouvoir copier le fichier
          if (AppDataSource && typeof AppDataSource.destroy === 'function') {
            await AppDataSource.destroy();
          }
        } catch (error) {
          console.warn('Erreur lors de la gestion de la connexion à la base de données:', error);
          // Continuer malgré l'erreur
        }
        
        // Copier le fichier de base de données
        fs.copyFileSync(this.dbPath, backupPath);
        
        // Réinitialiser la connexion à la base de données
        try {
          if (AppDataSource && typeof AppDataSource.initialize === 'function') {
            await AppDataSource.initialize();
          }
        } catch (error) {
          console.warn('Erreur lors de la réinitialisation de la connexion à la base de données:', error);
          // Continuer malgré l'erreur
        }
      }
      
      // Obtenir la taille du fichier de sauvegarde
      const stats = fs.statSync(backupPath);
      const fileSize = stats.size;
      
      // Créer l'enregistrement de sauvegarde
      const backupRecord: BackupHistory = {
        id: backupName,
        name: backupName,
        created_at: new Date().toISOString(),
        size: fileSize,
        type: 'local',
        status: 'success',
        user_id: '00000000-0000-0000-0000-000000000000', // Utiliser un UUID fixe pour l'instant
        metadata: {
          version: '1.0'
        }
      };
      
      // Si Supabase est activé, télécharger la sauvegarde
      const config = await this.getConfig();
      if (config.data?.useSupabase) {
        try {
          // Utiliser la variable de classe pour éviter de tester à chaque fois
          if (!this.supabaseAvailable) {
            // Ne pas essayer d'uploader vers Supabase
            return { success: true, data: backupRecord };
          }
          
          // Lire le fichier de sauvegarde
          const fileBuffer = fs.readFileSync(backupPath);
          
          console.log(`Téléchargement de la sauvegarde vers le bucket '${supabaseConfig.bucket}'...`);
          
          // Télécharger vers Supabase Storage avec remplacement si le fichier existe déjà
          const { data, error } = await this.supabase.storage
            .from(supabaseConfig.bucket)
            .upload(`${backupName}.sqlite`, fileBuffer, {
              cacheControl: '3600',
              upsert: true // Remplacer si existe déjà
            });
            
          if (error) {
            console.warn(`Erreur lors du téléchargement vers Supabase: ${error.message}`);
            console.warn('Détails de l\'erreur:', error);
            // Continuer avec la sauvegarde locale uniquement
            return { success: true, data: backupRecord };
          }
          
          console.log('Sauvegarde téléchargée avec succès vers Supabase');
          
          // Mettre à jour le type de sauvegarde
          backupRecord.type = 'cloud';
          
          // NOUVELLE APPROCHE : Stocker les métadonnées dans un fichier JSON dans le bucket Supabase
          console.log('Enregistrement des métadonnées de sauvegarde dans Supabase (fichier JSON)...');
          try {
            // Créer un fichier JSON avec les métadonnées
            const metadataJson = JSON.stringify(backupRecord, null, 2);
            const metadataBuffer = Buffer.from(metadataJson);
            
            // Télécharger le fichier JSON des métadonnées vers Supabase Storage
            const metadataResult = await this.supabase.storage
              .from(supabaseConfig.bucket)
              .upload(`metadata/${backupRecord.id}.json`, metadataBuffer, {
                cacheControl: '3600',
                upsert: true // Remplacer si existe déjà
              });
              
            if (metadataResult.error) {
              console.warn(`Erreur lors du téléchargement des métadonnées vers Supabase: ${metadataResult.error.message}`);
              console.warn('Détails de l\'erreur:', metadataResult.error);
              // Continuer avec la sauvegarde locale uniquement
              return { success: true, data: backupRecord };
            }
            
            console.log('Métadonnées de sauvegarde enregistrées avec succès dans Supabase (fichier JSON)');
            
            // Mettre à jour le fichier d'index des sauvegardes
            await this.updateBackupIndex(backupRecord);
              
            // Générer l'URL publique de la sauvegarde
            const { data: publicURL } = this.supabase.storage
              .from(supabaseConfig.bucket)
              .getPublicUrl(`${backupName}.sqlite`);
                
            if (publicURL) {
              console.log('URL publique de la sauvegarde:', publicURL);
              // Ajouter l'URL publique aux métadonnées
              backupRecord.metadata = {
                ...backupRecord.metadata,
                publicURL: publicURL
              };
            }
          } catch (error) {
            console.warn('Erreur lors de l\'enregistrement dans Supabase:', error);
            // Revenir au type local si l'insertion a échoué
            backupRecord.type = 'local';
          }
        } catch (error) {
          console.warn('Erreur lors du téléchargement vers Supabase:', error);
          // Continuer avec la sauvegarde locale même si le téléchargement a échoué
        }
      }
      
      // Stocker l'historique des sauvegardes localement
      await this.saveBackupHistory(backupRecord);
      
      // Nettoyer les anciennes sauvegardes si nécessaire
      await this.cleanupOldBackups();
      
      return { success: true, data: backupRecord };
    } catch (error) {
      console.error('Erreur lors de la création de la sauvegarde:', error);
      
      // Réinitialiser la connexion à la base de données si elle a été fermée
      try {
        if (AppDataSource && typeof AppDataSource.isInitialized !== 'undefined' && !AppDataSource.isInitialized && typeof AppDataSource.initialize === 'function') {
          await AppDataSource.initialize();
        }
      } catch (error) {
        console.warn('Erreur lors de la réinitialisation de la connexion à la base de données:', error);
        // Continuer malgré l'erreur
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de la création de la sauvegarde'
      };
    }
  }
  
  /**
   * Restaure une sauvegarde
   */
  async restoreBackup(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Trouver la sauvegarde dans l'historique
      const history = await this.getBackupHistory();
      const backup = history.data?.find(b => b.id === id);
      
      if (!backup) {
        throw new Error('Sauvegarde non trouvée');
      }
      
      let backupPath = '';
      
      // Si la sauvegarde est dans le cloud, la télécharger d'abord
      if (backup.type === 'cloud') {
        try {
          // Télécharger depuis Supabase Storage
          const { data, error } = await this.supabase.storage
            .from(supabaseConfig.bucket)
            .download(`${id}.sqlite`);
            
          if (error) throw new Error(`Erreur lors du téléchargement depuis Supabase: ${error.message}`);
          
          // Écrire le fichier téléchargé localement
          backupPath = path.join(this.backupDir, `${id}.sqlite`);
          fs.writeFileSync(backupPath, Buffer.from(await data.arrayBuffer()));
        } catch (error) {
          throw new Error(`Erreur lors du téléchargement de la sauvegarde: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
      } else {
        // La sauvegarde est locale
        backupPath = path.join(this.backupDir, `${id}.sqlite`);
        if (!fs.existsSync(backupPath)) {
          throw new Error('Fichier de sauvegarde introuvable');
        }
      }
      
      // Fermer la connexion à la base de données
      try {
        if (AppDataSource && typeof AppDataSource.destroy === 'function') {
          await AppDataSource.destroy();
        }
      } catch (error) {
        console.warn('Erreur lors de la fermeture de la connexion à la base de données:', error);
        // Continuer malgré l'erreur
      }
      
      // Créer une sauvegarde de la base de données actuelle avant de la remplacer
      if (fs.existsSync(this.dbPath)) {
        const currentBackupName = `pre_restore_${new Date().toISOString().replace(/[:.]/g, '-')}`;
        const currentBackupPath = path.join(this.backupDir, `${currentBackupName}.sqlite`);
        fs.copyFileSync(this.dbPath, currentBackupPath);
      }
      
      // Remplacer la base de données par la sauvegarde
      fs.copyFileSync(backupPath, this.dbPath);
      
      // Réinitialiser la connexion à la base de données
      try {
        if (AppDataSource && typeof AppDataSource.initialize === 'function') {
          await AppDataSource.initialize();
        }
      } catch (error) {
        console.warn('Erreur lors de la réinitialisation de la connexion à la base de données:', error);
        // Continuer malgré l'erreur
      }
      
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la restauration de la sauvegarde:', error);
      
      // Réinitialiser la connexion à la base de données si elle a été fermée
      try {
        if (AppDataSource && typeof AppDataSource.isInitialized !== 'undefined' && !AppDataSource.isInitialized && typeof AppDataSource.initialize === 'function') {
          await AppDataSource.initialize();
        }
      } catch (error) {
        console.warn('Erreur lors de la réinitialisation de la connexion à la base de données:', error);
        // Continuer malgré l'erreur
      }
      
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de la restauration'
      };
    }
  }
  
  /**
   * Supprime une sauvegarde
   */
  async deleteBackup(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Trouver la sauvegarde dans l'historique
      const history = await this.getBackupHistory();
      const backup = history.data?.find(b => b.id === id);
      
      if (!backup) {
        throw new Error('Sauvegarde non trouvée');
      }
      
      // Supprimer le fichier local s'il existe
      
      // Mettre à jour l'historique local
      const updatedHistory = history.data?.filter(b => b.id !== id) || [];
      await this.saveLocalBackupHistory(updatedHistory);
      
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la suppression de la sauvegarde:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de la suppression'
      };
    }
  }
  
  /**
   * Télécharge une sauvegarde depuis Supabase
   */
  async downloadBackup(id: string): Promise<{ success: boolean; path?: string; error?: string }> {
    try {
      // Trouver la sauvegarde dans l'historique
      const history = await this.getBackupHistory();
      const backup = history.data?.find(b => b.id === id);
      
      if (!backup) {
        throw new Error('Sauvegarde non trouvée');
      }
      
      // Si la sauvegarde est déjà locale, retourner le chemin
      const localPath = path.join(this.backupDir, `${id}.sqlite`);
      if (backup.type === 'local' && fs.existsSync(localPath)) {
        return { success: true, path: localPath };
      }
      
      // Si la sauvegarde est dans le cloud, la télécharger
      if (backup.type === 'cloud') {
        try {
          // Télécharger depuis Supabase Storage
          const { data, error } = await this.supabase.storage
            .from(supabaseConfig.bucket)
            .download(`${id}.sqlite`);
            
          if (error) throw new Error(`Erreur lors du téléchargement depuis Supabase: ${error.message}`);
          
          // Écrire le fichier téléchargé localement
          fs.writeFileSync(localPath, Buffer.from(await data.arrayBuffer()));
          
          return { success: true, path: localPath };
        } catch (error) {
          throw new Error(`Erreur lors du téléchargement de la sauvegarde: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
        }
      }
      
      throw new Error('Sauvegarde introuvable');
    } catch (error) {
      console.error('Erreur lors du téléchargement de la sauvegarde:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur inconnue lors du téléchargement'
      };
    }
  }
  
  /**
   * Récupère l'historique des sauvegardes
   */
  async getBackupHistory(): Promise<{ success: boolean; data?: BackupHistory[]; error?: string }> {
    try {
      let backups: BackupHistory[] = [];
      
      // Récupérer l'historique local
      try {
        const historyPath = path.join(this.backupDir, 'history.json');
        if (fs.existsSync(historyPath)) {
          const historyData = fs.readFileSync(historyPath, 'utf8');
          backups = JSON.parse(historyData);
        }
      } catch (error) {
        console.error('Erreur lors de la lecture de l\'historique local:', error);
      }
      
      // Si Supabase est activé, récupérer également l'historique cloud
      const config = await this.getConfig();
      if (config.data?.useSupabase) {
        try {
          // Utiliser la variable de classe pour éviter de tester à chaque fois
          if (!this.supabaseAvailable) {
            // Ne pas essayer de récupérer les données depuis Supabase
            return { success: true, data: backups };
          }
          
          // NOUVELLE APPROCHE : Récupérer l'index des sauvegardes depuis le fichier JSON
          console.log('Récupération de l\'index des sauvegardes depuis Supabase...');
          
          try {
            // Télécharger l'index des sauvegardes
            const { data, error } = await this.supabase.storage
              .from(supabaseConfig.bucket)
              .download('metadata/index.json');
              
            if (error) {
              console.warn(`Erreur lors de la récupération de l'index des sauvegardes: ${error.message}`);
              // Continuer avec l'historique local uniquement
              return { success: true, data: backups };
            }
            
            if (data) {
              // Convertir les données en texte puis en JSON
              const indexText = await data.text();
              const cloudBackups = JSON.parse(indexText) as BackupHistory[];
              console.log(`Index des sauvegardes récupéré (${cloudBackups.length} entrées)`);
              
              // Fusionner les sauvegardes cloud avec les sauvegardes locales
              if (cloudBackups && cloudBackups.length > 0) {
                console.log('Sauvegardes récupérées depuis Supabase:', cloudBackups.length);
                // Filtrer pour éviter les doublons
                const cloudBackupIds = cloudBackups.map(b => b.id);
                backups = backups.filter(b => !cloudBackupIds.includes(b.id));
                backups = [...backups, ...cloudBackups];
              } else {
                console.log('Aucune sauvegarde trouvée dans Supabase');
              }
              
              // Retourner directement les sauvegardes fusionnées
              backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
              return { success: true, data: backups };
            }
          } catch (error) {
            console.warn('Erreur lors de la récupération de l\'index des sauvegardes:', error);
            // Continuer avec l'historique local uniquement
            return { success: true, data: backups };
          }
          
          // Fusionner les sauvegardes cloud avec les sauvegardes locales
          if (data && data.length > 0) {
            console.log('Sauvegardes récupérées depuis Supabase:', data.length);
            // Filtrer pour éviter les doublons
            const cloudBackupIds = data.map(b => b.id);
            backups = backups.filter(b => !cloudBackupIds.includes(b.id));
            backups = [...backups, ...data];
          } else {
            console.log('Aucune sauvegarde trouvée dans Supabase');
          }
        } catch (error) {
          console.warn('Erreur lors de la récupération depuis Supabase:', error);
          // Ne pas propager l'erreur, continuer avec l'historique local
        }
      }
      
      // Trier par date de création (plus récent en premier)
      backups.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      return { success: true, data: backups };
    } catch (error) {
      console.error('Erreur lors de la récupération de l\'historique des sauvegardes:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de la récupération de l\'historique',
        data: []
      };
    }
  }
  
  /**
   * Met à jour la configuration des sauvegardes
   */
  async updateConfig(config: BackupConfig): Promise<{ success: boolean; error?: string }> {
    try {
      // Stocker dans Supabase si activé et disponible
      if (config.useSupabase && this.supabaseAvailable) {
        try {
          // Vérifier que Supabase est toujours disponible
          const testConnection = async () => {
            try {
              const response = await fetch(supabaseConfig.url, { method: 'HEAD', timeout: 3000 });
              return response.ok;
            } catch {
              return false;
            }
          };
          
          // Tester la connexion avant de tenter la mise à jour
          const isConnected = await testConnection();
          if (!isConnected) {
            // Mettre à jour la variable d'état
            this.supabaseAvailable = false;
            console.log('Supabase est inaccessible, configuration sauvegardée localement uniquement');
          } else {
            // Supabase est disponible, tenter la mise à jour
            const { error } = await this.supabase
              .from('settings')
              .upsert({ key: this.configKey, value: config }, { onConflict: 'key' });
              
            if (error) {
              console.warn(`Erreur lors de la mise à jour de la configuration dans Supabase: ${error.message}`);
            }
          }
        } catch (error) {
          console.warn('Erreur lors de la mise à jour de la configuration dans Supabase');
          // Ne pas propager l'erreur, continuer avec la sauvegarde locale
        }
      } else if (config.useSupabase && !this.supabaseAvailable) {
        console.log('Supabase est configuré mais inaccessible, configuration sauvegardée localement uniquement');
      }
      
      // Stocker localement
      const configPath = path.join(this.backupDir, 'config.json');
      fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
      
      return { success: true };
    } catch (error) {
      console.error('Erreur lors de la mise à jour de la configuration:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Erreur inconnue lors de la mise à jour de la configuration'
      };
    }
  }
  
  /**
   * Vérifie si Supabase est disponible
   * Cette méthode est asynchrone et ne bloque pas le constructeur
   */
  private async checkSupabaseAvailability() {
    try {
      const response = await fetch(supabaseConfig.url, { method: 'HEAD', timeout: 3000 });
      this.supabaseAvailable = response.ok;
      
      if (this.supabaseAvailable) {
        console.log('Connexion à Supabase établie avec succès');
      } else {
        console.log('Supabase est inaccessible, mode hors ligne activé');
      }
    } catch (error) {
      this.supabaseAvailable = false;
        console.warn('Supabase inaccessible, initialisation annulée');
        return;
      }
      
      // Vérifier si le bucket existe déjà
      console.log('Vérification des buckets Supabase...');
      const { data: buckets, error: listError } = await this.supabase.storage.listBuckets();
      
      if (listError) {
        console.warn('Erreur lors de la vérification des buckets Supabase:', listError.message);
        this.supabaseAvailable = false;
        return;
      }
      
      console.log('Buckets disponibles:', buckets?.map(b => b.name).join(', ') || 'aucun');
      
      // Vérifier si notre bucket existe
      const bucketExists = buckets?.some(bucket => bucket.name === supabaseConfig.bucket);
      
      if (!bucketExists) {
        console.log(`Création du bucket '${supabaseConfig.bucket}' dans Supabase...`);
        
        // Créer le bucket avec accès public
        const { error: createError } = await this.supabase.storage.createBucket(supabaseConfig.bucket, {
          public: true,
          fileSizeLimit: 52428800 // 50 Mo
        });
        
        if (createError) {
          console.warn(`Erreur lors de la création du bucket '${supabaseConfig.bucket}':`, createError.message);
          this.supabaseAvailable = false;
        } else {
          console.log(`Bucket '${supabaseConfig.bucket}' créé avec succès`);
          
          // Mettre à jour les politiques d'accès pour permettre le téléchargement public
          try {
            const { error: policyError } = await this.supabase.storage.from(supabaseConfig.bucket).setPublic(true);
            if (policyError) {
              console.warn('Erreur lors de la configuration des politiques d\'accès:', policyError.message);
            }
          } catch (error) {
            console.warn('Erreur lors de la configuration des politiques d\'accès:', error);
          }
        }
      } else {
        console.log(`Bucket '${supabaseConfig.bucket}' déjà existant dans Supabase`);
      }
      
      // Vérifier si le dossier metadata existe dans le bucket
      try {
        const { data, error } = await this.supabase.storage
          .from(supabaseConfig.bucket)
          .list('metadata');
          
        if (error) {
          console.warn('Erreur lors de la vérification du dossier metadata:', error.message);
        } else if (!data || data.length === 0) {
          console.log('Le dossier metadata n\'existe pas encore, il sera créé automatiquement lors de la première sauvegarde');
        } else {
          console.log('Dossier metadata existant dans Supabase Storage');
          const indexExists = data.some(file => file.name === 'index.json');
          if (indexExists) {
            console.log('Fichier index.json trouvé dans le dossier metadata');
          } else {
            console.log('Fichier index.json non trouvé, il sera créé lors de la première sauvegarde');
          }
        }
      } catch (error) {
        console.warn('Erreur lors de la vérification du dossier metadata:', error);
      }
    } catch (error) {
      console.warn('Erreur lors de l\'initialisation du bucket Supabase:', error);
      this.supabaseAvailable = false;
    }
  }

  /**
   * Récupère la configuration des sauvegardes
   */
  async getConfig(): Promise<{ success: boolean; data?: BackupConfig; error?: string }> {
    try {
      let config = DEFAULT_CONFIG;
      
      // Essayer de récupérer la configuration locale
      const configPath = path.join(this.backupDir, 'config.json');
      if (fs.existsSync(configPath)) {
        try {
          const configData = fs.readFileSync(configPath, 'utf8');
          config = JSON.parse(configData);
        } catch (error) {
          console.error('Erreur lors de la lecture de la configuration locale:', error);
        }
      }
      
      // Si Supabase est activé, essayer de récupérer la configuration depuis Supabase
      if (config.useSupabase) {
        try {
          const { data, error } = await this.supabase
            .from('settings')
            .select('value')
            .eq('key', this.configKey)
            .single();
          
          if (!error && data?.value) {
            // Fusionner avec la configuration locale
            config = { ...config, ...data.value };
          }
        } catch (error) {
          console.error('Erreur lors de la récupération de la configuration depuis Supabase:', error);
          // Continuer avec la configuration locale
        }
      }
      
      return { success: true, data: config };
    } catch (error) {
      console.error('Erreur lors de la récupération de la configuration:', error);
      // En cas d'erreur, retourner la configuration par défaut
      return { 
        success: true, 
        data: DEFAULT_CONFIG
      };
    }
  }
  
  /**
   * Méthodes privées
   */
  
  /**
   * Met à jour l'index des sauvegardes après suppression d'une sauvegarde
   */
  private async updateBackupIndexAfterDelete(id: string): Promise<void> {
    try {
      // Récupérer l'index actuel
      let backupIndex: BackupHistory[] = [];
      
      try {
        // Télécharger l'index existant s'il existe
        const { data, error } = await this.supabase.storage
          .from(supabaseConfig.bucket)
          .download('metadata/index.json');
          
        if (!error && data) {
          // Convertir les données en texte puis en JSON
          const indexText = await data.text();
          backupIndex = JSON.parse(indexText);
          console.log(`Index des sauvegardes récupéré (${backupIndex.length} entrées)`);
        }
      } catch (error) {
        console.log('Erreur lors de la récupération de l\'index des sauvegardes:', error);
        return; // Impossible de continuer sans l'index
      }
      
      // Supprimer la sauvegarde de l'index
      const updatedIndex = backupIndex.filter(b => b.id !== id);
      
      if (updatedIndex.length === backupIndex.length) {
        console.log(`Sauvegarde ${id} non trouvée dans l'index, aucune mise à jour nécessaire`);
        return;
      }
      
      // Télécharger l'index mis à jour
      const indexJson = JSON.stringify(updatedIndex, null, 2);
      const indexBuffer = Buffer.from(indexJson);
      
      const { error } = await this.supabase.storage
        .from(supabaseConfig.bucket)
        .upload('metadata/index.json', indexBuffer, {
          cacheControl: '3600',
          upsert: true // Remplacer si existe déjà
        });
        
      if (error) {
        console.warn(`Erreur lors de la mise à jour de l'index des sauvegardes: ${error.message}`);
      } else {
        console.log(`Index des sauvegardes mis à jour après suppression (${updatedIndex.length} entrées)`);
      }
    } catch (error) {
      console.warn('Erreur lors de la mise à jour de l\'index des sauvegardes après suppression:', error);
    }
  }
  
  /**
   * Met à jour l'index des sauvegardes dans Supabase
   * Cette méthode maintient un fichier JSON contenant la liste de toutes les sauvegardes
   */
  private async updateBackupIndex(backup: BackupHistory): Promise<void> {
    try {
      // Récupérer l'index actuel ou en créer un nouveau
      let backupIndex: BackupHistory[] = [];
      
      try {
        // Télécharger l'index existant s'il existe
        const { data, error } = await this.supabase.storage
          .from(supabaseConfig.bucket)
          .download('metadata/index.json');
          
        if (!error && data) {
          // Convertir les données en texte puis en JSON
          const indexText = await data.text();
          backupIndex = JSON.parse(indexText);
          console.log(`Index des sauvegardes récupéré (${backupIndex.length} entrées)`);
        }
      } catch (error) {
        console.log('Aucun index existant, création d\'un nouvel index');
      }
      
      // Ajouter ou mettre à jour la sauvegarde dans l'index
      const existingIndex = backupIndex.findIndex(b => b.id === backup.id);
      if (existingIndex >= 0) {
        backupIndex[existingIndex] = backup;
      } else {
        backupIndex.push(backup);
      }
      
      // Trier par date de création (plus récent en premier)
      backupIndex.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      
      // Télécharger l'index mis à jour
      const indexJson = JSON.stringify(backupIndex, null, 2);
      const indexBuffer = Buffer.from(indexJson);
      
      const { error } = await this.supabase.storage
        .from(supabaseConfig.bucket)
        .upload('metadata/index.json', indexBuffer, {
          cacheControl: '3600',
          upsert: true // Remplacer si existe déjà
        });
        
      if (error) {
        console.warn(`Erreur lors de la mise à jour de l'index des sauvegardes: ${error.message}`);
      } else {
        console.log(`Index des sauvegardes mis à jour (${backupIndex.length} entrées)`);
      }
    } catch (error) {
      console.warn('Erreur lors de la mise à jour de l\'index des sauvegardes:', error);
    }
  }
  
  /**
   * Sauvegarde l'historique des sauvegardes
   */
  private async saveBackupHistory(backup: BackupHistory): Promise<void> {
    try {
      // Récupérer l'historique actuel
      const history = await this.getBackupHistory();
      const backups = history.data || [];
      
      // Ajouter la nouvelle sauvegarde
      backups.push(backup);
      
      // Sauvegarder l'historique mis à jour
      await this.saveLocalBackupHistory(backups);
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'historique:', error);
    }
  }
  
  /**
   * Sauvegarde l'historique des sauvegardes localement
   */
  private async saveLocalBackupHistory(backups: BackupHistory[]): Promise<void> {
    try {
      const historyPath = path.join(this.backupDir, 'history.json');
      fs.writeFileSync(historyPath, JSON.stringify(backups, null, 2));
    } catch (error) {
      console.error('Erreur lors de la sauvegarde de l\'historique local:', error);
    }
  }
  
  /**
   * Nettoie les anciennes sauvegardes
   */
  private async cleanupOldBackups(): Promise<void> {
    try {
      // Récupérer la configuration
      const config = await this.getConfig();
      const maxBackups = config.data?.maxBackups || DEFAULT_CONFIG.maxBackups;
      
      // Récupérer l'historique des sauvegardes
      const history = await this.getBackupHistory();
      const backups = history.data || [];
      
      // Si le nombre de sauvegardes est inférieur à la limite, ne rien faire
      if (backups.length <= maxBackups) {
        return;
      }
      
      // Trier les sauvegardes par date (plus ancien en premier)
      backups.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      
      // Supprimer les sauvegardes les plus anciennes
      const backupsToDelete = backups.slice(0, backups.length - maxBackups);
      
      for (const backup of backupsToDelete) {
        await this.deleteBackup(backup.id);
      }
    } catch (error) {
      console.error('Erreur lors du nettoyage des anciennes sauvegardes:', error);
  }
}

/**
 * Initialise le bucket de stockage Supabase si nécessaire
 * Cette méthode est asynchrone et ne bloque pas le constructeur
 */
private async initSupabaseBucket() {
  try {
    if (!this.supabaseAvailable) {
      console.warn('Supabase inaccessible, initialisation du bucket annulée');
      return;
        this.supabaseAvailable = false;
        return;
      }
      
      console.log('Buckets disponibles:', buckets?.map(b => b.name).join(', ') || 'aucun');
      
      // Vérifier si notre bucket existe
      const bucketExists = buckets?.some(bucket => bucket.name === supabaseConfig.bucket);
      
      if (!bucketExists) {
        console.log(`Création du bucket '${supabaseConfig.bucket}' dans Supabase...`);
        
        // Créer le bucket avec accès public
        const { error: createError } = await this.supabase.storage.createBucket(supabaseConfig.bucket, {
          public: true,
          fileSizeLimit: 52428800 // 50 Mo
        });
        
        if (createError) {
          console.warn(`Erreur lors de la création du bucket '${supabaseConfig.bucket}':`, createError.message);
          this.supabaseAvailable = false;
        } else {
          console.log(`Bucket '${supabaseConfig.bucket}' créé avec succès`);
          
          // Mettre à jour les politiques d'accès pour permettre le téléchargement public
          try {
            const { error: policyError } = await this.supabase.storage.from(supabaseConfig.bucket).setPublic(true);
            if (policyError) {
              console.warn('Erreur lors de la configuration des politiques d\'accès:', policyError.message);
            }
          } catch (error) {
            console.warn('Erreur lors de la configuration des politiques d\'accès:', error);
          }
        }
      } else {
        console.log(`Bucket '${supabaseConfig.bucket}' déjà existant dans Supabase`);
      }
      
      // Vérifier le dossier metadata dans le bucket
      console.log('Vérification du dossier metadata dans le bucket...');
      try {
        // Vérifier si le dossier metadata existe
        const { data, error } = await this.supabase.storage
          .from(supabaseConfig.bucket)
          .list('metadata');
          
        if (error) {
          console.warn('Erreur lors de la vérification du dossier metadata:', error.message);
        } else if (!data || data.length === 0) {
          console.log('Le dossier metadata n\'existe pas encore, il sera créé automatiquement lors de la première sauvegarde');
        } else {
          console.log('Dossier metadata existant dans Supabase Storage avec', data.length, 'fichiers');
        }
      } catch (error) {
        console.warn('Erreur lors de la vérification du dossier metadata:', error);
      }
    } catch (error) {
      console.warn('Erreur lors de l\'initialisation du bucket Supabase:', error);
      this.supabaseAvailable = false;
    }
  }
  
  /**
   * Test d'insertion directe dans la table backups
   * Cette méthode est utilisée uniquement pour tester l'insertion dans Supabase
   */
  async testDirectInsert(): Promise<{ success: boolean; error?: any }> {
    try {
      console.log('Test d\'insertion directe dans la table backups...');
      
      // Définir un enregistrement de test
      const testRecord = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        name: 'test-backup',
        created_at: new Date().toISOString(),
        size: 1024,
        type: 'local',
        status: 'success',
        user_id: '00000000-0000-0000-0000-000000000000',
        metadata: { version: '1.0' }
      };
      
      console.log('Données à insérer:', JSON.stringify(testRecord, null, 2));
      
      // Tenter l'insertion directe
      const { data, error } = await this.supabase
        .from('backups')
        .insert(testRecord);
        
      if (error) {
        console.error('Erreur lors de l\'insertion directe:', error);
        return { success: false, error };
      }
      
      console.log('Insertion directe réussie:', data);
      return { success: true, data };
    } catch (error) {
      console.error('Exception lors du test d\'insertion directe:', error);
      return { success: false, error };
    }
  }
  
  /**
   * Exécute un diagnostic complet de la connexion Supabase
   * Utile pour déboguer les problèmes de connexion
   */
  async runSupabaseDiagnostic(): Promise<{ success: boolean; results: any }> {
    try {
      console.log('Démarrage du diagnostic Supabase...');
      this.diagnosticResults = {};
      
      // Vérifier la configuration
      this.diagnosticResults.config = {
        url: supabaseConfig.url,
        keyValid: !!supabaseConfig.key && supabaseConfig.key.startsWith('eyJ'),
        bucket: supabaseConfig.bucket
      };
      
      // Tester la connexion internet
      try {
        const internetResponse = await fetch('https://www.google.com', { timeout: 5000 });
        this.diagnosticResults.internetConnected = internetResponse.ok;
      } catch (error) {
        this.diagnosticResults.internetConnected = false;
        this.diagnosticResults.internetError = error;
      }
      
      // Si pas de connexion internet, inutile de continuer
      if (!this.diagnosticResults.internetConnected) {
        console.warn('Pas de connexion internet détectée');
        return { success: false, results: this.diagnosticResults };
      }
      
      // Tester la connexion Supabase
      await this.checkSupabaseAvailability();
      
      // Si Supabase est disponible, tester le bucket
      if (this.supabaseAvailable) {
        try {
          const { data: buckets, error } = await this.supabase.storage.listBuckets();
          this.diagnosticResults.bucketsListed = !error;
          this.diagnosticResults.buckets = buckets?.map(b => b.name) || [];
          this.diagnosticResults.bucketExists = buckets?.some(b => b.name === supabaseConfig.bucket) || false;
        } catch (error) {
          this.diagnosticResults.bucketsListed = false;
          this.diagnosticResults.bucketError = error;
        }
        
        // Tester le dossier metadata et l'index des sauvegardes
        try {
          // Vérifier si le fichier index.json existe
          const { data, error } = await this.supabase.storage
            .from(supabaseConfig.bucket)
            .list('metadata');
            
          this.diagnosticResults.metadataFolderExists = !error && data && data.length > 0;
          this.diagnosticResults.metadataFiles = data ? data.map(f => f.name) : [];
          this.diagnosticResults.indexExists = data ? data.some(f => f.name === 'index.json') : false;
          
          if (this.diagnosticResults.indexExists) {
            // Tenter de récupérer l'index pour vérifier son contenu
            const { data: indexData, error: indexError } = await this.supabase.storage
              .from(supabaseConfig.bucket)
              .download('metadata/index.json');
              
            if (!indexError && indexData) {
              const indexText = await indexData.text();
              const backupIndex = JSON.parse(indexText);
              this.diagnosticResults.indexValid = true;
              this.diagnosticResults.backupCount = backupIndex.length;
            } else {
              this.diagnosticResults.indexValid = false;
              this.diagnosticResults.indexError = indexError;
            }
          }
        } catch (error) {
          this.diagnosticResults.metadataFolderExists = false;
          this.diagnosticResults.metadataError = error;
        }
      }
      
      console.log('Résultats du diagnostic Supabase:', this.diagnosticResults);
      return { success: true, results: this.diagnosticResults };
    } catch (error) {
      console.error('Erreur lors du diagnostic Supabase:', error);
      return { success: false, results: { error } };
    }
  }
}

export const backupService = new BackupService();
export default backupService;
