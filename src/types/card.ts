export interface ColorScheme {
  name: string;
  primary: string;
  secondary: string;
  text: string;
  background: string;
}

export interface Student {
  id?: number;
  firstname?: string;
  lastname?: string;
  matricule?: string;
  birthDay?: string | Date;
  birthPlace?: string;
  famillyPhone?: string;
  grade?: {
    id: number;
    name: string;
  };
  photo?: {
    id?: number;
    url?: string;
    optimizedUrl?: string;
  };
  schoolYear?: string;
}

export interface SchoolInfo {
  id?: number;
  name?: string;
  logo?: {
    id?: number;
    url?: string;
    optimizedUrl?: string;
  };
  phone?: string;
  email?: string;
  address?: string;
} 