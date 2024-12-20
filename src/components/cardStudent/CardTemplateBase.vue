<template>
  <div class="card-template-base">
    <div class="card-content">
      <slot></slot>
    </div>
    <div class="card-footer">
      <p class="school-year">{{ student?.schoolYear }}</p>
      <p class="validity">Valide jusqu'au {{ formatDate(validUntil) }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface Student {
  firstname?: string;
  lastname?: string;
  matricule?: string;
  schoolYear?: string;
  grade?: {
    name: string;
  };
  photoUrl?: string;
}

interface SchoolInfo {
  name?: string;
  address?: string;
}

defineProps<{
  student: Student;
  schoolInfo: SchoolInfo;
  logoUrl?: string;
}>();

const validUntil = computed(() => {
  const currentYear = new Date().getFullYear();
  return new Date(currentYear + 1, 6, 31); // July 31st of next year
});

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
};
</script>

<style scoped>
.card-template-base {
  width: 85.6mm; /* ID-1 format width */
  height: 53.98mm; /* ID-1 format height */
  background: white;
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-direction: column;
  position: relative;
}

.card-content {
  flex: 1;
  padding: 12px;
}

.card-footer {
  background: linear-gradient(to right, #2c3e50, #3498db);
  color: white;
  padding: 8px 12px;
  font-size: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.school-year, .validity {
  margin: 0;
  font-weight: 500;
}

@media print {
  .card-template-base {
    box-shadow: none;
    border: 1px solid #ddd;
  }
}
</style>
