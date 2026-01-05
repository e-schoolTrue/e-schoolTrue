<template>
  <div class="print-model-view">
    <!-- Header moderne -->
    <div class="header-bar">
      <div class="header-left">
        <div class="title-section">
          <div class="title-icon">
            <el-icon :size="24"><Printer /></el-icon>
          </div>
          <div class="title-text">
            <h2>Impression des Bulletins</h2>
            <span class="subtitle" v-if="selectedClassName && selectedPeriod">{{ selectedClassName }} • {{ selectedPeriod }}</span>
          </div>
        </div>
        <el-divider direction="vertical" />
        <div class="selectors">
          <el-select
            v-model="selectedClassId"
            placeholder="Sélectionner une classe"
            @change="onClassChange"
            size="large"
            style="width: 200px"
            clearable
          >
            <template #prefix>
              <el-icon><School /></el-icon>
            </template>
            <el-option
              v-for="classe in classes"
              :key="classe.id"
              :label="classe.name"
              :value="classe.id"
            />
          </el-select>

          <el-select
            v-model="selectedPeriod"
            placeholder="Sélectionner une période"
            @change="onPeriodChange"
            size="large"
            style="width: 200px"
            :disabled="!selectedClassId"
            clearable
          >
            <template #prefix>
              <el-icon><Calendar /></el-icon>
            </template>
            <el-option
              v-for="period in periods"
              :key="period"
              :label="period"
              :value="period"
            />
          </el-select>
        </div>
      </div>
      
      <div class="header-right">
        <el-tooltip content="Configurer le modèle et les couleurs" placement="bottom">
          <el-button @click="showTemplateDialog = true" circle size="large">
            <el-icon :size="18"><Setting /></el-icon>
          </el-button>
        </el-tooltip>
        <el-button 
          type="primary"
          size="large"
          @click="handlePrint"
          :loading="printing"
          :disabled="selectedStudents.length === 0"
          class="print-btn"
        >
          <el-icon class="mr-1"><Printer /></el-icon>
          Imprimer {{ selectedStudents.length > 0 ? `(${selectedStudents.length})` : '' }}
        </el-button>
      </div>
    </div>

    <!-- Contenu principal -->
    <div v-if="selectedClassId && selectedPeriod" class="main-content">
      <el-row :gutter="16" class="content-row">
        <!-- Liste des élèves (sidebar) -->
        <el-col :span="6">
          <el-card class="students-card compact-card">
            <template #header>
              <div class="card-header">
                <div class="header-title-row">
                  <span class="header-title">
                    <el-icon><User /></el-icon>
                    Élèves
                  </span>
                  <el-tag size="small" type="info">{{ students.length }}</el-tag>
                </div>
                <el-input
                  v-model="studentSearch"
                  placeholder="Rechercher un élève..."
                  size="default"
                  clearable
                  class="search-input"
                >
                  <template #prefix><el-icon><Search /></el-icon></template>
                </el-input>
              </div>
            </template>
            
            <div class="students-list-container">
              <div class="select-all-section">
                <el-checkbox
                  v-model="selectAll"
                  :indeterminate="isIndeterminate"
                  @change="handleSelectAll"
                >
                  Tout sélectionner
                </el-checkbox>
                <span class="selected-count" v-if="selectedStudentIds.length > 0">
                  {{ selectedStudentIds.length }} sélectionné(s)
                </span>
              </div>
              
              <div class="students-list">
                <el-checkbox-group v-model="selectedStudentIds">
                  <div
                    v-for="student in filteredStudents"
                    :key="student.id"
                    class="student-item"
                    :class="{ 
                      'active': previewStudentId === student.id,
                      'selected': selectedStudentIds.includes(student.id)
                    }"
                    @click="selectStudentForPreview(student)"
                  >
                    <el-checkbox :label="student.id" @click.stop>
                      <div class="student-info">
                        <span class="student-name">{{ student.lastname }} {{ student.firstname }}</span>
                        <span class="student-mat">{{ student.matricule || 'N/A' }}</span>
                      </div>
                    </el-checkbox>
                    <div class="student-status">
                      <el-tooltip v-if="studentGradesStatus[student.id] === 'complete'" content="Notes complètes" placement="left">
                        <el-tag type="success" size="small" effect="dark" round>
                          <el-icon><Check /></el-icon>
                        </el-tag>
                      </el-tooltip>
                      <el-tooltip v-else-if="studentGradesStatus[student.id] === 'partial'" content="Notes incomplètes" placement="left">
                        <el-tag type="warning" size="small" effect="dark" round>
                          <el-icon><Warning /></el-icon>
                        </el-tag>
                      </el-tooltip>
                      <el-tooltip v-else content="Aucune note" placement="left">
                        <el-tag type="info" size="small" effect="plain" round>
                          <el-icon><Remove /></el-icon>
                        </el-tag>
                      </el-tooltip>
                    </div>
                  </div>
                </el-checkbox-group>
                
                <div v-if="filteredStudents.length === 0" class="no-students">
                  <el-icon :size="32" color="#c0c4cc"><UserFilled /></el-icon>
                  <p>Aucun élève trouvé</p>
                </div>
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- Aperçu du bulletin -->
        <el-col :span="18">
          <div v-if="!previewStudent" class="empty-state">
            <div class="empty-content">
              <div class="empty-icon">
                <el-icon :size="64"><Document /></el-icon>
              </div>
              <h3>Aperçu du Bulletin</h3>
              <p>Cliquez sur un élève dans la liste pour afficher l'aperçu de son bulletin.</p>
              <el-button v-if="students.length > 0" type="primary" plain @click="selectStudentForPreview(students[0])">
                Voir le premier élève
              </el-button>
            </div>
          </div>

          <el-card v-else class="preview-card compact-card" v-loading="loadingPreview">
            <template #header>
              <div class="card-header-preview">
                <div class="preview-student-info">
                  <el-avatar :size="36" class="student-avatar">
                    {{ previewStudent.firstname?.charAt(0) }}{{ previewStudent.lastname?.charAt(0) }}
                  </el-avatar>
                  <div>
                    <strong>{{ previewStudent.lastname }} {{ previewStudent.firstname }}</strong>
                    <span class="student-details">{{ selectedClassName }} • {{ previewStudent.matricule }}</span>
                  </div>
                </div>
                <div class="preview-status">
                  <el-tag v-if="previewGradesData.length > 0" type="success" effect="light">
                    <el-icon class="mr-1"><Check /></el-icon>
                    {{ previewGradesData.length }} matière(s)
                  </el-tag>
                  <el-tag v-else type="warning" effect="light">
                    <el-icon class="mr-1"><Warning /></el-icon>
                    Aucune note
                  </el-tag>
                </div>
              </div>
            </template>

            <div class="preview-container">
              <div class="preview-scaler">
                <component
                  :is="currentTemplateComponent"
                  :student="previewStudent"
                  :school-info="schoolInfo"
                  :grades="previewGradesData"
                  :period="selectedPeriod"
                  :options="colorOptions"
                  :current-year="currentYear"
                  :rank="previewRank"
                  :total-students="students.length"
                  :class-average="classAverage"
                  :absences="previewAbsences"
                />
              </div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- Empty state initial -->
    <div v-else class="initial-state">
      <div class="welcome-content">
        <div class="welcome-icon">
          <el-icon :size="80"><Printer /></el-icon>
        </div>
        <h2>Impression des Bulletins Scolaires</h2>
        <p>Sélectionnez une classe et une période pour commencer.</p>
        <div class="welcome-steps">
          <div class="step">
            <span class="step-number">1</span>
            <span>Choisir la classe</span>
          </div>
          <el-icon><ArrowRight /></el-icon>
          <div class="step">
            <span class="step-number">2</span>
            <span>Choisir la période</span>
          </div>
          <el-icon><ArrowRight /></el-icon>
          <div class="step">
            <span class="step-number">3</span>
            <span>Sélectionner et imprimer</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Dialog Configuration du Bulletin -->
    <BulletinConfigDialog
      v-model="showTemplateDialog"
      :template-id="selectedTemplateId"
      :color-options="colorOptions"
      :school-info="schoolInfo"
      :period="selectedPeriod || 'T1'"
      :current-year="currentYear"
      @update:template-id="selectedTemplateId = $event"
      @update:color-options="Object.assign(colorOptions, $event)"
      @save="saveTemplatePreferences"
    />

    <!-- Dialog de progression / erreurs -->
    <el-dialog v-model="showProgressDialog" title="Impression des Bulletins" width="450px" :close-on-click-modal="false">
      <div class="progress-content">
        <el-progress :percentage="progressPercentage" :status="progressStatus" :stroke-width="12" />
        <p class="progress-message">{{ progressMessage }}</p>
        
        <div v-if="validationErrors.length > 0" class="validation-errors">
          <el-alert
            v-for="(err, idx) in validationErrors"
            :key="idx"
            :title="err"
            type="error"
            :closable="false"
            show-icon
            class="error-item"
          />
        </div>
      </div>
      <template #footer>
        <el-button v-if="progressStatus === 'exception' || progressStatus === 'success'" @click="showProgressDialog = false">
          Fermer
        </el-button>
      </template>
    </el-dialog>

    <!-- Zone d'impression invisible (rendue seulement pendant l'impression) -->
    <div id="print-area" class="print-area-container">
      <div v-for="(item, index) in printingData" :key="index" class="print-page">
        <component
          :is="currentTemplateComponent"
          :student="item.student"
          :school-info="schoolInfo"
          :grades="item.grades"
          :period="selectedPeriod || ''"
          :options="colorOptions"
          :current-year="currentYear"
          :absences="item.absences || 0"
          :rank="item.rank || 0"
          :total-students="item.totalStudents || 0"
          :class-average="item.classAverage || 0"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch, nextTick, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { 
  Printer, Search, Check, Warning, Document, Setting,
  School, Calendar, User, Remove, UserFilled, ArrowRight
} from '@element-plus/icons-vue';
import BulletinTemplateOne from '@/components/bulletin/templates/BulletinTemplateOne.vue';
import BulletinTemplateTwo from '@/components/bulletin/templates/BulletinTemplateTwo.vue';
import BulletinConfigDialog from '@/components/bulletin/BulletinConfigDialog.vue';

