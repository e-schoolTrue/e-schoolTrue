<template>
  <div class="report-template-two">
    <!-- En-tête moderne -->
    <header class="modern-header">
      <div class="header-content">
        <div class="school-brand">
        <img v-if="schoolInfo?.logo?.url" :src="schoolInfo.logo.url" alt="Logo" class="school-logo">
          <div class="school-info">
          <h1>{{ schoolInfo?.name }}</h1>
            <p class="subtitle">{{ schoolInfo?.address }}</p>
        </div>
      </div>
        <div class="report-meta">
          <div class="period-badge">{{ periodLabel }}</div>
          <div class="academic-year">{{ currentYear }}</div>
        </div>
    </div>
    </header>

    <!-- Carte d'identité de l'élève -->
    <div class="student-card">
      <div class="photo-section">
        <img v-if="student?.photo?.url" :src="student.photo.url" alt="Photo" class="student-photo">
        <div v-else class="photo-placeholder">{{ studentInitials }}</div>
      </div>
      <div class="student-details">
        <div class="detail-row">
          <div class="detail-item">
            <label>Nom</label>
            <span>{{ student?.lastname }}</span>
          </div>
          <div class="detail-item">
            <label>Prénom</label>
            <span>{{ student?.firstname }}</span>
          </div>
        </div>
        <div class="detail-row">
          <div class="detail-item">
            <label>Matricule</label>
            <span>{{ student?.matricule }}</span>
        </div>
          <div class="detail-item">
            <label>Classe</label>
            <span>{{ student?.grade?.name }}</span>
        </div>
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
        <div class="summary-value">{{ rank || '-' }}/{{ totalStudents || '-' }}</div>
        <div class="summary-label">Rang</div>
      </div>
      <div class="summary-card">
        <div class="summary-value">{{ getGeneralAppreciation() }}</div>
        <div class="summary-label">Mention</div>
      </div>
    </div>

    <!-- Notes par groupe de matières -->
    <div class="grades-groups">
      <div v-for="(group, groupName) in groupedGrades" :key="groupName" class="grade-group">
        <h3>{{ groupName }}</h3>
        <div class="grades-table">
          <div class="table-header">
            <div class="col-subject">Matière</div>
            <div class="col-coef">Coef</div>
            <div class="col-assignments">
              <div v-for="i in maxAssignments" :key="i">Dev {{ i }}</div>
            </div>
            <div class="col-exam">Exam</div>
            <div class="col-average">Moyenne</div>
            <div class="col-appreciation">Appréciation</div>
          </div>
          <div 
            v-for="grade in group" 
            :key="grade.courseId" 
            class="grade-row"
            :class="getGradeRowClass(grade.average)"
          >
            <div class="col-subject">{{ grade.courseName }}</div>
            <div class="col-coef">{{ grade.coefficient }}</div>
            <div class="col-assignments">
              <div 
                v-for="(assignment, index) in grade.assignments" 
                :key="index"
                class="assignment-grade"
              >
                {{ formatGrade(assignment) }}
              </div>
            </div>
            <div class="col-average">{{ formatGrade(grade.average) }}</div>
            <div class="col-appreciation">{{ grade.appreciation }}</div>
        </div>
    </div>
      </div>
    </div>

    <!-- Observations et comportement -->
    <div class="feedback-section">
      <div class="observations" v-if="observations">
        <h3>Observations du conseil de classe</h3>
        <p>{{ observations }}</p>
      </div>
      <div class="conduct-grid" v-if="conduct">
        <div class="conduct-item">
          <label>Discipline</label>
          <span>{{ conduct.discipline }}</span>
        </div>
        <div class="conduct-item">
          <label>Assiduité</label>
          <span>{{ conduct.attendance }}</span>
        </div>
        <div class="conduct-item">
          <label>Travail</label>
          <span>{{ conduct.workEthic }}</span>
        </div>
      </div>
      </div>

    <!-- Signatures -->
      <div class="signatures">
        <div class="signature-block">
        <span>Le Directeur</span>
        <div class="signature-area"></div>
        </div>
        <div class="signature-block">
        <span>Le Professeur Principal</span>
        <div class="signature-area"></div>
        </div>
        <div class="signature-block">
        <span>Les Parents</span>
        <div class="signature-area"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ReportCardData } from '@/types/report';

const props = defineProps<ReportCardData>();

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
    return sum + (grade.average * grade.coefficient);
  }, 0);
  
  const totalCoefficients = props.grades.reduce((sum, grade) => {
    return sum + grade.coefficient;
  }, 0);
  
  return totalWeightedGrades / totalCoefficients;
});

const currentYear = computed(() => {
  const now = new Date();
  const year = now.getFullYear();
  return `${year-1}/${year}`;
});

const studentInitials = computed(() => {
  if (!props.student) return '';
  return `${props.student.firstname[0]}${props.student.lastname[0]}`.toUpperCase();
});

const maxAssignments = computed(() => {
  return Math.max(...props.grades.map(g => g.assignments.length), 0);
});

// Données pour le graphique

// Méthodes
const formatGrade = (grade: number): string => {
  return grade.toFixed(2);
};

const getGeneralAppreciation = () => {
  const avg = props.generalAverage;
  if (avg >= 16) return 'Excellent';
  if (avg >= 14) return 'Très Bien';
  if (avg >= 12) return 'Bien';
  if (avg >= 10) return 'Assez Bien';
  return 'Insuffisant';
};

const getGradeRowClass = (average: number) => ({
  'excellent': average >= 16,
  'very-good': average >= 14,
  'good': average >= 12,
  'average': average >= 10,
  'poor': average < 10
});

</script>

<style scoped>
.report-template-two {
  background: white;
  font-family: 'Segoe UI', Roboto, sans-serif;
  padding: 30px;
  color: #2c3e50;
}

.modern-header {
  background: linear-gradient(135deg, #1e3c72 0%, #2a5298 100%);
  color: white;
  padding: 30px;
  border-radius: 10px;
  margin-bottom: 30px;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.school-brand {
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

.period-badge {
  background: rgba(255, 255, 255, 0.2);
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
}

.student-card {
  background: #f8f9fa;
  border-radius: 10px;
  padding: 20px;
  display: flex;
  gap: 30px;
  margin-bottom: 30px;
}

.photo-section {
  width: 150px;
  height: 180px;
  overflow: hidden;
  border-radius: 8px;
}

.student-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-placeholder {
  width: 100%;
  height: 100%;
  background: #e9ecef;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: bold;
  color: #adb5bd;
}

.performance-summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 30px;
}

.summary-card {
  background: white;
  border-radius: 10px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.summary-value {
  font-size: 32px;
  font-weight: bold;
  color: #1e3c72;
  margin-bottom: 8px;
}

.grades-groups {
  display: flex;
  flex-direction: column;
  gap: 30px;
}

.grade-group {
  background: white;
  border-radius: 10px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.grade-group h3 {
  color: #1e3c72;
  margin-bottom: 20px;
  padding-bottom: 10px;
  border-bottom: 2px solid #e9ecef;
}

/* ... Autres styles spécifiques ... */

@media print {
  .report-template-two {
    padding: 0;
  }
}
</style> 