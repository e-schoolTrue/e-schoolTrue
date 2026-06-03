<template>
  <div class="annual-pv-container">
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
          <h1>Procès-Verbal Annuel</h1>
          <p class="subtitle">Synthèse des résultats de l'année scolaire</p>
        </div>
      </div>

      <div class="header-right">
        <el-button type="primary" @click="exportToPDF" :loading="exportingPDF">
          <el-icon><Document /></el-icon>
          Exporter PDF
        </el-button>
      </div>
    </div>

    <!-- Info Bar -->
    <div class="info-bar">
      <div class="info-item">
        <el-icon><School /></el-icon>
        <span class="info-label">Classe:</span>
        <span class="info-value">{{ currentClass?.name || 'Non sélectionné' }}</span>
      </div>
      <div class="info-item">
        <el-icon><User /></el-icon>
        <span class="info-label">Professeur Principal:</span>
        <span class="info-value">{{ mainTeacherName || 'Non défini' }}</span>
      </div>
      <div class="info-item">
        <el-icon><TrendCharts /></el-icon>
        <span class="info-label">Moyenne Générale:</span>
        <span class="info-value">{{ classAverage.toFixed(2) }}</span>
      </div>
      <div class="info-item">
        <el-icon><Star /></el-icon>
        <span class="info-label">Appréciation:</span>
        <span class="info-value">{{ generalAppreciation }}</span>
      </div>
      <div class="info-item">
        <el-icon><Calendar /></el-icon>
        <span class="info-label">Année Scolaire:</span>
        <span class="info-value">{{ schoolYear }}</span>
      </div>
    </div>

    <!-- Filters -->
    <div class="filters-panel">
      <div class="filters-grid">
        <el-select v-model="filters.gradeId" placeholder="Classe" clearable style="width: 200px">
          <el-option v-for="classe in grades" :key="classe.id" :label="classe.name" :value="classe.id" />
        </el-select>
      </div>
      <div v-if="!filters.gradeId && grades.length > 0" class="error-message">
        Sélectionnez un niveau scolaire pour afficher le Procès-Verbal Annuel
      </div>
      <div v-else-if="grades.length === 0" class="empty-state">
        <el-icon><Warning /></el-icon>
        <p>Aucun niveau scolaire trouvé</p>
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
        <p>Veuillez sélectionner un niveau scolaire</p>
      </div>

      <div v-else-if="rankings.length === 0 && filters.gradeId && !loading" class="empty-state">
        <el-icon><Warning /></el-icon>
        <p>Aucune donnée trouvée</p>
        <small>Le PV Annuel nécessite des notes saisies pour les 3 trimestres</small>
      </div>

      <el-table v-else-if="rankings.length > 0 && !loading" :data="paginatedRankings" stripe border row-key="studentId" style="width: 100%">
        <el-table-column fixed prop="rank" label="Rang" width="60" align="center" />

        <el-table-column fixed prop="firstname" label="Prénom" width="150" align="center" />
        <el-table-column fixed prop="lastname" label="Nom" width="150" align="center" />

        <el-table-column label="TRIM 1" width="80" align="center">
          <template #default="scope">{{ scope.row.trim1Average.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="TRIM 2" width="80" align="center">
          <template #default="scope">{{ scope.row.trim2Average.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="TRIM 3" width="80" align="center">
          <template #default="scope">{{ scope.row.trim3Average.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="ANNUEL" width="90" align="center">
          <template #default="scope">
            <strong>{{ scope.row.annualAverage.toFixed(2) }}</strong>
          </template>
        </el-table-column>

        <el-table-column label="Distinctions" align="center">
          <el-table-column label="TH" width="50" align="center">
            <template #default="scope">{{ scope.row.distinctions.tableauHonneur ? 'X' : '' }}</template>
          </el-table-column>
          <el-table-column label="Enc." width="60" align="center">
            <template #default="scope">{{ scope.row.distinctions.encouragements ? 'X' : '' }}</template>
          </el-table-column>
          <el-table-column label="Félic." width="60" align="center">
            <template #default="scope">{{ scope.row.distinctions.felicitations ? 'X' : '' }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column label="Discipline" align="center">
          <el-table-column label="Av-T" width="55" align="center">
            <template #default="scope">{{ scope.row.discipline.avertissementTravail ? 'X' : '' }}</template>
          </el-table-column>
          <el-table-column label="B-T" width="45" align="center">
            <template #default="scope">{{ scope.row.discipline.blameTravail ? 'X' : '' }}</template>
          </el-table-column>
          <el-table-column label="Av-C" width="55" align="center">
            <template #default="scope">{{ scope.row.discipline.avertissementConduite ? 'X' : '' }}</template>
          </el-table-column>
          <el-table-column label="B-C" width="45" align="center">
            <template #default="scope">{{ scope.row.discipline.blameConduite ? 'X' : '' }}</template>
          </el-table-column>
          <el-table-column label="EJ" width="45" align="center">
            <template #default="scope">{{ scope.row.discipline.exclusionTemporaire ? 'X' : '' }}</template>
          </el-table-column>
        </el-table-column>

        <el-table-column label="Décision" width="120" align="center" fixed="right">
          <template #default="scope">
            <el-tag :type="scope.row.finalDecision === 'Admis' ? 'success' : 'danger'" size="small">
              {{ scope.row.finalDecision }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <div v-if="rankings.length > 0 && !loading" class="pagination">
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

    <!-- Statistics Table -->
    <div v-if="rankings.length > 0 && !loading" class="stats-container">
      <h3>Statistiques Globales</h3>
      <el-table :data="statsTableData" border style="width: 100%" :show-header="true" :cell-style="cellStyle">
        <el-table-column prop="category" label="" width="120" align="center" />
        <el-table-column prop="effectif" label="Effectif" width="100" align="center" />
        <el-table-column prop="presents" label="Présents" width="100" align="center" />
        <el-table-column prop="percentPresents" label="% Présents" width="110" align="center">
          <template #default="scope">{{ scope.row.percentPresents.toFixed(1) }}%</template>
        </el-table-column>
        <el-table-column prop="admis" label="Admis" width="100" align="center" />
        <el-table-column prop="percentAdmis" label="% Admis" width="110" align="center">
          <template #default="scope">{{ scope.row.percentAdmis.toFixed(1) }}%</template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';
import { Document, Loading, Warning, School, Calendar, TrendCharts, Star, User } from '@element-plus/icons-vue';

interface AnnualDistinctions {
  tableauHonneur: boolean;
  encouragements: boolean;
  felicitations: boolean;
}

interface AnnualDiscipline {
  avertissementTravail: boolean;
  blameTravail: boolean;
  avertissementConduite: boolean;
  blameConduite: boolean;
  exclusionTemporaire: boolean;
}

interface AnnualStudentRecord {
  studentId: number;
  matricule: string;
  firstname: string;
  lastname: string;
  sex: 'male' | 'female';
  trim1Average: number;
  trim2Average: number;
  trim3Average: number;
  annualAverage: number;
  rank: number;
  totalScores: number;
  averageScores: number;
  distinctions: AnnualDistinctions;
  discipline: AnnualDiscipline;
  finalDecision: string;
}

interface Filters {
  gradeId?: number;
}

interface Grade {
  id: number;
  name: string;
}

const loading = ref(false);
const exportingPDF = ref(false);
const rankings = ref<AnnualStudentRecord[]>([]);
const grades = ref<Grade[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const classConfig = ref<{ finalGradeBase: number } | null>(null);
const currentClass = ref<Grade | null>(null);
const schoolInfo = ref<any>(null);
const mainTeacherName = ref<string>('');

const schoolYear = computed(() => {
  const currentYear = new Date().getFullYear();
  return `${currentYear}-${currentYear + 1}`;
});

const paginatedRankings = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return rankings.value.slice(start, end);
});

