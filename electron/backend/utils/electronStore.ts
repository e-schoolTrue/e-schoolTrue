import Store from 'electron-store';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export class ElectronStore {
  private store: Store;
  private readonly storePath: string;

  constructor(name: string = 'supabase-auth') {
    this.storePath = path.join(app.getPath('userData'), `${name}.json`);
    
    // Tentative de réparation du fichier de stockage s'il est corrompu
    this.repairStoreIfNeeded();
    
    this.store = new Store({
      name,
      encryptionKey: process.env.ENCRYPTION_KEY || 'your-fallback-encryption-key',
      clearInvalidConfig: true, // Nettoie automatiquement la config si elle est invalide
    });
  }

  private repairStoreIfNeeded(): void {
    try {
      if (fs.existsSync(this.storePath)) {
        const content = fs.readFileSync(this.storePath, 'utf8');
        JSON.parse(content); // Teste si le JSON est valide
      }
    } catch (error) {
      console.error('Store file corrupted, creating backup and resetting:', error);
      
      // Crée une sauvegarde du fichier corrompu
      if (fs.existsSync(this.storePath)) {
        const backupPath = `${this.storePath}.backup-${Date.now()}`;
        try {
          fs.copyFileSync(this.storePath, backupPath);
          console.log('Backup created at:', backupPath);
        } catch (e) {
          console.error('Failed to create backup:', e);
        }
      }
      
      // Réinitialise le fichier de stockage
      try {
        fs.writeFileSync(this.storePath, '{}', 'utf8');
        console.log('Store file reset successfully');
      } catch (e) {
        console.error('Failed to reset store file:', e);
      }
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const value = this.store.get(key) as string;
      return value ?? null;
    } catch (error) {
      console.error('Error getting item from store:', error);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Valide que la valeur peut être sérialisée en JSON
      JSON.parse(JSON.stringify(value));
      this.store.set(key, value);
    } catch (error) {
      console.error('Error setting item in store:', error);
      throw new Error('Failed to store invalid JSON data');
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      this.store.delete(key);
    } catch (error) {
      console.error('Error removing item from store:', error);
    }
  }
}
