<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { SCHOOL_TYPE } from "#electron/command";
import { ElMessage } from 'element-plus';
import type { GradeEntity } from '#electron/backend/entities/grade';

interface Course {
  id: number;
  name: string;
}

interface Props {
  schoolType: SCHOOL_TYPE | null;
  selectedClasses: number[];
  selectedCourse: number | null;
}

const props = defineProps<Props>();
const emit = defineEmits([
  'update:schoolType',
  'update:selectedClasses',
  'update:selectedCourse'
]);

const schoolType = computed({
  get: () => props.schoolType,
  set: (value) => emit('update:schoolType', value)
});

const selectedClasses = computed({
  get: () => props.selectedClasses,
  set: (value) => emit('update:selectedClasses', value)
});

const selectedCourse = computed({
  get: () => props.selectedCourse,
  set: (value) => emit('update:selectedCourse', value)
});

const loading = ref(false);
const classes = ref<GradeEntity[]>([]);
const courses = ref<Course[]>([]);

// Charger les classes et les matières
const loadData = async () => {
  loading.value = true;
  try {
    // Charger les classes
    const classesResult = await window.ipcRenderer.invoke('grade:all');
    if (classesResult.success) {
      classes.value = classesResult.data;
    }

    // Charger les matières
    const coursesResult = await window.ipcRenderer.invoke('course:all');
    if (coursesResult.success) {
      courses.value = coursesResult.data;
    }
  } catch (error) {
    console.error('Erreur lors du chargement des données:', error);
    ElMessage.error('Erreur lors du chargement des données');
  } finally {
    loading.value = false;
  }
};

const handleSchoolTypeChange = () => {
  selectedClasses.value = [];
  selectedCourse.value = null;
};


onMounted(loadData);
</script>

<template>
  <div class="teaching-assignment">
    <el-form label-position="top">
      <el-form-item label="Type d'école">
        <el-radio-group v-model="schoolType" @change="handleSchoolTypeChange">
          <el-radio :label="SCHOOL_TYPE.PRIMARY">École Primaire</el-radio>
          <el-radio :label="SCHOOL_TYPE.SECONDARY">Collège/Lycée</el-radio>
        </el-radio-group>
      </el-form-item>

      <template v-if="schoolType === SCHOOL_TYPE.PRIMARY">
        <el-form-item label="Classe d'enseignement">
          <el-select 
            v-model="selectedClasses[0]"
            placeholder="Sélectionnez une classe"
          >
            <el-option
              v-for="classe in classes"
              :key="classe.id"
              :label="classe.name"
              :value="classe.id"
            />
          </el-select>
        </el-form-item>
      </template>

      <template v-if="schoolType === SCHOOL_TYPE.SECONDARY">
        <el-form-item label="Matière enseignée">
          <el-select
            v-model="selectedCourse"
            placeholder="Sélectionnez une matière"
          >
            <el-option
              v-for="course in courses"
              :key="course.id"
              :label="course.name"
              :value="course.id"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="Classes">
          <el-select
            v-model="selectedClasses"
            multiple
            placeholder="Sélectionnez les classes"
          >
            <el-option
              v-for="classe in classes"
              :key="classe.id"
              :label="classe.name"
              :value="classe.id"
            />
          </el-select>
        </el-form-item>
      </template>
    </el-form>
  </div>
</template>

<style scoped>
.teaching-assignment {
  max-width: 600px;
  margin: 0 auto;
  padding: 20px;
}

:deep(.el-select) {
  width: 100%;
}

.el-radio-group {
  margin-bottom: 20px;
}
</style> 