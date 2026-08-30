<template>
  <div class="bulletin-template-one" :style="containerStyle">
    <!-- En-tête : Deux blocs gauche/droite -->
    <header class="header">
      <div class="header-block header-left">
        <div class="school-logo" v-if="schoolInfo?.logo?.url">
          <img :src="schoolInfo.logo.url" alt="Logo École" />
        </div>
        <h2 class="school-name" :style="{ color: options.primaryColor }">{{ schoolInfo?.name }}</h2>
        <p class="school-detail">{{ schoolInfo?.address }}</p>
        <p class="school-detail" v-if="schoolInfo?.town">{{ schoolInfo.town }}</p>
        <p class="school-detail" v-if="schoolInfo?.phone">Tél : {{ schoolInfo.phone }}</p>
        <p class="school-detail" v-if="schoolInfo?.email">Email : {{ schoolInfo.email }}</p>
      </div>
      <div class="header-block header-right">
        <h2 class="country-name">{{ countryData.countryName }}</h2>
        <p class="country-motto">{{ countryData.motto }}</p>
        <p class="ministry">{{ countryData.ministry }}</p>
        <p class="inspection">{{ countryData.inspection }}</p>
      </div>
    </header>

    <!-- Titre Central et Année Scolaire -->
    <div class="bulletin-title-section">
      <h1 class="bulletin-title" :style="{ color: options.primaryColor, borderColor: options.primaryColor }">BULLETIN DE NOTES DU {{ periodLabel.toUpperCase() }}</h1>
      <p class="school-year-line">Année scolaire : {{ currentYear }}</p>
    </div>

    <!-- Info Élève -->
    <section class="student-info-section" :style="{ borderColor: options.primaryColor }">
      <div class="student-photo" v-if="student?.photo?.url">
        <img :src="student.photo.url" alt="Photo Élève" />
      </div>
      <div class="student-details">
        <div class="detail-row">
          <span class="label">Nom & Prénom :</span>
          <span class="value">{{ student?.lastname }} {{ student?.firstname }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Matricule :</span>
          <span class="value">{{ student?.matricule }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Classe :</span>
          <span class="value">{{ student?.grade?.name }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Date de naissance :</span>
          <span class="value">{{ formatBirthDay(student?.birthDay) }}</span>
        </div>
        <div class="detail-row">
          <span class="label">Genre :</span>
          <span class="value">{{ student?.sex === 'male' ? 'Masculin' : student?.sex === 'female' ? 'Féminin' : '-' }}</span>
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
            <th v-for="cat in categories" :key="cat.code" class="text-center">{{ cat.name }}</th>
            <th class="text-center">Moyenne de cours</th>
            <th class="text-center">Moyenne de composition</th>
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
            <td v-for="cat in categories" :key="cat.code" class="text-center">
              {{ getCategoryAverage(grade, cat.code) }}
            </td>
            <td class="text-center font-bold" :class="getGradeColorClass(grade.classAverage)">
              {{ formatNumber(grade.classAverage) }}
            </td>
            <td class="text-center font-bold" :class="getGradeColorClass(grade.examAverage)">
              {{ formatNumber(grade.examAverage) }}
            </td>
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
            <td v-for="cat in categories" :key="cat.code"></td>
            <td></td>
            <td></td>
            <td class="text-center font-bold">{{ formatNumber(totalAveragePoints) }}</td>
            <td class="text-center font-bold">{{ formatNumber(totalWeightedPoints) }}</td>
            <td></td>
            <td></td>
          </tr>
          <tr class="average-row" :style="{ backgroundColor: options.primaryColor + '10' }">
            <td colspan="2" class="text-right font-bold text-lg" style="white-space: nowrap;">MOYENNE GÉNÉRALE</td>
            <td v-for="cat in categories" :key="cat.code"></td>
            <td colspan="2"></td>
            <td colspan="2" class="text-left font-bold text-xl" :style="{ color: options.primaryColor }">
              {{ formatNumber(generalAverage) }} / 20
            </td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    </section>

    <!-- Section Moyenne Annuelle -->
    <section v-if="showAnnualSection" class="annual-summary-section" :style="{ borderColor: options.primaryColor }">
      <div class="annual-title" :style="{ backgroundColor: options.primaryColor, color: '#fff' }">
        MOYENNE ANNUELLE
      </div>

          <table class="annual-table">
            <thead>
              <tr :style="{ backgroundColor: options.secondaryColor + '20' }">
                <th colspan="2">Blocs de Synthèse des Moyennes</th>
                <th colspan="3" :style="{ borderLeft: '3px solid ' + options.primaryColor }">Annuelle</th>
              </tr>
              <tr :style="{ backgroundColor: options.primaryColor, color: '#fff' }">
                <th>1er SEMESTRE</th>
                <th>2ème SEMESTRE</th>
                <th class="annual-separator">Du plus Fort</th>
                <th>De l'Élève</th>
                <th>Du Plus Faible</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-bold">{{ formatNumber(semester1Average) }}</td>
                <td class="font-bold">{{ formatNumber(semester2Average) }}</td>
                <td class="font-bold annual-separator">{{ formatNumber(classHighestAnnual) }}</td>
            <td class="font-bold annual-highlight" :style="{ color: options.primaryColor }">{{ formatNumber(computedAnnualAverage) }}</td>
            <td class="font-bold">{{ formatNumber(classLowestAnnual) }}</td>
          </tr>
        </tbody>
      </table>

      <div class="annual-info-grid">
        <div class="annual-info-box" :style="{ borderColor: options.primaryColor }">
          <span class="info-label">Rang :</span>
          <span class="info-value font-bold">{{ annualRank ? annualRank + (annualRank === 1 ? 'er' : 'ème') : '-' }}</span>
        </div>
        <div class="annual-info-box" :style="{ borderColor: options.primaryColor }">
          <span class="info-label">Effectifs :</span>
          <span class="info-value font-bold">{{ totalStudents }}</span>
        </div>
      </div>

      <div class="annual-decisions">
        <div class="decisions-title" :style="{ color: options.primaryColor }">Décisions du Conseil de Classe</div>
        <div class="decisions-grid">
          <div
            v-for="(label, key) in decisionLabels"
            :key="key"
            class="decision-item"
            :class="{ 'decision-active': decisionState[key as keyof typeof decisionState] }"
          >
            <span class="checkbox">
              <span v-if="decisionState[key as keyof typeof decisionState]" class="checkmark">✓</span>
            </span>
            <span class="decision-label">{{ label }}</span>
          </div>
        </div>
        <div class="appreciation-box">
          <div class="appreciation-title">Appréciation Globale</div>
          <div class="appreciation-value">{{ annualAppreciation || getAppreciation(computedAnnualAverage) }}</div>
        </div>
      </div>
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
        <p>{{ signatoryLeftLabel }}</p>
        <div class="signature-space"></div>
      </div>
      <div class="signature-box">
        <p>{{ signatoryRightLabel }}</p>
        <div class="signature-space"></div>
      </div>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { getAppreciation, formatNumber } from '@/utils/grade';

interface AnnualDecision {
  honors: boolean;
  admitted: boolean;
  session: boolean;
  repeat: boolean;
  excluded: boolean;
}

interface Props {
  student: any;
  schoolInfo: any;
  grades: any[];
  period: string;
  options?: {
    primaryColor: string;
    secondaryColor: string;
    signatoryLeft?: string;
    signatoryRight?: string;
  };
  currentYear?: string;
  rank?: number;
  totalStudents?: number;
  classAverage?: number;
  absences?: number;
  semester1Average?: number;
  semester2Average?: number;
  annualAverage?: number;
  annualRank?: number;
  classHighestAnnual?: number;
  classLowestAnnual?: number;
  decisions?: AnnualDecision;
  annualAppreciation?: string;
  isFinalPeriod?: boolean;
  categories?: { code: string; name: string; isExam: boolean }[];
}

const props = withDefaults(defineProps<Props>(), {
  options: () => ({
    primaryColor: '#2c3e50',
    secondaryColor: '#3498db',
    signatoryLeft: 'Le Professeur Principal',
    signatoryRight: 'Le Directeur'
  }),
  currentYear: new Date().getFullYear().toString() + '-' + (new Date().getFullYear() + 1).toString(),
  grades: () => [],
  rank: 0,
  totalStudents: 0,
  classAverage: 0,
  absences: 0,
  semester1Average: undefined,
  semester2Average: undefined,
  annualAverage: undefined,
  annualRank: undefined,
  classHighestAnnual: undefined,
  classLowestAnnual: undefined,
  decisions: undefined,
  annualAppreciation: undefined,
  isFinalPeriod: false,
  categories: () => []
});

const countryHeaderMap: Record<string, { countryName: string; motto: string; ministry: string; inspection: string }> = {
  'GIN': {
    countryName: 'REPUBLIQUE DE GUINEE',
    motto: 'Travail - Justice - Solidarité',
    ministry: "MINISTERE DE L'EDUCATION NATIONALE ET DE L'ALPHABETISATION",
    inspection: "INSPECTION REGIONALE DE L'EDUCATION"
  },
  'SEN': {
    countryName: 'REPUBLIQUE DU SENEGAL',
    motto: 'Un Peuple - Un But - Une Foi',
    ministry: "MINISTERE DE L'EDUCATION NATIONALE ET DE L'ALPHABETISATION",
    inspection: "INSPECTION REGIONALE DE L'EDUCATION"
  },
  'MAR': {
    countryName: 'ROYAUME DU MAROC',
    motto: 'Dieu, La Patrie, Le Roi',
    ministry: "MINISTERE DE L'EDUCATION NATIONALE, DU PRESCOLAIRE ET DES SPORTS",
    inspection: "DIRECTION PROVINCIALE DE L'EDUCATION"
  },
  'CAF': {
    countryName: 'REPUBLIQUE CENTRAFRICAINE',
    motto: 'Unité - Dignité - Travail',
    ministry: "MINISTERE DE L'EDUCATION NATIONALE",
    inspection: "INSPECTION ACADEMIQUE"
  }
};

const formatBirthDay = (date: string | Date | undefined): string => {
  if (!date) return '-';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '-';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
};

const countryData = computed(() => {
  const code = props.schoolInfo?.country || 'SEN';
  const data = countryHeaderMap[code] || countryHeaderMap['SEN'];
  const town = props.schoolInfo?.town || '';
  return {
    ...data,
    inspection: town ? `${data.inspection} DE ${town.toUpperCase()}` : data.inspection
  };
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

const showAnnualSection = computed(() => {
  return props.isFinalPeriod || (props.semester1Average !== undefined && props.semester1Average !== null);
});

const computedAnnualAverage = computed(() => {
  if (props.annualAverage !== undefined && props.annualAverage !== null) {
    return props.annualAverage;
  }
  if (props.semester1Average != null && props.semester2Average != null) {
    return (props.semester1Average + props.semester2Average) / 2;
  }
  return 0;
});

const decisionLabels: Record<string, string> = {
  honors: 'Tableau d\'honneur',
  admitted: 'Admis(e) en classe Sup',
  session: 'Session',
  repeat: 'Redouble',
  excluded: 'Exclusion'
};

const decisionState = computed(() => ({
  honors: props.decisions?.honors || false,
  admitted: props.decisions?.admitted || false,
  session: props.decisions?.session || false,
  repeat: props.decisions?.repeat || false,
  excluded: props.decisions?.excluded || false
}));

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

const totalAveragePoints = computed(() => {
  return processedGrades.value.reduce((sum, g) => sum + g.average, 0);
});

const generalAverage = computed(() => {
  if (totalCoefficients.value === 0) return 0;
  return totalWeightedPoints.value / totalCoefficients.value;
});

const getGradeColorClass = (grade: number) => {
  if (grade < 10) return 'text-red-600';
  if (grade >= 16) return 'text-green-600';
  return 'text-gray-800';
};

const getCategoryAverage = (grade: any, code: string) => {
  if (grade.categoryGrades) {
    const cat = grade.categoryGrades.find((c: any) => c.code === code);
    if (cat) return formatNumber(cat.average);
  }
  return '-';
};

const signatoryLeftLabel = computed(() => props.options?.signatoryLeft || 'Le Professeur Principal');
const signatoryRightLabel = computed(() => props.options?.signatoryRight || 'Le Directeur');
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');

.bulletin-template-one {
  width: 210mm;
  max-width: 100%;
  min-height: 277mm; /* 297mm - 20mm marges */
  height: auto;
  padding: 8mm 10mm;
  background: white;
  box-sizing: border-box;
  color: #333;
  overflow: visible; /* Permet au contenu de s'étendre, le preview scrolle */
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 2px solid #eee;
}

.header-block {
  width: 48%;
}

.header-left {
  text-align: left;
}

.header-right {
  text-align: right;
}

.school-logo {
  margin-bottom: 6px;
}

.school-logo img {
  max-width: 80px;
  max-height: 80px;
}

.school-name {
  font-size: 16px;
  margin: 0 0 4px;
  text-transform: uppercase;
  font-weight: 700;
}

.school-detail {
  margin: 1px 0;
  font-size: 11px;
  color: #555;
}

.country-name {
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  margin: 0 0 2px;
}

.country-motto {
  font-size: 11px;
  font-style: italic;
  margin: 0 0 6px;
  color: #444;
}

.ministry {
  font-size: 10px;
  text-transform: uppercase;
  margin: 1px 0;
  color: #333;
}

.inspection {
  font-size: 10px;
  text-transform: uppercase;
  margin: 1px 0;
  color: #333;
}

.bulletin-title-section {
  text-align: center;
  margin-bottom: 12px;
}

.bulletin-title {
  font-size: 18px;
  font-weight: 700;
  text-transform: uppercase;
  margin: 0 0 4px;
  padding: 6px 16px;
  display: inline-block;
  border: 2px solid;
}

.school-year-line {
  font-size: 12px;
  margin: 6px 0 0;
  text-align: right;
  color: #555;
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
  gap: 8px;
}

.detail-row {
  display: flex;
  align-items: baseline;
  gap: 6px;
}

.detail-row .label {
  font-size: 11px;
  color: #666;
  white-space: nowrap;
  font-weight: 600;
}

.detail-row .value {
  font-size: 13px;
  font-weight: 500;
}

.grades-section {
  width: 100%;
  overflow-x: hidden;
  margin-bottom: 12px;
  flex-shrink: 0;
}

.grades-table {
  width: 100%;
  max-width: 190mm; /* 210mm - 20mm padding */
  border-collapse: collapse;
  margin-bottom: 12px;
  table-layout: fixed;
  word-wrap: break-word;
}

.grades-table th,
.grades-table td {
  padding: 4px 6px;
  border: 1px solid #e0e0e0;
  font-size: 9px;
  line-height: 1.2;
  word-break: break-word;
  overflow-wrap: break-word;
}

.grades-table th {
  text-transform: uppercase;
  font-size: 8px;
  letter-spacing: 0.3px;
  line-height: 1.2;
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

/* Annual Summary Section */
.annual-summary-section {
  border: 2px solid;
  margin-bottom: 20px;
  background-color: #fff;
  border-radius: 4px;
  overflow: hidden;
}

.annual-title {
  text-align: center;
  font-size: 14px;
  font-weight: 700;
  text-transform: uppercase;
  padding: 8px 0;
  letter-spacing: 0.5px;
}

.annual-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.annual-table th,
.annual-table td {
  border: 1px solid #e0e0e0;
  padding: 8px 6px;
  text-align: center;
}

.annual-table thead th {
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  font-size: 11px;
}

.annual-highlight {
  font-size: 14px;
}

.annual-info-grid {
  display: flex;
  justify-content: space-around;
  padding: 10px;
  border-top: 1px solid #e0e0e0;
  background-color: #f8f9fa;
  gap: 10px;
}

.annual-info-box {
  display: flex;
  gap: 8px;
  align-items: center;
  font-size: 12px;
  border: 1px solid;
  padding: 6px 12px;
  border-radius: 4px;
  background: white;
  flex: 1;
  justify-content: center;
}

.info-label {
  font-weight: 600;
  color: #555;
}

.info-value {
  font-size: 14px;
}

.annual-decisions {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.decisions-title {
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
  text-align: center;
  margin-bottom: 2px;
}

.decisions-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 8px;
}

.decision-item {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  padding: 6px 8px;
  border: 1px solid #ccc;
  background-color: #fafafa;
  border-radius: 4px;
}

.decision-item.decision-active {
  background-color: #d1fae5;
  border-color: #16a34a;
  font-weight: 700;
}

.checkbox {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border: 1px solid #555;
  background: #fff;
  flex-shrink: 0;
  border-radius: 3px;
}

.checkmark {
  color: #16a34a;
  font-weight: 700;
  font-size: 12px;
  line-height: 1;
}

.appreciation-box {
  border: 2px solid #e0e0e0;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-height: 70px;
  background-color: #fafafa;
  border-radius: 4px;
}

.appreciation-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  color: #666;
}

.appreciation-value {
  font-size: 16px;
  font-weight: 700;
  color: #000;
  text-align: center;
}

.annual-separator {
  border-left: 3px solid v-bind('options.primaryColor') !important;
}

@media print {
  .bulletin-template-one {
    width: 100%;
    height: 100%;
    padding: 0;
  }

  .decision-item {
    white-space: nowrap;
    font-size: 7px;
  }
}
</style>
