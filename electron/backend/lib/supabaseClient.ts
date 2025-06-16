// src/lib/supabaseClient.ts

import { createClient } from '@supabase/supabase-js';
import { supabaseConfig } from '../../config/supabase';
import { ElectronStore } from '../utils/electronStore';

// Créez une seule instance de ElectronStore pour le client
const electronStore = new ElectronStore();

// Créez et exportez UNE SEULE instance du client Supabase
console.log('>>>>>>>> INITIALIZING SUPABASE SINGLETON CLIENT <<<<<<<<');
export const supabase = createClient(supabaseConfig.url, supabaseConfig.key, {
  auth: {
    storage: electronStore,
    autoRefreshToken: true,
    persistSession: true,
  }
  
});

