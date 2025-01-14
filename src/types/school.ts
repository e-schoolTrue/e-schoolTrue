export interface SchoolInfo {
  id?: number;
  name: string;
  address: string;
  town: string;
  country: 'MAR' | 'SEN' | 'CAF' | 'GIN';
  currency: string;
  phone: string;
  email: string;
  type: 'publique' | 'privée';
  foundationYear: number;
  logo?: {
    id: number;
    name: string;
    type: string;
  } | null;
} 