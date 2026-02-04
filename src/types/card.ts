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
  isNew?: boolean;
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

export interface IStudentRank {
  rank: number;
  student: {
    id?: number;
    firstname?: string;
    lastname?: string;
    matricule?: string;
    photo?: {
      url?: string;
      optimizedUrl?: string;
    };
  };
  average: number;
  subjectCount: number;
}

export interface IGradesCentralization {
  classId?: number;
  schoolId?: number;
  schoolYear?: string;
  classLevel?: string;
  classLevelNumber?: number;
  totalStudents: number;
  students: IStudentRank[];
} 