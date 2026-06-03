<template>
  <div class="centralized-notes-container">
    <!-- Header -->
    <div class="header">
      <div class="header-left">
        <div v-if="schoolInfo" class="school-info">
          <div class="school-logo">
            <img v-if="schoolInfo.logo && typeof schoolInfo.logo === 'string' && schoolInfo.logo.startsWith('data:')" :src="schoolInfo.logo" alt="Logo" class="logo-img" />
            <el-icon v-else :size="50"><School /></el-icon>
          </div>
          <div class="school-details">
            <h2>{{ schoolInfo.name }}</h2>
            <p>{{ schoolInfo.address }}</p>
            <p v-if="schoolInfo.phone">{{ schoolInfo.phone }}</p>
            <p v-if="schoolInfo.email">{{ schoolInfo.email }}</p>
          </div>
        </div>
      </div>

      <div class="header-center">
        <div class="title-section">
          <h1>Fiche de Centralisation des Notes</h1>
          <p class="subtitle">Visualisation et classement des résultats scolaires</p>
        </div>
      </div>

      <div class="header-right">
        <el-button
          type="primary"
          @click="exportToPDF"
          :loading="exportingPDF"
        >
          <el-icon><Document /></el-icon>
          Exporter PDF
        </el-button>
        <el-button
          type="success"
          @click="exportToExcel"
          :loading="exportingExcel"
        >
          <el-icon><Download /></el-icon>
          Exporter Excel
        </el-button>
      </div>
    </div>

    <!-- Classe et Période Display -->
    <div class="info-bar">
      <div class="info-item">
        <el-icon><School /></el-icon>
        <span class="info-label">Classe:</span>
        <span class="info-value">{{ currentClass?.name || 'Non sélectionné' }}</span>
      </div>
      <div class="info-item">
        <el-icon><Calendar /></el-icon>
        <span class="info-label">Période:</span>
        <span class="info-value">{{ filters.period || 'Toutes' }}</span>
      </div>
      <div class="info-item">
        <el-icon><TrendCharts /></el-icon>
        <span class="info-label">Moyenne de classe:</span>
        <span class="info-value">{{ classAverage.toFixed(2) }}</span>
      </div>
      <div class="info-item">
        <el-icon><EditPen /></el-icon>
        <span class="info-label">Base de notation:</span>
        <span class="info-value">{{ classConfig?.finalGradeBase || 20 }}</span>
      </div>
    </div>

    <!-- Filters Panel -->
    <div class="filters-panel">
      <div class="filters-grid">
        <el-select
          v-model="filters.gradeId"
          placeholder="Classe"
          clearable
          style="width: 200px"
        >
          <el-option
            v-for="classe in grades"
            :key="classe.id"
            :label="classe.name"
            :value="classe.id"
          />
        </el-select>

        <el-select
          v-model="filters.period"
          placeholder="Période"
          clearable
          @change="onPeriodChange"
          style="width: 200px"
          :disabled="!filters.gradeId"
        >
          <el-option
            v-for="period in periods"
            :key="period"
            :label="period"
            :value="period"
          />
        </el-select>
      </div>

      <!-- Message si aucun grade sélectionné mais qu'il y a des grades -->
      <div v-if="!filters.gradeId && grades.length > 0" class="error-message">
        Sélectionnez un niveau scolaire pour filtrer les données
      </div>

      <!-- Message si aucun grade -->
      <div v-else-if="grades.length === 0" class="empty-state">
        <el-icon><Warning /></el-icon>
        <p>Aucun niveau scolaire trouvé</p>
        <small>Créez des classes ou niveaux scolaires pour voir les classements</small>
      </div>
    </div>

    <!-- Table -->
    <div class="table-container">
      <div v-if="loading" class="loading-state">
        <el-icon class="is-loading"><Loading /></el-icon>
        <span>Chargement des données...</span>
      </div>

      <div v-else-if="!filters.gradeId && grades.length > 0" class="empty-state">
        <el-icon><Warning /></el-icon>
        <p>Veuillez sélectionner un niveau scolaire pour voir les données</p>
      </div>

      <div v-else-if="sortedCourses.length === 0 && filters.gradeId && !loading" class="empty-state">
        <el-icon><Warning /></el-icon>
        <p>Aucune matière trouvée pour le niveau scolaire sélectionné</p>
        <small>Ajoutez des matières au niveau scolaire pour afficher les résultats</small>
      </div>

      <div v-else-if="rankings && rankings.length === 0 && sortedCourses.length > 0 && !loading" class="empty-state">
        <el-icon><Warning /></el-icon>
        <p>Aucune donnée trouvée avec ces filtres</p>
        <small>Le classement centralisé nécessite des notes saisies dans le système</small>
      </div>

      <el-table
          v-else-if="rankings && rankings.length > 0 && !loading"
          :data="paginatedRankings"
          stripe
          border
          row-key="studentId"
          style="width: 96vw"
      >
        <el-table-column fixed type="index" label="Rang" width="80" align="center" :index="1" />

        <el-table-column fixed prop="matricule" label="Matricule" width="180" align="center" />

        <el-table-column fixed prop="firstname" label="Prénom" width="200" align="center" />

        <el-table-column fixed prop="lastname" label="Nom" width="200" align="center" />

          <el-table-column
              v-for="course in sortedCourses"
              :key="course.id"
              :label="course.code || course.id"
              width="150"
              align="center"
          >
           <template #default="scope">
             {{ getStudentScore(scope.row, course.id) || '-' }}
           </template>
         </el-table-column>

         <el-table-column label="Coef" width="120" align="center">
           <template #default="scope">
             {{ getTotalCoef(scope.row) }}
           </template>
         </el-table-column>

         <el-table-column label="Moyenne" width="150" align="center">
           <template #default="scope">
             {{ getStudentAverage(scope.row) }}
           </template>
         </el-table-column>

         <el-table-column label="Observation" width="200" align="center">
           <template #default="scope">
             {{ getStudentObservation(scope.row) }}
           </template>
         </el-table-column>
      </el-table>

      <div v-if="courses.length > 0 && paginatedRankings.length > 0" class="pagination">
        <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="rankings.length"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next, jumper"
            @current-change="onPageChange"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import {ref, computed, onMounted, watch} from 'vue';