// --- Types ---
interface Student {
  id: number;
  firstname: string;
  lastname: string;
  matricule: string;
  photo?: { id?: number; url?: string };
  dateOfBirth?: string;
  grade?: { id: number; name: string };
}

interface GradeData {
  courseId: number;
  courseName: string;
  coefficient: number;
  average: number;
  appreciation?: string;
  professorName?: string;
}

// --- State ---
const loading = ref(false);
const loadingPreview = ref(false);
const printing = ref(false);
const showTemplateDialog = ref(false);
const showProgressDialog = ref(false);

const progressPercentage = ref(0);
const progressMessage = ref('');
const progressStatus = ref<'' | 'success' | 'exception'>('');
const validationErrors = ref<string[]>([]);

// Sélection
const classes = ref<any[]>([]);
const students = ref<Student[]>([]);
const periods = ref<string[]>([]);

const selectedClassId = ref<number | null>(null);
const selectedPeriod = ref<string | null>(null);
const selectedStudentIds = ref<number[]>([]);
const previewStudentId = ref<number | null>(null);
const studentSearch = ref('');

// Données
const schoolInfo = ref<any>(null);
const currentYear = ref('2024-2025');
const previewStudent = ref<Student | null>(null);
const previewGradesData = ref<GradeData[]>([]);
const previewRank = ref(0);
const previewAbsences = ref(0);
const classAverage = ref(0);
const studentGradesStatus = reactive<Record<number, 'none' | 'partial' | 'complete'>>({});
const courses = ref<any[]>([]); // Liste des matières de la classe
const schoolId = ref(1);

