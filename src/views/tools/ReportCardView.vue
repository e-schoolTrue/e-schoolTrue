<template>
  <div class="report-card-view">
    <!-- Header compact -->
    <div class="header-bar">
      <div class="header-left">
        <h2><el-icon><Document /></el-icon> Saisie des Notes</h2>
        <div class="selectors">
          <el-select
            v-model="selectedClassId"
            placeholder="Classe"
            @change="onClassChange"
            size="default"
            style="width: 180px"
          >
            <el-option
              v-for="classe in classes"
              :key="classe.id"
              :label="classe.name"
              :value="classe.id"
            />
          </el-select>

          <el-select
            v-model="selectedPeriod"
            placeholder="Période"
            @change="onPeriodChange"
            size="default"
            style="width: 160px"
            :disabled="!selectedClassId"
          >
            <el-option
              v-for="period in periods"
              :key="period"
              :label="period"
              :value="period"
            />
          </el-select>
        </div>
      </div>
      <el-button 
        type="primary"
        @click="saveAll"
        :loading="saving"
        :disabled="!hasChanges"
      >
        <el-icon><Check /></el-icon>
        Enregistrer
      </el-button>
      </div>

    <!-- Contenu principal -->
    <div v-if="selectedClassId && selectedPeriod" class="main-content">
      <el-row :gutter="16" class="content-row">
        <!-- Liste des élèves (sidebar) -->
        <el-col :span="5">
          <el-card class="students-card compact-card">
            <template #header>
              <div class="card-header">
                <span>Élèves ({{ sortedStudents.length }})</span>
                <div class="card-actions">
                  <el-input
                    v-model="studentSearch"
                    placeholder="Rechercher..."
                    size="small"
                    clearable
                    style="width: 120px; margin-right: 8px;"
                  >
                    <template #prefix><el-icon><Search /></el-icon></template>
                  </el-input>
                  <el-select
                    v-model="sortingOption"
                    placeholder="Trier par"
                    size="small"
                    style="width: 140px;"
                  >
                    <el-option label="Par défaut" value="default" />
                    <el-option label="Nom A-Z" value="lastname-asc" />
                    <el-option label="Nom Z-A" value="lastname-desc" />
                    <el-option label="Prénom A-Z" value="firstname-asc" />
                    <el-option label="Prénom Z-A" value="firstname-desc" />
                  </el-select>
                </div>
              </div>
            </template>
            <div class="students-list">
              <div
                v-for="student in sortedStudents"
                :key="student.id"
                class="student-item"
                :class="{ 'active': selectedStudentId === student.id }"
                @click="selectStudent(student)"
              >
                <div class="student-info">
                  <span class="student-name">{{ student.lastname }} {{ student.firstname }}</span>
                  <span class="student-mat">{{ student.id }}</span>
                </div>
                <el-icon v-if="studentHasGrades(student.id)" color="#67c23a"><Check /></el-icon>
              </div>
            </div>
          </el-card>
        </el-col>

        <!-- Tableau des notes -->
        <el-col :span="19">
          <div v-if="!selectedStudent" class="empty-state">
            <el-empty description="Sélectionnez un élève pour commencer" />
          </div>

          <el-card v-else class="grades-card compact-card" v-loading="loading">
            <template #header>
              <div class="card-header-grade">
                <div>
                  <strong>{{ sortedStudents.find(s => s.id === selectedStudentId.value)?.lastname }} {{ sortedStudents.find(s => s.id === selectedStudentId.value)?.firstname }}</strong>
                  <span class="student-class">{{ selectedClassName }}</span>
                </div>
                <el-tag v-if="configInfo" type="info" effect="plain">
                  Config: {{ configInfo.level }} - Base {{ configInfo.finalGradeBase }}
                </el-tag>
              </div>
            </template>

            <!-- Tableau scrollable -->
            <div class="grades-table-container">
              <table class="grades-table">
                <thead>
                  <tr>
                    <th class="subject-col">Matière</th>
                    <th 
                      v-for="category in categories" 
                      :key="category.id"
                      :class="['category-col', category.isExam ? 'exam-col' : 'class-col']"
                      :style="{ borderTopColor: category.color }"
                    >
                      <div class="category-header">
                        <el-icon v-if="category.isExam" color="#e74c3c" size="16"><Star /></el-icon>
                        <span class="category-code">{{ category.code }}</span>
                        <span class="category-name">{{ category.name }}</span>
                        <span class="category-info">/{{ category.defaultMaxScore }} ×{{ category.weight }}</span>
      </div>
                    </th>
                    <th class="class-avg-col">Moy. Classe</th>
                    <th class="average-col">Moyenne</th>
                    <th class="weighted-col">Moy. × Coeff</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="course in courses" :key="course.id" class="grade-row">
                    <td class="subject-cell">
                      <div class="subject-info">
                        <span class="subject-name">{{ course.name }}</span>
                        <span class="subject-coef">Coef. {{ course.coefficient }}</span>
      </div>
                    </td>
                    <td
                      v-for="category in categories"
                      :key="`${course.id}-${category.id}`"
                      class="grade-cell"
                    >
                      <el-input-number
                        v-model="gradesData[course.id!][category.id]"
                        :min="0"
                        :max="category.defaultMaxScore"
                        :precision="1"
                        :step="0.5"
                        size="small"
                        controls-position="right"
                        @input="onGradeChange(course.id!, category.id)"
                      />
                    </td>
                    <td class="class-avg-cell">
                      <span class="class-avg-value">
                        {{ calculateClassAverage(course.id!) }}
                      </span>
                    </td>
                    <td class="average-cell">
                      <el-tooltip content="Cliquez pour voir le détail du calcul">
                        <span 
                          class="average-value clickable" 
                          :class="getAverageClass(course.id!)"
                          @click="showCalculationDetail(course.id!)"
                        >
                          {{ calculateCourseAverage(course.id!) }}
                        </span>
                      </el-tooltip>
                    </td>
                    <td class="weighted-cell">
                      <span class="weighted-value">
                        {{ calculateWeightedAverage(course.id!, course.coefficient) }}
                      </span>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr class="summary-row">
                    <td colspan="100%">
                      <div class="summary-content">
                        <span class="summary-label">Moyenne Générale:</span>
                        <span class="summary-value">{{ generalAverage }}</span>
                        <span class="summary-base">/ {{ configInfo?.finalGradeBase || 20 }}</span>
                      </div>
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </el-card>
        </el-col>
      </el-row>
      </div>

    <div v-else class="initial-state">
      <el-empty description="Sélectionnez une classe et une période pour commencer">
        <el-icon size="80" color="#909399"><Reading /></el-icon>
      </el-empty>
    </div>
    <GradeCalculationDetail ref="calculationDetailRef" />
  </div>
