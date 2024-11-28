<template>
  <div>
    <h3>Informations Académiques</h3>
    <el-form-item label="Classe">
      <el-select v-model="formData.gradeId" placeholder="Sélectionnez une classe">
        <el-option
          v-for="classItem in safeClasses"
          :key="classItem?.id"
          :label="classItem?.name"
          :value="classItem?.id"
        />
      </el-select>
    </el-form-item>
    <el-form-item label="Année Scolaire">
      <el-input v-model="formData.schoolYear" placeholder="Année scolaire" />
    </el-form-item>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface ClassItem {
  id: number;
  name: string;
}

interface Props {
  formData: {
    gradeId: number | null; // Changé de classId à gradeId
    schoolYear: string;
  };
  classes: ClassItem[];
}

const props = withDefaults(defineProps<Props>(), {
  classes: () => [],
  formData: () => ({
    gradeId: null, // Changé de classId à gradeId
    schoolYear: ''
  })
});


const safeClasses = computed(() => {
  return Array.isArray(props.classes) ? props.classes : [];
});
</script>