<template>
  <div class="report-template-two" :style="reportStyle">
    <!-- En-tête moderne -->
    <div class="modern-header">
      <div class="header-left">
        <img v-if="schoolInfo?.logo?.url" :src="schoolInfo.logo.url" class="school-logo" alt="Logo" />
        <div class="school-details">
          <h1>{{ schoolInfo?.name }}</h1>
          <p>{{ schoolInfo?.address }}</p>
        </div>
      </div>
      <div class="header-right">
        <div class="academic-info">
          <span class="period">{{ report?.period }}</span>
          <span class="school-year">{{ report?.schoolYear }}</span>
        </div>
      </div>
    </div>

    <!-- Carte d'information de l'étudiant -->
    <div class="student-card">
      <div class="student-header">
        <h2>{{ report?.student.firstname }} {{ report?.student.lastname }}</h2>
        <div class="student-meta">
          <span class="matricule">
            <Icon icon="mdi:identifier" />
            {{ report?.student.matricule }}
          </span>
          <span class="grade">
            <Icon icon="mdi:school" />
            {{ report?.student.grade.name }}
          </span>
        </div>
      </div>

      <!-- Statistiques -->
      <div class="stats-grid">
        <div class="stat-item">
          <span class="stat-label">Moyenne Générale</span>
          <span class="stat-value">{{ formatGrade(report?.average) }}/20</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Moyenne de Classe</span>
          <span class="stat-value">{{ formatGrade(report?.classAverage) }}/20</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Rang</span>
          <span class="stat-value">{{ report?.rank }}<small>/{{ report?.totalStudents }}</small></span>
        </div>
      </div>
    </div>

    <!-- Tableau des notes avec design moderne -->
    <div class="grades-section">
      <h3>Résultats par Matière</h3>
      <div class="grades-grid">
        <div v-for="grade in report?.grades" :key="grade.courseId" class="grade-card">
          <div class="course-name">{{ grade.courseName }}</div>
          <div class="grade-details">
            <div class="grade-item">
              <span class="label">Coefficient</span>
              <span class="value">{{ grade.coefficient }}</span>
            </div>
            <div class="grade-item">
              <span class="label">Note</span>
              <span class="value highlight">{{ formatGrade(grade.grade) }}/20</span>
            </div>
            <div class="grade-item">
              <span class="label">Moyenne Coef.</span>
              <span class="value">{{ formatGrade(grade.grade * grade.coefficient) }}</span>
            </div>
          </div>
          <div class="appreciation">{{ grade.appreciation }}</div>
        </div>
      </div>
    </div>

    <!-- Appréciation générale -->
    <div class="general-appreciation">
      <h3>Appréciation Générale</h3>
      <p>{{ report?.generalAppreciation }}</p>
    </div>

    <!-- Signatures modernes -->
    <div class="modern-signatures">
      <div class="signature-block">
        <div class="signature-space"></div>
        <span>Direction</span>
      </div>
      <div class="signature-block">
        <div class="signature-space"></div>
        <span>Parent/Tuteur</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import type { ReportCard } from '@/types/report';

const props = defineProps<{
  report: ReportCard;
  schoolInfo: any;
}>();

const reportStyle = computed(() => ({
  fontFamily: "'Poppins', sans-serif",
  padding: '20mm',
  width: '210mm',
  minHeight: '297mm',
  backgroundColor: '#fff',
  boxShadow: '0 0 20px rgba(0,0,0,0.1)',
  margin: '0 auto'
}));

const formatGrade = (grade: number) => {
  return grade?.toFixed(2) || '-';
};
</script>

<style scoped>
.report-template-two {
  position: relative;
  border-radius: 8px;
  overflow: hidden;
}

.modern-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: linear-gradient(135deg, #2c3e50 0%, #3498db 100%);
  color: white;
  border-radius: 8px;
  margin-bottom: 30px;
}

.school-logo {
  width: 60px;
  height: auto;
  margin-right: 20px;
}

.header-left {
  display: flex;
  align-items: center;
}

.school-details h1 {
  font-size: 24px;
  margin: 0;
}

.academic-info {
  text-align: right;
}

.period {
  font-size: 20px;
  font-weight: bold;
  display: block;
}

.student-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
}

.student-header {
  margin-bottom: 20px;
}

.student-meta {
  display: flex;
  gap: 20px;
  color: #666;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-top: 20px;
}

.stat-item {
  background: white;
  padding: 15px;
  border-radius: 8px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.stat-label {
  font-size: 14px;
  color: #666;
  display: block;
  margin-bottom: 5px;
}

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #2c3e50;
}

.grades-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
  gap: 20px;
  margin-top: 20px;
}

.grade-card {
  background: white;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.course-name {
  font-weight: bold;
  margin-bottom: 10px;
  color: #2c3e50;
}

.grade-details {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin-bottom: 10px;
}

.grade-item {
  text-align: center;
}

.grade-item .label {
  font-size: 12px;
  color: #666;
  display: block;
}

.grade-item .value {
  font-weight: bold;
  color: #2c3e50;
}

.grade-item .highlight {
  color: #3498db;
}

.appreciation {
  font-size: 14px;
  color: #666;
  font-style: italic;
}

.general-appreciation {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin: 30px 0;
  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
}

.modern-signatures {
  display: flex;
  justify-content: space-between;
  margin-top: 50px;
}

.signature-block {
  text-align: center;
  width: 200px;
}

.signature-space {
  height: 60px;
  border-bottom: 2px solid #ddd;
  margin-bottom: 10px;
}

@media print {
  .report-template-two {
    box-shadow: none;
  }
}
</style> 