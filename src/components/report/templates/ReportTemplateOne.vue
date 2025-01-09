<template>
  <div class="report-template-one">
    <!-- En-tête -->
    <header class="report-header">
      <div class="school-info">
        <img 
          v-if="schoolInfo?.logo?.url" 
          :src="schoolInfo.logo.url" 
          alt="Logo" 
          class="school-logo"
        >
        <div class="school-details">
          <h1>{{ schoolInfo?.name }}</h1>
          <p>{{ schoolInfo?.address }}</p>
          <p>{{ schoolInfo?.phone }} - {{ schoolInfo?.email }}</p>
        </div>
      </div>
      <div class="report-title">
        <h2>Bulletin de Notes</h2>
        <h3>{{ periodLabel }}</h3>
        <p>Année scolaire {{ currentYear }}</p>
      </div>
    </header>

    <!-- Informations de l'élève -->
    <section class="student-section">
      <div class="student-photo">
        <img 
          v-if="student?.photo?.url" 
          :src="student.photo.url" 
          alt="Photo"
          class="photo"
        >
        <div v-else class="photo-placeholder">
          {{ studentInitials }}
        </div>
      </div>
    <div class="student-info">
        <div class="info-grid">
          <div class="info-item">
            <label>Nom:</label>
            <span>{{ student?.lastname }}</span>
          </div>
          <div class="info-item">
            <label>Prénom:</label>
            <span>{{ student?.firstname }}</span>
          </div>
          <div class="info-item">
            <label>Matricule:</label>
            <span>{{ student?.matricule }}</span>
          </div>
          <div class="info-item">
            <label>Classe:</label>
            <span>{{ student?.grade?.name }}</span>
          </div>
          <div class="info-item" v-if="student?.birthDay">
            <label>Né(e) le:</label>
            <span>{{ formatDate(student.birthDay) }} à {{ student.birthPlace }}</span>
      </div>
      </div>
    </div>
    </section>

    <!-- Tableau des notes -->
    <section class="grades-section">
      <table class="grades-table">
        <thead>
          <tr>
            <th>Matières</th>
            <th>Coef.</th>
            <th v-for="(_, index) in maxAssignments" :key="index">
              Dev. {{ index + 1 }}
            </th>
            <th>Moy. Dev.</th>
            <th>Exam</th>
            <th>Moy.</th>
            <th>Moy. Classe</th>
            <th>Appréciation</th>
          </tr>
        </thead>
        <tbody>
          <template v-for="(group, groupName) in groupedGrades" :key="groupName">
            <tr class="group-header">
              <td colspan="100%">{{ groupName }}</td>
            </tr>
            <tr 
              v-for="grade in group" 
              :key="grade.courseId"
              :class="getGradeRowClass(grade.average)"
            >
            <td>{{ grade.courseName }}</td>
            <td class="text-center">{{ grade.coefficient }}</td>
              <td 
                v-for="(assignment, index) in grade.assignments" 
                :key="index"
                class="text-center"
              >
                {{ formatGrade(assignment) }}
              </td>
              <td 
                v-for="_ in (maxAssignments - grade.assignments.length)" 
                :key="'empty'+_"
                class="text-center"
              >-</td>
              <td class="text-center">{{ formatGrade(calculateAssignmentAverage(grade.assignments)) }}</td>
              <td class="text-center">{{ formatGrade(grade.exam) }}</td>
              <td class="text-center bold">{{ formatGrade(grade.average) }}</td>
              <td class="text-center">{{ formatGrade(grade.classAverage) }}</td>
            <td>{{ grade.appreciation }}</td>
          </tr>
          </template>
        </tbody>
      </table>
    </section>

    <!-- Résumé -->
    <section class="summary-section">
      <div class="averages">
        <div class="average-item">
          <label>Moyenne Générale:</label>
          <span class="value">{{ formatGrade(generalAverage) }}/20</span>
        </div>
        <div class="average-item" v-if="classGeneralAverage">
          <label>Moyenne Générale de la Classe:</label>
          <span class="value">{{ formatGrade(classGeneralAverage) }}/20</span>
        </div>
        <div class="average-item" v-if="rank && totalStudents">
          <label>Rang:</label>
          <span class="value">{{ rank }}/{{ totalStudents }}</span>
        </div>
    </div>

    <!-- Observations -->
      <div class="observations" v-if="observations">
        <h4>Observations:</h4>
      <p>{{ observations }}</p>
    </div>

      <!-- Comportement -->
      <div class="conduct" v-if="conduct">
        <h4>Comportement:</h4>
        <div class="conduct-grid">
          <div class="conduct-item">
            <label>Discipline:</label>
            <span>{{ conduct.discipline }}</span>
          </div>
          <div class="conduct-item">
            <label>Assiduité:</label>
            <span>{{ conduct.attendance }}</span>
          </div>
          <div class="conduct-item">
            <label>Travail:</label>
            <span>{{ conduct.workEthic }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- Signatures -->
    <section class="signatures-section">
      <div class="signature-block">
        <span>Le Directeur</span>
        <div class="signature-line"></div>
      </div>
      <div class="signature-block">
        <span>Le Professeur Principal</span>
        <div class="signature-line"></div>
      </div>
      <div class="signature-block">
        <span>Les Parents</span>
        <div class="signature-line"></div>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { ReportCardData, GradeInfo } from '@/types/report';

const props = defineProps<ReportCardData>();

// Computed
const studentInitials = computed(() => {
  if (!props.student) return '';
  return `${props.student.firstname[0]}${props.student.lastname[0]}`.toUpperCase();
});

const maxAssignments = computed(() => {
  return Math.max(...props.grades.map(g => g.assignments.length));
});

const groupedGrades = computed(() => {
  const groups: Record<string, GradeInfo[]> = {};
  props.grades.forEach(grade => {
    const group = grade.courseGroup || 'Autres matières';
    if (!groups[group]) groups[group] = [];
    groups[group].push(grade);
  });
  return groups;
});

const currentYear = computed(() => {
  const now = new Date();
  const year = now.getFullYear();
  return `${year-1}-${year}`;
});

const periodLabel = computed(() => {
  const labels: Record<string, string> = {
    trimester1: '1er Trimestre',
    trimester2: '2ème Trimestre',
    trimester3: '3ème Trimestre',
    semester1: '1er Semestre',
    semester2: '2ème Semestre'
  };
  return labels[props.period] || props.period;
});

// Methods
const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR');
};

