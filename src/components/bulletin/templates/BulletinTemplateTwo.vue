<template>
  <div class="bulletin-template-two" :style="containerStyle">
    <!-- En-tête : Deux blocs gauche/droite -->
    <header class="header">
      <div class="header-block header-left-block">
        <div class="logo-box">
          <div class="logo-circle" v-if="schoolInfo?.logo?.url">
            <img :src="schoolInfo.logo.url" alt="Logo" />
          </div>
          <div class="logo-circle logo-placeholder" v-else>
            <span>LOGO</span>
          </div>
        </div>
        <h2 class="school-name" :style="{ color: options.primaryColor }">{{ schoolInfo?.name || 'Nom de l\'École' }}</h2>
        <p class="school-detail">{{ schoolInfo?.address }}</p>
        <p class="school-detail" v-if="schoolInfo?.town">{{ schoolInfo.town }}</p>
        <p class="school-detail" v-if="schoolInfo?.phone">Tél : {{ schoolInfo.phone }}</p>
        <p class="school-detail" v-if="schoolInfo?.email">Email : {{ schoolInfo.email }}</p>
      </div>
      <div class="header-block header-right-block">
        <h2 class="country-name">{{ countryData.countryName }}</h2>
        <p class="country-motto">{{ countryData.motto }}</p>
        <p class="ministry-text">{{ countryData.ministry }}</p>
        <p class="inspection-text">{{ countryData.inspection }}</p>
      </div>
    </header>

    <!-- Titre Central et Année Scolaire -->
    <div class="bulletin-title-box" :style="{ backgroundColor: options.secondaryColor + '30' }">
      <h1>BULLETIN DE NOTES DU {{ periodLabel.toUpperCase() }}</h1>
      <p class="school-year-line">Année scolaire : {{ currentYear }}</p>
    </div>

    <!-- Informations de l'élève -->
    <div class="student-info" :style="{ borderColor: options.primaryColor }">
      <div class="row">
        <div class="cell"><strong>Nom :</strong> {{ student?.lastname || '-' }}</div>
        <div class="cell"><strong>Prénoms :</strong> {{ student?.firstname || '-' }}</div>
      </div>
      <div class="row">
        <div class="cell"><strong>N° Matricule :</strong> {{ student?.matricule || '-' }}</div>
        <div class="cell"><strong>Classe :</strong> {{ student?.grade?.name || '-' }}</div>
      </div>
      <div class="row">
        <div class="cell"><strong>Date de naissance :</strong> {{ formatBirthDay(student?.birthDay) }}</div>
        <div class="cell"><strong>Genre :</strong> {{ student?.sex === 'male' ? 'Masculin' : student?.sex === 'female' ? 'Féminin' : '-' }}</div>
      </div>
    </div>

    <!-- Tableau des notes -->
    <div v-if="processedGrades.length === 0" class="no-grades-message">
      <p>Aucune note disponible pour cette période</p>
    </div>
    <table v-else class="notes-table">
      <thead>
        <tr :style="{ backgroundColor: options.primaryColor, color: '#fff' }">
          <th class="col-matiere">Matières</th>
          <th class="col-coeff">Coeff</th>
          <th class="col-note">Note de cours</th>
          <th class="col-note">Moyenne</th>
          <th class="col-note">Points</th>
          <th>Appréciation</th>
          <th class="col-prof">Professeur</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(grade, index) in processedGrades" :key="index" :class="{ 'row-even': index % 2 === 0 }">
          <td class="text-left">{{ grade.courseName }}</td>
          <td>{{ grade.coefficient }}</td>
          <td :class="getGradeClass(grade.classAverage)">{{ fmt(grade.classAverage) }}</td>
          <td :class="getGradeClass(grade.average)">{{ fmt(grade.average) }}</td>
          <td class="bg-gray">{{ fmt(grade.weightedValue) }}</td>
          <td class="appreciation">{{ grade.appreciation || getAppreciation(grade.average) }}</td>
          <td class="professor-name">{{ grade.professorName || '-' }}</td>
        </tr>
      </tbody>
       <tfoot>
          <tr class="total-row">
            <td class="text-left font-bold">TOTAL</td>
            <td class="font-bold">{{ totalCoefficients }}</td>
            <td></td>
            <td class="bg-gray font-bold">{{ fmt(totalWeightedPoints) }}</td>
            <td colspan="3"></td>
          </tr>
          <tr class="moyenne-generale-row" :style="{ backgroundColor: options.secondaryColor + '20' }">
            <td colspan="3" class="label-moyenne">Moyenne Générale</td>
            <td colspan="4" class="value-moyenne" :style="{ color: options.primaryColor }">
              {{ fmt(generalAverage) }} / 20
            </td>
          </tr>
        </tfoot>
     </table>

     <!-- Détails des notes de cours -->
     <div v-if="hasCourseNotes" class="course-notes-section">
       <div class="section-title">
         Détails des Notes de Cours
       </div>
       <div v-for="grade in processedGrades" :key="grade.courseId" class="course-notes-block">
         <div class="course-header">
           <span class="course-title">{{ grade.courseName }}</span>
           <span class="course-average">Moyenne : {{ fmt(grade.average) }} / 20</span>
         </div>
         <div v-for="(cat, catIndex) in getCourseCategoryNotes(grade)" :key="catIndex" class="note-category">
           <div class="category-header">
             <span class="category-name">{{ cat.categoryName }}</span>
             <span class="category-grades-count">{{ cat.gradesCount }} note(s)</span>
           </div>
           <div class="grades-list">
             <div v-for="(gradeItem, itemIndex) in cat.grades" :key="itemIndex" class="grade-item">
               <span class="grade-text">{{ fmt(gradeItem.score) }}</span>
               <span class="grade-max">/ {{ fmt(gradeItem.maxScore) }}</span>
             </div>
           </div>
           <div class="category-summary">
             <span class="summary-label">Moyenne catégorie :</span>
             <span class="summary-value">{{ fmt(cat.average) }} / 20</span>
           </div>
         </div>
       </div>
     </div>

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
            {{ signatoryLeftLabel }}
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
            {{ signatoryRightLabel }}
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
    signatoryLeft?: string;
    signatoryRight?: string;
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
    secondaryColor: '#3f51b5',
    signatoryLeft: 'Le Professeur Principal',
    signatoryRight: 'Le Directeur'
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

