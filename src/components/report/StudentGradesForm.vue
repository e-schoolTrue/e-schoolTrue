<template>
  <div class="grades-form">
    <!-- En-tête avec info étudiant -->
    <div class="student-info" v-if="student">
      <el-descriptions :column="3" border size="small">
        <el-descriptions-item label="Nom">{{ student.lastname }}</el-descriptions-item>
        <el-descriptions-item label="Prénom">{{ student.firstname }}</el-descriptions-item>
        <el-descriptions-item label="Classe">{{ student.grade?.name }}</el-descriptions-item>
      </el-descriptions>
    </div>

    <!-- Tableau des notes -->
    <el-table 
      :data="courseGrades" 
      style="width: 100%; margin-top: 20px;"
      :max-height="500"
      border
      stripe
    >
      <!-- Matière et coefficient -->
      <el-table-column prop="name" label="Matière" min-width="180">
        <template #default="{ row }">
          <div class="course-info">
            <span>{{ row.name }}</span>
            <el-tag size="small" type="info">Coef. {{ row.coefficient }}</el-tag>
          </div>
        </template>
      </el-table-column>

      <!-- Notes des devoirs -->
      <el-table-column label="Devoirs (/20)" min-width="250">
        <template #default="{ row }">
          <div class="assignments-container">
            <el-input-number
              v-for="(, index) in row.assignments"
              :key="index"
              v-model="row.assignments[index]"
              :min="0"
              :max="20"
              :step="0.25"
              :precision="2"
              size="small"
              :controls="false"
              class="grade-input"
              @change="calculateAverages"
            >
              <template #prefix>D{{ index + 1 }}</template>
            </el-input-number>
          </div>
        </template>
      </el-table-column>

      <!-- Moyenne des devoirs -->
      <el-table-column label="Moy. Devoirs" width="120" align="center">
        <template #default="{ row }">
          <span :class="getAverageClass(row.assignmentAverage)">
            {{ formatNumber(row.assignmentAverage) }}
          </span>
        </template>
      </el-table-column>

      <!-- Note d'examen -->
      <el-table-column label="Examen (/40)" width="150" align="center">
        <template #default="{ row }">
          <el-input-number
            v-model="row.exam"
            :min="0"
            :max="40"
            :step="0.25"
            :precision="2"
            size="small"
            :controls="false"
            class="grade-input"
            @change="calculateAverages"
          />
        </template>
      </el-table-column>

      <!-- Moyenne finale -->
      <el-table-column label="Moyenne" width="120" align="center">
        <template #default="{ row }">
          <strong :class="getAverageClass(row.finalAverage)">
            {{ formatNumber(row.finalAverage) }}
          </strong>
        </template>
      </el-table-column>

      <!-- Appréciation -->
      <el-table-column label="Appréciation" width="120" align="center">
        <template #default="{ row }">
          <el-tag :type="getAppreciationTag(row.finalAverage)">
            {{ getAppreciation(row.finalAverage) }}
          </el-tag>
        </template>
      </el-table-column>
    </el-table>

    <!-- Moyenne générale -->
    <div class="general-average" v-if="courseGrades.length > 0">
      <h3>
        Moyenne Générale: 
        <span :class="getAverageClass(generalAverage)">
          {{ formatNumber(generalAverage) }}/20
        </span>
      </h3>
    </div>

    <!-- Actions -->
    <div class="actions">
      <el-button type="primary" @click="saveGrades" :loading="saving">
        Enregistrer les notes
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  studentId: number;
  gradeId: number;
  period: string;
  numberOfAssignments: number;
}>();

const emit = defineEmits(['saved']);

const courses = ref<any[]>([]);
const student = ref<any>(null);
const courseGrades = ref<any[]>([]);
const saving = ref(false);
const generalAverage = ref(0);

// Plages d'appréciation fixes
const appreciationRanges = {
  excellent: { min: 16, max: 20 },
  veryGood: { min: 14, max: 15.99 },
  good: { min: 12, max: 13.99 },
  passable: { min: 10, max: 11.99 },
  poor: { min: 0, max: 9.99 }
};

const loadStudent = async () => {
  try {
    const result = await window.ipcRenderer.invoke('student:getById', props.studentId);
    if (result.success) {
      student.value = result.data;
    }
  } catch (error) {
    console.error('Erreur chargement étudiant:', error);
    ElMessage.error('Erreur lors du chargement des informations de l\'étudiant');
  }
};

