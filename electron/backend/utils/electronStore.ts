import Store from 'electron-store';

export class ElectronStore {
  private store: Store;

  constructor(name: string = 'supabase-auth') {
    this.store = new Store({
      name,
      encryptionKey: process.env.ENCRYPTION_KEY || 'your-fallback-encryption-key'
    });
  }

  async getItem(key: string): Promise<string | null> {
    const value = this.store.get(key) as string;
    return value ?? null;
  }

  async setItem(key: string, value: string): Promise<void> {
    this.store.set(key, value);
  }

  async removeItem(key: string): Promise<void> {
    this.store.delete(key);
  }
}