const signatoryLeftLabel = computed(() => props.options?.signatoryLeft || 'Le Professeur Principal');
const signatoryRightLabel = computed(() => props.options?.signatoryRight || 'Le Directeur');

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

  const hasCourseNotes = computed(() => {
    return processedGrades.value.some(g => {
      if (!g.categoryBreakdown) return false;
      const breakdown = Array.isArray(g.categoryBreakdown) 
        ? g.categoryBreakdown 
        : Object.values(g.categoryBreakdown);
      return breakdown.length > 0;
    });
  });

  const getCourseCategoryNotes = (grade: any) => {
    if (!grade.categoryBreakdown) return [];
    const breakdown = Array.isArray(grade.categoryBreakdown) 
      ? grade.categoryBreakdown 
      : Object.values(grade.categoryBreakdown);
    return breakdown.map((cat: any) => ({
      categoryName: cat.categoryName,
      gradesCount: cat.gradesCount,
      grades: cat.grades || [],
      average: cat.average
    })).filter((cat: any) => cat.gradesCount > 0);
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
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  border-bottom: 2px solid #2c3e50;
  padding-bottom: 8px;
}

.header-block {
  width: 48%;
}

.header-left-block {
  text-align: left;
}

.header-right-block {
  text-align: right;
}

.logo-box {
  margin-bottom: 4px;
}

