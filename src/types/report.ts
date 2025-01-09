import { Component } from 'vue';

export interface SchoolInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  logo?: {
    url: string;
  };
}

export interface StudentInfo {
        firstname: string;
        lastname: string;
        matricule: string;
  birthDay?: string;
  birthPlace?: string;
        grade: {
            name: string;
        };
  photo?: {
    url: string;
  };
}

export interface GradeInfo {
  courseId: number;
  courseName: string;
  courseGroup?: string;
  coefficient: number;
  assignments: number[];
  exam: number;
  average: number;
  classAverage: number;
  appreciation: string;
}

export interface ReportCardData {
  student: StudentInfo;
  schoolInfo: SchoolInfo;
  period: string;
  grades: GradeInfo[];
  generalAverage: number;
  classGeneralAverage?: number;
  rank?: number;
  totalStudents?: number;
  observations?: string;
  conduct?: {
    discipline: string;
    attendance: string;
    workEthic: string;
    };
}

export interface ReportCardTemplate {
    id: string;
    name: string;
    description: string;
    component: Component;
} 