// src/lib/supabaseClient.ts

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../../config/supabase';
import { ElectronStore } from '../utils/electronStore';

const electronStore = new ElectronStore();

// Client principal (schema public) pour auth, schools_registry, sync_history
console.log('>>>>>>>> INITIALIZING SUPABASE SINGLETON CLIENT <<<<<<<<');
export const supabase = createClient(supabaseConfig.url, supabaseConfig.key, {
  auth: {
    storage: electronStore,
    autoRefreshToken: true,
    persistSession: true,
  }
});

// SupabaseClient with dynamic schema requires `any` for the schema type parameter
type SchemaClient = SupabaseClient<any, any, any>;

const schemaClients = new Map<string, SchemaClient>();

/**
 * Returns a Supabase client configured to operate on a specific school schema.
 * Clients are cached per schema name for reuse.
 */
export function getSchemaClient(schemaName: string): SchemaClient {
  const cached = schemaClients.get(schemaName);
  if (cached) return cached;

  const client = createClient(supabaseConfig.url, supabaseConfig.key, {
    auth: {
      storage: electronStore,
      autoRefreshToken: true,
      persistSession: true,
    },
    db: {
      schema: schemaName,
    },
  });

  schemaClients.set(schemaName, client);
  return client;
}

/**
 * Clears all cached schema clients (e.g. on logout).
 */
export function clearSchemaClients(): void {
  schemaClients.clear();
}