// Absences totales groupées par élève
interface AbsenceData {
  studentId: number;
  studentName: string;
  totalAbsences: number;
  totalHours: number;
  justified: number;
  unjustified: number;
}
const absencesByStudent = ref<AbsenceData[]>([]);

// Classement des élèves
interface RankingData {
  studentId: number;
  rank: number;
  generalAverage: number;
  totalStudents: number;
  classAverage: number;
}
const studentRankings = ref<Map<number, RankingData>>(new Map());

// Template & Couleurs
const selectedTemplateId = ref('template1');
const colorOptions = reactive({
  primaryColor: '#2c3e50',
  secondaryColor: '#3498db'
});

const templates = [
  { id: 'template1', name: 'Classique', description: 'Design moderne et épuré', component: BulletinTemplateOne },
  { id: 'template2', name: 'Officiel', description: 'Style administratif traditionnel', component: BulletinTemplateTwo },
];

const printingData = ref<{ student: Student; grades: GradeData[]; absences?: number; rank?: number; totalStudents?: number; classAverage?: number }[]>([]);

// --- Computed ---
const selectedClassName = computed(() => classes.value.find(c => c.id === selectedClassId.value)?.name || '');

const filteredStudents = computed(() => {
  if (!studentSearch.value) return students.value;
  const q = studentSearch.value.toLowerCase();
  return students.value.filter(s =>
    s.firstname.toLowerCase().includes(q) ||
    s.lastname.toLowerCase().includes(q) ||
    s.matricule?.toLowerCase().includes(q)
  );
});

