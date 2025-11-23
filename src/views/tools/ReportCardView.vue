<template>
  <div class="report-card-container">
    <!-- Titre principal -->
    <div class="main-title">
      <h2>Bulletins des notes</h2>
      </div>

    <!-- Section de sélection des élèves -->
    <div class="selection-section">
      <el-row :gutter="20">
        <el-col :span="12">
          <el-radio-group v-model="studentScope" @change="onStudentScopeChange">
            <el-radio value="all">Afficher tous les élèves de l'établissement</el-radio>
            <el-radio value="class">Afficher les élèves d'une classe</el-radio>
          </el-radio-group>
        </el-col>
      </el-row>

      <el-row :gutter="20" class="selection-tables">
        <!-- Tableau des classes -->
        <el-col :span="12">
          <div class="table-section">
            <h4>Code classe</h4>
            <el-table 
              :data="grades" 
              height="120" 
              @row-click="selectGrade"
              :row-class-name="getGradeRowClassName"
            >
              <el-table-column prop="code" label="Code classe" width="80" />
              <el-table-column prop="name" label="Nom classe" />
            </el-table>
      </div>
        </el-col>

        <!-- Tableau des élèves -->
        <el-col :span="12">
          <div class="table-section">
            <h4>Élèves</h4>
            <el-table 
              :data="filteredStudents" 
              height="120" 
              @row-click="selectStudent"
              :row-class-name="getStudentRowClassName"
            >
              <el-table-column prop="id" label="Matricule" width="100" />
              <el-table-column prop="lastname" label="Nom" />
              <el-table-column prop="firstname" label="Prénom" />
              <el-table-column prop="grade.name" label="Classe" />
            </el-table>
            <div class="legend-link">
              <el-link type="primary">Légende des couleurs</el-link>
      </div>
      </div>
        </el-col>
      </el-row>
      </div>

  

 

    <div v-if="loading" class="loading-container">
      <el-icon class="is-loading" size="24">
        <Loading />
      </el-icon>
      <p>Chargement en cours...</p>
        </div>
    <!-- Tableau principal des notes -->
    <div v-if="selectedStudent" class="main-grade-table">
      <!-- Debug info -->
      <div v-if="courses.length === 0" class="debug-info" style="padding: 10px; background: #fff3cd; border: 1px solid #ffeaa7; margin-bottom: 10px; border-radius: 4px;">
        <p><strong>Debug:</strong> Aucun cours trouvé. Nombre de cours: {{ courses.length }}</p>
        <p><strong>Élève sélectionné:</strong> {{ selectedStudent?.firstname }} {{ selectedStudent?.lastname }}</p>
        <p><strong>Classe ID:</strong> {{ selectedStudent?.gradeId }}</p>
      </div>
      
      <el-table :data="courses" border style="width: 100%" max-height="400">
        <el-table-column label="Matière" width="150">
          <template #default="{ row }">
            <div class="subject-cell">
              <span class="subject-icon">#</span>
              <span class="subject-name">{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column label="SEQ 1" width="80">
          <template #default="{ row }">
            <EditableCell 
              v-model="selectedStudentGrades[row.id!].seq1"
              :is-modified="selectedStudentGrades[row.id!].isModified"
              type="number"
              @update:modelValue="markAsModified(selectedStudentGrades[row.id!])"
            />
          </template>
        </el-table-column>
        
        <el-table-column label="SEQ 2" width="80">
          <template #default="{ row }">
            <EditableCell 
              v-model="selectedStudentGrades[row.id!].seq2"
              :is-modified="selectedStudentGrades[row.id!].isModified"
              type="number"
              @update:modelValue="markAsModified(selectedStudentGrades[row.id!])"
            />
          </template>
        </el-table-column>
        
        <el-table-column label="Moy." width="80">
          <template #default="{ row }">
            <span class="calculated-average">{{ calculateCourseAverage(row.id!) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="Coef." width="60">
          <template #default="{ row }">
            <span class="coefficient-value">{{ row.coefficient }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="Moy. Finale" width="80">
          <template #default="{ row }">
            <span class="final-average">{{ calculateFinalAverage(row.id!) }}</span>
          </template>
        </el-table-column>
        
        <el-table-column label="Observations" width="150">
          <template #default="{ row }">
            <EditableCell 
              v-model="selectedStudentGrades[row.id!].observation"
              :is-modified="selectedStudentGrades[row.id!].isModified"
              type="text"
              @update:modelValue="markAsModified(selectedStudentGrades[row.id!])"
            />
          </template>
        </el-table-column>
      </el-table>
      
      <!-- Ligne de somme -->
      <el-table :data="[{ isSum: true }]" border style="width: 100%; margin-top: 0;">
        <el-table-column label="Somme" width="150">
          <template #default>
            <strong>Somme</strong>
          </template>
        </el-table-column>
        <el-table-column width="120">
          <template #default>
            <span class="sum-value">{{ totalAverage }}</span>
          </template>
        </el-table-column>
        <el-table-column width="80">
          <template #default>
            <span class="sum-value">{{ totalAverage }}</span>
          </template>
        </el-table-column>
        <el-table-column width="80">
          <template #default>
            <span class="sum-value">{{ totalAverage }}</span>
          </template>
        </el-table-column>
        <el-table-column width="60">
          <template #default>
            <span class="sum-value">{{ totalCoefficient }}</span>
          </template>
        </el-table-column>
        <el-table-column width="80">
          <template #default>
            <span class="sum-value">{{ totalFinalAverage }}</span>
          </template>
        </el-table-column>
        <el-table-column width="150">
          <template #default>
            <!-- Cellule vide -->
          </template>
        </el-table-column>
      </el-table>
    </div>

    <!-- Section mention/sanction -->
    <div v-if="selectedStudent" class="mention-section">
      <el-row :gutter="20" align="middle">
        <el-col :span="4">
          <el-form-item label="Mention/Sanction">
            <el-input v-model="mention" placeholder="Saisir mention ou sanction">
              <template #suffix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
          </el-form-item>
        </el-col>
        <el-col :span="4">
          <el-button type="warning" @click="autoMentions">
            <el-icon><Lightning /></el-icon>
            Mentions auto
          </el-button>
        </el-col>
        <el-col :span="4">
          <el-button type="success" class="encouragement-btn">
            Encouragement
          </el-button>
        </el-col>
        <el-col :span="4">
          <el-button type="info" @click="autoObservations">
            <el-icon><Lightning /></el-icon>
            Observations auto
          </el-button>
        </el-col>
        <el-col :span="8">
          <el-button type="primary" @click="printReportCards" class="print-btn">
            <el-icon><Printer /></el-icon>
            Imprimer [Ctrl+P]
          </el-button>
        </el-col>
      </el-row>
    </div>
    <div v-else class="empty-state">
      <el-empty description="Veuillez sélectionner une période et une classe, puis cliquez sur 'Charger'." />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import type { YearRepartitionEntity } from '#electron/backend/entities/yearRepartition';
import type { GradeEntity } from '#electron/backend/entities/grade';
import type { StudentEntity } from '#electron/backend/entities/students';
import type { CourseEntity } from '#electron/backend/entities/course';
import EditableCell from '@/components/grade/EditableCell.vue';
import { Loading, Search, Printer, Lightning } from '@element-plus/icons-vue';

const periods = ref<any[]>([]);
const grades = ref<GradeEntity[]>([]);
const selectedPeriod = ref<string | null>(null);
const selectedGrade = ref<number | null>(null);
const courses = ref<CourseEntity[]>([]);
const loading = ref(false);
const isModified = ref(false);
const selectedStudentId = ref<number | null>(null);
const filteredStudents = ref<StudentEntity[]>([]);
const studentScope = ref('all');
const selectedStudent = ref<StudentEntity | null>(null);
const selectedStudentGrades = ref<{ [courseId: number]: { seq1: number | null, seq2: number | null, observation: string, isModified: boolean } }>({});
const mention = ref('');

onMounted(async () => {
  try {
    const periodsResponse = await window.ipcRenderer.invoke('yearRepartition:getAll');
    if (periodsResponse.success) {
      periods.value = periodsResponse.data.flatMap((year: YearRepartitionEntity) => year.periodConfigurations.map((p: any) => ({...p, id: `${year.id}-${p.name}`})));
    }

    const gradesResponse = await window.ipcRenderer.invoke('grade:all');
    if (gradesResponse.success) {
      grades.value = gradesResponse.data;
    }
  } catch (error) {
    console.error('Error fetching initial data:', error);
  }
});


const markAsModified = (item: { isModified: boolean; }) => {
  item.isModified = true;
  isModified.value = true;
};

const selectStudent = async (student: StudentEntity) => {
  selectedStudentId.value = student.id!;
  selectedStudent.value = student;
  await loadCoursesForStudent();
  initializeStudentGrades();
};

const selectGrade = async (grade: GradeEntity) => {
  selectedGrade.value = grade.id!;
  await loadStudentsForGrade();
  // Charger les cours pour cette classe
  await loadCoursesForGrade(grade.id!);
};

const onStudentScopeChange = () => {
  if (studentScope.value === 'all') {
    loadAllStudents();
  } else {
    selectedGrade.value = null;
    filteredStudents.value = [];
  }
};

const initializeStudentGrades = () => {
  if (!selectedStudent.value) return;
  
  selectedStudentGrades.value = {};
  courses.value.forEach((course: CourseEntity) => {
    selectedStudentGrades.value[course.id!] = {
      seq1: null,
      seq2: null,
      observation: '',
      isModified: false
    };
  });
};

const loadStudentsForGrade = async () => {
  if (!selectedGrade.value) return;
  
  try {
    const studentsResponse = await window.ipcRenderer.invoke('student:getByGrade', selectedGrade.value);
    if (studentsResponse.success) {
      filteredStudents.value = studentsResponse.data;
    }
  } catch (error) {
    console.error('Error loading students:', error);
  }
};

const loadAllStudents = async () => {
  try {
    const studentsResponse = await window.ipcRenderer.invoke('student:all');
    if (studentsResponse.success) {
      filteredStudents.value = studentsResponse.data;
    }
  } catch (error) {
    console.error('Error loading all students:', error);
  }
};

const loadCoursesForStudent = async () => {
  if (!selectedStudent.value) return;
  
  try {
    // Charger les cours pour la classe de l'élève sélectionné
    const coursesResponse = await window.ipcRenderer.invoke('course:getByGrade', selectedStudent.value.gradeId);
    if (coursesResponse.success) {
      courses.value = coursesResponse.data;
    } else {
      // Fallback: charger tous les cours si pas de cours spécifiques à la classe
      const allCoursesResponse = await window.ipcRenderer.invoke('course:all');
      if (allCoursesResponse.success) {
        courses.value = allCoursesResponse.data;
      }
    }
  } catch (error) {
    console.error('Error loading courses:', error);
    // En cas d'erreur, essayer de charger tous les cours
    try {
      const allCoursesResponse = await window.ipcRenderer.invoke('course:all');
      if (allCoursesResponse.success) {
        courses.value = allCoursesResponse.data;
      }
    } catch (fallbackError) {
      console.error('Error loading all courses:', fallbackError);
    }
  }
};

const loadCoursesForGrade = async (gradeId: number) => {
  try {
    const coursesResponse = await window.ipcRenderer.invoke('course:getByGrade', gradeId);
    if (coursesResponse.success) {
      courses.value = coursesResponse.data;
    } else {
      // Fallback: charger tous les cours si pas de cours spécifiques à la classe
      const allCoursesResponse = await window.ipcRenderer.invoke('course:all');
      if (allCoursesResponse.success) {
        courses.value = allCoursesResponse.data;
      }
    }
  } catch (error) {
    console.error('Error loading courses for grade:', error);
    // En cas d'erreur, essayer de charger tous les cours
    try {
      const allCoursesResponse = await window.ipcRenderer.invoke('course:all');
      if (allCoursesResponse.success) {
        courses.value = allCoursesResponse.data;
      }
    } catch (fallbackError) {
      console.error('Error loading all courses:', fallbackError);
    }
  }
};

const getGradeRowClassName = ({ row }: { row: GradeEntity }) => {
  return selectedGrade.value === row.id ? 'selected-row' : '';
};

const getStudentRowClassName = ({ row }: { row: StudentEntity }) => {
  return selectedStudentId.value === row.id ? 'selected-row' : '';
};

const calculateCourseAverage = (courseId: number) => {
  const grades = selectedStudentGrades.value[courseId];
  if (!grades || (grades.seq1 === null && grades.seq2 === null)) return '0,00';
  
  const seq1 = grades.seq1 || 0;
  const seq2 = grades.seq2 || 0;
  const average = (seq1 + seq2) / 2;
  return average.toFixed(2).replace('.', ',');
};

const calculateFinalAverage = (courseId: number) => {
  const course = courses.value.find((c: CourseEntity) => c.id === courseId);
  if (!course || !course.coefficient) return '0,00';
  
  const average = parseFloat(calculateCourseAverage(courseId).replace(',', '.'));
  const final = average * course.coefficient;
  return final.toFixed(2).replace('.', ',');
};

const totalAverage = computed(() => {
  const total = courses.value.reduce((sum: number, course: CourseEntity) => {
    const average = parseFloat(calculateCourseAverage(course.id!).replace(',', '.'));
    return sum + average;
  }, 0);
  return (total / courses.value.length).toFixed(2).replace('.', ',');
});

const totalCoefficient = computed(() => {
  return courses.value.reduce((sum: number, course: CourseEntity) => sum + (course.coefficient || 0), 0).toFixed(2).replace('.', ',');
});

const totalFinalAverage = computed(() => {
  const total = courses.value.reduce((sum: number, course: CourseEntity) => {
    const final = parseFloat(calculateFinalAverage(course.id!).replace(',', '.'));
    return sum + final;
  }, 0);
  return total.toFixed(2).replace('.', ',');
});


const autoMentions = () => {
  // Logique pour les mentions automatiques
  console.log('Auto mentions');
};

const autoObservations = () => {
  // Logique pour les observations automatiques
  console.log('Auto observations');
};


const printReportCards = async () => {
  if (!selectedStudent.value) {
    alert('Veuillez sélectionner un élève.');
    return;
  }

  try {
    await window.ipcRenderer.invoke('report:generateMultiple', {
      studentIds: [selectedStudent.value.id!],
      period: selectedPeriod.value || 'Trimestre 1',
    });
    alert('Impression lancée avec succès!');
  } catch (error) {
    console.error('Error printing report cards:', error);
    alert('Erreur lors de l\'impression des bulletins.');
  }
};
</script>

<style scoped>
.report-card-container {
  padding: 10px;
  background-color: #f5f5f5;
  min-height: 100vh;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.main-title {
  text-align: center;
  margin-bottom: 10px;
}

.main-title h2 {
  margin: 0;
  color: #333;
  font-size: 20px;
  font-weight: 600;
}

.selection-section {
  background: white;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 10px;
}

.selection-tables {
  margin-top: 8px;
}

.table-section {
  background: #fafafa;
  padding: 8px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.table-section h4 {
  margin: 0 0 5px 0;
  color: #333;
  font-size: 12px;
  font-weight: 600;
}

.legend-link {
  margin-top: 10px;
  text-align: right;
}


.main-grade-table {
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  margin-bottom: 20px;
  overflow: hidden;
}

.subject-cell {
  display: flex;
  align-items: center;
  padding: 8px;
}

.subject-icon {
  color: #ff4444;
  font-weight: bold;
  margin-right: 8px;
  font-size: 16px;
}

.subject-name {
  font-weight: 500;
  color: #333;
}

.calculated-average,
.coefficient-value,
.final-average {
  text-align: center;
  font-weight: 500;
  color: #333;
}

.sum-value {
  text-align: center;
  font-weight: 600;
  color: #333;
}


.mention-section {
  background: white;
  padding: 10px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.encouragement-btn {
  background-color: #ffc107 !important;
  border-color: #ffc107 !important;
  color: #000 !important;
  font-weight: 600;
  padding: 12px 24px;
}

.print-btn {
  background-color: #007bff !important;
  border-color: #007bff !important;
  color: white !important;
  font-weight: 600;
  padding: 12px 24px;
}

.selected-row {
  background-color: #e3f2fd !important;
}

:deep(.el-table .selected-row td) {
  background-color: #e3f2fd !important;
}


.loading-container {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  min-height: 200px;
  gap: 16px;
}

.loading-container p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.is-loading {
  animation: rotating 2s linear infinite;
}

@keyframes rotating {
  0% {
    transform: rotate(0deg);
  }
  100% {
    transform: rotate(360deg);
  }
}


.empty-state {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 300px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

:deep(.el-table) {
  font-size: 12px;
}

:deep(.el-table th) {
  background-color: #fafafa;
  font-weight: 600;
}

:deep(.el-table td) {
  padding: 6px 0;
}

:deep(.el-form-item__label) {
  font-weight: 600;
  color: #333;
}

:deep(.el-button) {
  font-weight: 500;
}



/* Styles pour connecter visuellement les tableaux */
:deep(.el-table) {
  border-collapse: separate;
  border-spacing: 0;
}

:deep(.el-table + .el-table) {
  margin-top: 0;
  border-top: none;
}

:deep(.el-table + .el-table .el-table__header) {
  border-top: none;
}

:deep(.el-table + .el-table .el-table__body tr:first-child td) {
  border-top: none;
}
</style>
