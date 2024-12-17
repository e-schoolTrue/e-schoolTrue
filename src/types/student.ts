// types/student.ts
export interface StudentFile {
    name: string;
    size: number;
    type: string;
    lastModified: number;
  }
  
  export interface StudentData {
    firstname: string;
    lastname: string;
    birthDay: Date | null;
    birthPlace: string;
    address: string;
    gradeId: number | null;
    fatherFirstname: string;
    fatherLastname: string;
    motherFirstname: string;
    motherLastname: string;
    famillyPhone: string;
    personalPhone: string;
    photo: StudentFile | null;
    document: StudentFile | null;
    sex: 'male' | 'female';
    schoolYear: string;
  }