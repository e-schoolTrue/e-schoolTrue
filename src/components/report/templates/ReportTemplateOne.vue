<template>
  <div class="report-template-one">
    <!-- En-tête -->
    <div class="report-header">
      <div class="school-info">
        <img v-if="schoolInfo?.logo?.url" :src="schoolInfo.logo.url" alt="Logo" class="school-logo">
        <div class="school-details">
          <h1>{{ schoolInfo?.name }}</h1>
          <p>{{ schoolInfo?.address }}</p>
          <p>{{ schoolInfo?.phone }}</p>
        </div>
      </div>
      <div class="report-title">
        <h2>Bulletin de Notes</h2>
        <h3>{{ periodLabel }}</h3>
        <p>Année scolaire {{ currentYear }}</p>
      </div>
    </div>

    <!-- Informations de l'élève -->
    <div class="student-info">
      <div class="student-details">
        <table>
          <tr>
            <td><strong>Nom:</strong></td>
            <td>{{ student?.lastname }}</td>
            <td><strong>Prénom:</strong></td>
            <td>{{ student?.firstname }}</td>
          </tr>
          <tr>
            <td><strong>Matricule:</strong></td>
            <td>{{ student?.matricule }}</td>
            <td><strong>Classe:</strong></td>
            <td>{{ student?.grade?.name }}</td>
          </tr>
        </table>
      </div>
      <div class="student-photo">
        <img v-if="student?.photo?.url" :src="student.photo.url" alt="Photo">
      </div>
    </div>

    <!-- Tableau des notes -->
    <div class="grades-table">
      <table>
        <thead>
          <tr>
            <th>Matière</th>
            <th>Coefficient</th>
            <th>Note</th>
            <th>Moyenne</th>
            <th>Appréciation</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="grade in grades" :key="grade.courseId">
            <td>{{ grade.courseName }}</td>
            <td class="text-center">{{ grade.coefficient }}</td>
            <td class="text-center">{{ formatGrade(grade.grade) }}</td>
            <td class="text-center">{{ formatGrade(grade.average) }}</td>
            <td>{{ grade.appreciation }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="total-row">
            <td colspan="2"><strong>Moyenne Générale</strong></td>
            <td class="text-center" colspan="2">
              <strong>{{ formatGrade(generalAverage) }}</strong>
            </td>
            <td>
              <strong>{{ getGeneralAppreciation() }}</strong>
            </td>
          </tr>
        </tfoot>
      </table>
    </div>

    <!-- Observations -->
    <div class="observations">
      <h4>Observations du conseil de classe</h4>
      <p>{{ observations }}</p>
    </div>

    <!-- Signatures -->
    <div class="signatures">
      <div class="signature-block">
        <p>Le Directeur</p>
        <div class="signature-line"></div>
      </div>
      <div class="signature-block">
        <p>Le Professeur Principal</p>
        <div class="signature-line"></div>
      </div>
      <div class="signature-block">
        <p>Les Parents</p>
        <div class="signature-line"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  student: any;
  grades: any[];
  period: string;
  config: any;
  schoolInfo?: any;
}>();

// Computed
const currentYear = computed(() => {
  const now = new Date();
  return `${now.getFullYear() - 1}/${now.getFullYear()}`;
});

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
</script>

<style scoped>
.report-template-one {
  padding: 20px;
  max-width: 210mm;
  margin: 0 auto;
  background: white;
}

.report-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 30px;
}

.school-info {
  display: flex;
  gap: 20px;
}

.school-logo {
  width: 80px;
  height: 80px;
  object-fit: contain;
}

.report-title {
  text-align: center;
}

.student-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 30px;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.student-photo img {
  width: 100px;
  height: 120px;
  object-fit: cover;
  border-radius: 4px;
}

.grades-table table {
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
  background-color: #f5f7fa;
}

.text-center {
  text-align: center;
}

.total-row {
  background-color: #f5f7fa;
}

.observations {
  margin-bottom: 30px;
  padding: 15px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.signatures {
  display: flex;
  justify-content: space-between;
  margin-top: 50px;
}

.signature-block {
  text-align: center;
  flex: 1;
}

.signature-line {
  width: 80%;
  margin: 20px auto;
  border-bottom: 1px solid #000;
}

@media print {
  .report-template-one {
    padding: 0;
  }
}
</style> 