<template>
  <div class="centralized-notes-container">
    <!-- Header -->
    <div class="header">
      <div class="header-title">
        <h1>Fiche de Centralisation des Notes</h1>
        <p class="subtitle">Visualisation et classement des résultats scolaires</p>
      </div>
      <div class="header-actions">
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

      <div v-else-if="courses.length === 0 && filters.gradeId && !loading" class="empty-state">
        <el-icon><Warning /></el-icon>
        <p>Aucune matière trouvée pour le niveau scolaire sélectionné</p>
        <small>Ajoutez des matières au niveau scolaire pour afficher les résultats</small>
      </div>

      <div v-else-if="rankings && rankings.length === 0 && courses.length > 0 && !loading" class="empty-state">
        <el-icon><Warning /></el-icon>
        <p>Aucune donnée trouvée avec ces filtres</p>
        <small>Le classement centralisé nécessite des notes saisies dans le système</small>
      </div>

      <div v-else-if="rankings && rankings.length > 0 && !loading" class="centralized-table">

        <!-- Scrollable Table Container -->
        <div class="table-scroll-container">
          <!-- Table Header -->
          <div class="table-header">
            <div class="header-cell rank-cell">Rang</div>
            <div class="header-cell matricule-cell">Matricule</div>
            <div class="header-cell name-cell">Prénom</div>
            <div class="header-cell name-cell">Nom</div>
            <div
              v-for="course in courses"
              :key="course.id"
              class="header-cell course-cell"
            >
              {{ course.name }} (Coef {{ course.coefficient }})
            </div>
            <div v-if="courses.length > 0" class="header-cell coef-total-cell">Coef</div>
            <div class="header-cell average-cell">Moyenne</div>
            <div class="header-cell">Observation</div>
          </div>

          <!-- Class Info Row -->
          <div class="class-info-row">
            <div class="class-info-item">
              <span class="info-label">Classe:</span>
              <span class="info-value">{{ currentClass?.name || '-' }}</span>
            </div>
            <div class="class-info-item">
              <span class="info-label">Base notation:</span>
              <span class="info-value">{{ classConfig?.finalGradeBase || 20 }}</span>
            </div>
          </div>

          <!-- Table Body -->
          <div class="table-body">
            <!-- Afficher les lignes si des données existent -->
            <div
              v-if="rankings.length > 0"
              v-for="(student, index) in rankings"
              :key="student.studentId"
              class="table-row"
              :class="{ 'top-3': index < 3 }"
            >
              <div class="cell rank-cell">{{ student.rank }}</div>
              <div class="cell matricule-cell">{{ student.matricule || '-' }}</div>
              <div class="cell name-cell">{{ student.firstname }}</div>
              <div class="cell name-cell">{{ student.lastname }}</div>

              <div
                v-for="course in courses"
                :key="course.id"
                class="cell"
              >
                <span :class="{ 'missing-score': !getStudentScore(student, course.id) }">
                  {{ getWeightedScore(student, course.id) || '-' }}
                </span>
              </div>
              <div v-if="courses.length > 0" class="cell coef-total-cell">{{ getTotalCoef(student) }}</div>
              <div class="cell average-cell">{{ getWeightedAverage(student).replace(/,/g, '.') }}</div>
              <div class="cell observation-cell">-</div>

            </div>
          </div>

          <!-- Pagination -->
          <div v-if="courses.length > 0" class="pagination">
            <el-pagination
              v-model:current-page="currentPage"
              v-model:page-size="pageSize"
              :total="rankings.length"
              :page-sizes="[10, 20, 50, 100]"
              layout="total, sizes, prev, pager, next, jumper"
              @current-change="loadData"
            />
          </div>
        </div>
      </div>
   </div>
  </div>
</template>

<script setup lang="ts">
// @ts-nocheck
import {ref, computed, onMounted, watch} from 'vue';
import * as XLSX from 'xlsx';
import { ElMessage } from 'element-plus';
import { Document, Download, Loading, Warning } from '@element-plus/icons-vue';

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
  coefficient: number;
}