</template>

<script setup lang="ts">
// @ts-ignore
// @ts-nocheck
import { ref, computed, onMounted, reactive, watchEffect } from 'vue';
import { Document, Check, Search, Reading, Star } from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';
import GradeCalculationDetail from '@/components/grade/GradeCalculationDetail.vue';

interface Student {
  id: number;
  firstname: string;
  lastname: string;
  gradeId: number;
}

interface Course {
  id: number;
  name: string;
  coefficient: number;
}

interface Category {
  id: number;
  name: string;
  code: string;
  weight: number;
  defaultMaxScore: number;
  color: string;
  isExam: boolean;
}

interface GradesDataStructure {
  [courseId: number]: {
    [categoryId: number]: number | null;
  };
}

// État
const loading = ref(false);
const saving = ref(false);
const refreshing = ref(false);
const hasChanges = ref(false);
let loadGeneration = 0;

const classes = ref<any[]>([]);
const students = ref<Student[]>([]);
const courses = ref<Course[]>([]);
const categories = ref<Category[]>([]);

const selectedClassId = ref<number | null>(null);
const selectedPeriod = ref<string | null>(null);
const selectedStudentId = ref<number | null>(null);
const selectedStudent = ref<Student | null>(null);
const studentSearch = ref('');
const sortingOption = ref<'default' | 'lastname-asc' | 'lastname-desc' | 'firstname-asc' | 'firstname-desc'>('default');

const periods = ref<string[]>([]);
const schoolId = ref(1);

const configInfo = ref<any>(null);
const gradesData = reactive<GradesDataStructure>({});
const calculatedAverages = ref<Map<number, number>>(new Map());
const calculationDetailRef = ref<InstanceType<typeof GradeCalculationDetail> | null>(null);

