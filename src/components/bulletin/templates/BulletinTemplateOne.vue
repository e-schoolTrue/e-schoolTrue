<template>
  <div class="bulletin-template-one" :style="containerStyle">
    <!-- En-tête -->
    <header class="header">
      <div class="school-logo" v-if="schoolInfo?.logo?.url">
        <img :src="schoolInfo.logo.url" alt="Logo École" />
      </div>
      <div class="school-info">
        <h1 :style="{ color: options.primaryColor }">{{ schoolInfo?.name }}</h1>
        <p>{{ schoolInfo?.address }}</p>
        <p v-if="schoolInfo?.email">Email: {{ schoolInfo.email }}</p>
        <p v-if="schoolInfo?.phone">Tél: {{ schoolInfo.phone }}</p>
      </div>
      <div class="academic-year">
        <h3>Année Scolaire</h3>
        <p>{{ currentYear }}</p>
        <h4 :style="{ color: options.secondaryColor }">{{ periodLabel }}</h4>
      </div>
    </header>

    <!-- Info Élève -->
    <section class="student-info-section" :style="{ borderColor: options.primaryColor }">
      <div class="student-photo" v-if="student?.photo?.url">
        <img :src="student.photo.url" alt="Photo Élève" />
      </div>
      <div class="student-details">
        <div class="detail-row">
          <span class="label">Nom & Prénom:</span>
          <span class="value">{{ student?.firstname }} {{ student?.lastname }}</span>
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
    </section>

    <!-- Tableau des notes -->
    <section class="grades-section">
      <table class="grades-table">
        <thead>
          <tr :style="{ backgroundColor: options.primaryColor, color: '#fff' }">
            <th>Matière</th>
            <th class="text-center">Coef.</th>
            <th class="text-center">Moyenne / 20</th>
            <th class="text-center">Note Pondérée</th>
            <th class="text-center">Appréciation</th>
            <th>Professeur</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="grade in processedGrades" :key="grade.courseId">
            <td class="course-name">{{ grade.courseName }}</td>
            <td class="text-center">{{ grade.coefficient }}</td>
            <td class="text-center font-bold" :class="getGradeColorClass(grade.average)">
              {{ formatNumber(grade.average) }}
            </td>
            <td class="text-center font-bold">
              {{ formatNumber(grade.weightedValue) }}
            </td>
            <td class="text-center text-sm italic">{{ grade.appreciation || getAppreciation(grade.average) }}</td>
            <td class="text-sm">{{ grade.professorName || '-' }}</td>
          </tr>
        </tbody>
        <tfoot>
          <tr class="total-row" :style="{ backgroundColor: options.secondaryColor + '20' }">
            <td class="font-bold">TOTAL</td>
            <td class="text-center font-bold">{{ totalCoefficients }}</td>
            <td></td>
            <td class="text-center font-bold">{{ formatNumber(totalWeightedPoints) }}</td>
            <td colspan="2"></td>
          </tr>
          <tr class="average-row" :style="{ backgroundColor: options.primaryColor + '10' }">
            <td colspan="2" class="text-right font-bold text-lg">MOYENNE GÉNÉRALE</td>
            <td colspan="4" class="text-left font-bold text-xl" :style="{ color: options.primaryColor }">
              {{ formatNumber(generalAverage) }} / 20
            </td>
          </tr>
        </tfoot>
      </table>
    </section>

    <!-- Évaluations du comportement / Stats -->
    <section class="footer-stats">
      <div class="stat-box">
        <h4 :style="{ color: options.secondaryColor }">Classement</h4>
        <p class="stat-value">{{ rank ? rank + (rank === 1 ? 'er' : 'ème') : '-' }} / {{ totalStudents }}</p>
      </div>
      <div class="stat-box">
        <h4 :style="{ color: options.secondaryColor }">Moyenne Classe</h4>
        <p class="stat-value">{{ formatNumber(classAverage) }}</p>
      </div>
      <div class="stat-box">
        <h4 :style="{ color: options.secondaryColor }">Absences</h4>
        <p class="stat-value">{{ absences }} h</p>
      </div>
    </section>

    <!-- Signatures -->
    <footer class="signatures">
      <div class="signature-box">
        <p>Le Professeur Principal</p>
        <div class="signature-space"></div>
      </div>
      <div class="signature-box">
        <p>Le Directeur</p>
        <div class="signature-space"></div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  student: any;
  schoolInfo: any;
  grades: any[];
  period: string;
  options?: {
    primaryColor: string;
    secondaryColor: string;
  };
  currentYear?: string;
  rank?: number;
  totalStudents?: number;
  classAverage?: number;
  absences?: number;
}

const props = withDefaults(defineProps<Props>(), {
  options: () => ({
    primaryColor: '#2c3e50',
    secondaryColor: '#3498db'
  }),
  currentYear: new Date().getFullYear().toString() + '-' + (new Date().getFullYear() + 1).toString(),
  grades: () => [],
  rank: 0,
  totalStudents: 0,
  classAverage: 0,
  absences: 0
});

