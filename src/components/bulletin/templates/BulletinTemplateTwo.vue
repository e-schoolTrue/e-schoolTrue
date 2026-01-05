<template>
  <div class="bulletin-template-two" :style="containerStyle">
    <!-- Header officiel -->
    <header class="header">
      <div class="header-left">
        <div class="logo-box">
          <div class="logo-circle" v-if="schoolInfo?.logo?.url">
            <img :src="schoolInfo.logo.url" alt="Logo" />
          </div>
          <div class="logo-circle logo-placeholder" v-else>
            <span>LOGO</span>
          </div>
        </div>
      </div>
      <div class="header-center">
        <h2 :style="{ color: options.primaryColor }">{{ schoolInfo?.country || 'REPUBLIQUE DE GUINEE' }}</h2>
        <div class="motto">
          <span class="red">Travail-</span>
          <span class="yellow">Justice-</span>
          <span class="green">Solidarité</span>
        </div>
        <p class="ministry">MINISTERE DE L'EDUCATION NATIONALE ET DE L'ALPHABETISATION</p>
        <p class="inspection">{{ schoolInfo?.town || 'INSPECTION REGIONALE' }}</p>
        <h1 class="school-name" :style="{ color: options.primaryColor }">{{ schoolInfo?.name || 'Nom de l\'École' }}</h1>
      </div>
    </header>

    <!-- Titre du Bulletin -->
    <div class="bulletin-title-box" :style="{ backgroundColor: options.secondaryColor + '30' }">
      <h1>Bulletin de Notes</h1>
      <h3>{{ periodLabel }}</h3>
    </div>

    <!-- Informations de l'élève -->
    <div class="student-info" :style="{ borderColor: options.primaryColor }">
      <div class="row">
        <div class="cell label">Année Scolaire : {{ currentYear }}</div>
        <div class="cell label">Classe : {{ student?.grade?.name || '-' }}</div>
      </div>
      <div class="row">
        <div class="cell"><strong>Prénoms :</strong> {{ student?.firstname || '-' }}</div>
        <div class="cell"><strong>Nom :</strong> {{ student?.lastname || '-' }}</div>
      </div>
      <div class="row">
        <div class="cell"><strong>N° Matricule :</strong> {{ student?.matricule || '-' }}</div>
        <div class="cell"><strong>Sexe :</strong> {{ student?.gender || '-' }}</div>
      </div>
    </div>

    <!-- Tableau des notes -->
    <table class="notes-table">
      <thead>
        <tr :style="{ backgroundColor: options.primaryColor, color: '#fff' }">
          <th class="col-matiere">Matières</th>
          <th class="col-coeff">Coeff</th>
          <th class="col-note">Moyenne</th>
          <th class="col-note">Points</th>
          <th>Appréciation</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(grade, index) in processedGrades" :key="index" :class="{ 'row-even': index % 2 === 0 }">
          <td class="text-left">{{ grade.courseName }}</td>
          <td>{{ grade.coefficient }}</td>
          <td :class="getGradeClass(grade.average)">{{ fmt(grade.average) }}</td>
          <td class="bg-gray">{{ fmt(grade.weightedValue) }}</td>
          <td class="appreciation">{{ grade.appreciation || getAppreciation(grade.average) }}</td>
        </tr>
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td class="text-left font-bold">TOTAL</td>
          <td class="font-bold">{{ totalCoefficients }}</td>
          <td></td>
          <td class="bg-gray font-bold">{{ fmt(totalWeightedPoints) }}</td>
          <td></td>
        </tr>
        <tr class="moyenne-generale-row" :style="{ backgroundColor: options.secondaryColor + '20' }">
          <td colspan="2" class="label-moyenne">Moyenne Générale</td>
          <td colspan="3" class="value-moyenne" :style="{ color: options.primaryColor }">
            {{ fmt(generalAverage) }} / 20
          </td>
        </tr>
      </tfoot>
    </table>

    <!-- Résumé et Statistiques -->
    <div class="footer-summary">
      <div class="summary-grid">
        <div class="summary-left">
          <div class="summary-line">
            <span>Moyenne Trimestrielle :</span>
            <span class="value">{{ fmt(generalAverage) }} /20</span>
          </div>
          <div class="summary-line">
            <span>Moyenne de la Classe :</span>
            <span class="value">{{ fmt(classAverage) }} /20</span>
          </div>
          <div class="signature">
            Le Professeur Principal
            <div class="signature-space"></div>
          </div>
        </div>

        <div class="summary-right">
          <div class="rank-line" :style="{ borderColor: options.primaryColor }">
            Rang : <strong>{{ rank ? rank + (rank === 1 ? 'er' : 'ème') : '-' }}</strong> / {{ totalStudents }} élèves
          </div>
          <div class="stats-box">
            <div class="stat-row">
              <span>Moyenne plus forte :</span>
              <span class="val">{{ fmt(highestAverage) }}</span>
            </div>
            <div class="stat-row">
              <span>Moyenne plus faible :</span>
              <span class="val">{{ fmt(lowestAverage) }}</span>
            </div>
          </div>
          <div class="signature">
            Le Directeur
            <div class="signature-space"></div>
          </div>
        </div>
      </div>
    </div>
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
  highestAverage?: number;
  lowestAverage?: number;
}

