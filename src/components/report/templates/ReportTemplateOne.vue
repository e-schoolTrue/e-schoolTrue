<template>
  <div class="report-template-one" :style="reportStyle">
    <!-- En-tête -->
    <div class="report-header">
      <div class="school-info">
        <img v-if="schoolInfo?.logo?.url" :src="schoolInfo.logo.url" class="school-logo" alt="Logo" />
        <div class="school-details">
          <h1>{{ schoolInfo?.name }}</h1>
          <p>{{ schoolInfo?.address }}</p>
          <p>Tel: {{ schoolInfo?.phone }}</p>
        </div>
      </div>
      <div class="report-title">
        <h2>BULLETIN DE NOTES</h2>
        <p>{{ report?.period }} - Année scolaire {{ report?.schoolYear }}</p>
      </div>
    </div>

    <!-- Informations de l'élève -->
    <div class="student-info">
      <div class="info-grid">
        <div class="info-item">
          <span class="label">Nom et Prénom:</span>
          <span class="value">{{ report?.student.firstname }} {{ report?.student.lastname }}</span>
        </div>
        <div class="info-item">
          <span class="label">Matricule:</span>
          <span class="value">{{ report?.student.matricule }}</span>
        </div>
        <div class="info-item">
          <span class="label">Classe:</span>
          <span class="value">{{ report?.student.grade.name }}</span>
        </div>
      </div>
    </div>

    <!-- Tableau des notes -->
    <table class="grades-table">
      <thead>
        <tr>
          <th>Matières</th>
          <th>Coef</th>
          <th>Note</th>
          <th>Moy. Coef</th>
          <th>Appréciation</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="grade in report?.grades" :key="grade.courseId">
          <td>{{ grade.courseName }}</td>
          <td class="center">{{ grade.coefficient }}</td>
          <td class="center">{{ formatGrade(grade.grade) }}</td>
          <td class="center">{{ formatGrade(grade.grade * grade.coefficient) }}</td>
          <td>{{ grade.appreciation }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="2">Moyenne Générale:</td>
          <td class="center">{{ formatGrade(report?.average) }}</td>
          <td colspan="2">Rang: {{ report?.rank }}/{{ report?.totalStudents }}</td>
        </tr>
      </tfoot>
    </table>

    <!-- Appréciations et signatures -->
    <div class="footer-section">
      <div class="appreciation-box">
        <h3>Appréciation Générale</h3>
        <p>{{ report?.generalAppreciation }}</p>
      </div>
      
      <div class="signatures">
        <div class="signature-item">
          <p>Le Directeur</p>
          <div class="signature-line"></div>
        </div>
        <div class="signature-item">
          <p>Le Parent</p>
          <div class="signature-line"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ReportCard } from '@/types/report';

const props = defineProps<{
  report: ReportCard;
  schoolInfo: any;
}>();

const reportStyle = computed(() => ({
  fontFamily: 'Arial, sans-serif',
  padding: '20mm',
  width: '210mm',
  minHeight: '297mm',
  backgroundColor: '#fff',
  boxShadow: '0 0 10px rgba(0,0,0,0.1)',
  margin: '0 auto'
}));

const formatGrade = (grade: number) => {
  return grade?.toFixed(2) || '-';
};
</script>

<style scoped>
.report-template-one {
  position: relative;
}

.report-header {
  margin-bottom: 30px;
}

.school-info {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-bottom: 20px;
}

.school-logo {
  width: 80px;
  height: auto;
}

.school-details h1 {
  font-size: 24px;
  margin: 0 0 5px 0;
}

.school-details p {
  margin: 2px 0;
  font-size: 14px;
}

.report-title {
  text-align: center;
  margin: 20px 0;
}

.report-title h2 {
  margin: 0;
  font-size: 22px;
  color: #003366;
}

.student-info {
  margin-bottom: 30px;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 15px;
}

.info-item .label {
  font-weight: bold;
  margin-right: 10px;
}

.grades-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 30px;
}

.grades-table th,
.grades-table td {
  border: 1px solid #ddd;
  padding: 8px;
}

.grades-table th {
  background-color: #f5f5f5;
  font-weight: bold;
}

.center {
  text-align: center;
}

.total-row {
  font-weight: bold;
  background-color: #f9f9f9;
}

.footer-section {
  margin-top: 30px;
}

.appreciation-box {
  border: 1px solid #ddd;
  padding: 15px;
  margin-bottom: 30px;
}

.appreciation-box h3 {
  margin: 0 0 10px 0;
  font-size: 16px;
}

.signatures {
  display: flex;
  justify-content: space-between;
  margin-top: 50px;
}

.signature-item {
  text-align: center;
  width: 200px;
}

.signature-line {
  border-top: 1px solid #000;
  margin-top: 50px;
}

@media print {
  .report-template-one {
    box-shadow: none;
  }
}
</style> 