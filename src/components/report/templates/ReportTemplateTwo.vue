<template>
  <div class="report-template-two">
    <!-- En-tête avec bannière -->
    <div class="report-banner">
      <div class="banner-content">
        <img v-if="schoolInfo?.logo?.url" :src="schoolInfo.logo.url" alt="Logo" class="school-logo">
        <div class="banner-text">
          <h1>{{ schoolInfo?.name }}</h1>
          <h2>Bulletin de Notes - {{ periodLabel }}</h2>
        </div>
      </div>
    </div>

    <!-- Carte d'information de l'élève -->
    <div class="student-card">
      <div class="student-photo">
        <img v-if="student?.photo?.url" :src="student.photo.url" alt="Photo">
        <div v-else class="photo-placeholder">
          <Icon icon="mdi:account" />
        </div>
      </div>
      <div class="student-details">
        <div class="detail-row">
          <span class="label">Nom:</span>
          <span class="value">{{ student?.lastname }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Prénom:</span>
          <span class="value">{{ student?.firstname }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Matricule:</span>
          <span class="value">{{ student?.matricule }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Classe:</span>
          <span class="value">{{ student?.grade?.name }}</span>
        </div>
      </div>
    </div>

    <!-- Résumé des performances -->
    <div class="performance-summary">
      <div class="summary-card">
        <div class="summary-value">{{ formatGrade(generalAverage) }}</div>
        <div class="summary-label">Moyenne Générale</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">{{ getGeneralAppreciation() }}</div>
        <div class="summary-label">Mention</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">{{ rank }}/{{ totalStudents }}</div>
        <div class="summary-label">Rang</div>
      </div>
    </div>

    <!-- Tableau des notes avec groupes de matières -->
    <div class="grades-section">
      <template v-for="(group) in groupedGrades" :key="index">
        <div class="subject-group">
          <h3>{{ group.name }}</h3>
          <table>
            <thead>
              <tr>
                <th>Matière</th>
                <th>Coef.</th>
                <th>Note</th>
                <th>Moy. Classe</th>
                <th>Appréciation</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="grade in group.grades" :key="grade.courseId">
                <td>{{ grade.courseName }}</td>
                <td class="text-center">{{ grade.coefficient }}</td>
                <td class="text-center grade-cell" :class="getGradeClass(grade.grade)">
                  {{ formatGrade(grade.grade) }}
                </td>
                <td class="text-center">{{ formatGrade(grade.classAverage) }}</td>
                <td>{{ grade.appreciation }}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </template>
    </div>

    <!-- Graphique des performances -->
    <div class="performance-chart">
      <h3>Évolution des moyennes</h3>
      <div class="chart-container">
        <PerformanceChart v-bind="chartData" />
      </div>
    </div>

    <!-- Observations et signatures -->
    <div class="footer-section">
      <div class="observations">
        <h3>Observations du conseil de classe</h3>
        <p>{{ observations }}</p>
      </div>

      <div class="signatures">
        <div class="signature-block">
          <div class="signature-title">Le Directeur</div>
          <div class="signature-box"></div>
        </div>
        <div class="signature-block">
          <div class="signature-title">Le Professeur Principal</div>
          <div class="signature-box"></div>
        </div>
        <div class="signature-block">
          <div class="signature-title">Les Parents</div>
          <div class="signature-box"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import PerformanceChart from '../charts/PerformanceChart.vue';

const props = defineProps<{
  student: any;
  grades: any[];
  period: string;
  config: any;
  schoolInfo?: any;
  rank?: number;
  totalStudents?: number;
  observations?: string;
}>();

// Computed properties
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

const generalAverage = computed(() => {
  if (!props.grades?.length) return 0;
  
  const totalWeightedGrades = props.grades.reduce((sum, grade) => {
    return sum + (grade.grade * grade.coefficient);
  }, 0);
  
  const totalCoefficients = props.grades.reduce((sum, grade) => {
    return sum + grade.coefficient;
  }, 0);
  
  return totalWeightedGrades / totalCoefficients;
});

// Données pour le graphique
const chartData = computed(() => {
  return {
    studentGrades: props.grades.map(g => g.grade),
    classAverages: props.grades.map(g => g.classAverage),
    labels: props.grades.map(g => g.courseName)
  };
});

// Méthodes
const formatGrade = (grade: number): string => {
  return grade.toFixed(2);
};

const getGeneralAppreciation = () => {
  const average = generalAverage.value;
  if (average >= 16) return 'Excellent';
  if (average >= 14) return 'Très Bien';
  if (average >= 12) return 'Bien';
  if (average >= 10) return 'Assez Bien';
  return 'Insuffisant';
};

const getGradeClass = (grade: number) => {
  if (grade >= 16) return 'grade-excellent';
  if (grade >= 14) return 'grade-very-good';
  if (grade >= 12) return 'grade-good';
  if (grade >= 10) return 'grade-average';
  return 'grade-poor';
};
</script>

<style scoped>
.report-template-two {
  background: white;
  max-width: 210mm;
  margin: 0 auto;
  padding: 0;
  font-family: 'Segoe UI', Roboto, sans-serif;
}

.report-banner {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  color: white;
  padding: 20px;
  margin-bottom: 30px;
}

.banner-content {
  display: flex;
  align-items: center;
  gap: 20px;
}

.school-logo {
  width: 80px;
  height: 80px;
  object-fit: contain;
  background: white;
  border-radius: 50%;
  padding: 5px;
}

.banner-text h1 {
  margin: 0;
  font-size: 24px;
}

.banner-text h2 {
  margin: 5px 0 0;
  font-size: 18px;
  font-weight: normal;
}

.student-card {
  display: flex;
  gap: 20px;
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin: 0 20px 30px;
}

.student-photo img {
  width: 120px;
  height: 150px;
  object-fit: cover;
  border-radius: 4px;
}

.student-details {
  flex: 1;
}

.detail-row {
  display: flex;
  margin-bottom: 10px;
}

.label {
  font-weight: 600;
  width: 100px;
}

.performance-summary {
  display: flex;
  justify-content: space-around;
  margin: 0 20px 30px;
  gap: 20px;
}

.summary-card {
  flex: 1;
  text-align: center;
  padding: 15px;
  background: #fff;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.summary-value {
  font-size: 24px;
  font-weight: bold;
  color: #2a5298;
}

.summary-label {
  font-size: 14px;
  color: #666;
  margin-top: 5px;
}

.grades-section {
  padding: 0 20px;
}

.subject-group {
  margin-bottom: 30px;
}

.subject-group h3 {
  color: #2a5298;
  border-bottom: 2px solid #2a5298;
  padding-bottom: 5px;
  margin-bottom: 15px;
}

table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
}

th, td {
  border: 1px solid #ddd;
  padding: 8px;
}

th {
  background: #f8f9fa;
  font-weight: 600;
}

.grade-cell {
  font-weight: bold;
}

.grade-excellent { color: #28a745; }
.grade-very-good { color: #17a2b8; }
.grade-good { color: #007bff; }
.grade-average { color: #ffc107; }
.grade-poor { color: #dc3545; }

.footer-section {
  padding: 20px;
}

.observations {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 30px;
}

.signatures {
  display: flex;
  justify-content: space-between;
  gap: 20px;
  margin-top: 40px;
}

.signature-block {
  flex: 1;
  text-align: center;
}

.signature-title {
  font-weight: 600;
  margin-bottom: 10px;
}

.signature-box {
  height: 80px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

@media print {
  .report-template-two {
    padding: 0;
  }
}
</style> 