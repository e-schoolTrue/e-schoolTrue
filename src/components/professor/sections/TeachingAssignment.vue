<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { SCHOOL_TYPE, type SchoolType } from '@/types/shared';

interface Teaching {
  schoolType: SchoolType | null;
  classId?: number;
  courseId?: number;
  gradeIds?: number[];
  teachingType?: string;
  selectedClasses?: number[];
  selectedCourse?: number;
  class?: {
    id: number;
    name: string;
  };
}

interface Grade {
  id: number;
  name: string;
  level?: number;
  description?: string;
}

interface Course {
  id: number;
  name: string;
  code?: string;
  coefficient?: number;
}

const props = withDefaults(defineProps<{
  modelValue: Teaching
}>(), {
  modelValue: () => ({
    schoolType: null,
    classId: undefined,
    courseId: undefined,
    gradeIds: undefined,
    selectedClasses: [],
    teachingType: 'CLASS_TEACHER'
  })
});

const emit = defineEmits<{
  'update:modelValue': [value: Teaching];
}>();

const grades = ref<Grade[]>([]);
const courses = ref<Course[]>([]);

const schoolType = computed({
  get: () => props.modelValue.schoolType,
  set: (value) => {
    const newValue = { 
      ...props.modelValue, 
      schoolType: value,
      classId: undefined,
      courseId: undefined,
      gradeIds: undefined,
      selectedClasses: [],
      selectedCourse: undefined,
      class: undefined
    };
    emit('update:modelValue', newValue);
    console.log("✅ Type d'école sélectionné :", newValue.schoolType);
  }
});

// Pour Primaire (sélection simple)
const selectedClass = computed({
  get: () => {
    console.log("🔍 [GET] selectedClass:", props.modelValue.classId);
    return props.modelValue.classId;
  },
  set: (value) => {
    console.log("📝 [SET] selectedClass:", value);
    const newValue = {
      ...props.modelValue,
      classId: value,
      gradeIds: value ? [value] : [],
      selectedClasses: value ? [value] : [],
      class: value ? { id: value, name: '' } : undefined,
      teachingType: 'CLASS_TEACHER' // Définir explicitement pour l'enseignement primaire
    };
    emit('update:modelValue', newValue);
    console.log("✅ Mise à jour après sélection (primaire):", newValue);
  }
});

// Pour Secondaire (multi-classes)
const selectedClasses = computed({
  get: () => {
    if (!Array.isArray(props.modelValue.selectedClasses) && props.modelValue.classId) {
      return [props.modelValue.classId];
    }
    return props.modelValue.selectedClasses || [];
  },
  set: (value) => {
    const classes = Array.isArray(value) ? value : [];
    const newValue = { 
      ...props.modelValue, 
      selectedClasses: classes,
      classId: classes.length > 0 ? classes[0] : undefined,
      gradeIds: classes,
      class: classes.length > 0 ? { id: classes[0], name: '' } : undefined
    };
    emit('update:modelValue', newValue);
    console.log("✅ Mise à jour des classes (secondaire):", newValue);
  }
});

const selectedCourse = computed({
  get: () => {
    return props.modelValue.selectedCourse != null ? Number(props.modelValue.selectedCourse) : props.modelValue.courseId != null ? Number(props.modelValue.courseId) : undefined;
  },
  set: (value) => {
    const newValue = { 
      ...props.modelValue, 
      selectedCourse: value,
      courseId: value,
      teachingType: value 
        ? (props.modelValue.schoolType === 'SECONDARY' ? 'SUBJECT_TEACHER' : 'CLASS_TEACHER')
        : 'CLASS_TEACHER'
    };
    emit('update:modelValue', newValue);
    console.log("✅ Cours sélectionné :", newValue);
  }
});

const loadGrades = async () => {
  try {
    const result = await window.ipcRenderer.invoke('grade:all');
    if (result?.success) {
      const raw = result.data;
      const arr = Array.isArray(raw) ? raw : (raw?.data ?? raw?.rows ?? []);
      grades.value = Array.isArray(arr) ? arr.map((g: any) => ({ ...g, id: Number(g.id) })) : [];
      console.log("📚 Classes chargées :", grades.value);
    } else {
      console.error("❌ Erreur lors du chargement des classes:", result?.error);
    }
  } catch (error) {
    console.error("❌ Exception lors du chargement des classes:", error);
  }
};

const loadCourses = async () => {
  try {
    const result = await window.ipcRenderer.invoke('course:all');
    if (result?.success) {
      const raw = result.data;
      const arr = Array.isArray(raw) ? raw : (raw?.data ?? raw?.rows ?? []);
      courses.value = Array.isArray(arr) ? arr.map((c: any) => ({ ...c, id: Number(c.id) })) : [];
      console.log("📘 Cours chargés :", courses.value);
    } else {
      console.error("❌ Erreur lors du chargement des cours:", result?.error);
    }
  } catch (error) {
    console.error("❌ Exception lors du chargement des cours:", error);
  }
};

onMounted(() => {
  loadGrades();
  loadCourses();
});
</script>

<template>
  <div class="teaching-assignment">
    <el-form-item label="Type d'école">
      <el-radio-group v-model="schoolType">
        <el-radio :label="SCHOOL_TYPE.PRIMARY">Primaire</el-radio>
        <el-radio :label="SCHOOL_TYPE.SECONDARY">Secondaire</el-radio>
      </el-radio-group>
    </el-form-item>

    <template v-if="schoolType === SCHOOL_TYPE.PRIMARY">
      <el-form-item label="Classe" required>
        <el-select
          v-model="selectedClass"
          placeholder="Sélectionnez une classe"
          clearable
        >
          <el-option
            v-for="grade in grades"
            :key="grade.id"
            :label="grade.name"
            :value="grade.id"
          />
        </el-select>
        <div v-if="!selectedClass" class="error-message">
          Veuillez sélectionner une classe pour l'enseignement primaire
        </div>
      </el-form-item>
    </template>

    <template v-if="schoolType === SCHOOL_TYPE.SECONDARY">
      <el-form-item label="Matière" required>
        <el-select
          v-model="selectedCourse"
          placeholder="Sélectionnez une matière"
          clearable
        >
          <el-option
            v-for="course in courses"
            :key="course.id"
            :label="`${course.name} (${(course as any).type ? String((course as any).type).charAt(0).toUpperCase() + String((course as any).type).slice(1).toLowerCase() : (schoolType ? String(schoolType).charAt(0).toUpperCase() + String(schoolType).slice(1).toLowerCase() : 'Matière')}${(course as any).coefficient ? ', ' + (course as any).coefficient : ''})`"
            :value="course.id"
          />
        </el-select>
        <div v-if="!selectedCourse" class="error-message">
          Veuillez sélectionner une matière pour l'enseignement secondaire
        </div>
      </el-form-item>

      <el-form-item label="Classes" required>
        <el-select
          v-model="selectedClasses"
          multiple
          placeholder="Sélectionnez les classes"
          clearable
        >
          <el-option
            v-for="grade in grades"
            :key="grade.id"
            :label="grade.name"
            :value="grade.id"
          />
        </el-select>
        <div v-if="selectedClasses.length === 0" class="error-message">
          Veuillez sélectionner au moins une classe pour l'enseignement secondaire
        </div>
      </el-form-item>
    </template>
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

.error-message {
  color: #f56c6c;
  font-size: 12px;
  margin-top: 5px;
}
</style>