const filters = ref<Filters>({
  gradeId: undefined
});

const classAverage = computed(() => {
  if (rankings.value.length === 0) return 0;
  const total = rankings.value.reduce((sum, r) => sum + r.annualAverage, 0);
  return total / rankings.value.length;
});

const generalAppreciation = computed(() => {
  const avg = classAverage.value;
  const base = classConfig.value?.finalGradeBase || 20;
  if (avg >= base - 1) return 'Excellent';
  if (avg >= base - 2.5) return 'Très Bien';
  if (avg >= base - 5) return 'Bien';
  if (avg >= base - 7.5) return 'Assez Bien';
  if (avg >= base - 10) return 'Passable';
  if (avg >= base - 15) return 'Insuffisant';
  return 'Très Insuffisant';
});

const onPageChange = (page: number) => {
  currentPage.value = page;
};

const loadData = async () => {
  loading.value = true;
  try {
    const requestData = {
      gradeId: filters.value.gradeId,
      schoolYear: schoolYear.value
    };

    const result = await window.ipcRenderer.invoke('gradeEntry:getAnnualRankings', requestData);

    if (result.success && result.data) {
      rankings.value = result.data;
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
        classId: gradeId
      });

      if (configResult.success && configResult.data) {
        classConfig.value = {
          finalGradeBase: configResult.data.finalGradeBase
        };
        currentClass.value = grades.value.find(g => g.id === gradeId) || null;
      }
    }
  } catch (error) {
    console.error('Erreur chargement config classe:', error);
  }
};

