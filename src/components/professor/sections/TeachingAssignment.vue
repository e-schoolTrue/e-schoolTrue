<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue';
import { SCHOOL_TYPE } from "#electron/command";

const props = withDefaults(defineProps<{
  modelValue: {
    schoolType: SCHOOL_TYPE | null;
    selectedClasses: number[];
    selectedCourse: number | null;
  }
}>(), {
  modelValue: () => ({
    schoolType: null,
    selectedClasses: [],
    selectedCourse: null
  })
});

const emit = defineEmits<{
  'update:modelValue': [value: typeof props.modelValue];
}>();

const grades = ref<any[]>([]);
const courses = ref<any[]>([]);

const schoolType = computed({
  get: () => props.modelValue.schoolType,
  set: (value) => emit('update:modelValue', { 
    ...props.modelValue, 
    schoolType: value,
    selectedClasses: [],
    selectedCourse: null
  })
});

const selectedClasses = computed({
  get: () => props.modelValue.selectedClasses,
  set: (value) => emit('update:modelValue', { 
    ...props.modelValue, 
    selectedClasses: value 
  })
});

const selectedCourse = computed({
  get: () => props.modelValue.selectedCourse,
  set: (value) => emit('update:modelValue', { 
    ...props.modelValue, 
    selectedCourse: value 
  })
});

const loadGrades = async () => {
  const result = await window.ipcRenderer.invoke('grade:all');
  if (result.success) {
    grades.value = result.data;
  }
};

const loadCourses = async () => {
  const result = await window.ipcRenderer.invoke('course:all');
  if (result.success) {
    courses.value = result.data;
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
      <el-form-item label="Classe">
        <el-select
          v-model="selectedClasses[0]"
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
      </el-form-item>
    </template>

    <template v-if="schoolType === SCHOOL_TYPE.SECONDARY">
      <el-form-item label="Matière">
        <el-select
          v-model="selectedCourse"
          placeholder="Sélectionnez une matière"
          clearable
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
          clearable
        >
          <el-option
            v-for="grade in grades"
            :key="grade.id"
            :label="grade.name"
            :value="grade.id"
          />
        </el-select>
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
</style> 