const selectedStudents = computed(() => 
  students.value.filter(s => selectedStudentIds.value.includes(s.id))
);

const selectAll = computed({
  get: () => selectedStudentIds.value.length === students.value.length && students.value.length > 0,
  set: () => {}
});

const isIndeterminate = computed(() => 
  selectedStudentIds.value.length > 0 && selectedStudentIds.value.length < students.value.length
);

const currentTemplateComponent = computed(() => {
  const tmpl = templates.find(t => t.id === selectedTemplateId.value);
  return tmpl ? tmpl.component : BulletinTemplateOne;
});

// --- Methods ---

const loadInitialData = async () => {
  try {
    // École
    const schoolRes = await window.ipcRenderer.invoke('school:get');
    if (schoolRes.success && schoolRes.data) {
      schoolInfo.value = schoolRes.data;
      schoolId.value = schoolRes.data.id || 1;
      if (schoolInfo.value.logo?.id) {
        const logoRes = await window.ipcRenderer.invoke('school:getLogo', schoolInfo.value.logo.id);
        if (logoRes.success && logoRes.data) {
          schoolInfo.value.logo.url = `data:${logoRes.data.type};base64,${logoRes.data.content}`;
        }
      }
    }

    // Classes
    const classesRes = await window.ipcRenderer.invoke('grade:all');
    if (classesRes.success) classes.value = classesRes.data || [];

    // Année scolaire et périodes
    const yearRes = await window.ipcRenderer.invoke('yearRepartition:getCurrent');
    if (yearRes.success && yearRes.data) {
      currentYear.value = yearRes.data.schoolYear;
      periods.value = yearRes.data.periodConfigurations?.map((p: any) => p.name) || ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
    } else {
      periods.value = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
    }
  } catch (e) {
    console.error('Erreur chargement initial:', e);
    ElMessage.error('Erreur lors du chargement des données');
  }
};

const onClassChange = async () => {
  students.value = [];
  selectedStudentIds.value = [];
  previewStudent.value = null;
  previewStudentId.value = null;
  previewGradesData.value = [];
  absencesByStudent.value = [];
  studentRankings.value.clear();
  Object.keys(studentGradesStatus).forEach(k => delete studentGradesStatus[Number(k)]);

  if (!selectedClassId.value) return;

  loading.value = true;
  try {
    // Élèves
    const studentsRes = await window.ipcRenderer.invoke('student:getByGrade', selectedClassId.value);
    if (studentsRes.success) students.value = studentsRes.data || [];

    // Matières de la classe
    const coursesRes = await window.ipcRenderer.invoke('course:getByGrade', selectedClassId.value);
    if (coursesRes.success) courses.value = coursesRes.data || [];

    // Absences totales par élève pour cette classe
    const absencesRes = await window.ipcRenderer.invoke('absence:getTotalAbsencesGroupedByStudent', selectedClassId.value);
    if (absencesRes && Array.isArray(absencesRes)) {
      absencesByStudent.value = absencesRes;
    }

  } catch (error) {
    console.error('Erreur chargement:', error);
    ElMessage.error('Erreur lors du chargement des élèves');
  } finally {
    loading.value = false;
  }
};