const statsTableData = computed(() => {
  const boys = rankings.value.filter(r => r.sex === 'male');
  const girls = rankings.value.filter(r => r.sex === 'female');

  const computeStats = (list: AnnualStudentRecord[]) => {
    const effectif = list.length;
    const presents = list.filter(r => r.annualAverage > 0).length;
    const admis = list.filter(r => r.annualAverage >= 10).length;
    return {
      effectif,
      presents,
      percentPresents: effectif > 0 ? (presents / effectif) * 100 : 0,
      admis,
      percentAdmis: presents > 0 ? (admis / presents) * 100 : 0
    };
  };

  const boysStats = computeStats(boys);
  const girlsStats = computeStats(girls);
  const totalStats = computeStats(rankings.value);

  return [
    { category: 'Garçons', ...boysStats },
    { category: 'Filles', ...girlsStats },
    { category: 'TOTAL', ...totalStats }
  ];
});

const cellStyle = ({ rowIndex }: { rowIndex: number }) => {
  if (rowIndex === 2) {
    return { backgroundColor: '#f0f9ff', fontWeight: 'bold' };
  }
  return {};
};

watch(() => filters.value.gradeId, async (newGradeId) => {
  if (newGradeId) {
    await loadGradeConfig(newGradeId);
    await loadData();
  } else {
    rankings.value = [];
    currentClass.value = null;
    classConfig.value = null;
    schoolInfo.value = null;
  }
});

