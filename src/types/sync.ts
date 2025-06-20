/**
 * Définit la configuration de la synchronisation automatique.
 * Ces propriétés correspondent à celles utilisées dans le CloudSyncService du backend.
 */
export interface SyncConfig {
  autoSyncOnConnect: boolean;
  notifyBeforeSync: boolean;
  syncIntervalMinutes?: number; // L'intervalle en minutes pour la synchronisation périodique
}


/**
 * Représente une seule entrée dans l'historique des opérations de synchronisation.
 * Ce type doit correspondre EXACTEMENT à l'interface `SyncHistory` du backend (`CloudSyncService`).
 */
export interface SyncHistoryType {
  // --- Identifiants ---
  id: string;          // ID unique de la session de synchronisation
  user_id: string;     // ID de l'utilisateur concerné

  // --- Timestamps ---
  sync_started_at: string; // Date et heure de début (format ISO string)
  sync_ended_at?: string;  // Date et heure de fin (format ISO string)

  // --- Statut et Métadonnées ---
  status: 'success' | 'partial_success' | 'failed' | 'in_progress' | 'skipped';
  direction: 'local_to_cloud' | 'cloud_to_local' | 'bidirectional';

  // --- Statistiques de la session ---
  records_synced_up?: number;   // Nombre d'enregistrements envoyés au cloud
  records_synced_down?: number; // Nombre d'enregistrements reçus du cloud
  conflict_count?: number;      // Nombre de conflits détectés et résolus
  
  // --- Informations de débogage ---
  tables_processed?: string[]; // Liste des tables/entités qui ont été traitées
  error_message?: string;      // Message d'erreur en cas de 'failed'
}


/**
 * (Optionnel mais recommandé)
 * Définit le contrat de l'API IPC pour la synchronisation.
 * Cela aide à maintenir la cohérence entre les appels du frontend et les handlers du backend.
 */
export interface SyncAPI {
  // Déclenche une synchronisation manuelle
  now(): Promise<{ success: boolean; data?: SyncHistoryType; error?: string }>;

  // Récupère l'historique complet des synchronisations
  getHistory(): Promise<{ success: boolean; data?: SyncHistoryType[]; error?: string }>;

  // Récupère la configuration actuelle
  getConfig(): Promise<{ success: boolean; data?: SyncConfig; error?: string }>;

  // Met à jour la configuration
  updateConfig(config: Partial<SyncConfig>): Promise<{ success: boolean; error?: string }>;
}

// --- Les types suivants ne sont plus nécessaires dans ce contexte "sync-first" ---
// export interface SupabaseSyncConfig { ... }
// export interface SyncService { ... } 
// La logique est maintenant directement dans le composant et les appels IPC.