// Watch pour déboguer les changements dans gradesData
if (import.meta.env.DEV) {
  watchEffect(() => {
    console.log('🔄 gradesData mis à jour:', JSON.stringify(gradesData, null, 2));
  });
}

// Computed
const selectedClassName = computed(() => {
  return classes.value.find(c => c.id === selectedClassId.value)?.name || '';
});

// Élèves filtrés et triés
const sortedStudents = computed(() => {
  // 1. Filtrer par recherche
  let filtered = students.value;
  if (!studentSearch.value) {
    filtered = students.value;
  } else {
    const search = studentSearch.value.toLowerCase();
    filtered = students.value.filter(s =>
      s.firstname.toLowerCase().includes(search) ||
      s.lastname.toLowerCase().includes(search) ||
      s.id.toString().includes(search)
    );
  }

  // 2. Trier selon l'option
  switch (sortingOption.value) {
    case 'lastname-asc':
      filtered.sort((a, b) => a.lastname.localeCompare(b.lastname, 'fr'));
      break;
    case 'lastname-desc':
      filtered.sort((a, b) => b.lastname.localeCompare(a.lastname, 'fr'));
      break;
    case 'firstname-asc':
      filtered.sort((a, b) => a.firstname.localeCompare(b.firstname, 'fr'));
      break;
    case 'firstname-desc':
      filtered.sort((a, b) => b.firstname.localeCompare(a.firstname, 'fr'));
      break;
    case 'default':
    default:
      // Par défaut: par nom (desc), puis prénom
      filtered.sort((a, b) => {
        if (a.lastname !== b.lastname) {
          return a.lastname.localeCompare(b.lastname, 'fr');
        }
        return a.firstname.localeCompare(b.firstname, 'fr');
      });
      break;
  }

  return filtered;
});

const generalAverage = computed(() => {
  if (!selectedStudent.value || courses.value.length === 0) return '0.00';
  
  let totalWeighted = 0;
  let totalCoef = 0;

  for (const course of courses.value) {
    const avg = parseFloat(calculateCourseAverage(course.id!));
    if (!isNaN(avg) && avg > 0) {
      totalWeighted += avg * (course.coefficient || 1);
      totalCoef += course.coefficient || 1;
    }
  }

  const general = totalCoef > 0 ? totalWeighted / totalCoef : 0;
  return general.toFixed(2);
});

// Lifecycle
onMounted(async () => {
  await loadSchoolInfo();
  await loadClasses();
  await loadPeriods();
});

// Méthodes
const loadSchoolInfo = async () => {
  try {
    const result = await window.ipcRenderer.invoke('school:get');
    if (result?.success && result.data?.id) {
      schoolId.value = result.data.id;
    }
  } catch (error) {
    console.error('Erreur chargement école:', error);
  }
};

const loadClasses = async () => {
  try {
    const result = await window.ipcRenderer.invoke('grade:all');
    if (result.success) {
      classes.value = result.data || [];
    }
  } catch (error) {
    console.error('Erreur chargement classes:', error);
  }
};

