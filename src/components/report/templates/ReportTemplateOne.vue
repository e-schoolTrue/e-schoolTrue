<template>
  <div class="report-card">
    <div class="header">
      <div class="school-info">
        <img v-if="schoolInfo?.logo?.url" :src="schoolInfo.logo.url" alt="Logo" class="school-logo">
        <div class="school-details">
          <h2>{{ schoolInfo?.name }}</h2>
          <p>{{ schoolInfo?.address }}{{ schoolInfo?.town ? `, ${schoolInfo.town}` : '' }}</p>
          <p>Tél: {{ schoolInfo?.phone }} | Email: {{ schoolInfo?.email }}</p>
        </div>
      </div>
    </div>

    <div class="report-title">
      <h3>Bulletin de Notes - {{ period }}</h3>
    </div>

    <div class="student-info">
      <div><strong>Nom:</strong> {{ student?.lastname }} {{ student?.firstname }}</div>
      <div><strong>Matricule:</strong> {{ student?.matricule }}</div>
      <div><strong>Classe:</strong> {{ student?.grade?.name }}</div>
    </div>

    <table class="grades-table">
      <thead>
        <tr>
          <th>Matières</th>
          <th>Coefficient</th>
          <th>Moyenne Devoirs</th>
          <th>Note Examen</th>
          <th>Moyenne</th>
          <th>Appréciation</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="grade in grades" :key="grade.courseId">
          <td>{{ grade.courseName }}</td>
          <td class="center">{{ grade.coefficient }}</td>
          <td class="center">{{ calculateAssignmentAverage(grade.assignments) }}</td>
          <td class="center">{{ grade.exam }}</td>
          <td class="center">{{ grade.average.toFixed(2) }}</td>
          <td>{{ grade.appreciation }}</td>
        </tr>
        <tr class="totals">
          <td>Total</td>
          <td class="center">{{ calculateTotalCoef() }}</td>
          <td class="center">{{ calculateTotalAssignments() }}</td>
          <td class="center">{{ calculateTotalExams() }}</td>
          <td class="center">{{ calculateTotalAverages() }}</td>
          <td></td>
        </tr>
      </tbody>
    </table>

    <div class="general-average">
      Moyenne Générale: {{ generalAverage?.toFixed(2) || '0.00' }}/20
    </div>

    <div class="decision">
      Décision: {{ getDecision() }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps } from 'vue';
import { SchoolInfo } from '@/types/report';

interface Props {
  student: {
    lastname: string;
    firstname: string;
    matricule: string;
    grade: {
      name: string;
    };
  };
  grades: Array<{
    courseId: number;
    courseName: string;
    coefficient: number;
    average: number;
    exam: number;
    appreciation: string;
    assignments: number[];
  }>;
  period: string;
  schoolInfo: SchoolInfo;
  generalAverage: number;
}

const props = defineProps<Props>();

const calculateAssignmentAverage = (assignments: number[]) => {
  if (!assignments?.length) return '0.00';
  return (assignments.reduce((sum, grade) => sum + grade, 0) / assignments.length).toFixed(2);
};

const calculateTotalCoef = () => {
  return props.grades.reduce((sum, grade) => sum + grade.coefficient, 0);
};

const calculateTotalAssignments = () => {
  const total = props.grades.reduce((sum, grade) => {
    const avg = grade.assignments.reduce((s, a) => s + a, 0) / grade.assignments.length;
    return sum + avg;
  }, 0);
  return total.toFixed(2);
};

const calculateTotalExams = () => {
  const total = props.grades.reduce((sum, grade) => sum + grade.exam, 0);
  return total.toFixed(2);
};

const calculateTotalAverages = () => {
  const total = props.grades.reduce((sum, grade) => sum + grade.average, 0);
  return total.toFixed(2);
};

const getDecision = () => {
  const average = props.generalAverage;
  return average >= 10 ? 'Admis(e)' : 'Non admis(e)';
};
</script>

<style scoped>
.report-card {
  width: 210mm;
  height: 297mm;
  padding: 10mm;
  margin: 0;
  background: white;
  font-size: 11pt;
  box-sizing: border-box;
  position: relative;
}

.header {
  margin-bottom: 20px;
}

.school-info {
  display: flex;
  align-items: center;
  gap: 15px;
}

.school-logo {
  width: 60px;
  height: 60px;
  object-fit: contain;
}

.school-details h2 {
  margin: 0 0 5px 0;
  font-size: 16pt;
}

.school-details p {
  margin: 2px 0;
}

.report-title {
  text-align: center;
  margin: 20px 0;
  border-bottom: 1px solid #000;
  padding-bottom: 10px;
}

.student-info {
  margin: 15px 0;
  line-height: 1.5;
}

.grades-table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
}

.grades-table th,
.grades-table td {
  border: 1px solid #000;
  padding: 8px;
  text-align: left;
}

.center {
  text-align: center;
}

.totals {
  font-weight: bold;
  background-color: #f5f5f5;
}

.general-average {
  text-align: center;
  padding: 10px;
  border: 1px solid #000;
  margin: 20px 0;
}

.decision {
  margin: 20px 0;
}

@media print {
  .report-card {
    margin: 0;
    padding: 10mm;
    width: 210mm;
    height: 297mm;
    page-break-after: always;
  }
  
  @page {
    size: A4;
    margin: 0;
  }
}
</style> 