const props = withDefaults(defineProps<Props>(), {
  options: () => ({
    primaryColor: '#1a237e',
    secondaryColor: '#3f51b5'
  }),
  currentYear: () => new Date().getFullYear().toString() + ' - ' + (new Date().getFullYear() + 1).toString(),
  grades: () => [],
  rank: 0,
  totalStudents: 0,
  classAverage: 0,
  absences: 0,
  highestAverage: 0,
  lowestAverage: 0
});

const containerStyle = computed(() => ({
  fontFamily: "'Arial Narrow', Arial, sans-serif"
}));

const periodLabel = computed(() => {
  const map: Record<string, string> = {
    'S1': 'Premier Semestre',
    'S2': 'Deuxième Semestre',
    'T1': 'Premier Trimestre',
    'T2': 'Deuxième Trimestre',
    'T3': 'Troisième Trimestre',
    'Trimestre 1': 'Premier Trimestre',
    'Trimestre 2': 'Deuxième Trimestre',
    'Trimestre 3': 'Troisième Trimestre'
  };
  return map[props.period] || props.period;
});

// Formater les nombres (ex: 10.00)
const fmt = (n: number) => {
  if (n === null || n === undefined || isNaN(n)) return '0.00';
  return n.toFixed(2);
};

const processedGrades = computed(() => {
  return props.grades.map(g => ({
    ...g,
    weightedValue: (g.average || 0) * (g.coefficient || 1)
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

const getGradeClass = (grade: number) => {
  if (grade < 10) return 'grade-low';
  if (grade >= 16) return 'grade-excellent';
  if (grade >= 14) return 'grade-good';
  return '';
};

const getAppreciation = (note: number) => {
  if (note < 5) return "Très Insuffisant";
  if (note < 8) return "Insuffisant";
  if (note < 10) return "Passable";
  if (note < 12) return "Assez Bien";
  if (note < 14) return "Bien";
  if (note < 16) return "Très Bien";
  if (note < 18) return "Excellent";
  return "Félicitations";
};
</script>

<style scoped>
.bulletin-template-two {
  width: 210mm;
  min-height: 297mm;
  padding: 10mm;
  background-color: white;
  color: #000;
  box-sizing: border-box;
}

/* Header */
.header {
  display: flex;
  margin-bottom: 8px;
  border-bottom: 2px solid #2c3e50;
  padding-bottom: 8px;
}

.header-left {
  width: 15%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.logo-circle {
  width: 70px;
  height: 70px;
  border: 2px solid #1a237e;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.logo-circle img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.logo-placeholder {
  font-size: 12px;
  font-weight: bold;
  color: #1a237e;
}

.header-center {
  width: 85%;
  text-align: center;
}

.header-center h2 {
  font-size: 14px;
  margin: 0;
  font-weight: bold;
  text-transform: uppercase;
}

.motto {
  font-size: 10px;
  font-weight: bold;
  margin-bottom: 4px;
}
.red { color: #d32f2f; }
.yellow { color: #fbc02d; }
.green { color: #388e3c; }

.ministry, .inspection {
  font-size: 9px;
  margin: 1px 0;
  text-transform: uppercase;
}

.school-name {
  font-size: 16px;
  margin: 5px 0 0 0;
  font-weight: 900;
  text-transform: uppercase;
}

/* Titre */
.bulletin-title-box {
  text-align: center;
  border: 2px solid #2c3e50;
  margin-bottom: 8px;
  padding: 6px 0;
}

.bulletin-title-box h1 {
  margin: 0;
  font-size: 22px;
  font-family: "Times New Roman", serif;
}

.bulletin-title-box h3 {
  margin: 0;
  font-size: 13px;
  font-weight: normal;
}

/* Info Élève */
.student-info {
  border: 2px solid;
  background-color: #f5f5f5;
  margin-bottom: 8px;
  font-size: 11px;
}

.student-info .row {
  display: flex;
  border-bottom: 1px solid #999;
}
.student-info .row:last-child {
  border-bottom: none;
}

.student-info .cell {
  flex: 1;
  padding: 4px 8px;
  border-right: 1px solid #999;
}
.student-info .cell:last-child {
  border-right: none;
}

/* Tableau */
.notes-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 11px;
  border: 2px solid #000;
  margin-bottom: 10px;
}

.notes-table th, .notes-table td {
  border: 1px solid #000;
  padding: 5px 4px;
  text-align: center;
}

.notes-table thead th {
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
}

.col-matiere { width: 35%; text-align: left; padding-left: 8px !important; }
.col-coeff { width: 10%; }
.col-note { width: 15%; }

.text-left { text-align: left; padding-left: 8px; }
.bg-gray { background-color: #e8e8e8; }
.font-bold { font-weight: bold; }
.row-even { background-color: #fafafa; }

.grade-low { color: #c62828; font-weight: bold; }
.grade-good { color: #2e7d32; }
.grade-excellent { color: #1565c0; font-weight: bold; }

.appreciation { font-size: 10px; font-style: italic; }

/* Totaux */
.total-row td {
  border-top: 2px solid #000;
  background-color: #f0f0f0;
}

.moyenne-generale-row .label-moyenne {
  text-align: right;
  padding-right: 15px;
  font-weight: bold;
  font-size: 13px;
}
.moyenne-generale-row .value-moyenne {
  font-weight: bold;
  font-size: 16px;
  text-align: left;
  padding-left: 15px;
}

/* Footer */
.footer-summary {
  border: 2px solid #000;
  background-color: #f5f5f5;
  padding: 10px;
  font-size: 11px;
}

.summary-grid {
  display: flex;
  justify-content: space-between;
  gap: 20px;
}

.summary-left, .summary-right {
  width: 48%;
}

.summary-line {
  display: flex;
  justify-content: space-between;
  margin-bottom: 5px;
  padding: 4px 0;
  border-bottom: 1px dotted #666;
}

.summary-line .value {
  font-weight: bold;
}

.rank-line {
  border: 2px solid;
  padding: 6px 10px;
  background: white;
  margin-bottom: 10px;
  text-align: center;
  font-size: 12px;
}

.stats-box {
  border: 1px solid #000;
  margin-bottom: 10px;
}

.stat-row {
  display: flex;
  justify-content: space-between;
  padding: 3px 8px;
  border-bottom: 1px solid #ccc;
}
.stat-row:last-child {
  border-bottom: none;
}

.stat-row .val {
  font-weight: bold;
}

.signature {
  margin-top: 15px;
  text-align: center;
  font-weight: bold;
}

.signature-space {
  height: 50px;
  border-bottom: 1px solid #000;
  margin-top: 5px;
}

@media print {
  .bulletin-template-two {
    width: 100%;
    height: 100%;
    padding: 5mm;
  }
}
</style>