const serializeForIPC = () => {
  const base = classConfig.value?.finalGradeBase || 20;
  const className = currentClass.value?.name || 'Toutes';

  const serializedSchoolInfo = schoolInfo.value ? {
    id: schoolInfo.value.id,
    name: schoolInfo.value.name,
    address: schoolInfo.value.address,
    phone: schoolInfo.value.phone,
    email: schoolInfo.value.email,
    logo: schoolInfo.value.logo || null
  } : null;

  const serializedRankings = rankings.value.map(r => ({
    studentId: r.studentId,
    matricule: r.matricule || '',
    firstname: r.firstname,
    lastname: r.lastname,
    sex: r.sex,
    trim1Average: r.trim1Average,
    trim2Average: r.trim2Average,
    trim3Average: r.trim3Average,
    annualAverage: r.annualAverage,
    rank: r.rank,
    distinctions: r.distinctions,
    discipline: r.discipline,
    finalDecision: r.finalDecision
  }));

  const serializedFilters = {
    gradeId: filters.value.gradeId
  };

  const classInfo = {
    name: className,
    base: base,
    mainTeacher: mainTeacherName.value || 'Non défini'
  };

  return {
    rankings: serializedRankings,
    filters: serializedFilters,
    classAverage: classAverage.value,
    generalAppreciation: generalAppreciation.value,
    schoolInfo: serializedSchoolInfo,
    classInfo,
    totalStudents: serializedRankings.length,
    stats: statsTableData.value,
    schoolYear: schoolYear.value
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
  try {
    const serializableData = serializeForIPC();
    const htmlContent = generatePVHtml(serializableData);

    const printWindow = window.open('', '_blank', 'width=1400,height=900,scrollbars=yes,resizable=yes');

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
  }
};

const generatePVHtml = (data: any): string => {
  const { rankings: students, classInfo, classAverage, generalAppreciation, schoolInfo, schoolYear, stats } = data;
  const className = classInfo?.name || 'Classe';
  const mainTeacher = classInfo?.mainTeacher || 'Non défini';

  const statsRows = (stats || []).map((s: any) => `
    <tr class="${s.category === 'TOTAL' ? 'total-row' : ''}">
      <td class="label-cell">${s.category}</td>
      <td>${s.effectif}</td>
      <td>${s.presents}</td>
      <td>${s.percentPresents.toFixed(1)}%</td>
      <td>${s.admis}</td>
      <td>${s.percentAdmis.toFixed(1)}%</td>
    </tr>
  `).join('');

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Procès-Verbal Annuel</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    @page { size: landscape; margin: 5mm; }
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background: #fff;
      padding: 5px;
      font-size: 9px;
    }
    .page {
      background: white;
      padding: 6px;
      min-height: 98vh;
      page-break-after: always;
    }
    .page:last-child { page-break-after: avoid; }
    .header-section {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 6px;
      padding-bottom: 4px;
      border-bottom: 2px solid #333;
    }
    .header-left { flex: 1; text-align: left; }
    .header-center { flex: 0 0 auto; display: flex; justify-content: center; }
    .header-right { flex: 1; text-align: right; }
    .institution-info {
      font-size: 9px;
      line-height: 1.3;
      color: #000;
      font-weight: 500;
    }
    .institution-info p { margin: 0; text-transform: uppercase; }
    .logo { width: 45px; height: 45px; display: flex; align-items: center; justify-content: center; }
    .logo img { max-width: 45px; max-height: 45px; object-fit: contain; }
    .logo-placeholder {
      width: 45px; height: 45px; background: #1a237e; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      color: white; font-size: 20px;
    }
    .title-banner {
      background: #f8bbd0; border-radius: 4px; padding: 6px 12px;
      text-align: center; margin-bottom: 6px;
    }
    .title-banner h1 {
      font-size: 13px; font-weight: 700; text-transform: uppercase;
      color: #000; margin-bottom: 2px;
    }
    .title-banner .subtitle {
      font-size: 11px; font-weight: 600; text-transform: uppercase; color: #333;
    }
    .info-row {
      display: flex; justify-content: space-between; flex-wrap: wrap;
      font-size: 10px; font-weight: 600; color: #000;
      margin-bottom: 6px; padding: 4px 10px;
      background: #e8eaf6; border-radius: 3px;
    }
    .info-row span { margin-right: 12px; }
    table.main-table {
      width: 100%; border-collapse: collapse;
      font-size: 9px; table-layout: fixed; margin-bottom: 8px;
    }
    th, td {
      border: 1px solid #333; padding: 3px 2px; text-align: center;
    }
    th {
      background: #1a237e; color: white; font-weight: 600;
      font-size: 8px; text-transform: uppercase;
    }
    .rank-cell { background: #1a237e !important; color: white !important; font-weight: bold; }
    .distinction-cell { font-weight: bold; color: #1a237e; }
    .decision-admis { color: #2e7d32; font-weight: bold; }
    .decision-redouble { color: #c62828; font-weight: bold; }
    tr:nth-child(even) td { background-color: #f5f5f5; }
    .stats-section { margin-top: 10px; }
    .stats-section h3 {
      font-size: 11px; text-transform: uppercase;
      margin-bottom: 4px; color: #1a237e;
    }
    table.stats-table {
      width: 60%; border-collapse: collapse;
      font-size: 9px; table-layout: fixed;
    }
    table.stats-table th { background: #3949ab; }
    table.stats-table .label-cell { font-weight: bold; background: #e8eaf6; }
    table.stats-table .total-row td { background: #fff3e0; font-weight: bold; }
    @media print {
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
      body { background: white; padding: 0; }
      .page { box-shadow: none; padding: 3mm; min-height: 97vh; }
      .institution-info { font-size: 8px; }
      .logo, .logo-placeholder { width: 40px; height: 40px; }
      .title-banner { padding: 4px 8px; margin-bottom: 4px; }
      .title-banner h1 { font-size: 10px; }
      .title-banner .subtitle { font-size: 8px; }
      .info-row { font-size: 8px; padding: 3px 6px; margin-bottom: 4px; }
      th, td { padding: 2px 1px; font-size: 7px; }
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
          <p>RÉPUBLIQUE DE GUINÉE</p>
          <p>TRAVAIL - JUSTICE - SOLIDARITÉ</p>
          <p>MINISTÈRE DE L'ÉDUCATION NATIONALE</p>
        </div>
      </div>
    </div>

    <div class="title-banner">
      <h1>Procès-Verbal Annuel</h1>
      <div class="subtitle">Synthèse des résultats de l'année scolaire</div>
    </div>

    <div class="info-row">
      <span>Classe : ${className}</span>
      <span>Professeur Principal : ${mainTeacher}</span>
      <span>Moyenne Générale : ${classAverage?.toFixed(2) || '0.00'}</span>
      <span>Appréciation : ${generalAppreciation}</span>
      <span>Année Scolaire : ${schoolYear}</span>
    </div>

    <table class="main-table">
      <thead>
        <tr>
          <th class="rank-cell" style="width: 35px;">RANG</th>
          <th class="rank-cell" style="width: 70px;">PRÉNOM</th>
          <th class="rank-cell" style="width: 70px;">NOM</th>
          <th style="width: 45px;">TRIM 1</th>
          <th style="width: 45px;">TRIM 2</th>
          <th style="width: 45px;">TRIM 3</th>
          <th style="width: 50px;">ANNUEL</th>
          <th style="width: 35px;">TH</th>
          <th style="width: 40px;">Enc.</th>
          <th style="width: 40px;">Félic.</th>
          <th style="width: 35px;">Av-T</th>
          <th style="width: 30px;">B-T</th>
          <th style="width: 35px;">Av-C</th>
          <th style="width: 30px;">B-C</th>
          <th style="width: 30px;">EJ</th>
          <th style="width: 60px;">Décision</th>
        </tr>
      </thead>
      <tbody>
        ${students.map((r: any) => `
          <tr>
            <td class="rank-cell">${r.rank}</td>
            <td>${r.firstname}</td>
            <td>${r.lastname}</td>
            <td>${r.trim1Average.toFixed(2)}</td>
            <td>${r.trim2Average.toFixed(2)}</td>
            <td>${r.trim3Average.toFixed(2)}</td>
            <td><strong>${r.annualAverage.toFixed(2)}</strong></td>
            <td class="distinction-cell">${r.distinctions.tableauHonneur ? 'X' : ''}</td>
            <td class="distinction-cell">${r.distinctions.encouragements ? 'X' : ''}</td>
            <td class="distinction-cell">${r.distinctions.felicitations ? 'X' : ''}</td>
            <td>${r.discipline.avertissementTravail ? 'X' : ''}</td>
            <td>${r.discipline.blameTravail ? 'X' : ''}</td>
            <td>${r.discipline.avertissementConduite ? 'X' : ''}</td>
            <td>${r.discipline.blameConduite ? 'X' : ''}</td>
            <td>${r.discipline.exclusionTemporaire ? 'X' : ''}</td>
            <td class="${r.finalDecision === 'Admis' ? 'decision-admis' : 'decision-redouble'}">${r.finalDecision}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="stats-section">
      <h3>Statistiques Globales</h3>
      <table class="stats-table">
        <thead>
          <tr>
            <th style="width: 100px;"></th>
            <th style="width: 80px;">Effectif</th>
            <th style="width: 80px;">Présents</th>
            <th style="width: 90px;">% Présents</th>
            <th style="width: 80px;">Admis</th>
            <th style="width: 90px;">% Admis</th>
          </tr>
        </thead>
        <tbody>
          ${statsRows}
        </tbody>
      </table>
    </div>
  </div>
</body>
</html>`;
};

onMounted(async () => {
  await loadGrades();
});
</script>

<style scoped>
.annual-pv-container {
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
  flex-wrap: wrap;
  gap: 12px;
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

.error-message {
  color: #f56c6c;
  font-size: 14px;
  text-align: center;
  padding: 10px;
}

.table-container {
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  overflow-x: auto;
  overflow-y: auto;
  max-height: calc(100vh - 420px);
  background: white;
}

.loading-state, .empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 0;
  color: #909399;
}

.loading-state .el-icon, .empty-state .el-icon {
  font-size: 48px;
  margin-bottom: 16px;
}

.pagination {
  margin-top: 16px;
  display: flex;
  justify-content: center;
}

.stats-container {
  margin-top: 20px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.stats-container h3 {
  margin: 0 0 12px 0;
  font-size: 16px;
  color: #303133;
  text-transform: uppercase;
}

:deep(.el-table) {
  font-size: 14px;
}

:deep(.el-table th.el-table__cell) {
  font-size: 13px;
  font-weight: 600;
  padding: 10px 0;
  background-color: #f5f7fa;
}

:deep(.el-table td.el-table__cell) {
  padding: 8px 0;
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
    font-size: 14px !important;
  }

  :deep(.el-table th.el-table__cell) {
    font-size: 13px !important;
    font-weight: 600 !important;
    background-color: #f5f7fa !important;
    color: #303133 !important;
  }

  :deep(.el-table td.el-table__cell) {
    padding: 8px 0 !important;
  }
}
</style>