const onPeriodChange = async () => {
  // Recharger le statut des notes pour chaque élève
  if (!selectedClassId.value || !selectedPeriod.value) return;
  
  for (const student of students.value) {
    await checkStudentGradesStatus(student.id);
  }
  
  // Charger les classements des élèves
  await loadStudentRankings();
  
  // Rafraîchir l'aperçu si un élève est sélectionné
  if (previewStudent.value) {
    await loadStudentGradesForPreview(previewStudent.value);
  }
};

const loadStudentRankings = async () => {
  if (!selectedClassId.value || !selectedPeriod.value) return;
  
  try {
    const rankingsRes = await window.ipcRenderer.invoke('gradeEntry:getClassRankings', {
      classId: selectedClassId.value,
      schoolId: schoolInfo.value?.id || schoolId.value,
      period: selectedPeriod.value
    });
    
    if (rankingsRes.success && rankingsRes.data) {
      const newMap = new Map<number, RankingData>();
      
      // Calculer la moyenne de classe et le nombre total d'élèves
      const totalStudents = rankingsRes.data.length;
      const classAvg = totalStudents > 0
        ? rankingsRes.data.reduce((sum: number, r: any) => sum + r.generalAverage, 0) / totalStudents
        : 0;
      
      // Stocker les données de classement pour chaque élève
      rankingsRes.data.forEach((r: any) => {
        newMap.set(r.studentId, {
          studentId: r.studentId,
          rank: r.rank,
          generalAverage: r.generalAverage,
          totalStudents: totalStudents,
          classAverage: Math.round(classAvg * 100) / 100
        });
      });
      
      studentRankings.value = newMap;
      
      // Mettre à jour la moyenne de classe globale
      classAverage.value = Math.round(classAvg * 100) / 100;
      
      console.log(`Classement chargé: ${totalStudents} élèves, moyenne de classe: ${classAvg.toFixed(2)}`);
    }
  } catch (error) {
    console.error('Erreur chargement classement:', error);
  }
};

const checkStudentGradesStatus = async (studentId: number) => {
  try {
    const res = await window.ipcRenderer.invoke('gradeEntry:getStudentAverages', {
      studentId,
      classId: selectedClassId.value,
      schoolId: schoolInfo.value?.id || schoolId.value,
      period: selectedPeriod.value
    });

    if (res.success && res.data) {
      const count = res.data.length;
      if (count === 0) {
        studentGradesStatus[studentId] = 'none';
      } else if (count < courses.value.length) {
        studentGradesStatus[studentId] = 'partial';
      } else {
        studentGradesStatus[studentId] = 'complete';
      }
    } else {
      studentGradesStatus[studentId] = 'none';
    }
  } catch {
    studentGradesStatus[studentId] = 'none';
  }
};

const handleSelectAll = (val: boolean) => {
  if (val) {
    selectedStudentIds.value = students.value.map(s => s.id);
  } else {
    selectedStudentIds.value = [];
  }
};

const selectStudentForPreview = async (student: Student) => {
  previewStudentId.value = student.id;
  previewStudent.value = student;
  await loadStudentGradesForPreview(student);
};