const loading = ref(false);
const exportingPDF = ref(false);
const exportingExcel = ref(false);
const rankings = ref<CentralizedRanking[]>([]);
const grades = ref<any[]>([]);
const periods = ref<string[]>([]);
const courses = ref<Course[]>([]);
const currentPage = ref(1);
const pageSize = ref(20);
const classConfig = ref<GradeConfig | null>(null);
const currentClass = ref<Grade | null>(null);
const schoolInfo = ref<any>(null);

const filters = ref<Filters>({
  gradeId: undefined,
  period: undefined
});

const classAverage = computed(() => {
  if (rankings.value.length === 0) return 0;
  const total = rankings.value.reduce((sum, r) => sum + r.generalAverage, 0);
  return total / rankings.value.length;
});

const onPeriodChange = async () => {
  console.log("period changed")
  await loadData()
};

const loadPeriods = async () => {
  try {
    const currentYearRes = await window.ipcRenderer.invoke('yearRepartition:getCurrent');
    if (currentYearRes.success && currentYearRes.data) {
      const yearConfig = currentYearRes.data;
      // Extraire les noms des périodes
      periods.value = yearConfig.periodConfigurations.map((p: any) => p.name);
    } else {
      // Fallback sur des périodes par défaut
      periods.value = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
      ElMessage.warning('Aucune année scolaire en cours. Périodes par défaut utilisées.');
    }
  } catch (error) {
    console.error('Erreur chargement périodes:', error);
    periods.value = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
  }
};

watch(rankings, ()=>{
  console.log("=== RANKINGS UPDATED ===");
  console.log("Rankings length:", rankings.value.length);
  console.log("Rankings data:", JSON.stringify(rankings.value, null, 2));

  if (rankings.value.length > 0) {
    console.log("First student matricule:", rankings.value[0].matricule);
    console.log("First student matricule type:", typeof rankings.value[0].matricule);
    console.log("First student matricule length:", (rankings.value[0].matricule || '').length);
  }
})