.logo-circle {
  width: 60px;
  height: 60px;
  border: 2px solid #1a237e;
  border-radius: 50%;
  display: inline-flex;
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

.school-name {
  font-size: 14px;
  margin: 4px 0 2px 0;
  font-weight: 900;
  text-transform: uppercase;
}

.school-detail {
  margin: 1px 0;
  font-size: 10px;
  color: #444;
}

.country-name {
  font-size: 13px;
  font-weight: 700;
  text-transform: uppercase;
  margin: 0 0 2px;
}

.country-motto {
  font-size: 10px;
  font-style: italic;
  margin: 0 0 4px;
  color: #333;
}

.ministry-text {
  font-size: 9px;
  text-transform: uppercase;
  margin: 1px 0;
  color: #222;
}

.inspection-text {
  font-size: 9px;
  text-transform: uppercase;
  margin: 1px 0;
  color: #222;
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
  font-size: 20px;
  font-family: "Times New Roman", serif;
  font-weight: 700;
  text-transform: uppercase;
}

.school-year-line {
  font-size: 11px;
  margin: 4px 0 0;
  text-align: right;
  padding-right: 10px;
  color: #444;
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

.no-grades-message {
  text-align: center;
  padding: 30px;
  color: #909399;
  font-size: 14px;
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

 .col-matiere { width: 22%; text-align: left; padding-left: 8px !important; }
 .col-coeff { width: 7%; }
 .col-note { width: 10%; }
 .col-prof { width: 18%; }

.text-left { text-align: left; padding-left: 8px; }
.bg-gray { background-color: #e8e8e8; }
.font-bold { font-weight: bold; }
.row-even { background-color: #fafafa; }

.grade-low { color: #c62828; font-weight: bold; }
.grade-good { color: #2e7d32; }
.grade-excellent { color: #1565c0; font-weight: bold; }

.appreciation { font-size: 10px; font-style: italic; }
.professor-name { font-size: 9px; text-align: left; padding-left: 6px; }

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

 .course-notes-section {
   border: 2px solid #000;
   background-color: #f5f5f5;
   padding: 10px;
   margin-bottom: 10px;
 }

 .section-title {
   font-weight: 700;
   font-size: 12px;
   text-transform: uppercase;
   margin-bottom: 8px;
   padding-bottom: 5px;
   border-bottom: 1px solid #000;
 }

 .course-notes-block {
   border: 1px solid #000;
   margin-bottom: 10px;
   padding: 8px;
   background-color: #fff;
 }

 .course-header {
   display: flex;
   justify-content: space-between;
   align-items: center;
   padding: 6px 8px;
   background-color: #f0f0f0;
   border-bottom: 1px solid #000;
   font-size: 11px;
   font-weight: 700;
 }

 .course-title {
   text-transform: uppercase;
 }

 .course-average {
   font-weight: 700;
   color: #333;
 }

 .note-category {
   border: 1px solid #ccc;
   border-radius: 4px;
   padding: 6px;
   margin-bottom: 8px;
   background-color: #fafafa;
 }

 .category-header {
   display: flex;
   justify-content: space-between;
   align-items: center;
   margin-bottom: 6px;
   font-size: 10px;
   font-weight: 700;
   text-transform: uppercase;
 }

 .category-name {
   color: #000;
 }

 .category-grades-count {
   color: #666;
 }

 .grades-list {
   display: flex;
   flex-wrap: wrap;
   gap: 6px;
   margin-bottom: 6px;
 }

 .grade-item {
   display: flex;
   align-items: baseline;
   gap: 2px;
   font-size: 10px;
   background-color: #e8e8e8;
   padding: 3px 6px;
   border-radius: 3px;
 }

 .grade-text {
   font-weight: 700;
   color: #000;
 }

 .grade-max {
   color: #666;
   font-size: 9px;
 }

 .category-summary {
   display: flex;
   justify-content: flex-end;
   align-items: center;
   gap: 6px;
   font-size: 10px;
   padding-top: 6px;
   border-top: 1px solid #ccc;
 }

 .summary-label {
   font-weight: 700;
   color: #333;
 }

 .summary-value {
   font-weight: 700;
   color: #000;
 }

 @media print {
  .bulletin-template-two {
    width: 100%;
    height: 100%;
    padding: 5mm;
  }
}
</style>