const loadStudentGradesForPreview = async (student: Student) => {
  if (!selectedPeriod.value || courses.value.length === 0) return;
  
  loadingPreview.value = true;
  try {
    // Charger photo si nécessaire
    if (student.photo?.id && !student.photo.url) {
      const photoRes = await window.ipcRenderer.invoke('getStudentPhoto', student.photo.id);
      if (photoRes.success && photoRes.data) {
        student.photo = { ...student.photo, url: `data:${photoRes.data.type};base64,${photoRes.data.content}` };
      }
    }

    // Récupérer les moyennes calculées pour chaque matière
    const gradesResults: GradeData[] = [];
    
    for (const course of courses.value) {
      // Récupérer la moyenne calculée (si elle existe)
      const avgRes = await window.ipcRenderer.invoke('gradeEntry:getCalculated', {
        studentId: student.id,
        courseId: course.id,
        classId: selectedClassId.value,
        schoolId: schoolInfo.value?.id || schoolId.value,
        period: selectedPeriod.value
      });

      if (avgRes.success && avgRes.data) {
        gradesResults.push({
          courseId: course.id,
          courseName: course.name,
          coefficient: course.coefficient || 1,
          average: avgRes.data.finalAverage,
          appreciation: getAppreciation(avgRes.data.finalAverage),
          professorName: ''
        });
      }
    }
    
    previewGradesData.value = gradesResults;
    
    // Récupérer les absences de l'élève depuis les données chargées (en heures)
    const studentAbsence = absencesByStudent.value.find(a => a.studentId === student.id);
    previewAbsences.value = studentAbsence?.totalHours || 0;
    
    // Récupérer le rang de l'élève
    const ranking = studentRankings.value.get(student.id);
    previewRank.value = ranking?.rank || 0;
    classAverage.value = ranking?.classAverage || 0;

  } catch (error) {
    console.error('Erreur chargement aperçu:', error);
    previewGradesData.value = [];
  } finally {
    loadingPreview.value = false;
  }
};

const getAppreciation = (note: number): string => {
  if (note < 5) return "Très Insuffisant";
  if (note < 8) return "Insuffisant";
  if (note < 10) return "Passable";
  if (note < 12) return "Assez Bien";
  if (note < 14) return "Bien";
  if (note < 16) return "Très Bien";
  if (note < 18) return "Excellent";
  return "Félicitations";
};

// --- Impression ---

const handlePrint = async () => {
  if (selectedStudents.value.length === 0) return;

  printing.value = true;
  showProgressDialog.value = true;
  progressPercentage.value = 0;
  progressMessage.value = 'Validation des données...';
  progressStatus.value = '';
  validationErrors.value = [];

  const studentsToPrint = selectedStudents.value;
  const validStudentsData: { student: Student; grades: GradeData[]; absences?: number; rank?: number; totalStudents?: number; classAverage?: number }[] = [];

  // Validation : Vérifier que chaque élève a TOUTES ses notes
  for (let i = 0; i < studentsToPrint.length; i++) {
    const student = studentsToPrint[i];
    progressMessage.value = `Vérification de ${student.firstname} ${student.lastname}...`;
    progressPercentage.value = Math.floor(((i + 1) / studentsToPrint.length) * 50);

    try {
      const studentGrades: GradeData[] = [];
      let missingCourses = 0;

      // Récupérer les moyennes pour chaque matière
      for (const course of courses.value) {
        const avgRes = await window.ipcRenderer.invoke('gradeEntry:getCalculated', {
          studentId: student.id,
          courseId: course.id,
          classId: selectedClassId.value,
          schoolId: schoolInfo.value?.id || schoolId.value,
          period: selectedPeriod.value
        });

        if (avgRes.success && avgRes.data && avgRes.data.finalAverage > 0) {
          studentGrades.push({
            courseId: course.id,
            courseName: course.name,
            coefficient: course.coefficient || 1,
            average: avgRes.data.finalAverage,
            appreciation: getAppreciation(avgRes.data.finalAverage)
          });
        } else {
          missingCourses++;
        }
      }

      // Vérifier si toutes les notes sont présentes
      if (missingCourses > 0) {
        validationErrors.value.push(`${student.firstname} ${student.lastname}: Notes incomplètes (${courses.value.length - missingCourses}/${courses.value.length} matières).`);
        continue;
      }

      // Charger photo si nécessaire
      if (student.photo?.id && !student.photo.url) {
        const photoRes = await window.ipcRenderer.invoke('getStudentPhoto', student.photo.id);
        if (photoRes.success && photoRes.data) {
          student.photo = { ...student.photo, url: `data:${photoRes.data.type};base64,${photoRes.data.content}` };
        }
      }

      // Récupérer les absences de l'élève (en heures)
      const studentAbsence = absencesByStudent.value.find(a => a.studentId === student.id);
      const totalAbsenceHours = studentAbsence?.totalHours || 0;

      // Récupérer le rang de l'élève
      const ranking = studentRankings.value.get(student.id);

      validStudentsData.push({ 
        student, 
        grades: studentGrades, 
        absences: totalAbsenceHours,
        rank: ranking?.rank || 0,
        totalStudents: ranking?.totalStudents || students.value.length,
        classAverage: ranking?.classAverage || classAverage.value
      });

    } catch (e) {
      validationErrors.value.push(`${student.firstname} ${student.lastname}: Erreur technique.`);
    }
  }

  // Si erreurs de validation
  if (validationErrors.value.length > 0) {
    progressStatus.value = 'exception';
    progressMessage.value = `${validationErrors.value.length} erreur(s) détectée(s). Veuillez compléter les notes manquantes.`;
    printing.value = false;
    return;
  }

  // Lancer l'impression
  progressMessage.value = 'Préparation de l\'impression...';
  progressPercentage.value = 70;

  printingData.value = validStudentsData;
  await nextTick();

  progressMessage.value = 'Ouverture de la fenêtre d\'impression...';
  progressPercentage.value = 90;

  // Petite pause pour que Vue rende les composants
  await new Promise(resolve => setTimeout(resolve, 300));

  window.print();

  progressPercentage.value = 100;
  progressMessage.value = 'Impression lancée !';
  progressStatus.value = 'success';
  printing.value = false;

  // Nettoyer après fermeture de la dialog d'impression
  setTimeout(() => {
    printingData.value = [];
  }, 1000);
};

