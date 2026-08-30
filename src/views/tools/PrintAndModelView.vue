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
            size="large"
            style="width: 200px"
            clearable
            @change="onClassChange"
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
            size="large"
            style="width: 200px"
            :disabled="!selectedClassId"
            clearable
            @change="onPeriodChange"
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
    <div v-if="selectedClassId && selectedPeriod" class="main-content" v-loading="periodLoading">
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
              :categories="previewCategories"
              :period="selectedPeriod"
              :options="colorOptions"
              :current-year="currentYear"
              :rank="previewRank"
              :total-students="students.length"
              :class-average="classAverage"
              :absences="previewAbsences"
              :semester1-average="previewSemester1Average"
              :semester2-average="previewSemester2Average"
              :annual-average="previewAnnualAverage"
              :annual-rank="previewAnnualRank"
              :class-highest-annual="previewClassHighestAnnual"
              :class-lowest-annual="previewClassLowestAnnual"
              :decisions="previewDecisions"
              :annual-appreciation="previewAnnualAppreciation"
              :is-final-period="isFinalPeriod"
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

  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { 
  Printer, Search, Check, Warning, Document, Setting,
  School, Calendar, User, Remove, UserFilled, ArrowRight
} from '@element-plus/icons-vue';
import BulletinTemplateOne from '@/components/bulletin/templates/BulletinTemplateOne.vue';
import BulletinTemplateTwo from '@/components/bulletin/templates/BulletinTemplateTwo.vue';
import BulletinConfigDialog from '@/components/bulletin/BulletinConfigDialog.vue';
import { getAppreciation, formatNumber } from '@/utils/grade';

