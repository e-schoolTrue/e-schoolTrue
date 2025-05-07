<template>
  <div class="card-template-base" :style="cardStyles">
    <div class="card-content">
      <slot></slot>
    </div>
    <div class="card-back">
      <slot name="back"></slot>
    </div>
    <div class="card-footer">
      <p class="school-year">{{ student?.schoolYear || currentSchoolYear }}</p>
      <p class="validity">Valide jusqu'au {{ formatDate(validUntil) }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

interface GradeInfo {
  id?: number;
  name: string;
}

interface Student {
  id?: number;
  firstname?: string;
  lastname?: string;
  matricule?: string;
  schoolYear?: string;
  grade?: GradeInfo;
  photoUrl?: string;
}

interface SchoolInfo {
  id?: number;
  name?: string;
  address?: string;
  logo?: {
    url?: string;
  };
}

interface Props {
  student: Student;
  schoolInfo: SchoolInfo;
  logoUrl?: string;
  width?: string | number;
  height?: string | number;
  backgroundColor?: string;
}

const props = withDefaults(defineProps<Props>(), {
  width: '85.6mm',  // Format CR80 standard
  height: '54mm',
  backgroundColor: '#ffffff'
});

// Calcul de l'année scolaire actuelle
const currentSchoolYear = computed(() => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  
  // Si on est après juillet, on prend l'année suivante
  const startYear = month >= 7 ? year : year - 1;
  const endYear = startYear + 1;
  
  return `${startYear}-${endYear}`;
});

const validUntil = computed(() => {
  const currentYear = new Date().getFullYear();
  // Date de fin fixée au 31 juillet de l'année suivante
  return new Date(currentYear + 1, 6, 31);
});

const formatDate = (date: Date) => {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  }).format(date);
};

// Styles calculés pour la carte
const cardStyles = computed(() => ({
  width: typeof props.width === 'number' ? `${props.width}px` : props.width,
  height: typeof props.height === 'number' ? `${props.height}px` : props.height,
  backgroundColor: props.backgroundColor
}));

// Exposer certaines méthodes pour les composants parents
defineExpose({
  formatDate,
  currentSchoolYear
});
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
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.card-content {
  flex: 1;
  padding: 12px;
  backface-visibility: hidden;
  position: relative;
  transform-style: preserve-3d;
}

/* Style spécifique pour le verso */
.card-back {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  transform: rotateY(180deg);
  background-color: var(--background-color);
  display: flex;
  flex-direction: column;
}

.card-footer {
  background: linear-gradient(to right, #2c3e50, #3498db);
  color: white;
  padding: 8px 12px;
  font-size: 0.75rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  position: relative;
  z-index: 1;
}

.school-year, .validity {
  margin: 0;
  font-weight: 500;
}

/* État retourné */
.is-flipped .card-content {
  transform: rotateY(-180deg);
}

.is-flipped .card-back {
  transform: rotateY(0);
}

@media print {
  .card-template-base {
    box-shadow: none;
    border: 1px solid #ddd;
    break-inside: avoid;
    page-break-inside: avoid;
    transform-style: flat;
    page-break-after: always;
  }
  
  .card-front, .card-back {
    position: relative;
    transform: none !important;
    backface-visibility: visible !important;
  }

  .card-back {
    break-before: page;
    page-break-before: always;
    margin-top: 20px;
  }

  .is-flipped .card-front,
  .is-flipped .card-back {
    transform: none !important;
  }
}
</style>
