import Store from 'electron-store';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';

export class ElectronStore {
  private store: Store;
  private readonly storePath: string;
  private readonly encryptionKey: string;

  constructor(name: string = 'supabase-auth') {
    this.storePath = path.join(app.getPath('userData'), `${name}.json`);
    this.encryptionKey = process.env.ENCRYPTION_KEY || 'your-fallback-encryption-key';

    if (!process.env.ENCRYPTION_KEY) {
      console.warn(
        '[ElectronStore] ENCRYPTION_KEY not set — using stable fallback key. ' +
          'Set ENCRYPTION_KEY in .env for production security. Path:',
        this.storePath,
      );
    }

    console.log('[ElectronStore] path', this.storePath, 'name', name);

    // Encryption-aware repair: must run before Store init but must NOT wipe encrypted files
    this.repairStoreIfNeeded();

    this.store = new Store({
      name,
      encryptionKey: this.encryptionKey,
      clearInvalidConfig: false,
    });

    // Post-init integrity probe via Store API (decryption-aware, non-destructive)
    this.validateStoreIntegrity(name);
  }

  /**
   * Encryption-aware repair.
   * - Encrypted stores (encryptionKey present) are NOT parsed as plain JSON.
   *   Raw content will look like gibberish and JSON.parse would always fail.
   *   In that case we NEVER wipe the file — we backup and preserve it.
   * - Plain JSON stores (no encryptionKey — not the case with current fallback)
   *   keep the classic backup+reset behaviour.
   */
  private repairStoreIfNeeded(): void {
    try {
      if (!fs.existsSync(this.storePath)) {
        return;
      }

      const stats = fs.statSync(this.storePath);
      if (stats.size === 0) {
        console.warn('[ElectronStore] Store file empty at', this.storePath, '- keeping file, electron-store will initialize lazily');
        return;
      }

      const content = fs.readFileSync(this.storePath, 'utf8');
      const trimmed = content.trim();

      // Encrypted file heuristic: electron-store with encryptionKey writes
      // ciphertext that never starts with '{' / '['.
      const looksEncrypted = trimmed.length > 0 && !trimmed.startsWith('{') && !trimmed.startsWith('[');
      const isEncryptedStore = !!this.encryptionKey;

      if (isEncryptedStore && looksEncrypted) {
        console.log('[ElectronStore] Encrypted store detected at', this.storePath, '- skipping manual JSON repair (handled by electron-store)');
        return;
      }

      // For plain JSON stores, validate that the file is valid JSON
      JSON.parse(content);
    } catch (error) {
      const isEncryptedStore = !!this.encryptionKey;

      if (isEncryptedStore) {
        // CRITICAL: Never wipe an encrypted store. The parse failure is expected
        // because raw bytes are ciphertext, not JSON. Preserve file and let
        // electron-store handle decryption. Create a backup for forensic recovery.
        console.error(
          '[ElectronStore] Store file at',
          this.storePath,
          'failed JSON validation but is encrypted — preserving file to avoid data loss:',
          error,
        );
        try {
          const backupPath = `${this.storePath}.backup-${Date.now()}`;
          fs.copyFileSync(this.storePath, backupPath);
          console.log('[ElectronStore] Backup preserved at:', backupPath);
        } catch (e) {
          console.error('[ElectronStore] Failed to create backup:', e);
        }
        console.log('[ElectronStore] Encrypted store preserved — electron-store will handle decryption');
        return;
      }

      // Non-encrypted path: classic backup + reset (only reached if encryptionKey absent)
      console.error('[ElectronStore] Store file corrupted, creating backup and resetting:', error);

      if (fs.existsSync(this.storePath)) {
        const backupPath = `${this.storePath}.backup-${Date.now()}`;
        try {
          fs.copyFileSync(this.storePath, backupPath);
          console.log('[ElectronStore] Backup created at:', backupPath);
        } catch (e) {
          console.error('[ElectronStore] Failed to create backup:', e);
        }
      }

      try {
        fs.writeFileSync(this.storePath, '{}', 'utf8');
        console.log('[ElectronStore] Store file reset successfully');
      } catch (e) {
        console.error('[ElectronStore] Failed to reset store file:', e);
      }
    }
  }

  private validateStoreIntegrity(name: string): void {
    try {
      // Probe via Store API — decryption-aware. Does not write.
      this.store.get('__integrity_probe__' as never);
      console.log('[ElectronStore] Store integrity check passed for', name);
    } catch (error) {
      console.error(
        '[ElectronStore] Store integrity check failed for',
        name,
        '- file preserved at',
        this.storePath,
        'for manual recovery:',
        error,
      );
    }
  }

  async getItem(key: string): Promise<string | null> {
    try {
      const value = this.store.get(key) as unknown as string | undefined;
      // electron-store decrypts automatically when encryptionKey is set
      return value ?? null;
    } catch (error) {
      console.error('[ElectronStore] Error getting item from store:', error, 'path:', this.storePath, 'key:', key);
      return null;
    }
  }

  async setItem(key: string, value: string): Promise<void> {
    try {
      // Validate that value is JSON-serializable (string always is, but keep guard for callers passing objects)
      JSON.parse(JSON.stringify(value));
      this.store.set(key, value);
    } catch (error) {
      console.error('[ElectronStore] Error setting item in store:', error, 'path:', this.storePath, 'key:', key);
      throw new Error('Failed to store invalid JSON data');
    }
  }

  async removeItem(key: string): Promise<void> {
    try {
      this.store.delete(key);
    } catch (error) {
      console.error('[ElectronStore] Error removing item from store:', error, 'path:', this.storePath, 'key:', key);
    }
  }
}