import * as XLSX from 'xlsx';
import { ElMessage } from 'element-plus';
import { Document, Download, Loading, Warning, School, Calendar, TrendCharts, EditPen } from '@element-plus/icons-vue';

 interface CentralizedRanking {
   studentId: number;
   matricule: string;
   firstname: string;
   lastname: string;
   generalAverage: number;
   rank: number;
   totalScores: number;
   averageScores: number;
   scores: Array<{
     courseId: number;
     courseName: string;
     score: number;
     coefficient: number;
     weightedScore: number;
   }>;
 }

 enum ObservationType {
   EXCELLENT = "Excellent",
   TRES_BIEN = "Très Bien",
   BIEN = "Bien",
   ASSEZ_BIEN = "Assez Bien",
   PASSABLE = "Passable",
   INSUFFISANT = "Insuffisant",
   TRES_INSUFFISANT = "Très Insuffisant"
 }

interface GradeConfig {
  finalGradeBase: number;
}

interface Grade {
  id: number;
  name: string;
}

interface Filters {
  gradeId?: number;
  period?: string;
}

 interface Course {
   id: number;
   name: string;
   code?: string;
   coefficient: number;
 }

const loading = ref(false);
const exportingPDF = ref(false);
const exportingExcel = ref(false);
const isExportingPDF = ref(false);
const rankings = ref<CentralizedRanking[]>([]);
const grades = ref<any[]>([]);
const periods = ref<string[]>([]);
const courses = ref<Course[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const classConfig = ref<GradeConfig | null>(null);
const currentClass = ref<Grade | null>(null);
const schoolInfo = ref<any>(null);

const sortedCourses = computed(() => {
  return [...courses.value].sort((a, b) => {
    const codeA = (a.code || a.name).toLowerCase();
    const codeB = (b.code || b.name).toLowerCase();
    return codeA.localeCompare(codeB);
  });
});

const paginatedRankings = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return rankings.value.slice(start, end);
});

const filters = ref<Filters>({
  gradeId: undefined,
  period: undefined
});

