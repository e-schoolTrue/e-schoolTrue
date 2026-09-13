export type Database = {
  public: {
    Tables: {
      schools_registry: {
        Row: {
          id: string;
          owner_id: string;
          name: string;
          schema_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          owner_id: string;
          name: string;
          schema_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          owner_id?: string;
          name?: string;
          schema_name?: string;
          updated_at?: string;
        };
      };
      sync_history: {
        Row: {
          id: string;
          user_id: string;
          school_id: string | null;
          sync_started_at: string;
          sync_ended_at: string | null;
          direction: 'local_to_cloud' | 'cloud_to_local' | 'bidirectional';
          status: 'success' | 'partial_success' | 'failed' | 'in_progress' | 'skipped';
          records_synced_up: number;
          records_synced_down: number;
          tables_processed: string[];
          error_message: string | null;
          conflict_count: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          school_id?: string | null;
          sync_started_at?: string;
          sync_ended_at?: string | null;
          direction: 'local_to_cloud' | 'cloud_to_local' | 'bidirectional';
          status: 'success' | 'partial_success' | 'failed' | 'in_progress' | 'skipped';
          records_synced_up?: number;
          records_synced_down?: number;
          tables_processed?: string[];
          error_message?: string | null;
          conflict_count?: number;
        };
        Update: {
          sync_ended_at?: string | null;
          status?: 'success' | 'partial_success' | 'failed' | 'in_progress' | 'skipped';
          records_synced_up?: number;
          records_synced_down?: number;
          tables_processed?: string[];
          error_message?: string | null;
          conflict_count?: number;
        };
      };
    };
    Functions: {
      provision_school: {
        Args: { p_name: string };
        Returns: {
          school_id: string;
          schema_name: string;
          name: string;
        };
      };
      get_my_schools: {
        Args: Record<string, never>;
        Returns: Array<{
          id: string;
          owner_id: string;
          name: string;
          schema_name: string;
          created_at: string;
          updated_at: string;
        }>;
      };
      delete_school: {
        Args: { p_school_id: string };
        Returns: boolean;
      };
    };
  };
};