const saveTemplatePreferences = () => {
  // TODO: Sauvegarder les préférences localement ou via IPC
  ElMessage.success('Préférences sauvegardées');
  showTemplateDialog.value = false;
};

// --- Lifecycle ---

onMounted(() => {
  loadInitialData();
});

watch([selectedClassId, selectedPeriod], () => {
  if (selectedClassId.value && selectedPeriod.value) {
    onPeriodChange();
  }
});
</script>

<style scoped>
.print-model-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: linear-gradient(135deg, #f5f7fa 0%, #e4e8ec 100%);
  overflow: hidden;
}

/* Header */
.header-bar {
  background: white;
  padding: 16px 24px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.08);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
  border-bottom: 1px solid #ebeef5;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.title-section {
  display: flex;
  align-items: center;
  gap: 12px;
}

.title-icon {
  width: 44px;
  height: 44px;
  background: linear-gradient(135deg, #003366 0%, #003366 100%);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
}

.title-text h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #2c3e50;
}

.title-text .subtitle {
  font-size: 0.8rem;
  color: #909399;
  font-weight: 400;
}

.selectors {
  display: flex;
  gap: 12px;
}

.header-right {
  display: flex;
  gap: 12px;
  align-items: center;
}

.print-btn {
  padding: 10px 20px;
}

/* Main content */
.main-content {
  flex: 1;
  padding: 20px;
  overflow: hidden;
}

.content-row {
  height: 100%;
}

.content-row :deep(.el-col) {
  height: 100%;
}

/* Cards */
.compact-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  border: none;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

.compact-card :deep(.el-card__header) {
  padding: 16px;
  border-bottom: 1px solid #f0f2f5;
  flex-shrink: 0;
  background: #fafbfc;
  border-radius: 12px 12px 0 0;
}

.compact-card :deep(.el-card__body) {
  padding: 0;
  flex: 1;
  overflow: auto;
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.header-title-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.95rem;
}

.search-input {
  background: white;
}