const loadCourses = async () => {
  console.log('Chargement des cours et de la configuration');
  try {
    // Charger la configuration de la classe
    const configResult = await window.ipcRenderer.invoke('gradeConfig:get', {
      gradeId: props.gradeId
    });
    console.log('Configuration chargée:', configResult);

    // Charger les cours
    const result = await window.ipcRenderer.invoke('course:all');
    console.log('Résultat cours:', result);
    
    if (result.success) {
      courses.value = result.data;
      console.log('Cours chargés:', courses.value);
      
      // Utiliser le nombre de devoirs de la configuration
      const numberOfAssignments = configResult.success ? 
        configResult.data.numberOfAssignments : props.numberOfAssignments;

      // Initialiser les notes avec le bon nombre de devoirs
      courseGrades.value = courses.value.map(course => ({
        id: course.id,
        name: course.name,
        coefficient: course.coefficient,
        assignments: Array(numberOfAssignments).fill(0),
        exam: 0,
        assignmentAverage: 0,
        finalAverage: 0
      }));
      
      console.log('Notes initialisées avec', numberOfAssignments, 'devoirs:', courseGrades.value);
    }
  } catch (error) {
    console.error('Erreur chargement cours et config:', error);
    ElMessage.error('Erreur lors du chargement des cours');
  }
};

const calculateAverages = () => {
  let totalWeightedAverage = 0;
  let totalCoefficients = 0;

  courseGrades.value.forEach(course => {
    // Moyenne des devoirs
    const validAssignments = course.assignments
      .filter((n: number | null) => n !== null)
      .map((n: any) => Number(n) || 0);
      
    course.assignmentAverage = validAssignments.length 
      ? validAssignments.reduce((a: any, b: any) => a + b, 0) / validAssignments.length 
      : 0;

    // Moyenne finale (devoirs 40%, examen 60%)
    const examOn20 = (course.exam / 40) * 20;
    course.finalAverage = course.assignmentAverage * 0.4 + examOn20 * 0.6;

    // Pour la moyenne générale
    totalWeightedAverage += course.finalAverage * course.coefficient;
    totalCoefficients += course.coefficient;
  });

  // Calcul de la moyenne générale
  generalAverage.value = totalCoefficients ? totalWeightedAverage / totalCoefficients : 0;
};

const formatNumber = (num: number) => num.toFixed(2);

const getAverageClass = (average: number) => ({
  'text-success': average >= 14,
  'text-warning': average >= 10 && average < 14,
  'text-danger': average < 10
});

const getAppreciationTag = (average: number) => {
  if (average >= 16) return 'success';
  if (average >= 14) return '';
  if (average >= 12) return 'warning';
  if (average >= 10) return 'info';
  return 'danger';
};

const getAppreciation = (average: number) => {
  if (average >= appreciationRanges.excellent.min) return 'Excellent';
  if (average >= appreciationRanges.veryGood.min) return 'Très Bien';
  if (average >= appreciationRanges.good.min) return 'Bien';
  if (average >= appreciationRanges.passable.min) return 'Passable';
  return 'Insuffisant';
};

const saveGrades = async () => {
  saving.value = true;
  try {
    const gradesData = courseGrades.value.map(course => ({
      courseId: course.id,
      assignments: course.assignments.map((grade: number | null) => Number(grade) || 0),
      exam: Number(course.exam) || 0,
      average: Number(course.finalAverage.toFixed(2)),
      appreciation: getAppreciation(course.finalAverage)
    }));

    const payload = {
      studentId: props.studentId,
      gradeId: props.gradeId,
      period: props.period,
      grades: gradesData
    };

    console.log('Envoi des notes:', payload);
    const result = await window.ipcRenderer.invoke('grades:save', payload);

    if (result.success) {
      emit('saved');
      ElMessage.success('Notes enregistrées avec succès');
    } else {
      throw new Error(result.message || 'Erreur lors de la sauvegarde');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde des notes');
  } finally {
    saving.value = false;
  }
};

watch(() => props.numberOfAssignments, async (newValue) => {
  console.log('Nombre de devoirs mis à jour:', newValue);
  if (courseGrades.value.length > 0) {
    courseGrades.value = courseGrades.value.map(course => ({
      ...course,
      assignments: Array(newValue).fill(0)
    }));
  }
});

onMounted(() => {
  console.log('StudentGradesForm monté avec les props:', {
    studentId: props.studentId,
    gradeId: props.gradeId,
    period: props.period,
    numberOfAssignments: props.numberOfAssignments
  });

  if (!props.period) {
    ElMessage.warning('Aucune période sélectionnée');
    return;
  }

  loadStudent();
  loadCourses();
});
</script>

<style scoped>
.grades-form {
  padding: 20px;
}

.course-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.assignments-container {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.grade-input {
  width: 100px;
}

.general-average {
  margin-top: 20px;
  padding: 16px;
  background-color: var(--el-fill-color-light);
  border-radius: 8px;
  text-align: center;
}

.text-success { color: var(--el-color-success); }
.text-warning { color: var(--el-color-warning); }
.text-danger { color: var(--el-color-danger); }

.actions {
  margin-top: 20px;
  text-align: right;
}

:deep(.el-input-number) {
  width: 100px;
}

:deep(.el-table) {
  --el-table-border-color: var(--el-border-color-lighter);
}

:deep(.el-input-number__prefix) {
  color: var(--el-text-color-secondary);
}
</style> 