const loadPeriods = async () => {
  try {
    // Récupérer l'année scolaire en cours
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

const onClassChange = async () => {
  selectedStudentId.value = null;
  selectedStudent.value = null;
  students.value = [];
  courses.value = [];
  categories.value = [];

  if (!selectedClassId.value) return;

  loading.value = true;
  try {
    // Charger les élèves
    const studentsRes = await window.ipcRenderer.invoke('student:getByGrade', selectedClassId.value);
    if (studentsRes.success) {
      students.value = studentsRes.data || [];
    }

    // Charger les matières
    const coursesRes = await window.ipcRenderer.invoke('course:getByGrade', selectedClassId.value);
    if (coursesRes.success) {
      courses.value = coursesRes.data || [];
    }

    // Charger la configuration
    await loadConfig();
  } catch (error) {
    console.error('Erreur chargement données:', error);
    ElMessage.error('Erreur lors du chargement des données');
  } finally {
    loading.value = false;
  }
};

const onPeriodChange = async () => {
  await loadConfig();
  if (selectedStudent.value) {
    await loadStudentGrades();
  }
};

const loadConfig = async () => {
  if (!selectedClassId.value) return;

  try {
    const configRes = await window.ipcRenderer.invoke('grade-config:get', {
      schoolId: schoolId.value,
      classId: selectedClassId.value,
      subjectId: null,
      period: selectedPeriod.value
    });

    if (configRes.success && configRes.data) {
      const config = configRes.data;
      categories.value = config.categories.map((cat: any) => ({
        id: cat.id,
        name: cat.name,
        code: cat.code,
        weight: cat.weight,
        defaultMaxScore: cat.defaultMaxScore,
        color: cat.color,
        isExam: cat.isExam || false
      }));

      configInfo.value = {
        level: config.contextLevel,
        finalGradeBase: config.finalGradeBase,
        strategy: config.calculationStrategy,
        normalize: config.normalizeScores
      };
    } else {
      ElMessage.warning('Aucune configuration de notation trouvée pour cette classe');
      categories.value = [];
    }
  } catch (error) {
    console.error('Erreur chargement config:', error);
  }
};

const selectStudent = async (student: Student) => {
  selectedStudentId.value = student.id;
  selectedStudent.value = student;
  await loadStudentGrades();
};

const loadStudentGrades = async () => {
  if (!selectedStudent.value || !selectedPeriod.value || courses.value.length === 0) return;

  const generation = ++loadGeneration;
  loading.value = true;
  try {
    console.log('=== CHARGEMENT DES NOTES ===');
    console.log('StudentId:', selectedStudent.value.id, 'Période:', selectedPeriod.value, 'Matières:', courses.value.length);

    // Vider le cache des moyennes précédentes
    calculatedAverages.value = new Map();

    console.log('Structure initiale de gradesData créée');

    // Charger les notes existantes pour chaque matière
    for (const course of courses.value) {
      if (generation !== loadGeneration) return;

      if (!gradesData[course.id!]) {
        gradesData[course.id!] = {};
      }

      // Remettre à null pour cette matière seulement, au moment du fetch
      for (const category of categories.value) {
        gradesData[course.id!][category.id] = null;
      }

      const gradesRes = await window.ipcRenderer.invoke('gradeEntry:get', {
        studentId: selectedStudent.value.id,
        courseId: course.id,
        period: selectedPeriod.value
      });

      if (generation !== loadGeneration) return;

      if (gradesRes.success && gradesRes.data && gradesRes.data.length > 0) {
        for (const entry of gradesRes.data) {
          gradesData[course.id!][entry.categoryId] = entry.score;
        }
        console.log(`✅ Notes chargées pour matière ${course.name} (ID: ${course.id}):`, gradesData[course.id!]);
      } else {
        console.log(`ℹ️ Aucune note trouvée pour matière ${course.name} (studentId: ${selectedStudent.value.id}, courseId: ${course.id}, period: ${selectedPeriod.value})`);
      }

      // Charger la moyenne calculée
      const avgRes = await window.ipcRenderer.invoke('gradeEntry:getCalculated', {
        studentId: selectedStudent.value.id,
        courseId: course.id,
        classId: selectedClassId.value,
        schoolId: schoolId.value,
        period: selectedPeriod.value
      });

      if (generation !== loadGeneration) return;

      if (avgRes.success && avgRes.data) {
        calculatedAverages.value.set(course.id!, avgRes.data.finalAverage);
      }
    }

    if (generation !== loadGeneration) return;

    console.log('=== CHARGEMENT TERMINÉ ===');
    console.log('Notes finales dans gradesData:', JSON.stringify(gradesData, null, 2));
    hasChanges.value = false;
  } catch (error) {
    if (generation !== loadGeneration) return;
    console.error('Erreur chargement notes:', error);
    ElMessage.error('Erreur lors du chargement des notes');
  } finally {
    loading.value = false;
  }
};

const onGradeChange = (courseId: number, categoryId: number) => {
  const newValue = gradesData[courseId]?.[categoryId];
  console.log(`✏️ Modification détectée - Cours ${courseId}, Catégorie ${categoryId}:`, newValue);
  hasChanges.value = true;
  // Recalculer la moyenne localement
  calculatedAverages.value.delete(courseId);
};

const calculateClassAverage = (courseId: number): string => {
  const courseGrades = gradesData[courseId];
  if (!courseGrades || !configInfo.value) return '-';

  const classCategories = categories.value.filter(c => !c.isExam);
  if (classCategories.length === 0) return '-';

  const classScores: number[] = [];

  for (const category of classCategories) {
    const grade = courseGrades[category.id];
    if (grade !== null && grade !== undefined && grade > 0) {
      let normalizedGrade = grade;
      if (configInfo.value.normalize) {
        normalizedGrade = (grade / category.defaultMaxScore) * configInfo.value.finalGradeBase;
      }
      classScores.push(normalizedGrade);
    }
  }

  if (classScores.length === 0) return '-';
  
  const classAverage = classScores.reduce((a, b) => a + b, 0) / classScores.length;
  return classAverage.toFixed(2);
};

const calculateCourseAverage = (courseId: number): string => {
  // Si on a une moyenne en cache, l'utiliser
  if (calculatedAverages.value.has(courseId)) {
    const cachedAvg = calculatedAverages.value.get(courseId);
    console.log(`📊 Utilisation du cache pour cours ${courseId}: ${cachedAvg}`);
    return cachedAvg?.toFixed(2);
  }

  // Sinon calculer localement (temporaire)
  const courseGrades = gradesData[courseId];
  console.log(`📊 Calcul local pour cours ${courseId}. Grades présents:`, courseGrades);
  if (!courseGrades || !configInfo.value) {
    console.log(`📊 Pas de grades ni de config pour cours ${courseId}`);
    return '0.00';
  }

  // Vérifier la stratégie de calcul
  if (configInfo.value.strategy === 'SIMPLE') {
    // Moyenne simple : toutes les notes comptent pareil
    let sum = 0;
    let count = 0;
    
    for (const category of categories.value) {
      const grade = courseGrades[category.id];
      if (grade !== null && grade !== undefined) {
        let normalizedGrade = grade;
        if (configInfo.value.normalize) {
          normalizedGrade = (grade / category.defaultMaxScore) * configInfo.value.finalGradeBase;
        }
        sum += normalizedGrade;
        count++;
      }
    }
    
    const avg = count > 0 ? sum / count : 0;
    return avg.toFixed(2);
    } else {
      // Moyenne pondérée : séparer notes de classe et examens
      const classCategories = categories.value.filter(c => !c.isExam);
      const examCategories = categories.value.filter(c => c.isExam);

      let totalWeighted = 0;
      let totalWeight = 0;

      console.log(`📊 Moyenne pondérée pour cours ${courseId}. Catégories: ${classCategories.length} classe, ${examCategories.length} examens`);

    // 1. Traiter les notes de classe (groupées)
    // Les notes de classe sont moyennées et comptent pour 1 coefficient total
    if (classCategories.length > 0) {
      const classScores: number[] = [];

      for (const category of classCategories) {
        const grade = courseGrades[category.id];
        if (grade !== null && grade !== undefined && grade > 0) {
          let normalizedGrade = grade;
          if (configInfo.value.normalize) {
            normalizedGrade = (grade / category.defaultMaxScore) * configInfo.value.finalGradeBase;
          }
          classScores.push(normalizedGrade);
        }
      }

      if (classScores.length > 0) {
        const classAverage = classScores.reduce((a, b) => a + b, 0) / classScores.length;
        // CORRECTION: Les notes de classe comptent pour 1 coefficient, pas la somme
        const classCoefficient = 1;
        totalWeighted += classAverage * classCoefficient;
        totalWeight += classCoefficient;
      }
    }

    // 2. Traiter les examens (individuellement)
    for (const category of examCategories) {
      const grade = courseGrades[category.id];
      if (grade !== null && grade !== undefined && grade > 0) {
        let normalizedGrade = grade;
        if (configInfo.value.normalize) {
          normalizedGrade = (grade / category.defaultMaxScore) * configInfo.value.finalGradeBase;
        }
        totalWeighted += normalizedGrade * category.weight;
        totalWeight += category.weight;
      }
    }

    const avg = totalWeight > 0 ? totalWeighted / totalWeight : 0;
    return avg.toFixed(2);
  }
};

const calculateWeightedAverage = (courseId: number, courseCoef: number): string => {
  const avg = parseFloat(calculateCourseAverage(courseId));
  if (isNaN(avg) || avg === 0) return '-';
  const weighted = avg * courseCoef;
  return weighted.toFixed(2);
};

const getAverageClass = (courseId: number): string => {
  const avg = parseFloat(calculateCourseAverage(courseId));
  const base = configInfo.value?.finalGradeBase || 20;
  const ratio = avg / base;

  if (ratio >= 0.8) return 'excellent';
  if (ratio >= 0.6) return 'good';
  if (ratio >= 0.5) return 'average';
  return 'poor';
};

const studentHasGrades = (_studentId: number): boolean => {
  // TODO: Implémenter la vérification
  return false;
};

const showCalculationDetail = (courseId: number) => {
  if (!configInfo.value || !calculationDetailRef.value) {
    console.error('❌ showCalculationDetail: configInfo ou calculationDetailRef non disponible');
    return;
  }

  const courseGrades = gradesData[courseId];
  console.log(`🔍 showCalculationDetail appelé pour cours ${courseId}`);
  console.log('Course grades:', courseGrades);

  if (!courseGrades) {
    console.error(`❌ showCalculationDetail: gradesData[${courseId}] non trouvé`);
    return;
  }

  const classCategories = categories.value.filter(c => !c.isExam);
  const examCategories = categories.value.filter(c => c.isExam);

  // Préparer les détails du calcul
  const categoryDetails = categories.value.map(category => {
    const grade = courseGrades[category.id];
    const grades: any[] = [];
    
    if (grade !== null && grade !== undefined) {
      let normalized = grade;
      if (configInfo.value.normalize) {
        normalized = (grade / category.defaultMaxScore) * configInfo.value.finalGradeBase;
      }
      grades.push({ score: grade, maxScore: category.defaultMaxScore, normalized });
    }

    const average = grades.length > 0 ? grades[0].normalized : 0;

    return {
      name: category.name,
      code: category.code,
      weight: category.weight,
      isExam: category.isExam,
      grades,
      average
    };
  });

  let totalWeighted = 0;
  let totalWeight = 0;
  let totalSum = 0;
  let totalCount = 0;

  if (configInfo.value.strategy === 'WEIGHTED') {
    // Notes de classe groupées
    const classScores: number[] = [];
    
    for (const cat of classCategories) {
      const grade = courseGrades[cat.id];
      if (grade !== null && grade !== undefined && grade > 0) {
        let normalized = grade;
        if (configInfo.value.normalize) {
          normalized = (grade / cat.defaultMaxScore) * configInfo.value.finalGradeBase;
        }
        classScores.push(normalized);
      }
    }

    if (classScores.length > 0) {
      const classAvg = classScores.reduce((a, b) => a + b, 0) / classScores.length;
      totalWeighted += classAvg * 1; // Coef 1 pour toutes les notes de classe
      totalWeight += 1;
    }

    // Examens individuels
    for (const cat of examCategories) {
      const grade = courseGrades[cat.id];
      if (grade !== null && grade !== undefined && grade > 0) {
        let norm = grade;
        if (configInfo.value.normalize) {
          norm = (grade / cat.defaultMaxScore) * configInfo.value.finalGradeBase;
        }
        totalWeighted += norm * cat.weight;
        totalWeight += cat.weight;
      }
    }
  } else {
    for (const cat of categoryDetails) {
      if (cat.grades.length > 0) {
        totalSum += cat.average;
        totalCount++;
      }
    }
  }

  const finalAverage = configInfo.value.strategy === 'WEIGHTED'
    ? (totalWeight > 0 ? totalWeighted / totalWeight : 0)
    : (totalCount > 0 ? totalSum / totalCount : 0);

  calculationDetailRef.value.show({
    strategy: configInfo.value.strategy,
    base: configInfo.value.finalGradeBase,
    normalized: configInfo.value.normalize,
    categories: categoryDetails,
    totalWeighted,
    totalWeight,
    totalSum,
    totalCount,
    finalAverage
  });

  console.log(`🔍 Détail de calcul final: stratégie=${configInfo.value.strategy}, finalAverage=${finalAverage}, totalWeighted=${totalWeighted}, totalWeight=${totalWeight}`);
};

const saveAll = async () => {
  if (!selectedStudent.value || !selectedPeriod.value || refreshing.value) return;

  refreshing.value = true;
  saving.value = true;
  let allSuccess = true;
  let savedAtLeastOne = false;
  try {
    console.log('=== DÉBUT SAUVEGARDE ===');
    console.log('Élève:', selectedStudent.value.id, selectedStudent.value.lastname);
    console.log('Période:', selectedPeriod.value);
    console.log('Catégories:', categories.value.map(c => ({ id: c.id, name: c.name, isExam: c.isExam })));

    // Afficher les notes actuellement dans gradesData avant sauvegarde
    console.log('État complet de gradesData avant sauvegarde:', JSON.stringify(gradesData, null, 2));

    // Sauvegarder les notes pour chaque matière
    for (const course of courses.value) {
      const courseGrades = gradesData[course.id!];
      const gradesToSave: any[] = [];

      console.log(`\n--- Matière: ${course.name} (ID: ${course.id}) ---`);
      console.log('Notes saisies:', courseGrades);

      for (const category of categories.value) {
        const score = courseGrades[category.id];
        console.log(`Catégorie ${category.name} (ID: ${category.id}):`, score);

        if (score !== null && score !== undefined && score >= 0) {
          gradesToSave.push({
            categoryId: category.id,
            score: score,
            maxScore: category.defaultMaxScore
          });
        }
      }

      console.log('Notes à sauvegarder:', gradesToSave);

      if (gradesToSave.length > 0) {
        const savePayload = {
          studentId: selectedStudent.value.id,
          courseId: course.id,
          period: selectedPeriod.value,
          grades: gradesToSave
        };
        
        console.log('Payload de sauvegarde:', JSON.stringify(savePayload, null, 2));
        
        const saveRes = await window.ipcRenderer.invoke('gradeEntry:bulkSave', savePayload);
        console.log('Résultat sauvegarde:', saveRes);

        if (!saveRes.success) {
          allSuccess = false;
          console.error(`❌ Échec sauvegarde pour matière ${course.name}:`, saveRes);
          continue;
        }

        savedAtLeastOne = true;

        // Recalculer et mettre en cache la moyenne
        const calcPayload = {
          studentId: selectedStudent.value.id,
          courseId: course.id,
          classId: selectedClassId.value,
          schoolId: schoolId.value,
          period: selectedPeriod.value
        };

        console.log('Payload de calcul de moyenne:', JSON.stringify(calcPayload, null, 2));
        console.log('Calcul de la moyenne pour matière:', course.name, 'ID:', course.id);

        try {
          const calcRes = await window.ipcRenderer.invoke('gradeEntry:calculate', calcPayload);
          console.log('Résultat du calcul de moyenne:', JSON.stringify(calcRes, null, 2));

          if (calcRes.success && calcRes.data) {
            console.log(`✅ Moyenne calculée: ${calcRes.data.finalAverage}`);
            calculatedAverages.value.set(course.id!, calcRes.data.finalAverage);
            console.log(`✅ Moyenne mise en cache pour cours ${course.id}: ${calcRes.data.finalAverage}`);
          } else {
            allSuccess = false;
            console.error(`❌ Échec du calcul de moyenne pour cours ${course.id}:`, calcRes);
          }
        } catch (error) {
          allSuccess = false;
          console.error(`❌ Erreur lors du calcul de moyenne pour cours ${course.id}:`, error);
        }
      } else {
        console.log('Aucune note à sauvegarder pour cette matière');
      }
    }

    if (allSuccess && savedAtLeastOne) {
      console.log('=== FIN SAUVEGARDE ===\n');
      ElMessage.success('Notes enregistrées avec succès');
      hasChanges.value = false;
      await loadStudentGrades();
    } else if (!savedAtLeastOne) {
      ElMessage.warning('Aucune note à enregistrer');
    } else {
      ElMessage.error('Erreur lors de la sauvegarde de certaines matières');
    }
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
    ElMessage.error('Erreur lors de la sauvegarde');
  } finally {
    saving.value = false;
    refreshing.value = false;
  }
};
</script>

<style scoped>
.report-card-view {
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: #f5f7fa;
  overflow: hidden;
}

/* Header */
.header-bar {
  background: white;
  padding: 12px 20px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.1);
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-left h2 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 8px;
}

.selectors {
  display: flex;
  gap: 12px;
}

/* Main content */
.main-content {
  flex: 1;
  padding: 16px;
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
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.compact-card :deep(.el-card__header) {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
  flex-shrink: 0;
}

.compact-card :deep(.el-card__body) {
  padding: 0;
  flex: 1;
  overflow: auto;
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.card-header span {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9rem;
}

.card-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.card-header-grade {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header-grade strong {
  font-size: 1rem;
  color: #2c3e50;
}

.student-class {
  margin-left: 12px;
  color: #909399;
  font-size: 0.85rem;
}

/* Students list */
.students-list {
  max-height: calc(100vh - 200px);
  overflow-y: auto;
}

.student-item {
  padding: 10px 16px;
  cursor: pointer;
  border-bottom: 1px solid #f0f2f5;
  transition: all 0.2s;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.student-item:hover {
  background: #f8f9fa;
}

.student-item.active {
  background: #e6f4ff;
  border-left: 3px solid #1890ff;
}

.student-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.student-name {
  font-weight: 500;
  color: #2c3e50;
  font-size: 0.9rem;
}

.student-mat {
  font-size: 0.75rem;
  color: #909399;
}

/* Grades table */
.grades-table-container {
  max-height: calc(100vh - 220px);
  overflow: auto;
  padding: 16px;
}

.grades-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.85rem;
}

.grades-table th {
  background: #f8f9fa;
  padding: 10px 8px;
  text-align: left;
  font-weight: 600;
  color: #2c3e50;
  border-bottom: 2px solid #e0e6ed;
  position: sticky;
  top: 0;
  z-index: 10;
}

.subject-col {
  width: 180px;
  min-width: 180px;
}

.category-col {
  width: 100px;
  text-align: center;
  border-top: 3px solid #3498db;
}

.class-col {
  background: #f8f9fa;
}

.exam-col {
  background: #fff5f5;
  border-top: 3px solid #e74c3c !important;
}

.class-avg-col {
  width: 100px;
  text-align: center;
  background: #e8f5e9;
  font-size: 0.8rem;
}

.average-col {
  width: 100px;
  text-align: center;
  background: #fef5e7;
}

.weighted-col {
  width: 110px;
  text-align: center;
  background: #e3f2fd;
  font-size: 0.8rem;
}

.category-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.category-code {
  font-weight: 700;
  font-size: 0.9rem;
}

.category-name {
  font-size: 0.75rem;
  color: #7f8c8d;
}

.category-info {
  font-size: 0.7rem;
  color: #95a5a6;
}

.grades-table td {
  padding: 8px;
  border-bottom: 1px solid #f0f2f5;
}

.grade-row:hover {
  background: #fafbfc;
}

.subject-cell {
  font-weight: 500;
}

.subject-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.subject-name {
  color: #2c3e50;
  font-size: 0.9rem;
}

.subject-coef {
  font-size: 0.75rem;
  color: #7f8c8d;
}

.grade-cell {
  text-align: center;
}

.grade-cell :deep(.el-input-number) {
  width: 80px;
}

.class-avg-cell {
  text-align: center;
  background: #f1f8f4;
  font-size: 0.85rem;
}

.class-avg-value {
  color: #2e7d32;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  background: #c8e6c9;
}

.average-cell {
  text-align: center;
  background: #fffbf0;
}

.weighted-cell {
  text-align: center;
  background: #e3f2fd;
  font-size: 0.85rem;
}

.weighted-value {
  color: #1565c0;
  font-weight: 600;
  padding: 4px 8px;
  border-radius: 4px;
  background: #bbdefb;
}

.average-value {
  font-weight: 700;
  font-size: 1rem;
  padding: 4px 8px;
  border-radius: 4px;
}

.average-value.excellent {
  background: #d1fae5;
  color: #047857;
}

.average-value.good {
  background: #dbeafe;
  color: #1d4ed8;
}

.average-value.average {
  background: #fef3c7;
  color: #b45309;
}

.average-value.poor {
  background: #fee2e2;
  color: #b91c1c;
}

.average-value.clickable {
  cursor: pointer;
  transition: transform 0.2s;
}

.average-value.clickable:hover {
  transform: scale(1.1);
}

/* Summary */
.summary-row {
  background: #f8f9fa;
}

.summary-content {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  justify-content: flex-end;
}

.summary-label {
  font-weight: 600;
  color: #2c3e50;
}

.summary-value {
  font-size: 1.5rem;
  font-weight: 700;
  color: #1890ff;
}

.summary-base {
  color: #909399;
}

/* Empty states */
.empty-state,
.initial-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: calc(100vh - 100px);
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
</style>