/* Students list */
.students-list-container {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.select-all-section {
  padding: 12px 16px;
  background: #f8f9fa;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.selected-count {
  font-size: 0.75rem;
  color: #003366;
  font-weight: 500;
}

.students-list {
  flex: 1;
  overflow-y: auto;
  padding: 8px 0;
}

.student-item {
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f5f5f5;
  transition: all 0.2s ease;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.student-item:hover {
  background: #f0f7ff;
}

.student-item.active {
  background: #e6f4ff;
  border-left: 3px solid #003366;
}

.student-item.selected {
  background: #f0f9eb;
}

.student-item.selected.active {
  background: #e6f4ff;
}

.student-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-left: 8px;
}

.student-name {
  font-weight: 500;
  color: #303133;
  font-size: 0.9rem;
}

.student-mat {
  font-size: 0.75rem;
  color: #909399;
}

.student-status :deep(.el-tag) {
  padding: 2px 6px;
}

.no-students {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: #909399;
}

.no-students p {
  margin: 10px 0 0;
  font-size: 0.85rem;
}

/* Preview */
.card-header-preview {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.preview-student-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.student-avatar {
  background: linear-gradient(135deg, #003366 0%, #003366 100%);
  color: white;
  font-weight: 600;
}

.preview-student-info strong {
  font-size: 1rem;
  color: #2c3e50;
}

.student-details {
  display: block;
  font-size: 0.8rem;
  color: #909399;
  font-weight: 400;
}

.preview-status {
  display: flex;
  gap: 8px;
}

.preview-card :deep(.el-card__body) {
  padding: 16px;
  overflow: auto;
}

.preview-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  background: linear-gradient(135deg, #3a3d41 0%, #525659 100%);
  border-radius: 12px;
  padding: 24px;
  min-height: calc(100vh - 280px);
  overflow: auto;
}

.preview-scaler {
  transform: scale(0.55);
  transform-origin: top center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  border-radius: 4px;
}

/* Empty states */
.empty-state {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0,0,0,0.08);
}

.empty-content {
  text-align: center;
  padding: 40px;
}

.empty-icon {
  width: 100px;
  height: 100px;
  background: linear-gradient(135deg, #f0f7ff 0%, #e6f4ff 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 20px;
  color: #003366;
}

.empty-content h3 {
  margin: 0 0 10px;
  font-size: 1.25rem;
  color: #303133;
}

.empty-content p {
  margin: 0 0 20px;
  color: #909399;
  font-size: 0.9rem;
}

/* Initial/Welcome state */
.initial-state {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.welcome-content {
  text-align: center;
  padding: 60px;
  background: white;
  border-radius: 16px;
  box-shadow: 0 4px 20px rgba(0,0,0,0.1);
  max-width: 600px;
}

.welcome-icon {
  width: 120px;
  height: 120px;
  background: linear-gradient(135deg, #409eff 0%, #66b1ff 100%);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto 24px;
  color: white;
}

.welcome-content h2 {
  margin: 0 0 12px;
  font-size: 1.5rem;
  color: #2c3e50;
}

.welcome-content > p {
  margin: 0 0 32px;
  color: #909399;
  font-size: 1rem;
}

.welcome-steps {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
}

.step {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.step-number {
  width: 32px;
  height: 32px;
  background: #409eff;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.9rem;
}

.step span:last-child {
  font-size: 0.85rem;
  color: #606266;
}

.welcome-steps > .el-icon {
  color: #c0c4cc;
  font-size: 18px;
}

/* Progress Dialog */
.progress-content {
  text-align: center;
}

.progress-message {
  margin-top: 16px;
  font-size: 14px;
  color: #666;
}

.validation-errors {
  margin-top: 20px;
  max-height: 200px;
  overflow-y: auto;
  text-align: left;
}

.error-item {
  margin-bottom: 8px;
}

/* Print Area */
.print-area-container {
  display: none;
}

@media print {
  body * {
    visibility: hidden;
  }
  
  .print-model-view > .header-bar,
  .print-model-view > .main-content,
  .print-model-view > .initial-state,
  .el-dialog,
  .el-overlay {
    display: none !important;
  }
  
  .print-model-view,
  .print-area-container,
  .print-area-container * {
    visibility: visible;
  }

  .print-model-view {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: auto;
    background: white;
    padding: 0;
    margin: 0;
    overflow: visible;
  }

  .print-area-container {
    display: block !important;
    width: 100%;
  }
  
  .print-page {
    page-break-after: always;
    width: 210mm;
    min-height: 297mm;
  }
  
  .print-page:last-child {
    page-break-after: auto;
  }
}

/* Scrollbar */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Utilities */
.mr-1 { margin-right: 4px; }
</style>
