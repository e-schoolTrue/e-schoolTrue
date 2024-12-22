import { Component } from 'vue';

export interface ReportCard {
    id: number;
    period: string;
    schoolYear: string;
    grades: {
        courseId: number;
        courseName: string;
        coefficient: number;
        grade: number;
        appreciation: string;
    }[];
    generalAppreciation?: string;
    average: number;
    classAverage: number;
    rank: number;
    totalStudents: number;
    student: {
        id: number;
        firstname: string;
        lastname: string;
        matricule: string;
        grade: {
            id: number;
            name: string;
        };
    };
}

export interface ReportCardTemplate {
    id: string;
    name: string;
    description: string;
    component: Component;
} 