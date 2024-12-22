<template>
  <div class="card-template-three" :style="cardStyle">
    <!-- Face avant -->
    <div class="card-front">
      <div class="design-element"></div>
      
      <div class="main-content">
        <div class="header">
          <div class="school-brand">
            <img v-if="schoolInfo?.logo?.url" :src="schoolInfo.logo.url" class="school-logo" alt="Logo" />
            <h2>{{ schoolInfo?.name }}</h2>
          </div>
          <div class="academic-year">
            {{ currentYear }}
          </div>
        </div>

        <div class="student-section">
          <div class="photo-section">
            <div class="student-photo">
          <img v-if="student?.photo?.url && isValidDataUrl(student.photo.url)" 
               :src="student.photo.url" 
               alt="Photo" />
          <div v-else class="photo-placeholder">
            <Icon icon="mdi:account" />
          </div>
        </div>
            <div class="qr-container" v-if="student?.matricule">
              <qrcode-vue :value="student.matricule" :size="35" level="H" />
            </div>
          </div>

          <div class="identity-section">
            <div class="student-name">
              <span class="label">NOM ET PRÉNOM</span>
              <h3>{{ student?.firstname }} {{ student?.lastname }}</h3>
            </div>
            <div class="student-details">
              <div class="detail-item">
                <span class="label">MATRICULE</span>
                <span class="value">{{ student?.matricule }}</span>
              </div>
              <div class="detail-item">
                <span class="label">CLASSE</span>
                <span class="value">{{ student?.grade?.name }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Face arrière -->
    <div class="card-back">
      <div class="back-pattern"></div>
      
      <div class="back-content">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Date de naissance</span>
            <span class="info-value">{{ formatDate(student?.birthDay) }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Lieu de naissance</span>
            <span class="info-value">{{ student?.birthPlace }}</span>
          </div>
          <div class="info-item">
            <span class="info-label">Contact</span>
            <span class="info-value">{{ student?.famillyPhone }}</span>
          </div>
        </div>

        <div class="school-contact">
          <Icon icon="mdi:map-marker" />
          <span>{{ schoolInfo?.address }}</span>
          <Icon icon="mdi:phone" />
          <span>{{ schoolInfo?.phone }}</span>
        </div>

        <div class="card-validity">
          <div class="validity-badge">
            <span>VALIDE JUSQU'AU</span>
            <strong>{{ formatDate(validUntil) }}</strong>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import QrcodeVue from 'qrcode.vue';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  student: any;
  schoolInfo: any;
  colorScheme: {
    primary: string;
    secondary: string;
    text: string;
    background: string;
  };
}>();

const cardStyle = computed(() => ({
  '--primary-color': props.colorScheme.primary,
  '--secondary-color': props.colorScheme.secondary,
  '--text-color': props.colorScheme.text,
  '--background-color': props.colorScheme.background,
}));

const isValidDataUrl = (url: string) => {
  return url && url.startsWith('data:') && url.includes('base64,');
};

const currentYear = computed(() => {
  const now = new Date();
  return `${now.getFullYear()}-${now.getFullYear() + 1}`;
});

const validUntil = computed(() => {
  const date = new Date();
  date.setFullYear(date.getFullYear() + 1);
  return date;
});

const formatDate = (date: string | Date | undefined) => {
  if (!date) return '';
  return new Date(date).toLocaleDateString('fr-FR');
};
</script>

<style scoped>
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap');

.card-template-three {
  font-family: 'Inter', sans-serif;
  width: 85.6mm;
  height: 54mm;
  position: relative;
  perspective: 1000px;
  background-color: var(--background-color);
  border-radius: 15px;
  overflow: hidden;
  box-shadow: 0 10px 20px rgba(0, 0, 0, 0.12);
}

.card-front, .card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

.design-element {
  position: absolute;
  top: -50%;
  right: -20%;
  width: 200px;
  height: 200px;
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  border-radius: 50%;
  opacity: 0.1;
}

.main-content {
  position: relative;
  z-index: 1;
  padding: 12px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.school-brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.school-logo {
  width: 30px;
  height: 30px;
  object-fit: contain;
}

.school-brand h2 {
  font-size: 12px;
  font-weight: 700;
  color: var(--primary-color);
  margin: 0;
}

.academic-year {
  font-size: 10px;
  color: var(--text-color);
  opacity: 0.8;
}

.student-section {
  display: flex;
  gap: 15px;
}

.photo-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.student-photo {
  width: 65px;
  height: 85px;
  border: 2px solid var(--primary-color);
  border-radius: 10px;
  overflow: hidden;
}

.identity-section {
  flex: 1;
}

.student-name {
  margin-bottom: 10px;
}

.label {
  font-size: 8px;
  color: var(--text-color);
  opacity: 0.6;
  letter-spacing: 0.5px;
}

.student-name h3 {
  margin: 2px 0;
  font-size: 14px;
  color: var(--primary-color);
  font-weight: 600;
}

.student-details {
  display: grid;
  gap: 8px;
}

.detail-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.value {
  font-size: 12px;
  color: var(--text-color);
}

/* Styles pour le dos de la carte */
.card-back {
  transform: rotateY(180deg);
  background-color: var(--background-color);
}

.back-pattern {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  opacity: 0.05;
  background-image: repeating-linear-gradient(
    45deg,
    var(--primary-color) 0,
    var(--primary-color) 1px,
    transparent 0,
    transparent 50%
  );
  background-size: 10px 10px;
}

.back-content {
  position: relative;
  padding: 15px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.info-grid {
  display: grid;
  gap: 12px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.info-label {
  font-size: 9px;
  color: var(--primary-color);
  font-weight: 600;
}

.info-value {
  font-size: 11px;
  color: var(--text-color);
}

.school-contact {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 9px;
  color: var(--text-color);
  justify-content: center;
  flex-wrap: wrap;
}

.validity-badge {
  background-color: var(--primary-color);
  color: white;
  padding: 5px 10px;
  border-radius: 15px;
  font-size: 8px;
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  position: absolute;
  bottom: 10px;
  right: 10px;
}

.validity-badge strong {
  font-size: 10px;
}

/* Animation au survol */
.card-template-three:hover .card-front {
  transform: rotateY(180deg);
}

.card-template-three:hover .card-back {
  transform: rotateY(0);
}
</style> 