const containerStyle = computed(() => ({
  fontFamily: "'Inter', sans-serif"
}));

const periodLabel = computed(() => {
  const map: Record<string, string> = {
    'S1': '1er Semestre',
    'S2': '2ème Semestre',
    'T1': '1er Trimestre',
    'T2': '2ème Trimestre',
    'T3': '3ème Trimestre'
  };
  return map[props.period] || props.period;
});

const processedGrades = computed(() => {
  return props.grades.map(g => ({
    ...g,
    weightedValue: g.average * (g.coefficient || 1)
  }));
});

const totalCoefficients = computed(() => {
  return processedGrades.value.reduce((sum, g) => sum + (g.coefficient || 1), 0);
});

const totalWeightedPoints = computed(() => {
  return processedGrades.value.reduce((sum, g) => sum + g.weightedValue, 0);
});

const generalAverage = computed(() => {
  if (totalCoefficients.value === 0) return 0;
  return totalWeightedPoints.value / totalCoefficients.value;
});

const formatNumber = (num: number) => {
  return num ? num.toFixed(2) : '0.00';
};


const getGradeColorClass = (grade: number) => {
  if (grade < 10) return 'text-red-600';
  if (grade >= 16) return 'text-green-600';
  return 'text-gray-800';
};

const getAppreciation = (note: number) => {
  if (note < 5) return "Très Faible";
  if (note < 8) return "Faible";
  if (note < 10) return "Insuffisant";
  if (note < 12) return "Passable";
  if (note < 14) return "Assez Bien";
  if (note < 16) return "Bien";
  if (note < 18) return "Très Bien";
  return "Excellent";
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

.bulletin-template-one {
  width: 210mm;
  min-height: 297mm;
  padding: 15mm;
  background: white;
  box-sizing: border-box;
  color: #333;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
  border-bottom: 2px solid #eee;
  padding-bottom: 15px;
}

.school-logo img {
  max-width: 100px;
  max-height: 100px;
}

.school-info h1 {
  font-size: 24px;
  margin: 0 0 5px;
}

.school-info p {
  margin: 2px 0;
  font-size: 12px;
  color: #666;
}

.academic-year {
  text-align: right;
}

.academic-year h2 {
  font-size: 14px;
  color: #666;
  margin: 0;
}

.academic-year h3 {
  font-size: 18px;
  margin: 5px 0 0;
}

.student-info-section {
  display: flex;
  gap: 20px;
  background-color: #f8f9fa;
  padding: 15px;
  border-left: 5px solid;
  margin-bottom: 20px;
  border-radius: 4px;
}

.student-photo img {
  width: 80px;
  height: 80px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #ddd;
}

.student-details {
  flex: 1;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.detail-row {
  display: flex;
  flex-direction: column;
}

.detail-row .label {
  font-size: 11px;
  color: #888;
  text-transform: uppercase;
}

.detail-row .value {
  font-size: 14px;
  font-weight: 600;
}

.grades-table {
  width: 100%;
  border-collapse: collapse;
  margin-bottom: 20px;
}

.grades-table th,
.grades-table td {
  padding: 8px 10px;
  border: 1px solid #e0e0e0;
  font-size: 13px;
}

.grades-table th {
  text-transform: uppercase;
  font-size: 11px;
  letter-spacing: 0.5px;
}

.grade-row:nth-child(even) {
  background-color: #fafafa;
}

.text-center { text-align: center; }
.text-right { text-align: right; }
.text-left { text-align: left; }
.font-bold { font-weight: bold; }
.text-green-600 { color: #16a34a; }
.text-red-600 { color: #dc2626; }
.text-sm { font-size: 11px; }
.italic { font-style: italic; }

.footer-stats {
  display: flex;
  justify-content: space-between;
  margin-bottom: 30px;
  gap: 15px;
}

.stat-box {
  flex: 1;
  background: #f8f9fa;
  padding: 15px;
  text-align: center;
  border-radius: 4px;
  border: 1px solid #eee;
}

.stat-box h4 {
  margin: 0 0 5px;
  font-size: 12px;
  text-transform: uppercase;
}

.stat-value {
  margin: 0;
  font-size: 20px;
  font-weight: bold;
}

.signatures {
  display: flex;
  justify-content: space-between;
  margin-top: 40px;
}

.signature-box {
  width: 250px;
  text-align: center;
}

.signature-box p {
  font-weight: bold;
  border-bottom: 1px solid #000;
  padding-bottom: 5px;
  margin-bottom: 15px;
}

.signature-space {
  height: 80px;
}

@media print {
  .bulletin-template-one {
    width: 100%;
    height: 100%;
    padding: 0;
  }
}
</style>