const classAverage = computed(() => {
  if (rankings.value.length === 0) return 0;
  const total = rankings.value.reduce((sum, r) => sum + r.generalAverage, 0);
  return total / rankings.value.length;
});

const onPageChange = (page: number) => {
  currentPage.value = page;
};

const onPeriodChange = async () => {
  await loadData();
};

// Charger les données depuis le service backend
const loadData = async () => {
  loading.value = true;
  try {
    const requestData: any = {
      gradeId: filters.value.gradeId,
      period: filters.value.period,
      minScore: undefined,
      maxScore: undefined
    };

    const result = await window.ipcRenderer.invoke('gradeEntry:getCentralizedRankings', requestData);

    if (result.success && result.data) {
      rankings.value = result.data;

      const coursesResult = await window.ipcRenderer.invoke('course:getByGrade', filters.value.gradeId);
      if (coursesResult.success && coursesResult.data) {
        courses.value = coursesResult.data.map((course: any) => ({
          id: course.id,
          name: course.name,
          code: course.code || course.id.toString(),
          coefficient: course.coefficient || 1
        }));
      } else {
        courses.value = [];
      }

      if (filters.value.gradeId && isExportingPDF.value) {
        await loadGradeConfigForPDF(filters.value.gradeId);
      }
    } else {
      ElMessage.error(result.message || 'Erreur lors du chargement des données');
      rankings.value = [];
    }
  } catch (error) {
    ElMessage.error('Erreur lors du chargement des données');
    rankings.value = [];
  } finally {
    loading.value = false;
  }
};

const getStudentScore = (student: CentralizedRanking, courseId: number): string | null => {
   const scoreData = student.scores?.find((s) => s.courseId === courseId);
   if (scoreData) {
     return scoreData.score ? scoreData.score.toFixed(1) : null;
   }
   return null;
 };

const getStudentAverage = (student: CentralizedRanking): string => {
   const totalCoef = student.scores?.reduce((sum, s) => sum + s.coefficient, 0) || 0;
   if (totalCoef === 0) return '-';

   let totalWeightedValue = 0;
   student.scores?.forEach((score) => {
     totalWeightedValue += score.score * score.coefficient;
   });

   const average = totalWeightedValue / totalCoef;
   return average.toFixed(2);
 };

const getStudentObservation = (student: CentralizedRanking): string => {
   if (!student.scores || student.scores.length === 0) return '-';

   const base = classConfig?.finalGradeBase || 20;
   const generalAvg = student.generalAverage;

   if (generalAvg >= base - 1) return ObservationType.EXCELLENT;
   if (generalAvg >= base - 2.5) return ObservationType.TRES_BIEN;
   if (generalAvg >= base - 5) return ObservationType.BIEN;
   if (generalAvg >= base - 7.5) return ObservationType.ASSEZ_BIEN;
   if (generalAvg >= base - 10) return ObservationType.PASSABLE;
   if (generalAvg >= base - 15) return ObservationType.INSUFFISANT;
   return ObservationType.TRES_INSUFFISANT;
 };

const getWeightedScore = (student: CentralizedRanking, courseId: number): string | null => {
  if (!courseId || isNaN(courseId)) {
    console.warn('Invalid courseId:', courseId);
    return null;
  }
  const scoreData = student.scores?.find((s) => s.courseId && Number(s.courseId) === Number(courseId));
  if (scoreData && scoreData.score !== undefined && scoreData.score !== null) {
    return scoreData.score.toFixed(1);
  }
  return null;
};

const getTotalCoef = (student: CentralizedRanking): string => {
  let totalCoef = 0;
  student.scores?.forEach((score) => {
    totalCoef += score.coefficient || 0;
  });
  return totalCoef.toString();
};

const getWeightedAverage = (student: CentralizedRanking): string => {
  let totalWeightedValue = 0;
  let totalCoef = 0;
  student.scores?.forEach((score) => {
    totalWeightedValue += score.score * score.coefficient;
    totalCoef += score.coefficient || 0;
  });
  const weightedAverage = totalCoef > 0 ? (totalWeightedValue / totalCoef) : 0;
  const formatted = weightedAverage.toFixed(2).replace(/,/g, '.').replace(/\.0$/, '').replace(/\.00$/, '');
  return formatted;
};

