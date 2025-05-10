export type Database = {
  public: {
    Tables: {
      backups: {
        Row: {
          id: string;
          name: string;
          created_at: string;
          size: number;
          type: 'local' | 'cloud';
          status: 'success' | 'error' | 'pending';
          user_id: string;
          school_id: string;
          school_name: string;
          backup_status: 'pending' | 'in_progress' | 'completed' | 'failed';
          metadata: {
            tables?: string[];
            fileCount?: number;
            version?: string;
            publicURL?: string;
            description?: string;
            school_info?: {
              id: string;
              name: string;
              address?: string;
              contact?: string;
            };
          } | null;
        };
        Insert: {
          id: string;
          name: string;
          created_at: string;
          size: number;
          type: 'local' | 'cloud';
          status: 'success' | 'error' | 'pending';
          user_id: string;
          school_id: string;
          school_name: string;
          backup_status: 'pending' | 'in_progress' | 'completed' | 'failed';
          metadata?: {
            tables?: string[];
            fileCount?: number;
            version?: string;
            publicURL?: string;
            description?: string;
            school_info?: {
              id: string;
              name: string;
              address?: string;
              contact?: string;
            };
          } | null;
        };
        Update: {
          id?: string;
          name?: string;
          created_at?: string;
          size?: number;
          type?: 'local' | 'cloud';
          status?: 'success' | 'error' | 'pending';
          user_id?: string;
          school_id?: string;
          school_name?: string;
          backup_status?: 'pending' | 'in_progress' | 'completed' | 'failed';
          metadata?: {
            tables?: string[];
            fileCount?: number;
            version?: string;
            publicURL?: string;
            description?: string;
            school_info?: {
              id: string;
              name: string;
              address?: string;
              contact?: string;
            };
          } | null;
        };
      };
      settings: {
        Row: {
          key: string;
          value: any;
        };
        Insert: {
          key: string;
          value: any;
        };
        Update: {
          key?: string;
          value?: any;
        };
      };
    };
  };
}; 