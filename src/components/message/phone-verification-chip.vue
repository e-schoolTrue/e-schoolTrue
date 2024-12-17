<!-- src/views/components/PhoneVerificationChip.vue -->
<template>
    <div class="phone-verification-container">
      <span>{{ formattedPhone }}</span>
      <el-tag 
        :type="verificationStatus ? 'success' : 'danger'"
        size="small"
        @click="toggleVerification"
      >
        {{ verificationStatus ? 'Vérifié' : 'Non vérifié' }}
      </el-tag>
    </div>
  </template>
  
  <script setup lang="ts">
  import { ref, defineProps, defineEmits, computed } from 'vue'
  
  const props = defineProps({
    phone: {
      type: String,
      default: null
    }
  })
  
  const emit = defineEmits(['verification-status'])
  
  const verificationStatus = ref(false)
  
  const formattedPhone = computed(() => {
    if (!props.phone) return 'Aucun numéro'
    return props.phone.replace(/(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})/, '$1 $2 $3 $4 $5')
  })
  
  const toggleVerification = () => {
    if (props.phone) {
      verificationStatus.value = !verificationStatus.value
      emit('verification-status', verificationStatus.value)
    }
  }
  </script>
  
  <style scoped>
  .phone-verification-container {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  </style>