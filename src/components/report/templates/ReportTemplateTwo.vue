<template>
  <div class="report-card">
    <!-- En-tête avec logos et infos ministère -->
    <div class="header">
      <div class="ministry-section">
        <div class="ministry-logo"></div>
        <div class="ministry-info">
          <h4>{{ getCountryInfo.ministry }}</h4>
          <p v-if="getCountryInfo.motto">{{ getCountryInfo.motto }}</p>
          <p>{{ getCountryInfo.country }}</p>
          <p>{{ schoolInfo?.name }} | Téléphone: {{ schoolInfo?.phone }}</p>
        </div>
      </div>
      <div class="school-section">
        <div class="school-logo">
          <img v-if="schoolInfo?.logo?.url" :src="schoolInfo.logo.url" alt="Logo">
        </div>
        <div class="academic-year">
          Année Scolaire: 2023-2024
        </div>
      </div>
    </div>

    <!-- Titre du bulletin -->
    <div class="bulletin-header">
      <h3>BULLETIN - {{ period }}</h3>
    </div>

    <!-- Informations de l'élève -->
    <div class="student-section">
      <div class="student-photo">
        <img v-if="student?.photo?.url" :src="student.photo.url" alt="Photo">
      </div>
      <div class="student-details">
        <div class="detail-row">
          <span class="label">NIA/N°:</span>
          <span class="value">{{ student?.matricule }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Nom:</span>
          <span class="value">{{ student?.lastname }} {{ student?.firstname }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Classe:</span>
          <span class="value">{{ student?.grade?.name }}</span>
        </div>
      </div>
    </div>

    <!-- Tableau des notes -->
    <div class="grades-container">
      <table class="grades-table">
        <thead>
          <tr>
            <th>DISCIPLINES</th>
            <th>MOYENNE</th>
            <th>COEF</th>
            <th>NOTE x</th>
            <th>Appréciation</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="grade in grades" :key="grade.courseId">
            <td class="discipline">{{ grade.courseName }}</td>
            <td class="center">{{ grade.average.toFixed(2) }}</td>
            <td class="center">{{ grade.coefficient }}</td>
            <td class="center">{{ (grade.average * grade.coefficient).toFixed(2) }}</td>
            <td>{{ grade.appreciation }}</td>
          </tr>
          <tr class="totals">
            <td>TOTAUX</td>
            <td class="center">{{ calculateTotalAverages() }}</td>
            <td class="center">{{ calculateTotalCoef() }}</td>
            <td class="center">{{ calculateWeightedTotal() }}</td>
            <td></td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Absences -->
   

    <!-- Bilan dynamique -->
    <div class="summary-section">
      <div class="results-section">
        <h5>BILAN</h5>
        <table class="results-table">
          <tbody>
            <template v-if="period.includes('Semestre')">
              <tr v-if="previousResults?.semester1">
                <td>Semestre 1</td>
                <td class="center">{{ previousResults.semester1.average.toFixed(2) }}</td>
              </tr>
              <tr v-if="period === 'Semestre 2'">
                <td>Semestre 2</td>
                <td class="center">{{ generalAverage.toFixed(2) }}</td>
              </tr>
              <tr v-if="previousResults?.semester1" class="annual-average">
                <td>Moyenne Annuelle</td>
                <td class="center">{{ calculateAnnualAverage().toFixed(2) }}</td>
              </tr>
            </template>
            <template v-else>
              <tr v-if="previousResults?.term1">
                <td>1er Trimestre</td>
                <td class="center">{{ previousResults.term1.average.toFixed(2) }}</td>
              </tr>
              <tr v-if="previousResults?.term2">
                <td>2ème Trimestre</td>
                <td class="center">{{ previousResults.term2.average.toFixed(2) }}</td>
              </tr>
              <tr v-if="period === 'Trimestre 3'">
                <td>3ème Trimestre</td>
                <td class="center">{{ generalAverage.toFixed(2) }}</td>
              </tr>
              <tr v-if="previousResults?.term1" class="annual-average">
                <td>Moyenne Annuelle</td>
                <td class="center">{{ calculateAnnualAverage().toFixed(2) }}</td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
    </div>

    <!-- Décision et signature -->
    <div class="footer-section">
      <div class="decision">
        <strong>DÉCISION DU CONSEIL DE CLASSE:</strong>
        <span>{{ getDecision() }}</span>
      </div>
      <div class="signature">
        <p>Le Proviseur</p>
        <div class="stamp-area"></div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { defineProps, computed } from 'vue';
import { SchoolInfo } from '@/types/report';

interface Props {
  student: {
    lastname: string;
    firstname: string;
    matricule: string;
    grade: {
      name: string;
    };
    photo?: {
      url?: string;
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
  maxClassAverage?: number;
  minClassAverage?: number;
  classAverage?: number;
  currentRank?: number;
  previousResults?: {
    term1?: { average: number; rank: number };
    term2?: { average: number; rank: number };
    semester1?: { average: number; rank: number };
    semester2?: { average: number; rank: number };
  };
}

const props = defineProps<Props>();

const getCountryInfo = computed(() => {
  switch (props.schoolInfo?.country) {
    case 'MAR':
      return {
        country: 'Royaume du Maroc',
        ministry: 'Ministère de l\'Education Nationale',
        motto: 'الله - الوطن - الملك', // Dieu, la Patrie, le Roi
      };
    case 'SEN':
      return {
        country: 'République du Sénégal',
        ministry: 'Ministère de l\'Education Nationale',
        motto: 'Un Peuple - Un But - Une Foi',
      };
    case 'CAF':
      return {
        country: 'République Centrafricaine',
        ministry: 'Ministère de l\'Enseignement National',
        motto: 'Unité - Dignité - Travail',
      };
    case 'GIN':
      return {
        country: 'République de Guinée',
        ministry: 'Ministère de l\'Education Nationale et de l\'Alphabétisation',
        motto: 'Travail - Justice - Solidarité',
      };
    default:
      return {
        country: '',
        ministry: 'Ministère de l\'Education Nationale',
        motto: '',
      };
  }
});

const calculateTotalCoef = () => {
  return props.grades.reduce((sum, grade) => sum + grade.coefficient, 0);
};

const calculateTotalAverages = () => {
  const total = props.grades.reduce((sum, grade) => sum + grade.average, 0);
  return total.toFixed(2);
};

const getDecision = () => {
  const average = props.generalAverage;
  return average >= 10 ? 'Admis(e)' : 'Non admis(e)';
};

const calculateWeightedTotal = () => {
  return props.grades.reduce((sum, grade) => 
    sum + (grade.average * grade.coefficient), 0).toFixed(2);
};

const calculateAnnualAverage = () => {
  if (props.period.includes('Semestre')) {
    const sem1 = props.previousResults?.semester1?.average || 0;
    const sem2 = props.period === 'Semestre 2' ? props.generalAverage : 0;
    return (sem1 + sem2) / (sem2 ? 2 : 1);
  } else {
    const term1 = props.previousResults?.term1?.average || 0;
    const term2 = props.previousResults?.term2?.average || 0;
    const term3 = props.period === 'Trimestre 3' ? props.generalAverage : 0;
    const divisor = [term1, term2, term3].filter(t => t > 0).length;
    return (term1 + term2 + term3) / divisor;
  }
};
</script>

<style scoped>
.report-card {
  width: 210mm;
  height: 297mm;
  padding: 15mm;
  margin: 0;
  box-sizing: border-box;
  background: white;
  position: relative;
  overflow: hidden;
}

.header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10mm;
}

.ministry-section {
  display: flex;
  gap: 10px;
}

.ministry-logo {
  width: 50px;
  height: 50px;
  background-image: url('@/assets/ministry-logo.png');
  background-size: contain;
  background-repeat: no-repeat;
}

.ministry-info {
  text-align: center;
}

.ministry-info h4 {
  margin: 0 0 5px 0;
  font-size: 12pt;
  text-transform: uppercase;
  font-weight: bold;
}

.ministry-info p {
  margin: 2px 0;
  font-size: 9pt;
}

.ministry-info p:nth-child(2) {
  font-style: italic;
  font-weight: 500;
}

.school-section {
  text-align: right;
}

.school-logo {
  width: 40px;
  height: 40px;
  margin-bottom: 5px;
}

.school-logo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.academic-year {
  font-size: 9pt;
}

.bulletin-header {
  text-align: center;
  border-bottom: 1px solid #000;
  margin: 10mm 0;
}

.bulletin-header h3 {
  margin: 0;
  padding: 5px 0;
  font-size: 12pt;
}

.student-section {
  display: flex;
  gap: 15px;
  margin: 10mm 0;
}

.student-photo {
  width: 25mm;
  height: 30mm;
  border: 1px solid #000;
}

.student-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.student-details {
  flex: 1;
}

.detail-row {
  margin: 5px 0;
  font-size: 10pt;
}

.label {
  font-weight: bold;
  display: inline-block;
  width: 80px;
}

.grades-table {
  width: 100%;
  border-collapse: collapse;
  margin: 10mm 0;
  font-size: 9pt;
}

.grades-table th,
.grades-table td {
  border: 1px solid #000;
  padding: 4px 6px;
}

.grades-table th {
  background-color: #fff;
  font-weight: bold;
  text-align: center;
}

.discipline {
  font-weight: bold;
}

.center {
  text-align: center;
}

.totals {
  font-weight: bold;
}

.summary-section {
  margin: 10mm 0;
  font-size: 10pt;
}

.results-section {
  width: 50%;
  margin: 0 auto;
}

.results-section h5 {
  margin: 0 0 10px 0;
  font-size: 11pt;
  text-transform: uppercase;
  font-weight: bold;
  text-align: center;
  border-bottom: 1px solid #000;
  padding-bottom: 5px;
}

.results-table {
  width: 100%;
  border-collapse: collapse;
  margin-top: 10px;
}

.results-table td {
  border: 1px solid #000;
  padding: 6px 10px;
}

.results-table td:first-child {
  width: 60%;
}

.annual-average {
  font-weight: bold;
  background-color: #f5f5f5;
}

.annual-average td {
  border-top: 2px solid #000;
}

.footer-section {
  margin-top: 10mm;
  position: absolute;
  bottom: 15mm;
  left: 15mm;
  right: 15mm;
}

.decision {
  margin-bottom: 20px;
  font-size: 10pt;
}

.signature {
  text-align: right;
  margin-top: 40px;
}

.stamp-area {
  width: 100px;
  height: 100px;
  margin-left: auto;
  margin-top: 10px;
}

.absences-section {
  margin: 15px 0;
  padding: 10px;
  border: 1px solid #eee;
  border-radius: 4px;
}

@media print {
  .report-card {
    margin: 0;
    padding: 10mm;
  }
  
  @page {
    size: A4 portrait;
    margin: 0;
  }
}
</style>