const loadGrades = async () => {
  try {
    const result = await window.ipcRenderer.invoke('grade:getAllGrades');
    if (result.success && result.data) {
      grades.value = result.data;
    }
  } catch (error) {
    console.error('Erreur lors du chargement des niveaux:', error);
  }
};

const loadGradeConfig = async (gradeId: number) => {
  try {
    const schoolResult = await window.ipcRenderer.invoke('school:get');
    if (schoolResult?.success && schoolResult.data) {
      const schoolId = schoolResult.data.id;
      schoolInfo.value = schoolResult.data;
      if (schoolResult.data.logo) {
        const logoResult = await window.ipcRenderer.invoke('school:getLogo', schoolResult.data.logo.id);
        if (logoResult.success && logoResult.data) {
          const base64 = logoResult.data.content.toString('base64');
          schoolInfo.value.logo = `data:${logoResult.data.type};base64,${base64}`;
        }
      }
      const configResult = await window.ipcRenderer.invoke('grade-config:get', {
        schoolId: schoolId,
        classId: gradeId,
        period: filters.value.period
      });

      if (configResult.success && configResult.data) {
        classConfig.value = {
          finalGradeBase: configResult.data.finalGradeBase
        };
        currentClass.value = grades.value.find(g => g.id === gradeId);
      }
    }
  } catch (error) {
    console.error('Erreur chargement config classe:', error);
  }
};

const loadGradeConfigForPDF = async (gradeId: number) => {
  try {
    const schoolResult = await window.ipcRenderer.invoke('school:get');
    if (schoolResult?.success && schoolResult.data) {
      const schoolId = schoolResult.data.id;
      schoolInfo.value = schoolResult.data;
      if (schoolResult.data.logo) {
        const logoResult = await window.ipcRenderer.invoke('school:getLogo', schoolResult.data.logo.id);
        if (logoResult.success && logoResult.data) {
          const base64 = logoResult.data.content.toString('base64');
          schoolInfo.value.logo = `data:${logoResult.data.type};base64,${base64}`;
        }
      }
      const configResult = await window.ipcRenderer.invoke('grade-config:get', {
        schoolId: schoolId,
        classId: gradeId,
        period: filters.value.period
      });

      if (configResult.success && configResult.data) {
        classConfig.value = {
          finalGradeBase: configResult.data.finalGradeBase
        };
        currentClass.value = grades.value.find(g => g.id === gradeId);
      }
    }
  } catch (error) {
    console.error('Erreur chargement config classe:', error);
  }
};

 // Fonction utilitaire pour sérialiser les données pour IPC