// Charger les données depuis le service backend
const loadData = async () => {
  loading.value = true;
  try {
    const requestData: any = {
      gradeId:filters.value.gradeId,
      period: filters.value.period,
      minScore: undefined,
      maxScore: undefined
    };
    console.log('Filtres envoyés au backend:', requestData);
    const result = await window.ipcRenderer.invoke('gradeEntry:getCentralizedRankings', requestData);
    console.log('Résultat du backend:', result);
    if (result.success && result.data) {
      console.log('=== DONNÉES DU BACKEND ===');
      console.log('Total students:', result.data.length);
      console.log('First student:', result.data[0]);
      console.log('Matricule du premier étudiant:', result.data[0]?.matricule);
      console.log('=== END DONNÉES ===');
      rankings.value = result.data;

      const coursesResult = await window.ipcRenderer.invoke('course:getByGrade', filters.value.gradeId);
      if (coursesResult.success && coursesResult.data) {
        courses.value = coursesResult.data.map((course: any) => ({
          id: course.id,
          name: course.name,
          coefficient: course.coefficient || 1
        }));
        console.log('Matières chargées:', courses.value);
      } else {
        console.log('Aucune matière trouvée pour le grade:', filters.value.gradeId);
        courses.value = [];
      }

      // Charger la configuration de notation de la classe
      if (filters.value.gradeId) {
        await loadGradeConfig(filters.value.gradeId);
      }
    } else {
      ElMessage.error(result.message || 'Erreur lors du chargement des données');
      console.error('Erreur backend:', result.error);
      rankings.value = [];
    }
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
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

const getWeightedScore = (student: CentralizedRanking, courseId: number): string | null => {
  const scoreData = student.scores?.find((s) => s.courseId === courseId);
  if (scoreData && scoreData.score && scoreData.coefficient) {
    const weighted = scoreData.score * scoreData.coefficient;
    return weighted.toFixed(1);
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
    if (schoolResult?.success && schoolResult.data?.id) {
      const schoolId = schoolResult.data.id;
      schoolInfo.value = schoolResult.data;
      const configResult = await window.ipcRenderer.invoke('grade-config:get', {
        schoolId: schoolId,
        classId: gradeId
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
  const schoolInfo = schoolInfo.value ? {
    id: schoolInfo.value.id,
    name: schoolInfo.value.name,
    address: schoolInfo.value.address,
    phone: schoolInfo.value.phone,
    email: schoolInfo.value.email
  } : null;

  // Sérialiser les rankings en créant des objets à la main
  const rankings = [];
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
    rankings.push({
      studentId: r.studentId,
      firstname: r.firstname,
      lastname: r.lastname,
      generalAverage: r.generalAverage,
      rank: r.rank,
      totalScores: r.totalScores,
      averageScores: r.averageScores,
      scores: scores
    });
  }

  // Sérialiser les filters
  const filters = {
    gradeId: filters.value.gradeId,
    period: filters.value.period
  };

  // Sérialiser classInfo
  const classInfo = {
    name: className,
    base: base
  };

  return {
    rankings,
    filters,
    classAverage: classAverage.value,
    schoolInfo,
    classInfo
  };
};

const exportToPDF = async () => {
  exportingPDF.value = true;
  try {
    console.log('=== GÉNÉRATION PDF ===');

    const serializableData = serializeForIPC();

    console.log('Informations école:', serializableData.schoolInfo);
    console.log('Informations classe:', serializableData.classInfo);
    console.log('Filtres:', serializableData.filters);
    console.log('Nombre de rankings:', serializableData.rankings.length);

    // Tester la sérialisation avec JSON.stringify
    try {
      const jsonString = JSON.stringify(serializableData);
      console.log('✅ JSON.stringify réussi, longueur:', jsonString.length);
      console.log('📊 Premier 1000 caractères:', jsonString.substring(0, 1000));
    } catch (jsonError) {
      console.error('❌ JSON.stringify a échoué:', jsonError);
      throw new Error('Erreur lors de la sérialisation JSON');
    }

    const result = await window.ipcRenderer.invoke('report-card:generatePDF', {
      type: 'centralized',
      data: serializableData
    });

    console.log('Résultat PDF:', result);
    ElMessage.success('PDF généré avec succès');
  } catch (error) {
    console.error('Erreur lors de la génération du PDF:', error);
    ElMessage.error('Erreur lors de la génération du PDF');
  } finally {
    exportingPDF.value = false;
  }
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

    // Créer la structure des données pour le tableau centralisé
    // Créer un tableau avec des colonnes avec les coefficients affichés
    const coursesWithCoeff = courses.value.map(c => ({
      name: c.name,
      coefficient: c.coefficient,
      header: `${c.name} (Coef ${c.coefficient})`
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
    wsData.push(['FICHE DE CENTRALISATION DES NOTES']);
    wsData.push([]); // Ligne vide

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
    rankings.value.forEach(student => {
      const rowData: any[] = [
        student.rank,
        student.matricule || '-',
        student.firstname,
        student.lastname
      ];
      coursesWithCoeff.forEach(c => {
        const score = getWeightedScore(student, c.name);
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
</script>

<style scoped>
.centralized-notes-container {
  padding: 20px;
  background-color: #f5f5f5;
  min-height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.header-title {
  h1 {
    margin: 0 0 8px 0;
    font-size: 24px;
    color: #303133;
  }
  
  .subtitle {
    margin: 0;
    font-size: 14px;
    color: #909399;
  }
}

.header-actions {
  display: flex;
  gap: 12px;
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
  background: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
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

.no-data-message {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 0;
  color: #909399;
  background: #f9fafc;
  border-radius: 8px;
  margin: 20px 0;

  .no-data-content {
    text-align: center;

    p {
      margin: 8px 0 4px 0;
      font-size: 16px;
      color: #303133;
    }

    small {
      margin: 0;
      font-size: 13px;
      color: #909399;
    }
  }
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.centralized-table {
  overflow-x: auto;
}

.table-header {
  display: grid;
  grid-template-columns:
    60px 100px 100px 100px
    minmax(180px, 200px)
    minmax(180px, 200px)
    60px 80px 80px;
  gap: 8px;
  padding: 12px;
  background: #f5f5f5;
  border-radius: 4px 4px 0 0;
  font-weight: 600;
  color: #606266;
  border-bottom: 2px solid #ebeef5;
  overflow-x: auto;
  white-space: nowrap;
}

.course-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.coef-label {
  font-size: 0.65rem;
  font-weight: 500;
  color: #909399;
  margin-top: 2px;
}

.average-cell {
  color: #409eff;
  font-weight: 600;
}

.total-cell {
  color: #67c23a;
  font-weight: 600;
}

.coef-total-cell {
  color: #e6a23c;
  font-weight: 600;
}

.course-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.coef-label {
  font-size: 0.7rem;
  font-weight: 500;
  color: #909399;
  margin-top: 2px;
}

.class-info-row {
  display: flex;
  justify-content: flex-end;
  gap: 24px;
  padding: 8px 16px;
  background: #fafafa;
  border-bottom: 1px solid #ebeef5;
}

.class-info-item {
  display: flex;
  align-items: center;
  gap: 8px;
}

.info-label {
  font-weight: 500;
  color: #606266;
  font-size: 0.9rem;
}

.info-value {
  font-weight: 600;
  color: #303133;
  font-size: 0.9rem;
}

.header-cell {
  padding: 8px;
  text-align: center;
  overflow: visible;
  white-space: normal;
}

.matricule-cell {
  text-align: left;
  font-weight: 600;
  padding-left: 12px;
}

.name-cell {
  text-align: left;
  font-weight: 600;
}

.rank-cell {
  color: #409eff;
  font-weight: 600;
}

.course-cell {
  color: #303133;
  font-size: 0.9rem;
  overflow: visible;
  white-space: normal;
}

.average-cell {
  color: #409eff;
  font-weight: 600;
}

.total-cell {
  color: #67c23a;
  font-weight: 600;
}

.coef-total-cell {
  color: #e6a23c;
  font-weight: 600;
}

.observation-cell {
  text-align: left;
  font-style: italic;
  color: #909399;
}

.table-body {
  border-bottom: 2px solid #ebeef5;
}

.table-row {
  display: grid;
  grid-template-columns:
    60px 100px 100px 100px
    minmax(180px, 200px)
    minmax(180px, 200px)
    60px 80px 80px;
  gap: 8px;
  padding: 10px 12px;
  align-items: center;
  border-bottom: 1px solid #ebeef5;
  transition: background-color 0.2s;

  &:hover {
    background-color: #f5f5f5;
  }

  &.top-3 {
    background-color: rgba(103, 194, 58, 0.1);
    font-weight: 600;
  }
}

.cell {
  padding: 4px 8px;
  text-align: center;
  overflow: visible;
  white-space: normal;
}

.matricule-cell {
  text-align: left;
  font-weight: 500;
  padding-left: 8px;
  color: #e6a23c;
  font-family: monospace;
  font-size: 0.9rem;
}

.name-cell {
  text-align: left;
  font-weight: 500;
}

.missing-score {
  color: #909399;
  font-style: italic;
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.name-cell {
  text-align: left;
  font-weight: 500;
}

.rank-cell {
  color: #409eff;
  font-weight: 600;
}

.average-cell {
  color: #409eff;
  font-weight: 600;
}

.observation-cell {
  text-align: left;
  font-style: italic;
  color: #909399;
}

.missing-score {
  color: #909399;
  font-style: italic;
}

.total-row {
  font-weight: 600;
  background-color: #f9fafc;

  .total-cell {
    color: #67c23a;
  }
}

.pagination {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}

.table-scroll-container {
  overflow-x: auto;
  width: 100%;
  border: 1px solid #ebeef5;
  border-radius: 4px;
  background: white;
}

.table-scroll-container::-webkit-scrollbar {
  height: 8px;
  background: #f5f5f5;
}

.table-scroll-container::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 4px;
}

.table-scroll-container::-webkit-scrollbar-thumb:hover {
  background: #a0a4aa;
}

@media (max-width: 1200px) {
  .table-header,
  .table-row {
    grid-template-columns:
      50px 85px 85px 85px
      minmax(120px, 140px)
      minmax(120px, 140px)
      50px 70px 90px;
  }
}

@media (max-width: 768px) {
  .table-header,
  .table-row {
    grid-template-columns:
      40px 60px 60px 60px
      minmax(90px, 100px)
      minmax(90px, 100px)
      50px 60px 70px;
  }
}
</style>