const formatGrade = (grade: number | null | undefined): string => {
  if (typeof grade !== 'number') return '-';
  return grade.toFixed(2);
};

const calculateAssignmentAverage = (assignments: number[]) => {
  if (!assignments.length) return 0;
  return assignments.reduce((sum, grade) => sum + grade, 0) / assignments.length;
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
.report-template-one {
  background: white;
  padding: 40px;
  font-family: 'Times New Roman', serif;
  color: #333;
}

/* En-tête */
.report-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 30px;
  border-bottom: 2px solid #333;
  padding-bottom: 20px;
}

.school-logo {
  width: 100px;
  height: 100px;
  object-fit: contain;
}

.school-details h1 {
  font-size: 24px;
  margin: 0 0 10px;
}

.school-details p {
  margin: 5px 0;
}

/* Section étudiant */
.student-section {
  display: flex;
  gap: 20px;
  margin-bottom: 30px;
}

.student-photo {
  width: 120px;
  height: 150px;
  border: 1px solid #ddd;
}

.photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  font-size: 24px;
  font-weight: bold;
}

.info-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.info-item label {
  font-weight: bold;
  margin-right: 10px;
}

/* Tableau des notes */
.grades-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 30px;
}

.grades-table th,
.grades-table td {
  border: 1px solid #ddd;
  padding: 8px;
  font-size: 14px;
}

.grades-table th {
  background: #f5f5f5;
  font-weight: bold;
}

.group-header {
  background: #eee;
  font-weight: bold;
}

.text-center {
  text-align: center;
}

.bold {
  font-weight: bold;
}

/* Classes pour les moyennes */
.excellent { background-color: #e8f5e9; }
.very-good { background-color: #e3f2fd; }
.good { background-color: #fff3e0; }
.average { background-color: #fbe9e7; }
.poor { background-color: #ffebee; }

/* Résumé */
.summary-section {
  margin: 30px 0;
}

.averages {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  margin-bottom: 20px;
}

.average-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.average-item .value {
  font-weight: bold;
  font-size: 18px;
}

/* Signatures */
.signatures-section {
  display: flex;
  justify-content: space-between;
  margin-top: 50px;
}

.signature-block {
  text-align: center;
  width: 200px;
}

.signature-line {
  margin-top: 50px;
  border-top: 1px solid #333;
}

@media print {
  .report-template-one {
    padding: 0;
  }
}
</style> 