// --- Helpers ---
const escapeHtml = (str: string): string => {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

// --- Types ---
interface Student {
  id: number;
  firstname: string;
  lastname: string;
  matricule: string;
  photo?: { id?: number; url?: string };
  birthDay?: string;
  grade?: { id: number; name: string };
  sex?: string;
}

 interface GradeData {
    courseId: number;
    courseName: string;
    coefficient: number;
    average: number;
    classAverage?: number;
    examAverage?: number;
    appreciation?: string;
    professorName?: string;
    categoryGrades?: {
      name: string;
      code: string;
      average: number;
      isExam: boolean;
      gradesCount: number;
    }[];
  }

// --- State ---
const loading = ref(false);
const loadingPreview = ref(false);
const printing = ref(false);
const periodLoading = ref(false);
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

// Données de synthèse annuelle
const previewSemester1Average = ref<number | undefined>(undefined);
const previewSemester2Average = ref<number | undefined>(undefined);
const previewAnnualAverage = ref<number | undefined>(undefined);
const previewAnnualRank = ref<number | undefined>(undefined);
const previewClassHighestAnnual = ref<number | undefined>(undefined);
const previewClassLowestAnnual = ref<number | undefined>(undefined);
const previewAnnualAppreciation = ref<string | undefined>(undefined);
const previewDecisions = ref<{
  honors: boolean;
  admitted: boolean;
  session: boolean;
  repeat: boolean;
  excluded: boolean;
} | undefined>(undefined);

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
const studentRankings = ref<Map<any, RankingData>>(new Map());

// Template & Couleurs
const selectedTemplateId = ref('template1');
const colorOptions = reactive({
  primaryColor: '#2c3e50',
  secondaryColor: '#3498db',
  signatoryLeft: 'Le Professeur Principal',
  signatoryRight: 'Le Directeur'
});

const templates = [
  { id: 'template1', name: 'Classique', description: 'Design moderne et épuré', component: BulletinTemplateOne },
  { id: 'template2', name: 'Officiel', description: 'Style administratif traditionnel', component: BulletinTemplateTwo },
];

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

const isFinalPeriod = computed(() => {
  if (!selectedPeriod.value) return false;
  const p = selectedPeriod.value.toLowerCase();
  return p.includes('2') || p.includes('deuxième') || p.includes('deuxieme') || p.includes('3') || p.includes('troisième') || p.includes('troisieme') || p.includes('annuelle') || p.includes('annuel');
});

const previewCategories = computed(() => {
  const allCategories = new Map<string, { name: string; isExam: boolean }>();
  for (const g of previewGradesData.value) {
    if (g.categoryGrades) {
      for (const cat of g.categoryGrades) {
        if (!allCategories.has(cat.code)) {
          allCategories.set(cat.code, { name: cat.name, isExam: cat.isExam });
        }
      }
    }
  }
  const nonExam = Array.from(allCategories.entries())
    .filter(([_, info]) => info.isExam === false)
    .map(([code, info]) => ({ code, name: info.name, isExam: info.isExam }));
  return nonExam.length > 0 ? nonExam : [];
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
    // Charger en parallèle les élèves et les matières de la classe
    const [studentsRes, coursesRes] = await Promise.all([
      window.ipcRenderer.invoke('student:getByGrade', selectedClassId.value),
      window.ipcRenderer.invoke('course:getByGrade', selectedClassId.value),
    ]);

    if (studentsRes.success) students.value = studentsRes.data || [];
    if (coursesRes.success) {
      courses.value = (coursesRes.data || []).sort((a: any, b: any) => 
        (a.name || '').localeCompare(b.name || '')
      );
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

  const currentStudents = [...students.value];

  periodLoading.value = true;

  // Charger les absences de la classe uniquement quand une période est choisie
  if (absencesByStudent.value.length === 0) {
    try {
      const absencesRes = await window.ipcRenderer.invoke('absence:getTotalAbsencesGroupedByStudent', selectedClassId.value);
      if (absencesRes && Array.isArray(absencesRes)) {
        absencesByStudent.value = absencesRes;
      }
    } catch (error) {
      console.error('Erreur chargement absences:', error);
    }
  }

  try {
    // Mettre à jour les statuts de notes en parallèle
    await Promise.all(currentStudents.map((student) => checkStudentGradesStatus(student.id)));

    // Charger les classements des élèves
    await loadStudentRankings();

    // Rafraîchir l'aperçu si un élève est sélectionné
    if (previewStudent.value) {
      const student = currentStudents.find((s) => s.id === previewStudent.value?.id);
      if (student) {
        await loadStudentGradesForPreview(student);
      }
    }
  } finally {
    periodLoading.value = false;
  }
};

const loadStudentRankings = async () => {
  if (!selectedClassId.value || !selectedPeriod.value) {
    console.error('Cannot load rankings: missing classId or period', { classId: selectedClassId.value, period: selectedPeriod.value });
    return;
  }
  
  console.log('Loading rankings for:', { classId: selectedClassId.value, schoolId: schoolInfo.value?.id || schoolId.value, period: selectedPeriod.value });
  
  try {
    const rankingsRes = await window.ipcRenderer.invoke('gradeEntry:getClassRankings', {
      classId: selectedClassId.value,
      schoolId: schoolInfo.value?.id || schoolId.value,
      period: selectedPeriod.value
    });
    
      console.log('Rankings response:', rankingsRes);
      
    if (rankingsRes.success && rankingsRes.data) {
      const newMap = new Map<any, RankingData>();
      
      // Calculer la moyenne de classe et le nombre total d'élèves
      const totalStudents = rankingsRes.data.length;
      const classAvg = totalStudents > 0
        ? rankingsRes.data.reduce((sum: number, r: any) => sum + r.generalAverage, 0) / totalStudents
        : 0;
      
      // Stocker les données de classement pour chaque élève
      console.log('Storing rankings with data:', rankingsRes.data.map((r: any) => ({ studentId: r.studentId, rank: r.rank })));
      rankingsRes.data.forEach((r: any) => {
        const studentId = Number(r.studentId);
        const rankingData = {
          studentId: studentId,
          rank: r.rank,
          generalAverage: r.generalAverage,
          totalStudents: totalStudents,
          classAverage: Math.round(classAvg * 100) / 100
        };
        // Store with number key
        newMap.set(studentId, rankingData);
        // Store with string key as fallback
        newMap.set(String(r.studentId), rankingData);
      });
      
      console.log('Final map keys:', Array.from(newMap.keys()));
      
      studentRankings.value = newMap;
      
      // Mettre à jour la moyenne de classe globale
      classAverage.value = Math.round(classAvg * 100) / 100;
      
      console.log(`Classement chargé: ${totalStudents} élèves, moyenne de classe: ${classAvg.toFixed(2)}`);
      console.log('Student rankings map:', studentRankings.value);
    } else {
      console.error('Failed to load rankings:', rankingsRes);
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
        // Recalculer la moyenne (sans cache)
        const avgRes = await window.ipcRenderer.invoke('gradeEntry:calculate', {
          studentId: student.id,
          courseId: course.id,
          classId: selectedClassId.value,
          schoolId: schoolInfo.value?.id || schoolId.value,
          period: selectedPeriod.value
        });

       if (avgRes.success && avgRes.data) {
         // Récupérer le professeur enseignant cette matière dans cette classe
         let professorName = '';
         try {
           console.log(`🔍 Recherche professeur pour matière: ${course.name} (id=${course.id}), classe: ${selectedClassId.value}`);
           const profRes = await window.ipcRenderer.invoke('professor:getByCourseAndGrade', {
             courseId: course.id,
             gradeId: selectedClassId.value
           });

           console.log('Réponse professeur:', profRes);

           if (profRes.success && profRes.data) {
             professorName = `${profRes.data.firstname} ${profRes.data.lastname}`;
             console.log(`✅ Professeur trouvé: ${professorName}`);
           } else {
             console.log(`⚠️ Aucun professeur affecté pour ${course.name}: ${profRes.message}`);
           }
         } catch (error) {
           console.error('❌ Erreur récupération professeur:', error);
         }

          // Calculer la note de cours (moyenne des catégories qui ne sont pas des exams)
          const classAverage = calculateClassAverage(avgRes.data);
          const examAverage = calculateExamAverage(avgRes.data);
          console.log(`📝 Moyenne de cours pour ${course.name}: ${classAverage}`);
          console.log(`📝 Moyenne de composition pour ${course.name}: ${examAverage}`);

          // Extraire les notes par catégorie
          let categoryGrades: GradeData['categoryGrades'] = [];
          if (avgRes.data && avgRes.data.categoryBreakdown) {
            console.log(`📊 Category breakdown pour ${course.name}:`, avgRes.data.categoryBreakdown);
            const breakdown = Array.isArray(avgRes.data.categoryBreakdown) 
              ? avgRes.data.categoryBreakdown 
              : Object.values(avgRes.data.categoryBreakdown);
            categoryGrades = breakdown.map((cat: any) => ({
              name: cat.categoryName,
              code: cat.categoryCode,
              average: cat.average || 0,
              isExam: cat.isExam || false,
              gradesCount: cat.gradesCount || 0
            }));
            console.log(`📊 Category grades pour ${course.name}:`, categoryGrades);
          } else {
            console.log(`⚠️ Pas de categoryBreakdown pour ${course.name}:`, avgRes.data);
          }

          const courseTypeForName = (course as any).type || course.grades?.[0]?.type || (course as any).grade?.type || '';
          const courseTypeLabel = courseTypeForName ? String(courseTypeForName).charAt(0).toUpperCase() + String(courseTypeForName).slice(1).toLowerCase() : '';
          const courseCoeffForName = course.coefficient ? `, ${course.coefficient}` : '';
          const displayCourseName = courseTypeLabel ? `${course.name} (${courseTypeLabel}${courseCoeffForName})` : (courseCoeffForName ? `${course.name} (${courseCoeffForName.slice(2)})` : course.name);
          gradesResults.push({
            courseId: course.id,
            courseName: displayCourseName,
            coefficient: course.coefficient || 1,
            average: avgRes.data.finalAverage,
            classAverage: classAverage,
            examAverage: examAverage,
            appreciation: getAppreciation(avgRes.data.finalAverage),
            professorName,
            categoryGrades
          });
       }
     }
    
    previewGradesData.value = gradesResults;
    
    // Récupérer les absences de l'élève depuis les données chargées (en heures)
    const studentAbsence = absencesByStudent.value.find(a => a.studentId === student.id);
    previewAbsences.value = studentAbsence?.totalHours || 0;
    
    // Récupérer le rang de l'élève
    const studentId = Number(student.id);
    let ranking = studentRankings.value.get(studentId);
    if (!ranking) {
      ranking = studentRankings.value.get(String(student.id));
    }
    if (!ranking) {
      for (const [key, value] of studentRankings.value.entries()) {
        if (Number(key) === studentId || Number(value.studentId) === studentId) {
          ranking = value;
          break;
        }
      }
    }
    previewRank.value = ranking?.rank || 0;
    classAverage.value = ranking?.classAverage || 0;

    // Charger les données du semestre précédent pour la synthèse annuelle
    if (isFinalPeriod.value && selectedPeriod.value && courses.value.length > 0) {
      await loadAnnualData(student, gradesResults);
    } else {
      previewSemester1Average.value = undefined;
      previewSemester2Average.value = undefined;
      previewAnnualAverage.value = undefined;
      previewAnnualRank.value = undefined;
      previewClassHighestAnnual.value = undefined;
      previewClassLowestAnnual.value = undefined;
      previewAnnualAppreciation.value = undefined;
      previewDecisions.value = undefined;
    }

   } catch (error) {
    console.error('Erreur chargement aperçu:', error);
    previewGradesData.value = [];
  } finally {
    loadingPreview.value = false;
  }
 };

const findPreviousPeriod = (current: string): string | null => {
  const idx = periods.value.indexOf(current);
  if (idx > 0) {
    return periods.value[idx - 1];
  }
  const fallback = periods.value.find(p => {
    const lower = p.toLowerCase();
    return lower.includes('1') || lower.includes('premier');
  });
  return fallback || null;
};

const loadAnnualData = async (student: Student, currentGrades: GradeData[]) => {
  try {
    // 1. Calculer la moyenne générale du S2 (période actuelle)
    const s2TotalWeighted = currentGrades.reduce((sum, g) => sum + g.average * (g.coefficient || 1), 0);
    const s2TotalCoef = currentGrades.reduce((sum, g) => sum + (g.coefficient || 1), 0);
    const s2Average = s2TotalCoef > 0 ? s2TotalWeighted / s2TotalCoef : 0;
    previewSemester2Average.value = Math.round(s2Average * 100) / 100;

    // 2. Trouver la période précédente
    const prevPeriod = findPreviousPeriod(selectedPeriod.value!);
    if (!prevPeriod) {
      previewSemester1Average.value = undefined;
      previewAnnualAverage.value = previewSemester2Average.value;
      previewAnnualRank.value = previewRank.value;
      return;
    }

    // 3. Charger les notes du S1 pour l'élève
    const s1Grades: GradeData[] = [];
    for (const course of courses.value) {
      const avgRes = await window.ipcRenderer.invoke('gradeEntry:calculate', {
        studentId: student.id,
        courseId: course.id,
        classId: selectedClassId.value,
        schoolId: schoolInfo.value?.id || schoolId.value,
        period: prevPeriod
      });
      if (avgRes.success && avgRes.data && avgRes.data.finalAverage > 0) {
        const s1TypeForName = (course as any).type || course.grades?.[0]?.type || (course as any).grade?.type || '';
        const s1TypeLabel = s1TypeForName ? String(s1TypeForName).charAt(0).toUpperCase() + String(s1TypeForName).slice(1).toLowerCase() : '';
        const s1CoeffForName = course.coefficient ? `, ${course.coefficient}` : '';
        const s1DisplayName = s1TypeLabel ? `${course.name} (${s1TypeLabel}${s1CoeffForName})` : (s1CoeffForName ? `${course.name} (${s1CoeffForName.slice(2)})` : course.name);
        s1Grades.push({
          courseId: course.id,
          courseName: s1DisplayName,
          coefficient: course.coefficient || 1,
          average: avgRes.data.finalAverage,
          classAverage: 0,
          examAverage: 0,
          appreciation: '',
          professorName: '',
          categoryGrades: []
        });
      }
    }

    // 4. Calculer la moyenne générale du S1
    const s1TotalWeighted = s1Grades.reduce((sum, g) => sum + g.average * (g.coefficient || 1), 0);
    const s1TotalCoef = s1Grades.reduce((sum, g) => sum + (g.coefficient || 1), 0);
    const s1Average = s1TotalCoef > 0 ? s1TotalWeighted / s1TotalCoef : 0;
    previewSemester1Average.value = Math.round(s1Average * 100) / 100;

    // 5. Calculer la moyenne annuelle
    const annualAvg = (s1Average + s2Average) / 2;
    previewAnnualAverage.value = Math.round(annualAvg * 100) / 100;

    // 6. Charger les classements des deux périodes
    const [s1RankingsRes, s2RankingsRes] = await Promise.all([
      window.ipcRenderer.invoke('gradeEntry:getClassRankings', {
        classId: selectedClassId.value,
        schoolId: schoolInfo.value?.id || schoolId.value,
        period: prevPeriod
      }),
      window.ipcRenderer.invoke('gradeEntry:getClassRankings', {
        classId: selectedClassId.value,
        schoolId: schoolInfo.value?.id || schoolId.value,
        period: selectedPeriod.value
      })
    ]);

    // 7. Calculer le rang annuel approximatif
    if (s1RankingsRes.success && s1RankingsRes.data && s2RankingsRes.success && s2RankingsRes.data) {
      const annualAverages = new Map<number, number>();

      for (const r1 of s1RankingsRes.data) {
        const sid = Number(r1.studentId);
        const r2 = s2RankingsRes.data.find((r: any) => Number(r.studentId) === sid);
        if (r2) {
          annualAverages.set(sid, (r1.generalAverage + r2.generalAverage) / 2);
        } else {
          annualAverages.set(sid, r1.generalAverage);
        }
      }

      for (const r2 of s2RankingsRes.data) {
        const sid = Number(r2.studentId);
        if (!annualAverages.has(sid)) {
          annualAverages.set(sid, r2.generalAverage);
        }
      }

      const sorted = Array.from(annualAverages.entries()).sort((a, b) => b[1] - a[1]);
      const studentId = Number(student.id);
      const annualRankIndex = sorted.findIndex(([sid]) => sid === studentId);
      if (annualRankIndex >= 0) {
        previewAnnualRank.value = annualRankIndex + 1;
      }

      if (sorted.length > 0) {
        previewClassHighestAnnual.value = Math.round(sorted[0][1] * 100) / 100;
        previewClassLowestAnnual.value = Math.round(sorted[sorted.length - 1][1] * 100) / 100;
      }
    }

    // 8. Déterminer les décisions du conseil de classe
    previewAnnualAppreciation.value = getAppreciation(annualAvg);
    previewDecisions.value = {
      honors: annualAvg >= 16,
      admitted: annualAvg >= 10,
      session: annualAvg >= 8 && annualAvg < 10,
      repeat: annualAvg < 8,
      excluded: false  // Force always false - manual only
    };
  } catch (error) {
    console.error('Erreur chargement données annuelles:', error);
    previewSemester1Average.value = undefined;
    previewAnnualAverage.value = previewSemester2Average.value;
    previewAnnualRank.value = previewRank.value;
    previewDecisions.value = undefined;
  }
};

  const calculateClassAverage = (calculatedData: any): number => {
    let classAverage = 0;
    if (calculatedData && calculatedData.categoryBreakdown) {
      // categoryBreakdown peut être un objet ou un tableau
      const breakdown = Array.isArray(calculatedData.categoryBreakdown) 
        ? calculatedData.categoryBreakdown 
        : Object.values(calculatedData.categoryBreakdown);
      
      console.log('📊 breakdown pour calculateClassAverage:', breakdown.map((c: any) => ({ name: c.categoryName, isExam: c.isExam, average: c.average })));
      
      // Calculer la moyenne uniquement des catégories qui ne sont pas des examens
      let categoriesToUse = breakdown.filter((cat: any) => cat.isExam === false);
      console.log('📊 Catégories non-examen:', categoriesToUse.length, categoriesToUse.map((c: any) => ({ name: c.categoryName, average: c.average })));
      
      // Fallback: si aucune catégorie non-examen, utiliser toutes les catégories
      if (categoriesToUse.length === 0 && breakdown.length > 0) {
        categoriesToUse = breakdown;
        console.log('📊 Utilisation fallback - toutes les catégories');
      }
      
      if (categoriesToUse.length > 0) {
        const totalAvg = categoriesToUse.reduce((sum: number, cat: any) => sum + (cat.average || 0), 0);
        classAverage = Math.round((totalAvg / categoriesToUse.length) * 100) / 100;
        console.log('📊 Moyenne calculée:', classAverage, 'total:', totalAvg, 'nb:', categoriesToUse.length);
      }
    } else {
      console.log('📊 Pas de categoryBreakdown');
    }
    return classAverage;
  };

  const calculateExamAverage = (calculatedData: any): number => {
    let examAverage = 0;
    if (calculatedData && calculatedData.categoryBreakdown) {
      const breakdown = Array.isArray(calculatedData.categoryBreakdown) 
        ? calculatedData.categoryBreakdown 
        : Object.values(calculatedData.categoryBreakdown);
      
      const examCategories = breakdown.filter((cat: any) => cat.isExam === true);
      
      if (examCategories.length > 0) {
        const totalAvg = examCategories.reduce((sum: number, cat: any) => sum + (cat.average || 0), 0);
        examAverage = Math.round((totalAvg / examCategories.length) * 100) / 100;
      }
    }
    return examAverage;
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

// --- Country Header Data ---
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

const getCountryData = () => {
  const code = schoolInfo.value?.country || 'SEN';
  const data = countryHeaderMap[code] || countryHeaderMap['SEN'];
  const town = schoolInfo.value?.town || '';
  return {
    ...data,
    inspection: town ? `${data.inspection} DE ${town.toUpperCase()}` : data.inspection
  };
};

// --- Impression ---

const generateBulletinsHtml = async (studentsData: { student: Student; grades: GradeData[]; absences?: number; rank?: number; totalStudents?: number; classAverage?: number; semester1Average?: number; semester2Average?: number; annualAverage?: number; annualRank?: number; classHighestAnnual?: number; classLowestAnnual?: number; decisions?: { honors: boolean; admitted: boolean; session: boolean; repeat: boolean; excluded: boolean }; annualAppreciation?: string; isFinalPeriod?: boolean }[]) => {
  console.log('📄 generateBulletinsHtml appelé avec', studentsData.length, 'élèves');
  console.log('📄 Données des élèves avec rank:', studentsData.map(d => ({ id: d.student.id, name: d.student.firstname, rank: d.rank, totalStudents: d.totalStudents })));
  
  const bulletinPages = await Promise.all(
    studentsData.map(data => generateBulletinHtml(data))
  );
  
  return `
    <!DOCTYPE html>
    <html lang="fr">
    <head>
      <meta charset="UTF-8">
      <title>Bulletins - ${selectedClassName.value} - ${selectedPeriod.value}</title>
      <style>
        @page {
          size: A4;
          margin: 5mm;
        }
        
        * {
          box-sizing: border-box;
        }
        
        body {
          margin: 0;
          padding: 0;
          font-family: 'Inter', 'Segoe UI', 'Arial', sans-serif;
          font-size: 9pt;
          line-height: 1.3;
        }
        
        .bulletin-page {
          page-break-after: always;
          width: 210mm;
          height: 297mm;
          padding: 5mm 7mm;
          background: white;
          position: relative;
          box-sizing: border-box;
          overflow: hidden;
        }
        
        .bulletin-page:last-child {
          page-break-after: auto;
        }
        
        .no-print {
          display: none !important;
        }
        
        @media print {
          @page { size: A4 portrait; margin: 10mm; }
          body { width: 100%; margin: 0; padding: 0; font-size: 12px; }
          .bulletin-page { max-height: 275mm; overflow: hidden; }
          
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            background: white !important;
          }
          
          .bulletin-page {
            page-break-after: always;
            margin: 0;
            padding: 10mm;
            background: white !important;
            box-shadow: none !important;
          }
          
          .bulletin-page:last-child {
            page-break-after: auto;
          }
          
          .no-print {
            display: none !important;
          }
          
          .header {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          
          .grades-table th {
            background-color: #1a237e !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          
          .grades-table tbody tr:nth-child(even) {
            background-color: #fafafa !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          
          .student-info-section {
            background-color: #f8f9fa !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          
          .stat-box {
            background: #f8f9fa !important;
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          
          .footer-summary {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          
          .summary-grid {
            print-color-adjust: exact !important;
            -webkit-print-color-adjust: exact !important;
          }
          
          .decision-item {
            white-space: nowrap;
            font-size: 7px;
          }
        }
        
        @media screen {
          body {
            background: #f0f0f0;
            padding: 20px;
          }
          
          .bulletin-page {
            margin: 0 auto 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          
          .print-button {
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            padding: 12px 24px;
            background: #007bff;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 600;
            box-shadow: 0 2px 8px rgba(0,0,0,0.2);
          }
          
          .print-button:hover {
            background: #0056b3;
          }
        }
      </style>
    </head>
    <body>
      <button class="print-button no-print" onclick="window.print()">🖨️ Imprimer les bulletins</button>
      ${bulletinPages.join('\n')}
    </body>
    </html>
  `;
};

const generateBulletinHtml = async (data: { student: Student; grades: GradeData[]; absences?: number; rank?: number; totalStudents?: number; classAverage?: number; semester1Average?: number; semester2Average?: number; annualAverage?: number; annualRank?: number; classHighestAnnual?: number; classLowestAnnual?: number; decisions?: { honors: boolean; admitted: boolean; session: boolean; repeat: boolean; excluded: boolean }; annualAppreciation?: string; isFinalPeriod?: boolean }) => {
  const { student, grades, absences, rank, totalStudents, classAverage, semester1Average, semester2Average, annualAverage, annualRank, classHighestAnnual, classLowestAnnual, decisions, annualAppreciation, isFinalPeriod } = data;

  console.log('🎯 generateBulletinHtml - student:', student.id, student.firstname, 'rank:', rank, 'totalStudents:', totalStudents);

  console.log('🎯 generateBulletinHtml appelé avec', grades.length, 'matières');
  console.log('🎯 grades[0] brut:', JSON.stringify(grades[0]));
  console.log('🎯 Première matière categoryGrades:', grades[0]?.categoryGrades);
  console.log('🎯 Première matière categoryGrades détail:', grades[0]?.categoryGrades?.map((c: any) => ({ code: c.code, isExam: c.isExam, average: c.average })));

  // Calculer les données nécessaires
  const processedGrades = grades.map(g => ({
    ...g,
    weightedValue: g.average * (g.coefficient || 1)
  }));

  console.log('🎯 classAverage dans grades:', grades.map(g => ({ course: g.courseName, classAvg: g.classAverage })));

  // Extraire toutes les catégories uniques
  const allCategories = new Map<string, { name: string; isExam: boolean }>();
  for (const g of grades) {
    if (g.categoryGrades) {
      for (const cat of g.categoryGrades) {
        if (!allCategories.has(cat.code)) {
          allCategories.set(cat.code, { name: cat.name, isExam: cat.isExam });
        }
      }
    }
  }
  const categoryColumns = Array.from(allCategories.entries()).map(([code, info]) => ({
    code,
    name: info.name,
    isExam: info.isExam
  }));

  console.log('📋 Catégories trouvées:', categoryColumns);
  console.log('📋 isExam de chaque catégorie:', categoryColumns.map(c => ({ code: c.code, isExam: c.isExam })));
  console.log('📋 Nombre de catégories:', categoryColumns.length);

  // Filtrer uniquement les catégories non-examen pour les colonnes
  const nonExamCategories = categoryColumns.filter(c => c.isExam === false);
  console.log('📋 Catégories non-examen:', nonExamCategories);

  // Fallback: si pas de catégories non-examen, ne pas afficher de colonnes
  const finalCategories = nonExamCategories.length > 0 ? nonExamCategories : [];
  console.log('📋 Catégories finales (non-exam):', finalCategories);

  const totalCoefficients = processedGrades.reduce((sum, g) => sum + (g.coefficient || 1), 0);
  const totalWeightedPoints = processedGrades.reduce((sum, g) => sum + g.weightedValue, 0);
  const totalAveragePoints = processedGrades.reduce((sum, g) => sum + g.average, 0);
  const generalAverage = totalCoefficients > 0 ? totalWeightedPoints / totalCoefficients : 0;

  const primaryColor = colorOptions.primaryColor;
  const secondaryColor = colorOptions.secondaryColor;
  const periodLabel = selectedPeriod.value || 'Période';
  const logoUrl = schoolInfo.value?.logo?.url || '';

  const showAnnual = isFinalPeriod || (semester1Average !== undefined && semester1Average !== null);
  const computedAnnualAvg = annualAverage !== undefined && annualAverage !== null ? annualAverage : ((semester1Average || 0) + (semester2Average || 0)) / 2;
  const annualDecisionState = {
    honors: decisions?.honors || false,
    admitted: decisions?.admitted || false,
    session: decisions?.session || false,
    repeat: decisions?.repeat || false,
    excluded: decisions?.excluded || false
  };
  const decisionLabelsMap: Record<string, string> = {
    honors: 'Tableau d\'honneur',
    admitted: 'Admis(e) en classe Sup',
    session: 'Session',
    repeat: 'Redouble',
    excluded: 'Exclusion'
  };
  const getAnnualAppreciation = () => annualAppreciation || getAppreciation(computedAnnualAvg);

  // Générer le HTML selon le template sélectionné
  if (selectedTemplateId.value === 'template2') {
    return generateTemplate2Html(student, processedGrades, generalAverage, totalCoefficients, totalWeightedPoints, totalAveragePoints, primaryColor, secondaryColor, periodLabel, logoUrl, absences, rank, totalStudents, classAverage, finalCategories, showAnnual, semester1Average, semester2Average, computedAnnualAvg, annualRank, classHighestAnnual, classLowestAnnual, annualDecisionState, getAnnualAppreciation, decisionLabelsMap);
  } else {
    return generateTemplate1Html(student, processedGrades, generalAverage, totalCoefficients, totalWeightedPoints, totalAveragePoints, primaryColor, secondaryColor, periodLabel, logoUrl, absences, rank, totalStudents, classAverage, finalCategories, showAnnual, semester1Average, semester2Average, computedAnnualAvg, annualRank, classHighestAnnual, classLowestAnnual, annualDecisionState, getAnnualAppreciation, decisionLabelsMap);
  }
};

const generateTemplate1Html = (student: Student, processedGrades: any[], generalAverage: number, totalCoefficients: number, totalWeightedPoints: number, totalAveragePoints: number = 0, primaryColor: string, secondaryColor: string, periodLabel: string, logoUrl: string, absences: number = 0, rank: number = 0, totalStudents: number = 0, classAverage: number = 0, categoryColumns: { code: string; name: string; isExam: boolean }[] = [], showAnnual: boolean = false, semester1Average?: number, semester2Average?: number, computedAnnualAvg: number = 0, annualRank?: number, classHighestAnnual?: number, classLowestAnnual?: number, annualDecisionState?: any, getAnnualAppreciation?: () => string, decisionLabelsMap?: Record<string, string>) => {
  const cData = getCountryData();
  return `
    <div class="bulletin-page">
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap');
        
        .bulletin-page {
          font-family: 'Inter', sans-serif;
          color: #333;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 6px;
          border-bottom: 2px solid #eee;
          padding-bottom: 5px;
        }
        
        .header-block { width: 48%; }
        .header-left { text-align: left; }
        .header-right { text-align: right; }
        
        .school-logo { margin-bottom: 6px; }
        .school-logo img { max-width: 55px; max-height: 55px; }
        
        .school-name {
          font-size: 13px; margin: 0;
          text-transform: uppercase; font-weight: 700;
          color: ${primaryColor};
        }
        .school-detail { margin: 0; font-size: 9px; color: #555; }
        
        .country-name { font-size: 11px; font-weight: 700; text-transform: uppercase; margin: 0 0 2px; }
        .country-motto { font-size: 11px; font-style: italic; margin: 0 0 6px; color: #444; }
        .ministry { font-size: 8px; text-transform: uppercase; margin: 1px 0; color: #333; }
        .inspection { font-size: 8px; text-transform: uppercase; margin: 1px 0; color: #333; }
        
        .bulletin-title-section { text-align: center; margin-bottom: 6px; }
        .bulletin-title {
          font-size: 14px; font-weight: 700; text-transform: uppercase;
          margin: 0 0 4px; padding: 4px 10px; display: inline-block;
          border: 2px solid ${primaryColor}; color: ${primaryColor};
        }
        .school-year-line { font-size: 12px; margin: 6px 0 0; text-align: right; color: #555; }
        
        .student-info-section {
          display: flex;
          gap: 10px;
          background-color: #f8f9fa;
          padding: 8px 10px;
          border-left: 5px solid ${primaryColor};
          margin-bottom: 8px;
          border-radius: 4px;
        }
        
        .student-photo img {
          width: 50px;
          height: 50px;
          object-fit: cover;
          border-radius: 4px;
          border: 1px solid #ddd;
        }
        
        .student-details {
          flex: 1;
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px;
        }
        
        .detail-row {
          display: flex;
          align-items: baseline;
          gap: 6px;
        }
        
        .detail-row .label {
          font-size: 9px;
          color: #666;
          white-space: nowrap;
          font-weight: 600;
        }
        
        .detail-row .value {
          font-size: 10px;
          font-weight: 500;
        }
        
        .grades-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 6px;
          table-layout: fixed;
          word-wrap: break-word;
        }
        
        .grades-table th,
        .grades-table td {
          padding: 2px 3px;
          border: 1px solid #e0e0e0;
          font-size: 9px;
          text-align: center;
          line-height: 1.3;
        }
        
        .grades-table th {
          background-color: ${primaryColor};
          color: #fff;
          text-transform: uppercase;
          font-size: 8px;
          font-weight: 600;
          letter-spacing: 0.2px;
        }
        
        .grades-table tbody tr:nth-child(even) {
          background-color: #fafafa;
        }
        
        .grades-table .course-name {
          text-align: left;
          font-size: 8px;
          padding-left: 3px;
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
          margin-bottom: 8px;
          gap: 6px;
        }
        
        .stat-box {
          flex: 1;
          background: #f8f9fa;
          padding: 6px 8px;
          text-align: center;
          border-radius: 4px;
          border: 1px solid #eee;
        }
        
        .stat-box h4 {
          margin: 0 0 5px;
          font-size: 9px;
          text-transform: uppercase;
          color: ${secondaryColor};
        }
        
        .stat-value {
          margin: 0;
          font-size: 14px;
          font-weight: bold;
        }
        
        .signatures {
          display: flex;
          justify-content: space-between;
          margin-top: 12px;
        }
        
        .signature-box {
          width: 250px;
          text-align: center;
        }
        
        .signature-box p {
          font-weight: bold;
          border-bottom: 1px solid #000;
          padding-bottom: 5px;
          margin: 0 0 8px;
        }

        .signature-space {
          height: 30px;
        }

        .no-grades-message {
          text-align: center;
          padding: 30px;
          color: #909399;
          font-size: 14px;
        }

        .annual-summary-section {
          border: 2px solid;
          margin-bottom: 6px;
          background-color: #fff;
          border-radius: 4px;
          overflow: hidden;
        }

        .annual-title {
          text-align: center;
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 4px 0;
          letter-spacing: 0.5px;
        }

        .annual-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9px;
        }

        .annual-table th,
        .annual-table td {
          border: 1px solid #e0e0e0;
          padding: 4px;
          text-align: center;
        }

        .annual-table thead th {
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
          font-size: 8px;
        }

        .annual-highlight {
          font-size: 14px;
        }

        .annual-info-grid {
          display: flex;
          justify-content: space-around;
          padding: 6px;
          border-top: 1px solid #e0e0e0;
          background-color: #f8f9fa;
          gap: 6px;
        }

        .annual-info-box {
          display: flex;
          gap: 8px;
          align-items: center;
          font-size: 9px;
          border: 1px solid;
          padding: 4px 8px;
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
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .decisions-title {
          font-size: 9px;
          font-weight: 700;
          text-transform: uppercase;
          text-align: center;
          margin-bottom: 2px;
        }

        .decisions-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 4px;
        }

        .decision-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 8px;
          padding: 3px 4px;
          border: 1px solid #ccc;
          background-color: #fafafa;
          border-radius: 4px;
        }

        .appreciation-box {
          border: 2px solid #e0e0e0;
          padding: 6px;
          display: flex;
          flex-direction: column;
          gap: 6px;
          min-height: 35px;
          background-color: #fafafa;
          border-radius: 4px;
        }

        .appreciation-value {
          font-size: 12px;
          font-weight: 700;
          color: #000;
          text-align: center;
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
          border-left: 3px solid ${primaryColor} !important;
        }
      </style>
      
      <div class="header">
        <div class="header-block header-left">
          ${logoUrl ? `<div class="school-logo"><img src="${logoUrl}" alt="Logo École" /></div>` : ''}
          <h2 class="school-name">${escapeHtml(schoolInfo.value?.name || '')}</h2>
          <p class="school-detail">${escapeHtml(schoolInfo.value?.address || '')}</p>
          ${schoolInfo.value?.town ? `<p class="school-detail">${escapeHtml(schoolInfo.value.town)}</p>` : ''}
          ${schoolInfo.value?.phone ? `<p class="school-detail">Tél : ${escapeHtml(schoolInfo.value.phone)}</p>` : ''}
          ${schoolInfo.value?.email ? `<p class="school-detail">Email : ${escapeHtml(schoolInfo.value.email)}</p>` : ''}
        </div>
        <div class="header-block header-right">
          <h2 class="country-name">${escapeHtml(cData.countryName)}</h2>
          <p class="country-motto">${escapeHtml(cData.motto)}</p>
          <p class="ministry">${escapeHtml(cData.ministry)}</p>
          <p class="inspection">${escapeHtml(cData.inspection)}</p>
        </div>
      </div>
      
      <div class="bulletin-title-section">
        <h1 class="bulletin-title">BULLETIN DE NOTES DU ${escapeHtml(periodLabel.toUpperCase())}</h1>
        <p class="school-year-line">Année scolaire : ${currentYear.value}</p>
      </div>
      
      <div class="student-info-section">
        ${student.photo?.url ? `<div class="student-photo"><img src="${student.photo.url}" alt="Photo Élève" /></div>` : ''}
        <div class="student-details">
          <div class="detail-row">
            <span class="label">Nom & Prénom :</span>
            <span class="value">${escapeHtml(student.lastname)} ${escapeHtml(student.firstname)}</span>
          </div>
          <div class="detail-row">
            <span class="label">Matricule :</span>
            <span class="value">${escapeHtml(student.matricule)}</span>
          </div>
          <div class="detail-row">
            <span class="label">Classe :</span>
            <span class="value">${escapeHtml(student.grade?.name || '')}</span>
          </div>
          <div class="detail-row">
            <span class="label">Date de naissance :</span>
            <span class="value">${escapeHtml(formatBirthDay(student.birthDay))}</span>
          </div>
          <div class="detail-row">
            <span class="label">Genre :</span>
            <span class="value">${student.sex === 'male' ? 'Masculin' : student.sex === 'female' ? 'Féminin' : '-'}</span>
          </div>
        </div>
      </div>

      ${processedGrades.length === 0 ? `
        <div class="no-grades-message">
          <p>Aucune note disponible pour cette période</p>
        </div>
      ` : `
        <table class="grades-table">
             <thead>
                <tr>
                  <th>Matière</th>
                  <th class="text-center">Coef.</th>
                  ${categoryColumns.map((cat: any) => `<th class="text-center">${escapeHtml(cat.name)}</th>`).join('')}
                  <th class="text-center">Moyenne de cours</th>
                  <th class="text-center">Moyenne de composition</th>
                  <th class="text-center">Moyenne / 20</th>
                  <th class="text-center">Note Pondérée</th>
                  <th class="text-center">Appréciation</th>
                  <th>Professeur</th>
                </tr>
             </thead>
           <tbody>
              ${processedGrades.map(grade => {
                const gradeByCategory = new Map();
                if (grade.categoryGrades) {
                  for (const cat of grade.categoryGrades) {
                    gradeByCategory.set(cat.code, cat);
                  }
                }
                return `
                 <tr>
                    <td class="course-name">${escapeHtml(grade.courseName)}</td>
                    <td class="text-center">${grade.coefficient}</td>
                    ${categoryColumns.map((cat: any) => {
                      const catGrade = gradeByCategory.get(cat.code);
                      const note = catGrade ? formatNumber(catGrade.average) : '-';
                      return `<td class="text-center">${note}</td>`;
                    }).join('')}
                    <td class="text-center font-bold ${grade.classAverage < 10 ? 'text-red-600' : grade.classAverage >= 16 ? 'text-green-600' : ''}">${formatNumber(grade.classAverage)}</td>
                    <td class="text-center font-bold ${grade.examAverage < 10 ? 'text-red-600' : grade.examAverage >= 16 ? 'text-green-600' : ''}">${formatNumber(grade.examAverage)}</td>
                    <td class="text-center font-bold ${grade.average < 10 ? 'text-red-600' : grade.average >= 16 ? 'text-green-600' : ''}">${formatNumber(grade.average)}</td>
                    <td class="text-center font-bold">${formatNumber(grade.weightedValue)}</td>
                    <td class="text-center text-sm italic">${escapeHtml(grade.appreciation || getAppreciation(grade.average))}</td>
                    <td class="text-sm">${escapeHtml(grade.professorName || '-')}</td>
                 </tr>
               `}).join('')}
           </tbody>
           <tfoot>
               <tr style="background-color: ${secondaryColor}20">
                 <td class="font-bold">TOTAL</td>
                 <td class="text-center font-bold">${totalCoefficients}</td>
                 ${categoryColumns.map(() => '<td></td>').join('')}
                 <td></td>
                 <td></td>
                 <td class="text-center font-bold">${formatNumber(totalAveragePoints)}</td>
                 <td class="text-center font-bold">${formatNumber(totalWeightedPoints)}</td>
                 <td></td>
                 <td></td>
               </tr>
               <tr style="background-color: ${primaryColor}10">
                  <td colspan="2" class="text-right font-bold" style="font-size: 14px; white-space: nowrap;">MOYENNE GÉNÉRALE</td>
                  ${categoryColumns.map(() => '<td></td>').join('')}
                  <td colspan="2"></td>
                  <td colspan="2" class="text-left font-bold" style="font-size: 16px; color: ${primaryColor};">${formatNumber(generalAverage)} / 20</td>
                  <td colspan="2"></td>
                </tr>
             </tfoot>
         </table>
       `}
      
      ${showAnnual ? `
      <div class="annual-summary-section" style="border-color: ${primaryColor};">
        <div class="annual-title" style="background-color: ${primaryColor}; color: #fff;">
          MOYENNE ANNUELLE
        </div>
        <table class="annual-table">
          <thead>
            <tr style="background-color: ${secondaryColor}20;">
              <th colspan="2">Blocs de Synthèse des Moyennes</th>
              <th colspan="3" style="border-left: 3px solid ${primaryColor};">Annuelle</th>
            </tr>
            <tr style="background-color: ${primaryColor}; color: #fff;">
              <th>1er SEMESTRE</th>
              <th>2ème SEMESTRE</th>
              <th class="annual-separator">Du plus Fort</th>
              <th>De l'Élève</th>
              <th>Du Plus Faible</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td class="font-bold">${formatNumber(semester1Average || 0)}</td>
              <td class="font-bold">${formatNumber(semester2Average || 0)}</td>
              <td class="font-bold annual-separator">${formatNumber(classHighestAnnual || 0)}</td>
              <td class="font-bold annual-highlight" style="color: ${primaryColor};">${formatNumber(computedAnnualAvg)}</td>
              <td class="font-bold">${formatNumber(classLowestAnnual || 0)}</td>
            </tr>
          </tbody>
        </table>
        <div class="annual-info-grid">
          <div class="annual-info-box" style="border-color: ${primaryColor};">
            <span class="info-label">Rang :</span>
            <span class="info-value font-bold">${annualRank ? annualRank + (annualRank === 1 ? 'er' : 'ème') : '-'} / ${totalStudents}</span>
          </div>
          <div class="annual-info-box" style="border-color: ${primaryColor};">
            <span class="info-label">Effectifs :</span>
            <span class="info-value font-bold">${totalStudents}</span>
          </div>
        </div>
        <div class="annual-decisions">
          <div class="decisions-title" style="color: ${primaryColor};">Décisions du Conseil de Classe</div>
          <div class="decisions-grid">
            ${Object.entries(decisionLabelsMap || {}).map(([key, label]) => `
            <div class="decision-item ${annualDecisionState?.[key] ? 'decision-active' : ''}">
              <span class="checkbox"><span class="checkmark">${annualDecisionState?.[key] ? '✓' : ''}</span></span>
              <span class="decision-label">${escapeHtml(label)}</span>
            </div>
            `).join('')}
          </div>
          <div class="appreciation-box">
            <div class="appreciation-title">Appréciation Globale</div>
            <div class="appreciation-value">${escapeHtml(getAnnualAppreciation ? getAnnualAppreciation() : '-')}</div>
          </div>
        </div>
      </div>
      ` : ''}
      <div class="footer-stats">
        <div class="stat-box">
          <h4>Classement</h4>
          <p class="stat-value">${(rank != null && rank > 0) ? rank + (rank === 1 ? 'er' : 'ème') : 'Non classé'} / ${totalStudents}</p>
        </div>
        <div class="stat-box">
          <h4>Moyenne Classe</h4>
          <p class="stat-value">${formatNumber(classAverage)}</p>
        </div>
        <div class="stat-box">
          <h4>Absences</h4>
          <p class="stat-value">${absences} h</p>
        </div>
      </div>
      
      <div class="signatures">
        <div class="signature-box">
          <p>${escapeHtml(colorOptions.signatoryLeft)}</p>
          <div class="signature-space"></div>
        </div>
        <div class="signature-box">
          <p>${escapeHtml(colorOptions.signatoryRight)}</p>
          <div class="signature-space"></div>
        </div>
      </div>
    </div>
  `;
};

const generateTemplate2Html = (student: Student, processedGrades: any[], generalAverage: number, totalCoefficients: number, totalWeightedPoints: number, totalAveragePoints: number = 0, primaryColor: string, secondaryColor: string, periodLabel: string, logoUrl: string, absences: number = 0, rank: number = 0, totalStudents: number = 0, classAverage: number = 0, categoryColumns: { code: string; name: string; isExam: boolean }[] = [], showAnnual: boolean = false, semester1Average?: number, semester2Average?: number, computedAnnualAvg: number = 0, annualRank?: number, classHighestAnnual?: number, classLowestAnnual?: number, annualDecisionState?: any, getAnnualAppreciation?: () => string, decisionLabelsMap?: Record<string, string>) => {
  const cData = getCountryData();
  const getGradeClass = (grade: number) => {
    if (grade < 10) return 'grade-low';
    if (grade >= 16) return 'grade-excellent';
    if (grade >= 14) return 'grade-good';
    return '';
  };
  
  return `
    <div class="bulletin-page">
      <style>
        .bulletin-page {
          font-family: 'Arial Narrow', Arial, sans-serif;
          color: #000;
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 5px;
          border-bottom: 2px solid #2c3e50;
          padding-bottom: 5px;
        }
        
        .header-block { width: 48%; }
        .header-left-block { text-align: left; }
        .header-right-block { text-align: right; }
        
        .logo-box { margin-bottom: 2px; }
        
        .logo-circle {
          width: 48px;
          height: 48px;
          border: 2px solid ${primaryColor};
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
        
        .school-name {
          font-size: 11px;
          margin: 2px 0 1px 0;
          font-weight: 900;
          text-transform: uppercase;
          color: ${primaryColor};
        }
        .school-detail { margin: 0; font-size: 8px; color: #444; }
        
        .country-name { font-size: 10px; font-weight: 700; text-transform: uppercase; margin: 0 0 1px; }
        .country-motto { font-size: 8px; font-style: italic; margin: 0 0 2px; color: #333; }
        .ministry-text { font-size: 7px; text-transform: uppercase; margin: 0; color: #222; }
        .inspection-text { font-size: 7px; text-transform: uppercase; margin: 0; color: #222; }
        
        .bulletin-title-box {
          text-align: center;
          border: 2px solid #2c3e50;
          margin-bottom: 4px;
          padding: 4px 0;
          background-color: ${secondaryColor}30;
        }
        
        .bulletin-title-box h1 {
          margin: 0;
          font-size: 14px;
          font-family: "Times New Roman", serif;
          font-weight: 700;
          text-transform: uppercase;
        }
        
        .school-year-line {
          font-size: 9px;
          margin: 2px 0 0;
          text-align: right;
          padding-right: 6px;
          color: #444;
        }
        
        .student-info {
          border: 2px solid ${primaryColor};
          background-color: #f5f5f5;
          margin-bottom: 4px;
          font-size: 8px;
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
          padding: 2px 4px;
          border-right: 1px solid #999;
        }
        .student-info .cell:last-child {
          border-right: none;
        }
        
        .header-block { width: 48%; }
        .header-left-block { text-align: left; }
        .header-right-block { text-align: right; }
        
        .notes-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 7px;
          border: 2px solid #000;
          margin-bottom: 4px;
        }
        
        .notes-table th, .notes-table td {
          border: 1px solid #000;
          padding: 2px 3px;
          text-align: center;
          font-size: 9px;
        }
        
        .notes-table thead th {
          background-color: ${primaryColor};
          color: #fff;
          font-size: 8px;
          text-transform: uppercase;
          letter-spacing: 0.2px;
        }
        
        .col-matiere { width: 18%; text-align: left; padding-left: 3px !important; }
        .col-coeff { width: 6%; }
        .col-note { width: 8%; }
        .col-prof { width: 15%; }
        
        .text-left { text-align: left; padding-left: 8px; }
        .bg-gray { background-color: #e8e8e8; }
        .font-bold { font-weight: bold; }
        .row-even { background-color: #fafafa; }
        
        .grade-low { color: #c62828; font-weight: bold; }
        .grade-good { color: #2e7d32; }
        .grade-excellent { color: #1565c0; font-weight: bold; }
        
        .appreciation { font-size: 8px; font-style: italic; }
        .professor-name { font-size: 8px; text-align: left; padding-left: 3px; }
        
        .total-row td {
          border-top: 2px solid #000;
          background-color: #f0f0f0;
        }
        
        .moyenne-generale-row .label-moyenne {
          background-color: ${secondaryColor}20;
          text-align: right;
          padding-right: 8px;
          font-weight: bold;
          font-size: 9px;
        }
        
        .moyenne-generale-row .value-moyenne {
          background-color: ${secondaryColor}20;
          font-weight: bold;
          font-size: 11px;
          text-align: left;
          padding-left: 8px;
          color: ${primaryColor};
        }
        
        .footer-summary {
          border: 2px solid #000;
          background-color: #f5f5f5;
          padding: 6px;
          font-size: 8px;
        }
        
        .summary-grid {
          display: flex;
          justify-content: space-between;
          gap: 10px;
        }
        
        .summary-left, .summary-right {
          width: 48%;
        }
        
        .summary-line {
          display: flex;
          justify-content: space-between;
          margin-bottom: 2px;
          padding: 2px 0;
          border-bottom: 1px dotted #666;
        }
        
        .summary-line .value {
          font-weight: bold;
        }
        
        .rank-line {
          border: 2px solid ${primaryColor};
          padding: 4px 6px;
          background: white;
          margin-bottom: 4px;
          text-align: center;
          font-size: 9px;
        }
        
        .stats-box {
          border: 1px solid #000;
          margin-bottom: 4px;
        }
        
        .stat-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 4px;
          border-bottom: 1px solid #ccc;
        }
        
        .stat-row:last-child {
          border-bottom: none;
        }
        
        .stat-row .val {
          font-weight: bold;
        }
        
        .signature {
          margin-top: 8px;
          text-align: center;
          font-weight: bold;
        }
        
        .signature-space {
          height: 25px;
          border-bottom: 1px solid #000;
          margin-top: 3px;
        }

        .annual-summary-section {
          border: 2px solid #000;
          margin-bottom: 4px;
          background-color: #fff;
        }

        .annual-title {
          text-align: center;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          padding: 3px 0;
          letter-spacing: 0.5px;
        }

        .annual-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 8px;
          border-bottom: 2px solid #000;
        }

        .annual-table th,
        .annual-table td {
          border: 1px solid #000;
          padding: 3px;
          text-align: center;
          font-size: 7px;
        }

        .annual-table thead th {
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }

        .annual-highlight {
          font-size: 9px;
        }

        .annual-info-grid {
          display: flex;
          justify-content: space-around;
          padding: 4px;
          border-bottom: 1px solid #000;
          background-color: #f5f5f5;
        }

        .annual-info-box {
          display: flex;
          gap: 4px;
          align-items: center;
          font-size: 8px;
        }

        .info-label {
          font-weight: 600;
        }

        .info-value {
          font-size: 13px;
        }

        .annual-decisions {
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 3px;
        }

        .decisions-title {
          font-size: 8px;
          font-weight: 700;
          text-transform: uppercase;
          text-align: center;
          margin-bottom: 2px;
        }

        .decisions-grid {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 3px;
        }

        .decision-item {
          display: flex;
          align-items: center;
          gap: 2px;
          font-size: 7px;
          padding: 2px 3px;
          border: 1px solid #999;
          background-color: #fafafa;
          border-radius: 3px;
        }

        .appreciation-box {
          border: 2px solid #000;
          padding: 4px;
          margin-top: 2px;
          display: flex;
          flex-direction: column;
          gap: 2px;
          min-height: 30px;
        }

        .appreciation-title {
          font-size: 7px;
          font-weight: 700;
          text-transform: uppercase;
          color: #555;
        }

        .appreciation-value {
          font-size: 10px;
          font-weight: 700;
          color: #000;
          text-align: center;
        }

        .annual-separator {
          border-left: 3px solid ${primaryColor} !important;
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
      </style>
      
      <div class="header">
        <div class="header-block header-left-block">
          <div class="logo-box">
            ${logoUrl ? `
              <div class="logo-circle">
                <img src="${logoUrl}" alt="Logo" />
              </div>
            ` : ''}
          </div>
          <h2 class="school-name">${escapeHtml(schoolInfo.value?.name || 'Nom de l\'École')}</h2>
          <p class="school-detail">${escapeHtml(schoolInfo.value?.address || '')}</p>
          ${schoolInfo.value?.town ? `<p class="school-detail">${escapeHtml(schoolInfo.value.town)}</p>` : ''}
          ${schoolInfo.value?.phone ? `<p class="school-detail">Tél : ${escapeHtml(schoolInfo.value.phone)}</p>` : ''}
          ${schoolInfo.value?.email ? `<p class="school-detail">Email : ${escapeHtml(schoolInfo.value.email)}</p>` : ''}
        </div>
        <div class="header-block header-right-block">
          <h2 class="country-name">${escapeHtml(cData.countryName)}</h2>
          <p class="country-motto">${escapeHtml(cData.motto)}</p>
          <p class="ministry-text">${escapeHtml(cData.ministry)}</p>
          <p class="inspection-text">${escapeHtml(cData.inspection)}</p>
        </div>
      </div>
      
      <div class="bulletin-title-box">
        <h1>BULLETIN DE NOTES DU ${escapeHtml(periodLabel.toUpperCase())}</h1>
        <p class="school-year-line">Année scolaire : ${currentYear.value}</p>
      </div>
      
      <div class="student-info">
        <div class="row">
          <div class="cell"><strong>Nom :</strong> ${escapeHtml(student.lastname || '-')}</div>
          <div class="cell"><strong>Prénoms :</strong> ${escapeHtml(student.firstname || '-')}</div>
        </div>
        <div class="row">
          <div class="cell"><strong>N° Matricule :</strong> ${escapeHtml(student.matricule || '-')}</div>
          <div class="cell"><strong>Classe :</strong> ${escapeHtml(student.grade?.name || '-')}</div>
        </div>
        <div class="row">
          <div class="cell"><strong>Date de naissance :</strong> ${escapeHtml(formatBirthDay(student.birthDay))}</div>
          <div class="cell"><strong>Genre :</strong> ${student.sex === 'male' ? 'Masculin' : student.sex === 'female' ? 'Féminin' : '-'}</div>
        </div>
      </div>
      
      <table class="notes-table">
          <thead>
            <tr>
              <th class="col-matiere">Matières</th>
              <th class="col-coeff">Coeff</th>
              ${categoryColumns.map((cat: any) => `<th class="col-note">${escapeHtml(cat.name)}</th>`).join('')}
              <th class="col-note">Moy. cours</th>
              <th class="col-note">Moy. comp</th>
              <th class="col-note">Moyenne</th>
              <th class="col-note">Points</th>
              <th>Appréciation</th>
              <th class="col-prof">Professeur</th>
            </tr>
          </thead>
         <tbody>
             ${processedGrades.map((grade, index) => {
                const gradeByCategory = new Map();
                if (grade.categoryGrades) {
                  for (const cat of grade.categoryGrades) {
                    gradeByCategory.set(cat.code, cat);
                  }
                }
                return `
               <tr class="${index % 2 === 0 ? 'row-even' : ''}">
                <td class="text-left">${escapeHtml(grade.courseName)}</td>
                <td>${grade.coefficient}</td>
                ${categoryColumns.map((cat: any) => {
                  const catGrade = gradeByCategory.get(cat.code);
                  const note = catGrade ? formatNumber(catGrade.average) : '-';
                  return `<td>${note}</td>`;
                }).join('')}
                <td class="${getGradeClass(grade.classAverage)}">${formatNumber(grade.classAverage)}</td>
                <td class="${getGradeClass(grade.examAverage)}">${formatNumber(grade.examAverage)}</td>
                <td class="${getGradeClass(grade.average)}">${formatNumber(grade.average)}</td>
                <td class="bg-gray">${formatNumber(grade.weightedValue)}</td>
                <td class="appreciation">${escapeHtml(grade.appreciation || getAppreciation(grade.average))}</td>
                <td class="professor-name">${escapeHtml(grade.professorName || '-')}</td>
               </tr>
             `}).join('')}
          </tbody>
            <tfoot>
             <tr class="total-row">
               <td class="text-left font-bold">TOTAL</td>
               <td class="font-bold">${totalCoefficients}</td>
               ${categoryColumns.map(() => '<td></td>').join('')}
               <td></td>
               <td></td>
               <td class="bg-gray font-bold">${formatNumber(totalAveragePoints)}</td>
               <td class="bg-gray font-bold">${formatNumber(totalWeightedPoints)}</td>
               <td colspan="2"></td>
             </tr>
               <tr class="moyenne-generale-row">
                 <td colspan="2" class="label-moyenne" style="white-space: nowrap;">Moyenne Générale</td>
                 ${categoryColumns.map(() => '<td></td>').join('')}
                 <td colspan="2"></td>
                 <td colspan="2" class="value-moyenne">${formatNumber(generalAverage)} / 20</td>
                 <td colspan="2"></td>
               </tr>
           </tfoot>
       </table>

       ${showAnnual ? `
       <div class="annual-summary-section">
         <div class="annual-title" style="background-color: ${primaryColor}; color: #fff;">
           MOYENNE ANNUELLE
         </div>
         <table class="annual-table">
           <thead>
             <tr>
                <th colspan="2" style="background-color: ${secondaryColor}30;">Blocs de Synthèse des Moyennes</th>
                <th colspan="3" style="background-color: ${secondaryColor}30; border-left: 3px solid ${primaryColor};">Annuelle</th>
              </tr>
              <tr style="background-color: ${primaryColor}; color: #fff;">
                <th>1er SEMESTRE</th>
                <th>2ème SEMESTRE</th>
                <th class="annual-separator">Du plus Fort</th>
                <th>De l'Élève</th>
                <th>Du Plus Faible</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td class="font-bold">${formatNumber(semester1Average || 0)}</td>
                <td class="font-bold">${formatNumber(semester2Average || 0)}</td>
                <td class="font-bold annual-separator">${formatNumber(classHighestAnnual || 0)}</td>
               <td class="font-bold annual-highlight" style="color: ${primaryColor};">${formatNumber(computedAnnualAvg)}</td>
               <td class="font-bold">${formatNumber(classLowestAnnual || 0)}</td>
             </tr>
           </tbody>
         </table>
         <div class="annual-info-grid">
           <div class="annual-info-box">
             <span class="info-label">Rang :</span>
             <span class="info-value font-bold">${annualRank ? annualRank + (annualRank === 1 ? 'er' : 'ème') : '-'} / ${totalStudents}</span>
           </div>
           <div class="annual-info-box">
             <span class="info-label">Effectifs :</span>
             <span class="info-value font-bold">${totalStudents}</span>
           </div>
         </div>
         <div class="annual-decisions">
           <div class="decisions-title" style="color: ${primaryColor};">Décisions du Conseil de Classe</div>
           <div class="decisions-grid">
              ${Object.entries(decisionLabelsMap || {}).map(([key, label]) => `
              <div class="decision-item ${annualDecisionState?.[key] ? 'decision-active' : ''}">
                <span class="checkbox"><span class="checkmark">${annualDecisionState?.[key] ? '✓' : ''}</span></span>
                <span class="decision-label">${escapeHtml(label)}</span>
              </div>
              `).join('')}
            </div>
            <div class="appreciation-box">
              <div class="appreciation-title">Appréciation Globale</div>
              <div class="appreciation-value">${escapeHtml(getAnnualAppreciation ? getAnnualAppreciation() : '-')}</div>
           </div>
         </div>
       </div>
       ` : ''}
       
       <div class="footer-summary">
         <div class="summary-grid">
           <div class="summary-left">
             <div class="summary-line">
               <span>Moyenne Trimestrielle :</span>
               <span class="value">${formatNumber(generalAverage)} /20</span>
             </div>
             <div class="summary-line">
               <span>Moyenne de la Classe :</span>
               <span class="value">${formatNumber(classAverage)} /20</span>
             </div>
             <div class="signature">
                ${escapeHtml(colorOptions.signatoryLeft)}
                <div class="signature-space"></div>
             </div>
           </div>
           
           <div class="summary-right">
             <div class="rank-line">
               Rang : <strong>${(rank != null && rank > 0) ? rank + (rank === 1 ? 'er' : 'ème') : 'Non classé'}</strong> / ${totalStudents} élèves
             </div>
             <div class="stats-box">
               <div class="stat-row">
                 <span>Absences :</span>
                 <span class="val">${absences} h</span>
               </div>
             </div>
             <div class="signature">
               ${escapeHtml(colorOptions.signatoryRight)}
              <div class="signature-space"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;
};

const handlePrint = async () => {
  if (selectedStudents.value.length === 0) return;

  // Charger les informations de l'école si pas encore chargées
  if (!schoolInfo.value?.id) {
    await loadInitialData();
  }

  printing.value = true;
  showProgressDialog.value = true;
  progressPercentage.value = 0;
  progressMessage.value = 'Validation des données...';
  progressStatus.value = '';
  validationErrors.value = [];

  // Charger les classements des élèves avant la validation
  progressMessage.value = 'Chargement des classements...';
  
  console.log('Loading rankings - classId:', selectedClassId.value, 'period:', selectedPeriod.value, 'schoolId:', schoolInfo.value?.id || schoolId.value);
  
  if (!selectedPeriod.value) {
    console.error('Période non sélectionnée!');
    ElMessage.error('Veuillez sélectionner une période');
    printing.value = false;
    showProgressDialog.value = false;
    return;
  }
  
  await loadStudentRankings();
  
  console.log('After loading rankings, studentRankings:', studentRankings.value);

  const studentsToPrint = selectedStudents.value;
  const validStudentsData: { student: Student; grades: GradeData[]; absences?: number; rank?: number; totalStudents?: number; classAverage?: number; semester1Average?: number; semester2Average?: number; annualAverage?: number; annualRank?: number; classHighestAnnual?: number; classLowestAnnual?: number; decisions?: { honors: boolean; admitted: boolean; session: boolean; repeat: boolean; excluded: boolean }; annualAppreciation?: string; isFinalPeriod?: boolean }[] = [];

  // Validation : Vérifier que chaque élève a TOUTES ses notes
  for (let i = 0; i < studentsToPrint.length; i++) {
    const student = studentsToPrint[i];
    progressMessage.value = `Vérification de ${student.firstname} ${student.lastname}...`;
    progressPercentage.value = Math.floor(((i + 1) / studentsToPrint.length) * 50);

    try {
      const studentGrades: GradeData[] = [];
      let missingCourses = 0;

      // Recalculer les moyennes pour chaque matière (sans cache)
      for (const course of courses.value) {
        const avgRes = await window.ipcRenderer.invoke('gradeEntry:calculate', {
          studentId: student.id,
          courseId: course.id,
          classId: selectedClassId.value,
          schoolId: schoolInfo.value?.id || schoolId.value,
          period: selectedPeriod.value
        });

        if (avgRes.success && avgRes.data && avgRes.data.finalAverage > 0) {
          // Récupérer le professeur enseignant cette matière dans cette classe
          let professorName = '';
          try {
            const profRes = await window.ipcRenderer.invoke('professor:getByCourseAndGrade', {
              courseId: course.id,
              gradeId: selectedClassId.value
            });
            
             if (profRes.success && profRes.data) {
               professorName = `${profRes.data.firstname} ${profRes.data.lastname}`;
             }
           } catch (error) {
             console.error('Erreur récupération professeur:', error);
           }

            // Calculer la note de cours (moyenne des catégories qui ne sont pas des exams)
             const classAverage = calculateClassAverage(avgRes.data);
             const examAverage = calculateExamAverage(avgRes.data);

            // Extraire les notes par catégorie
            let categoryGrades: GradeData['categoryGrades'] = [];
            if (avgRes.data.categoryBreakdown) {
              const breakdown = Array.isArray(avgRes.data.categoryBreakdown) 
                ? avgRes.data.categoryBreakdown 
                : Object.values(avgRes.data.categoryBreakdown);
              console.log('💾 Extraction categoryGrades AVANT breakdown:', breakdown);
              categoryGrades = breakdown.map((cat: any) => ({
                name: cat.categoryName,
                code: cat.categoryCode,
                average: cat.average || 0,
                isExam: cat.isExam || false,
                gradesCount: cat.gradesCount || 0
              }));
              console.log('💾 Extraction categoryGrades APRÈS:', categoryGrades);
            }

            const bulkTypeForName = (course as any).type || course.grades?.[0]?.type || (course as any).grade?.type || '';
            const bulkTypeLabel = bulkTypeForName ? String(bulkTypeForName).charAt(0).toUpperCase() + String(bulkTypeForName).slice(1).toLowerCase() : '';
            const bulkCoeffForName = course.coefficient ? `, ${course.coefficient}` : '';
            const bulkDisplayName = bulkTypeLabel ? `${course.name} (${bulkTypeLabel}${bulkCoeffForName})` : (bulkCoeffForName ? `${course.name} (${bulkCoeffForName.slice(2)})` : course.name);
            studentGrades.push({
              courseId: course.id,
              courseName: bulkDisplayName,
              coefficient: course.coefficient || 1,
              average: avgRes.data.finalAverage,
              classAverage: classAverage,
              examAverage: examAverage,
              appreciation: getAppreciation(avgRes.data.finalAverage),
              professorName,
              categoryGrades
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
      const studentId = Number(student.id);
      
      // Chercher dans toutes les valeurs du Map
      let ranking = null;
      for (const entry of studentRankings.value.entries()) {
        const value = entry[1];
        if (Number(value.studentId) === studentId) {
          ranking = value;
          break;
        }
      }

      const studentRank = ranking?.rank ?? undefined;
      const studentTotalStudents = ranking?.totalStudents ?? students.value.length;
      const studentClassAverage = ranking?.classAverage ?? classAverage.value;
      
      console.log(`Student ${student.id} final rank:`, studentRank, 'totalStudents:', studentTotalStudents);

      // Charger les données annuelles si période finale
      let annualData: any = {};
      if (isFinalPeriod.value && selectedPeriod.value) {
        const savedS1 = previewSemester1Average.value;
        const savedS2 = previewSemester2Average.value;
        const savedAnnual = previewAnnualAverage.value;
        const savedAnnualRank = previewAnnualRank.value;
        const savedHighest = previewClassHighestAnnual.value;
        const savedLowest = previewClassLowestAnnual.value;
        const savedAppreciation = previewAnnualAppreciation.value;
        const savedDecisions = previewDecisions.value;

        await loadAnnualData(student, studentGrades);

        annualData = {
          semester1Average: previewSemester1Average.value,
          semester2Average: previewSemester2Average.value,
          annualAverage: previewAnnualAverage.value,
          annualRank: previewAnnualRank.value,
          classHighestAnnual: previewClassHighestAnnual.value,
          classLowestAnnual: previewClassLowestAnnual.value,
          annualAppreciation: previewAnnualAppreciation.value,
          decisions: previewDecisions.value ? { ...previewDecisions.value } : undefined,
          isFinalPeriod: true
        };

        // Restaurer les refs de l'aperçu
        previewSemester1Average.value = savedS1;
        previewSemester2Average.value = savedS2;
        previewAnnualAverage.value = savedAnnual;
        previewAnnualRank.value = savedAnnualRank;
        previewClassHighestAnnual.value = savedHighest;
        previewClassLowestAnnual.value = savedLowest;
        previewAnnualAppreciation.value = savedAppreciation;
        previewDecisions.value = savedDecisions;
      }

      validStudentsData.push({ 
        student, 
        grades: studentGrades, 
        absences: totalAbsenceHours,
        rank: studentRank,
        totalStudents: studentTotalStudents,
        classAverage: studentClassAverage,
        ...annualData
      });

    } catch (e) {
      validationErrors.value.push(`${student.firstname} ${student.lastname}: Erreur technique.`);
    }
  }

  console.log('validStudentsData with ranks:', validStudentsData.map(d => ({ student: d.student.id, rank: d.rank, totalStudents: d.totalStudents })));

  // Si erreurs de validation
  if (validationErrors.value.length > 0) {
    progressStatus.value = 'exception';
    progressMessage.value = `${validationErrors.value.length} erreur(s) détectée(s). Veuillez compléter les notes manquantes.`;
    printing.value = false;
    return;
  }

  // Lancer l'impression
  progressMessage.value = 'Génération des bulletins...';
  progressPercentage.value = 70;

  try {
    // Générer le HTML pour l'impression
    const bulletinsHtml = await generateBulletinsHtml(validStudentsData);
    
    progressMessage.value = 'Ouverture de la fenêtre d\'impression...';
    progressPercentage.value = 90;

    // Ouvrir dans une nouvelle fenêtre
    const printWindow = window.open('', '_blank', 'width=900,height=800,scrollbars=yes,resizable=yes');
    
    if (printWindow) {
      printWindow.document.write(bulletinsHtml);
      printWindow.document.close();
      
      // Attendre que le contenu soit chargé avant d'imprimer
      printWindow.onload = () => {
        setTimeout(() => {
          printWindow.focus();
          printWindow.print();
        }, 500);
      };
      
      // Fallback si onload ne se déclenche pas
      setTimeout(() => {
        if (printWindow && !printWindow.closed) {
          printWindow.focus();
          printWindow.print();
        }
      }, 1000);
      
      progressPercentage.value = 100;
      progressMessage.value = 'Fenêtre d\'impression ouverte !';
      progressStatus.value = 'success';
      ElMessage.success('Fenêtre d\'impression ouverte');
    } else {
      // Si le popup est bloqué, télécharger en HTML
      const blob = new Blob([bulletinsHtml], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `bulletins_${selectedClassName.value}_${selectedPeriod.value}_${new Date().toISOString().slice(0,10)}.html`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      progressPercentage.value = 100;
      progressMessage.value = 'Bulletins téléchargés !';
      progressStatus.value = 'success';
      ElMessage.warning('Pop-up bloqué. Les bulletins ont été téléchargés en tant que fichier HTML.');
    }
  } catch (error) {
    console.error('Erreur lors de la génération des bulletins:', error);
    progressStatus.value = 'exception';
    progressMessage.value = 'Erreur lors de la génération des bulletins';
    ElMessage.error('Erreur lors de la génération des bulletins');
  } finally {
    printing.value = false;
  }
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
  max-height: calc(100vh - 180px);
  overflow: auto;
  /* Permet le scroll quand le contenu A4 dépasse */
}

.preview-scaler {
  transform: scale(0.72);
  transform-origin: top center;
  box-shadow: 0 8px 32px rgba(0,0,0,0.4);
  border-radius: 4px;
  /* A4 réel 210mm, le scale 0.72 donne ~151mm visible, lisible sans débordement */
  width: 210mm;
  flex-shrink: 0;
}

@media (max-width: 1400px) {
  .preview-scaler {
    transform: scale(0.60);
  }
}

@media (max-width: 1100px) {
  .preview-scaler {
    transform: scale(0.50);
  }
}

@media print {
  .preview-container {
    background: white;
    padding: 0;
    overflow: visible;
  }
  .preview-scaler {
    transform: none;
    width: 100%;
    box-shadow: none;
  }
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
