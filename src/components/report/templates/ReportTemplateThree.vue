<template>
  <div class="report-template-three">
    <!-- En-tête avec bannière -->
    <div class="report-banner">
      <div class="banner-content">
        <div class="school-brand">
          <img v-if="schoolInfo?.logo?.content && schoolInfo?.logo?.type" :src="`data:${schoolInfo.logo.type};base64,${schoolInfo.logo.content}`" alt="Logo" class="school-logo">
          <div class="school-info">
            <h1>{{ schoolInfo?.name }}</h1>
            <div class="school-contact">
              <span>{{ schoolInfo?.phone }}</span>
              <span>{{ schoolInfo?.email }}</span>
            </div>
          </div>
        </div>
        <div class="report-title">
          <h2>Bulletin de Notes</h2>
          <div class="period-chip">{{ periodLabel }}</div>
          <div class="year-label">{{ currentYear }}</div>
        </div>
      </div>
    </div>

    <!-- Profil étudiant avec carte moderne -->
    <div class="student-profile">
      <div class="profile-card">
        <div class="profile-header">
          <div class="profile-photo">
            <img v-if="student?.photo?.url" :src="student.photo.url" alt="Photo">
            <div v-else class="photo-placeholder">
              {{ studentInitials }}
            </div>
          </div>
          <div class="profile-info">
            <h3>{{ student?.firstname }} {{ student?.lastname }}</h3>
            <div class="info-grid">
              <div class="info-item">
                <i class="fas fa-id-card"></i>
                <span>{{ student?.matricule }}</span>
              </div>
              <div class="info-item">
                <i class="fas fa-graduation-cap"></i>
                <span>{{ student?.grade?.name }}</span>
              </div>
              <div class="info-item" v-if="student?.birthDay">
                <i class="fas fa-birthday-cake"></i>
                <span>{{ formatDate(student.birthDay) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Résumé des performances -->
      <div class="performance-overview">
        <div class="stat-card">
          <div class="stat-value">{{ formatGrade(generalAverage) }}/20</div>
          <div class="stat-label">Moyenne Générale</div>
          <div class="stat-trend" :class="getTrendClass(generalAverage)">
            {{ getTrendLabel(generalAverage) }}
          </div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ rank || '-' }}<small>/{{ totalStudents }}</small></div>
          <div class="stat-label">Rang</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ getSuccessRate() }}%</div>
          <div class="stat-label">Taux de réussite</div>
        </div>
      </div>
    </div>

    <!-- Graphique de performance -->
    <div class="performance-chart">
      <h3>Performance par matière</h3>
      <div class="chart-container">
        <canvas ref="chartRef"></canvas>
      </div>
    </div>

    <!-- Tableau des notes avec design moderne -->
    <div class="grades-section">
      <div v-for="(group, groupName) in groupedGrades" :key="groupName" class="subject-group">
        <h3>{{ groupName }}</h3>
        <div class="grades-grid">
          <div class="grade-card" v-for="grade in group" :key="grade.courseId">
            <div class="grade-header">
              <h4>{{ grade.courseName }}</h4>
              <span class="coefficient">Coef. {{ grade.coefficient }}</span>
            </div>
            <div class="grade-details">
              <div class="assignments">
                <div class="assignment" v-for="(assignment, index) in grade.assignments" :key="index">
                  <small>Dev {{ index + 1 }}</small>
                  <span>{{ formatGrade(assignment) }}</span>
                </div>
              </div>
              <div class="exam-grade">
                <small>Examen</small>
                <span>{{ formatGrade(grade.exam) }}</span>
              </div>
              <div class="final-grade" :class="getGradeClass(grade.average)">
                <small>Moyenne</small>
                <span>{{ formatGrade(grade.average) }}</span>
              </div>
            </div>
            <div class="grade-footer">
              <div class="appreciation">{{ grade.appreciation }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Observations avec design moderne -->
    <div class="feedback-section" v-if="observations || conduct">
      <div class="observation-card" v-if="observations">
        <h3>Observations</h3>
        <p>{{ observations }}</p>
      </div>
      <div class="conduct-card" v-if="conduct">
        <h3>Comportement</h3>
        <div class="conduct-grid">
          <div class="conduct-item">
            <i class="fas fa-user-check"></i>
            <label>Discipline</label>
            <span>{{ conduct.discipline }}</span>
          </div>
          <div class="conduct-item">
            <i class="fas fa-clock"></i>
            <label>Assiduité</label>
            <span>{{ conduct.attendance }}</span>
          </div>
          <div class="conduct-item">
            <i class="fas fa-book-reader"></i>
            <label>Travail</label>
            <span>{{ conduct.workEthic }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Signatures avec style moderne -->
    <div class="signatures-modern">
      <div class="signature-block">
        <div class="signature-title">Direction</div>
        <div class="signature-area"></div>
      </div>
      <div class="signature-block">
        <div class="signature-title">Professeur Principal</div>
        <div class="signature-area"></div>
      </div>
      <div class="signature-block">
        <div class="signature-title">Parents</div>
        <div class="signature-area"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import type { ReportCardData } from '@/types/report';
import Chart from 'chart.js/auto';

const props = defineProps<ReportCardData>();
const chartRef = ref<HTMLCanvasElement | null>(null);
let chart: Chart | null = null;

// Computed properties et méthodes similaires aux autres templates...
const periodLabel = computed(() => {
  const labels: Record<string, string> = {
    trimester1: '1er Trimestre',
    trimester2: '2ème Trimestre',
    trimester3: '3ème Trimestre',
    semester1: '1er Semestre',
    semester2: '2ème Semestre',
    year: 'Année Scolaire'
  };
  return labels[props.period] || props.period;
});

const currentYear = computed(() => {
  const now = new Date();
  return `${now.getFullYear() - 1}/${now.getFullYear()}`;
});

const generalAverage = computed(() => {
  if (!props.grades?.length) return 0;
  
  const totalWeightedGrades = props.grades.reduce((sum, grade) => {
    return sum + (grade.average * grade.coefficient);
  }, 0);
  
  const totalCoefficients = props.grades.reduce((sum, grade) => {
    return sum + grade.coefficient;
  }, 0);
  
  return totalWeightedGrades / totalCoefficients;
});

const groupedGrades = computed(() => {
  // Grouper les notes par catégorie de matière
  const groups: Record<string, any> = {};
  props.grades.forEach(grade => {
    const groupName = grade.courseGroup || 'Autres';
    if (!groups[groupName]) {
      groups[groupName] = {
        name: groupName,
        grades: []
      };
    }
    groups[groupName].grades.push(grade);
  });
  return Object.values(groups);
});

const studentInitials = computed(() => {
  if (!props.student) return '';
  return `${props.student.firstname[0]}${props.student.lastname[0]}`.toUpperCase();
});

// Méthodes
const formatGrade = (grade: number | undefined): string => {
  if (grade === undefined || grade === null) return '-';
  return grade.toFixed(2);
};

const getGradeClass = (grade: number): string => {
  if (grade >= 16) return 'grade-excellent';
  if (grade >= 14) return 'grade-very-good';
  if (grade >= 12) return 'grade-good';
  if (grade >= 10) return 'grade-average';
  return 'grade-poor';
};


const getSuccessRate = () => {
  const passedCourses = props.grades.filter(g => g.average >= 10).length;
  return Math.round((passedCourses / props.grades.length) * 100);
};

const getTrendClass = (average: number) => ({
  'trend-up': average >= 14,
  'trend-stable': average >= 10 && average < 14,
  'trend-down': average < 10
});

const getTrendLabel = (average: number) => {
  if (average >= 14) return '↑ Excellent';
  if (average >= 10) return '→ Satisfaisant';
  return '↓ À améliorer';
};

const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR');
};

const initChart = () => {
  if (!chartRef.value || !props.grades.length) return;

  const ctx = chartRef.value.getContext('2d');
  if (!ctx) return;

  const data = {
    labels: props.grades.map(g => g.courseName),
    datasets: [
      {
        label: 'Notes de l\'élève',
        data: props.grades.map(g => g.average === undefined ? null : g.average),
        borderColor: '#4CAF50',
        backgroundColor: 'rgba(76, 175, 80, 0.2)',
      },
      {
        label: 'Moyenne de classe',
        data: props.grades.map(g => g.classAverage === undefined ? null : g.classAverage),
        borderColor: '#2196F3',
        backgroundColor: 'rgba(33, 150, 243, 0.2)',
      }
    ]
  };

  chart = new Chart(ctx, {
    type: 'radar',
    data,
    options: {
      scales: {
        r: {
          min: 0,
          max: 20,
          ticks: {
            stepSize: 5
          }
        }
      }
    }
  });
};

// Lifecycle hooks
onMounted(() => {
  initChart();
});

watch(() => props.grades, () => {
  if (chart) {
    chart.destroy();
  }
  initChart();
}, { deep: true });
</script>

<style scoped>
/* Styles modernes avec des variables CSS pour la personnalisation */
:root {
  --primary-color: #1e3c72;
  --secondary-color: #2a5298;
  --success-color: #4CAF50;
  --warning-color: #FFC107;
  --danger-color: #F44336;
  --text-color: #2c3e50;
  --border-radius: 10px;
  --card-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.report-template-three {
  background: white;
  font-family: 'Segoe UI', Roboto, sans-serif;
  color: var(--text-color);
  padding: 30px;
}

/* ... Styles spécifiques pour chaque section ... */

@media print {
  .report-template-three {
    padding: 0;
  }
  
  .performance-chart {
    page-break-before: always;
  }
}
</style> 