<!-- src/components/message/student-selector.vue -->
<template>
    <el-select 
      v-model="localSelectedStudents" 
      multiple 
      placeholder="Sélectionner les étudiants"
      @change="emitSelection"
    >
      <el-option 
        v-for="student in students" 
        :key="student.id"
        :label="`${student.firstname} ${student.lastname}`"
        :value="student"
      >
        <span>{{ student.firstname }} {{ student.lastname }}</span>
        <span class="student-detail">{{ student.matricule }}</span>
      </el-option>
    </el-select>
  
    <div class="selection-actions mt-2">
      <el-checkbox 
        v-model="selectAllChecked"
        @change="toggleSelectAll"
      >
        Tout sélectionner
      </el-checkbox>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, defineProps, defineEmits } from 'vue'
  
  // Définition précise du type Student
  interface Student {
    id: number
    firstname?: string
    lastname?: string
    matricule?: string
  }
  
  const props = defineProps({
    students: {
      type: Array as () => Student[],
      required: true
    }
  })
  
  const emit = defineEmits(['selection-changed'])
  
  const localSelectedStudents = ref<Student[]>([])
  const selectAllChecked = ref(false)
  
  const toggleSelectAll = () => {
    localSelectedStudents.value = selectAllChecked.value 
      ? [...props.students] 
      : []
    emitSelection()
  }
  
  const emitSelection = () => {
    emit('selection-changed', localSelectedStudents.value)
  }
  </script>
  
  <style scoped>
  .student-detail {
    float: right;
    color: #999;
    font-size: 0.8em;
  }
  </style>