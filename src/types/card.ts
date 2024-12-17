export interface Student {
  id: number;
  firstname: string;
  lastname: string;
  matricule: string;
  birthDay?: Date;
  birthPlace?: string;
  famillyPhone?: string;
  photo?: {
    path: string;
    type: string;
  };
  grade?: {
    id: number;
    name: string;
  };
}

export interface SchoolInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  type: 'publique' | 'privée';
  logo?: {
    path: string;
    type: string;
    content?: string;
  };
}

export interface ColorScheme {
  name: string;
  primary: string;
  secondary: string;
  text: string;
  background: string;
}

export interface CardTemplate {
  id: string;
  name: string;
  description: string;
  component: any; // Type du composant Vue
} 