const serializeForIPC = () => {
  const base = classConfig?.finalGradeBase || 20;
  const className = currentClass?.name || (filters.value.gradeId ? grades.value.find(g => g.id === filters.value.gradeId)?.name : 'Toutes');

  // Sérialiser les informations de l'école
  const serializedSchoolInfo = schoolInfo.value ? {
    id: schoolInfo.value.id,
    name: schoolInfo.value.name,
    address: schoolInfo.value.address,
    phone: schoolInfo.value.phone,
    email: schoolInfo.value.email,
    logo: schoolInfo.value.logo || null
  } : null;

   // Sérialiser les courses
   const serializedCourses = courses.value.map(c => ({
     id: c.id,
     code: c.code || c.name,
     coefficient: c.coefficient
   }));

  // Sérialiser les rankings en créant des objets à la main
  const serializedRankings = [];
  for (let i = 0; i < rankings.value.length; i++) {
    const r = rankings.value[i];
    const scores = [];
    if (r.scores && Array.isArray(r.scores)) {
      for (let j = 0; j < r.scores.length; j++) {
        const s = r.scores[j];
        scores.push({
          courseId: s.courseId,
          courseName: s.courseName,
          score: s.score,
          coefficient: s.coefficient
        });
      }
    }
    serializedRankings.push({
      studentId: r.studentId,
      matricule: r.matricule || '',
      firstname: r.firstname,
      lastname: r.lastname,
      generalAverage: r.generalAverage,
      rank: r.rank,
      totalScores: r.totalScores,
      averageScores: r.averageScores,
      scores: scores
    });
  }

  // Sérialiser les filtres
  const serializedFilters = {
    gradeId: filters.value.gradeId,
    period: filters.value.period
  };

  // Sérialiser classInfo
  const classInfo = {
    name: className,
    base: base
  };

  return {
    rankings: serializedRankings,
    courses: serializedCourses,
    filters: serializedFilters,
    classAverage: classAverage.value,
    schoolInfo: serializedSchoolInfo,
    classInfo,
    totalStudents: serializedRankings.length
  };
};

  const exportToPDF = async () => {
   if (!rankings.value || rankings.value.length === 0) {
     ElMessage.warning('Aucune donnée à exporter');
     return;
   }

   if (!schoolInfo.value?.id && filters.value.gradeId) {
     await loadGradeConfig(filters.value.gradeId);
   }

   exportingPDF.value = true;
   isExportingPDF.value = true;
   try {
     console.log('=== GÉNÉRATION PDF CENTRALISÉ ===');

     const serializableData = serializeForIPC();

     console.log('Informations école:', serializableData.schoolInfo);
     console.log('Informations classe:', serializableData.classInfo);
     console.log('Filtres:', serializableData.filters);
     console.log('Nombre de rankings:', serializableData.rankings.length);

     const htmlContent = generateCentralizedPDFHtml(serializableData);
     
     const printWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
     
     if (printWindow) {
       printWindow.document.write(htmlContent);
       printWindow.document.close();
       
       printWindow.onload = () => {
         setTimeout(() => {
           printWindow.focus();
           printWindow.print();
         }, 500);
       };
       
       setTimeout(() => {
         if (printWindow && !printWindow.closed) {
           printWindow.focus();
           printWindow.print();
         }
       }, 1000);
       
       ElMessage.success('Fenêtre d\'impression ouverte');
     } else {
       ElMessage.error('Popup bloquée. Veuillez autoriser les popups.');
     }
   } catch (error) {
     console.error('Erreur lors de la génération du PDF:', error);
     ElMessage.error('Erreur lors de la génération du PDF');
   } finally {
     exportingPDF.value = false;
     isExportingPDF.value = false;
   }
  };

  const generateCentralizedPDFHtml = (data: any): string => {
    const { rankings: students, courses, schoolInfo, classInfo, filters, classAverage } = data;
    const period = filters?.period || 'Trimestre 1';
    const className = classInfo?.name || 'Classe';
    const base = classInfo?.base || 20;
    const schoolYear = new Date().getFullYear() + '-' + (new Date().getFullYear() + 1);

    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Fiche de Centralisation des Notes</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    @page {
      size: landscape;
      margin: 3mm;
    }

    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #f5f5f5;
      padding: 5px;
    }

    .page {
      background: white;
      padding: 8px;
      min-height: 98vh;
      page-break-after: always;
    }

    .page:last-child {
      page-break-after: avoid;
    }

    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid #333;
    }

    .header-left {
      flex: 1;
      text-align: left;
    }

    .header-center {
      flex: 0 0 auto;
      display: flex;
      justify-content: center;
    }

    .header-right {
      flex: 1;
      text-align: right;
    }

    .institution-info {
      font-size: 10px;
      line-height: 1.3;
      color: #000;
      font-weight: 500;
    }

    .institution-info p {
      margin: 0;
      text-transform: uppercase;
    }

    .logo {
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .logo img {
      max-width: 50px;
      max-height: 50px;
      object-fit: contain;
    }

    .logo-placeholder {
      width: 50px;
      height: 50px;
      background: #1a237e;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: white;
      font-size: 22px;
    }

    .title-banner {
      background: #f8bbd0;
      border-radius: 4px;
      padding: 8px 15px;
      text-align: center;
      margin-bottom: 6px;
    }

    .title-banner h1 {
      font-size: 14px;
      font-weight: 700;
      text-transform: uppercase;
      color: #000;
      margin-bottom: 2px;
    }

    .title-banner .subtitle {
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
      color: #333;
    }

    .info-row {
      display: flex;
      justify-content: space-between;
      font-size: 11px;
      font-weight: 600;
      color: #000;
      margin-bottom: 6px;
      padding: 5px 12px;
      background: #e8eaf6;
      border-radius: 3px;
    }

    .page-info {
      font-size: 10px;
      color: #666;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10px;
      table-layout: fixed;
    }

    th, td {
      border: 1px solid #333;
      padding: 4px 3px;
      text-align: center;
    }

    th {
      background: #1a237e;
      color: white;
      font-weight: 600;
      font-size: 9px;
      text-transform: uppercase;
    }

    td {
      background-color: white;
    }

    tr:nth-child(even) td {
      background-color: #f5f5f5;
    }

    .rank-cell {
      background: #1a237e !important;
      color: white;
      font-weight: bold;
    }

    .course-header {
      font-size: 8px;
      background: #3949ab;
    }

    .total-row td {
      background-color: #e8f4f8;
      font-weight: bold;
      color: #2c3e50;
    }

    .average-row td {
      background-color: #e8f4f8;
      font-weight: bold;
      color: #2c3e50;
    }

    @media print {
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        color-adjust: exact !important;
      }

      body {
        background: white;
        padding: 0;
      }

      .page {
        box-shadow: none;
        padding: 3mm;
        min-height: 97vh;
      }

      .header-section {
        margin-bottom: 4px;
        padding-bottom: 3px;
      }

      .institution-info {
        font-size: 9px;
      }

      .logo, .logo-placeholder {
        width: 40px;
        height: 40px;
      }

      .title-banner {
        padding: 5px 10px;
        margin-bottom: 4px;
      }

      .title-banner h1 {
        font-size: 11px;
      }

      .title-banner .subtitle {
        font-size: 9px;
      }

      .info-row {
        font-size: 9px;
        padding: 4px 8px;
        margin-bottom: 4px;
      }

      th, td {
        padding: 3px 2px;
        font-size: 8px;
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header-section">
      <div class="header-left">
        <div class="institution-info">
          <p>MINISTÈRE DE L'ÉDUCATION NATIONALE</p>
          <p>${schoolInfo?.name || 'École'}</p>
          ${schoolInfo?.address ? `<p>${schoolInfo.address}</p>` : ''}
          ${schoolInfo?.phone ? `<p>Tél: ${schoolInfo.phone}</p>` : ''}
        </div>
      </div>
      <div class="header-center">
        <div class="logo">
          ${schoolInfo?.logo ? `<img src="${schoolInfo.logo}" alt="Logo">` : '<div class="logo-placeholder">🏫</div>'}
        </div>
      </div>
      <div class="header-right">
        <div class="institution-info">
          <p> RÉPUBLIQUE DE GUINÉE</p>
          <p>TRAVAIL - JUSTICE - SOLIDARITÉ</p>
          <p>MINISTÈRE DE L'ÉDUCATION NATIONALE</p>
        </div>
      </div>
    </div>

    <div class="title-banner">
      <h1>REGISTRE DE CONSERVATION DES NOTES</h1>
      <div class="subtitle">${period}</div>
    </div>

    <div class="info-row">
      <span>Classe : ${className}</span>
      <span>Année Scolaire : ${schoolYear}</span>
    </div>

    <table>
      <thead>
        <tr>
          <th class="rank-cell" style="width: 40px;">RANG</th>
          <th class="rank-cell" style="width: 70px;">MATRICULE</th>
          <th class="rank-cell" style="width: 80px;">PRÉNOM</th>
          <th class="rank-cell" style="width: 80px;">NOM</th>
          ${courses.map((c: any) => `<th class="course-header" style="min-width: 50px;">${c.code || c.name}</th>`).join('')}
          <th class="rank-cell" style="width: 40px;">COEF</th>
          <th class="rank-cell" style="width: 50px;">MOYENNE</th>
        </tr>
      </thead>
      <tbody>
        ${students.map((r: any) => `
          <tr>
            <td class="rank-cell">${r.rank}</td>
            <td>${r.matricule || '-'}</td>
            <td>${r.firstname}</td>
            <td>${r.lastname}</td>
            ${courses.map((c: any) => {
              const score = r.scores?.find((s: any) => s.courseId === c.id);
              return `<td>${score ? score.score.toFixed(1) : '-'}</td>`;
            }).join('')}
            <td>${r.totalScores}</td>
            <td class="average-row">${r.generalAverage.toFixed(2)}</td>
          </tr>
        `).join('')}
      </tbody>
      <tfoot>
        <tr class="total-row">
          <td colspan="4">MOYENNE GÉNÉRALE DE LA CLASSE</td>
          ${courses.map(() => `<td>-</td>`).join('')}
          <td colspan="2">${classAverage?.toFixed(2) || '0.00'} / ${base}</td>
        </tr>
      </tfoot>
    </table>
  </div>
</body>
</html>`;
  };

// Exporter vers Excel
const exportToExcel = async () => {
  exportingExcel.value = true;
  try {
    if (!rankings.value || rankings.value.length === 0) {
      ElMessage.warning('Aucune donnée à exporter');
      return;
    }

    const base = classConfig?.finalGradeBase || 20;
    const className = currentClass?.name || (filters.value.gradeId ? grades.value.find(g => g.id === filters.value.gradeId)?.name : 'Toutes');

    console.log('=== EXPORT EXCEL ===');
    console.log('Courses chargées:', sortedCourses.value);
    console.log('Courses avec IDs:', sortedCourses.value.map(c => ({ id: c.id, name: c.name, type: typeof c.id })));

    // Créer la structure des données pour le tableau centralisé
    // Créer un tableau avec des colonnes avec les coefficients affichés
    const coursesWithCoeff = sortedCourses.value.map(c => ({
      name: c.name,
      coefficient: c.coefficient,
      header: `${c.name} (Coef ${c.coefficient})`,
      id: c.id ? Number(c.id) : null
    }));

    const columns = [
      { header: 'Rang', key: 'rang', width: 8 },
      { header: 'Matricule', key: 'matricule', width: 15 },
      { header: 'Prénom', key: 'prenom', width: 15 },
      { header: 'Nom', key: 'nom', width: 15 },
      ...coursesWithCoeff.map(c => ({ header: c.header, key: c.name, width: 18 })),
      { header: 'Coef', key: 'coef', width: 10 },
      { header: 'Moyenne', key: 'moyenne', width: 12 },
      { header: 'Observation', key: 'observation', width: 20 }
    ];

    // Construire le tableau de données correctement
    const wsData: any[] = [];

    // Ajouter l'en-tête principal
    wsData.push([`${schoolInfo.value?.name || ''} - FICHE DE CENTRALISATION DES NOTES`]);
    wsData.push([]); // Ligne vide

    // Ajouter le logo de l'école si disponible
    if (schoolInfo.value?.logo) {
      wsData.push([schoolInfo.value.logo]);
      wsData.push([]);
    }

    // Ajouter les informations générales
    wsData.push(['Classe', className]);
    wsData.push(['Base de notation', base]);
    wsData.push(['Période', filters.value.period || 'Toutes']);
    wsData.push([]); // Ligne vide

    // Créer un tableau avec tous les en-têtes sur une seule ligne
    const headersRow: any[] = ['Rang', 'Matricule', 'Prénom', 'Nom'];
    coursesWithCoeff.forEach(c => {
      headersRow.push(c.header);
    });
    headersRow.push('Coef', 'Moyenne', 'Observation');
    wsData.push(headersRow);

    // Créer un tableau avec toutes les données
    const dataRows: any[] = [];
    rankings.value.forEach((student, index) => {
      const rowData: any[] = [
        student.rank,
        student.matricule || '-',
        student.firstname,
        student.lastname
      ];

      coursesWithCoeff.forEach(c => {
        console.log(`Étudiant ${index}, matière ${c.name}: courseId=${c.id}, scores.length=${student.scores?.length}`);
        const score = getWeightedScore(student, c.id);
        console.log(`Score trouvé: ${score}`);
        rowData.push(score || '-');
      });

      rowData.push(getTotalCoef(student));
      rowData.push(getWeightedAverage(student));
      rowData.push('-');
      dataRows.push(rowData);
    });
    wsData.push(...dataRows);

    // Créer le fichier Excel avec xlsx library
    const ws = XLSX.utils.aoa_to_sheet(wsData);

    // Ajuster la largeur des colonnes
    ws['!cols'] = columns.map(col => col.width);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Centralisation Notes');

    // Télécharger le fichier
    const fileName = `Centralisation_Notes_${className}_${filters.value.period || 'Toutes'}.xlsx`;
    XLSX.writeFile(wb, fileName);
    ElMessage.success('Excel exporté avec succès');
  } catch (error) {
    console.error('Erreur lors de la génération du Excel:', error);
    ElMessage.error('Erreur lors de la génération du Excel');
  } finally {
    exportingExcel.value = false;
  }
};


// Initialisation
onMounted(async () => {
  await loadGrades();
  await loadPeriods();
});

const loadPeriods = async () => {
  try {
    const currentYearRes = await window.ipcRenderer.invoke('yearRepartition:getCurrent');
    if (currentYearRes.success && currentYearRes.data) {
      const yearConfig = currentYearRes.data;
      periods.value = yearConfig.periodConfigurations.map((p: any) => p.name);
    } else {
      periods.value = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
      ElMessage.warning('Aucune année scolaire en cours. Périodes par défaut utilisées.');
    }
  } catch (error) {
    periods.value = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
  }
};
</script>

<style scoped>
.centralized-notes-container {
  padding: 20px;
  background-color: #f5f5f5;
  min-height: 100vh;
  overflow-y: auto;
  box-sizing: border-box;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 24px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
  flex-shrink: 0;
}

.school-info {
  display: flex;
  align-items: center;
  gap: 16px;
}

.school-logo {
  width: 70px;
  height: 70px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 12px;
  color: white;
  overflow: hidden;
}

.logo-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  border-radius: 12px;
}

.school-details h2 {
  margin: 0 0 4px 0;
  font-size: 18px;
  color: #303133;
  font-weight: 600;
}

.school-details p {
  margin: 0;
  font-size: 13px;
  color: #606266;
}

.header-center {
  flex: 1;
  display: flex;
  justify-content: center;
}

.title-section {
  text-align: center;
}

.title-section h1 {
  margin: 0 0 8px 0;
  font-size: 28px;
  color: #303133;
  font-weight: 700;
}

.subtitle {
  margin: 0;
  font-size: 14px;
  color: #909399;
}

.header-right {
  display: flex;
  gap: 12px;
  flex-shrink: 0;
}

.info-bar {
  display: flex;
  justify-content: space-around;
  align-items: center;
  background: white;
  border-radius: 8px;
  padding: 16px 24px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.info-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #606266;
}

.info-label {
  color: #909399;
  font-weight: 500;
}

.info-value {
  color: #303133;
  font-weight: 600;
  font-size: 15px;
}

.filters-panel {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.filters-grid {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.filters-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.table-container {
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
  overflow-y: auto;
  max-height: calc(100vh - 400px);
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #909399;

  .el-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }
}

:deep(.el-table) {
  font-size: 18px;
  line-height: 2;
}

:deep(.el-table th.el-table__cell) {
  font-size: 17px;
  font-weight: 600;
  padding: 14px 0;
}

:deep(.el-table td.el-table__cell) {
  padding: 12px 0;
}

:deep(.el-table .cell) {
  padding: 0 10px;
}

@media print {
  * {
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
    color-adjust: exact !important;
  }

  .header {
    display: flex !important;
    print-color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }

  :deep(.el-table) {
    font-size: 18px !important;
    line-height: 2 !important;
  }

  :deep(.el-table th.el-table__cell) {
    font-size: 17px !important;
    font-weight: 600 !important;
    padding: 14px 0 !important;
    background-color: #f5f7fa !important;
    color: #303133 !important;
  }

  :deep(.el-table td.el-table__cell) {
    padding: 12px 0 !important;
  }

  :deep(.el-table .cell) {
    padding: 0 10px !important;
  }

  :deep(.el-table--striped .el-table__body tr.el-table__row--striped td.el-table__cell) {
    background-color: #fafafa !important;
  }

  :deep(.el-table__header-wrapper) {
    print-color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }

  :deep(.el-table__body tr:hover td.el-table__cell) {
    background-color: #f0f0f0 !important;
  }

  .school-logo img {
    print-color-adjust: exact !important;
    -webkit-print-color-adjust: exact !important;
  }
}
</style>
