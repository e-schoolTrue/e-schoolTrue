<!-- src/views/components/PhoneVerificationList.vue -->
<template>
    <el-table 
      :data="phoneVerificationData" 
      @selection-change="handleSelectionChange"
    >
      <el-table-column type="selection" width="55" />
      
      <el-table-column label="Étudiant">
        <template #default="scope">
          {{ scope.row.firstname }} {{ scope.row.lastname }}
        </template>
      </el-table-column>
  
      <el-table-column label="Téléphone Familial">
        <template #default="scope">
          <phone-verification-chip 
            :phone="scope.row.famillyPhone"
            @verification-status="updatePhoneStatus(scope.row, 'family', $event)"
          />
        </template>
      </el-table-column>
  
      <el-table-column label="Téléphone Personnel">
        <template #default="scope">
          <phone-verification-chip 
            :phone="scope.row.personalPhone"
            @verification-status="updatePhoneStatus(scope.row, 'personal', $event)"
          />
        </template>
      </el-table-column>
    </el-table>
  </template>
  
  <script setup lang="ts">
  import { ref, computed, defineProps, defineEmits } from 'vue'
  import PhoneVerificationChip from './phone-verification-chip.vue'
  
  const props = defineProps({
    selectedStudents: {
      type: Array,
      required: true
    }
  })
  
  const emit = defineEmits(['phone-verification-complete'])
  
  const phoneVerificationData = computed(() => props.selectedStudents)
  const verifiedPhones = ref<string[]>([])
  
  const updatePhoneStatus = (student: { famillyPhone: any; personalPhone: any; }, type: string, status: any) => {
    const phone = type === 'family' 
      ? student.famillyPhone 
      : student.personalPhone
  
    if (status) {
      verifiedPhones.value.push(phone)
    } else {
      verifiedPhones.value = verifiedPhones.value.filter(p => p !== phone)
    }
  
    emit('phone-verification-complete', verifiedPhones.value)
  }
  
  const handleSelectionChange = (_selection: any) => {
    // Logique supplémentaire si nécessaire
  }
  </script>