<template>
  <div class="report-template-three" :style="reportStyle">
    <!-- En-tête avec bannière -->
    <div class="banner-header">
      <img v-if="schoolInfo?.logo?.url" :src="schoolInfo.logo.url" class="school-logo" alt="Logo" />
      <div class="header-content">
        <div class="school-info">
          <h1>{{ schoolInfo?.name }}</h1>
          <p>{{ schoolInfo?.address }} | Tel: {{ schoolInfo?.phone }}</p>
        </div>
        <div class="report-info">
          <h2>Bulletin de Notes Détaillé</h2>
          <p>{{ report?.period }} | {{ report?.schoolYear }}</p>
        </div>
      </div>
    </div>

    <!-- Section profil étudiant -->
    <div class="student-profile">
      <div class="profile-header">
        <div class="student-info">
          <h3>{{ report?.student.firstname }} {{ report?.student.lastname }}</h3>
          <div class="info-details">
            <span><Icon icon="mdi:identifier" /> {{ report?.student.matricule }}</span>
            <span><Icon icon="mdi:school" /> {{ report?.student.grade.name }}</span>
          </div>
        </div>
        <div class="performance-summary">
          <div class="chart-container">
            <el-progress 
              type="dashboard"
              :percentage="(report?.average || 0) * 5"
              :stroke-width="8"
              :width="80"
              :format="() => `${formatGrade(report?.average)}/20`"
            />
            <span class="chart-label">Moyenne Générale</span>
          </div>
          <div class="rank-display">
            <span class="rank-number">{{ report?.rank }}</span>
            <span class="rank-total">/{{ report?.totalStudents }}</span>
            <span class="rank-label">Rang</span>
          </div>
        </div>
      </div>

      <!-- Graphique de progression -->
      <div class="progress-chart">
        <h4>Répartition des Notes</h4>
        <div class="grade-distribution">
          <div v-for="grade in gradeDistribution" :key="grade.range" class="distribution-bar">
            <div class="bar-label">{{ grade.range }}</div>
            <el-progress 
              :percentage="grade.percentage"
              :stroke-width="18"
              :color="grade.color"
            />
            <div class="bar-count">{{ grade.count }}</div>
          </div>
        </div>
      </div>
    </div>

    <!-- Tableau détaillé des notes -->
    <div class="detailed-grades">
      <h4>Résultats Détaillés par Matière</h4>
      <el-table :data="report?.grades" border style="width: 100%">
        <el-table-column prop="courseName" label="Matière" min-width="140" />
        <el-table-column prop="coefficient" label="Coef." width="80" align="center" />
        <el-table-column label="Note" width="100" align="center">
          <template #default="{ row }">
            <span :class="getGradeClass(row.grade)">
              {{ formatGrade(row.grade) }}/20
            </span>
          </template>
        </el-table-column>
        <el-table-column label="Moy. Coef." width="100" align="center">
          <template #default="{ row }">
            {{ formatGrade(row.grade * row.coefficient) }}
          </template>
        </el-table-column>
        <el-table-column prop="appreciation" label="Appréciation" min-width="200" show-overflow-tooltip />
      </el-table>
    </div>

    <!-- Graphique radar des compétences -->
   <!-- Skills Radar -->
<div class="skills-radar">
  <h4>Analyse des Compétences</h4>
  <div class="radar-container">
    <ECharts :options="radarOptions" style="height: 300px;" />
  </div>
</div>


    <!-- Appréciation et conclusion -->
    <div class="conclusion-section">
      <div class="appreciation-box">
        <h4>Appréciation Générale</h4>
        <p>{{ report?.generalAppreciation }}</p>
      </div>
      
      <div class="signature-section">
        <div class="signature-item">
          <div class="signature-line"></div>
          <span>Le Directeur</span>
        </div>
        <div class="signature-item">
          <div class="signature-line"></div>
          <span>Le Parent</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from 'vue';
import ECharts from 'vue-echarts';
import { use } from 'echarts/core';
import {
  RadarChart, // Import the Radar Chart
} from 'echarts/charts';
import {
  TooltipComponent, LegendComponent, // Tooltip and Legend Components
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

// Use the required ECharts modules
use([RadarChart, TooltipComponent, LegendComponent, CanvasRenderer]);

import { Icon } from '@iconify/vue';
import type { ReportCard } from '@/types/report';

const props = defineProps<{
  report: ReportCard;
  schoolInfo: any;
}>();


// Function to format grades
const formatGrade = (grade: number) => {
  return grade?.toFixed(2) || '-';
};
// Radar chart options
const radarOptions = computed(() => {
  const grades = props.report?.grades || [];
  return {
    tooltip: {
      trigger: 'item',
    },
    legend: {
      data: ['Notes'],
    },
    radar: {
      indicator: grades.map((grade) => ({
        name: grade.courseName,
        max: 20,
      })),
    },
    series: [
      {
        name: 'Analyse des Notes',
        type: 'radar',
        data: [
          {
            value: grades.map((grade) => grade.grade || 0),
            name: 'Notes',
          },
        ],
      },
    ],
  };
});
</script>


<style scoped>
/* Styles du template... */
.report-template-three {
  position: relative;
  border-radius: 12px;
  overflow: hidden;
}

.banner-header {
  background: linear-gradient(135deg, #1a237e 0%, #0d47a1 100%);
  color: white;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 20px;
  border-radius: 8px;
}

.school-logo {
  width: 80px;
  height: auto;
}

.header-content {
  flex: 1;
}

.student-profile {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin: 20px 0;
}

.profile-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.performance-summary {
  display: flex;
  gap: 30px;
  align-items: center;
}

.chart-container {
  text-align: center;
}

.chart-label {
  display: block;
  margin-top: 5px;
  font-size: 12px;
  color: #666;
}

.rank-display {
  text-align: center;
}

.rank-number {
  font-size: 36px;
  font-weight: bold;
  color: #1a237e;
}

.rank-total {
  font-size: 18px;
  color: #666;
}

.rank-label {
  display: block;
  font-size: 12px;
  color: #666;
}

.grade-distribution {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
  margin-top: 15px;
}

.distribution-bar {
  text-align: center;
}

.bar-label, .bar-count {
  font-size: 12px;
  color: #666;
  margin: 5px 0;
}

.detailed-grades {
  margin: 30px 0;
}

.grade-excellent { color: #409eff; font-weight: bold; }
.grade-good { color: #13ce66; font-weight: bold; }
.grade-average { color: #f7ba2a; font-weight: bold; }
.grade-warning { color: #ff4949; font-weight: bold; }

.skills-radar {
  margin: 30px 0;
}
.radar-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
}


.radar-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
}

.conclusion-section {
  margin-top: 30px;
}

.appreciation-box {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
}

.signature-section {
  display: flex;
  justify-content: space-between;
  margin-top: 50px;
}

.signature-item {
  text-align: center;
  width: 200px;
}

.signature-line {
  border-top: 2px solid #ddd;
  margin-bottom: 10px;
}

@media print {
  .report-template-three {
    box-shadow: none;
  }
}
</style> 