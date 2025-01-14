<template>
  <div class="card-template-one" :style="cardStyle">
    <!-- Face avant -->
    <div class="card-front">
      <div class="card-header">
        <div class="school-logo-container">
          <img v-if="schoolInfo?.logo?.url" :src="schoolInfo.logo.url" class="school-logo" alt="Logo" />
          <div v-else class="logo-placeholder">
            <Icon icon="mdi:school" />
          </div>
        </div>

        <div class="student-photo">
          <img v-if="student?.photo?.url && isValidDataUrl(student.photo.url)" 
               :src="student.photo.url" 
               alt="Photo" />
          <div v-else class="photo-placeholder">
            <Icon icon="mdi:account" />
          </div>
        </div>
      </div>

      <div class="card-body">
        <div class="student-info">
          <h3>{{ student?.firstname }} {{ student?.lastname }}</h3>
          <p class="matricule">{{ student?.matricule }}</p>
          <p class="class">Classe: {{ student?.grade?.name }}</p>
          <p class="year">Année: {{ currentYear }}</p>
        </div>
      </div>

      <div class="card-footer">
        <div class="qr-code" v-if="student?.matricule">
          <qrcode-vue :value="student.matricule" :size="50" level="H" />
        </div>
      </div>
    </div>

    <!-- Face arrière -->
    <div class="card-back">
      <div class="back-header">
        <h3>Informations personnelles</h3>
      </div>

      <div class="back-content">
        <table>
          <tbody>
            <tr>
              <td>Date de naissance:</td>
              <td>{{ formatDate(student?.birthDay) }}</td>
            </tr>
            <tr>
              <td>Lieu de naissance:</td>
              <td>{{ student?.birthPlace }}</td>
            </tr>
            <tr>
              <td>Contact parents:</td>
              <td>{{ student?.famillyPhone }}</td>
            </tr>
          </tbody>
        </table>

        <div class="emergency-contact">
          <h4>En cas d'urgence:</h4>
          <p>{{ schoolInfo?.phone }}</p>
        </div>
      </div>

      <div class="validity">
        <p>Valide jusqu'au: {{ formatDate(validUntil) }}</p>
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

const isValidDataUrl = (url: string) => {
  return url && url.startsWith('data:') && url.includes('base64,');
};
</script>

<style scoped>


.card-template-one {
  font-family: 'Poppins', sans-serif;
  width: 85.6mm;
  height: 54mm;
  position: relative;
  perspective: 1000px;
  background-color: var(--background-color);
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
}

/* Header styles */
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 1rem;
  background-color: var(--primary-color);
  color: white;
}

.school-logo-container {
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.school-logo {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.student-photo {
  width: 80px;
  height: 100px;
  border: 3px solid white;
  border-radius: 5px;
  overflow: hidden;
  background-color: #f5f5f5;
}

.student-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-placeholder, .logo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #eee;
  color: #999;
}

.photo-placeholder :deep(svg), .logo-placeholder :deep(svg) {
  font-size: 2rem;
}
.card-front, .card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  transition: transform 0.6s;
}

.card-front {
  display: grid;
  grid-template-rows: auto 1fr auto;
  padding: 10px;
}

.card-back {
  transform: rotateY(180deg);
  padding: 15px;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
  border-bottom: 2px solid var(--primary-color);
  padding-bottom: 8px;
}

.school-logo-container, .student-photo {
  display: flex;
  justify-content: center;
  align-items: center;
  overflow: hidden;
}

.school-logo, .student-photo img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.logo-placeholder, .photo-placeholder {
  display: flex;
  justify-content: center;
  align-items: center;
  background-color: #f5f5f5;
  width: 100%;
  height: 100%;
}

.school-info h2 {
  font-size: 14px;
  color: var(--primary-color);
  margin: 0;
}

.school-info p {
  font-size: 10px;
  color: var(--text-color);
  margin: 2px 0;
}

.card-body {
  display: flex;
  gap: 15px;
  padding: 10px 0;
}

.student-photo {
  width: 80px;
  height: 100px;
  border: 2px solid var(--primary-color);
  border-radius: 4px;
  overflow: hidden;
}

.student-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.photo-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: #f5f5f5;
  color: #ccc;
  font-size: 40px;
}

.student-info {
  flex: 1;
}

.student-info h3 {
  font-size: 16px;
  color: var(--text-color);
  margin: 0 0 5px 0;
}

.matricule {
  font-size: 14px;
  color: var(--primary-color);
  font-weight: 500;
  margin: 3px 0;
}

.class, .year {
  font-size: 12px;
  color: var(--text-color);
  margin: 2px 0;
}

.card-footer {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding-top: 5px;
  border-top: 1px solid var(--secondary-color);
}

/* Styles pour le dos de la carte */
.back-header {
  text-align: center;
  color: var(--primary-color);
  margin-bottom: 10px;
}

.back-header h3 {
  font-size: 14px;
  margin: 0;
}

.back-content table {
  width: 100%;
  font-size: 10px;
  border-collapse: collapse;
}

.back-content td {
  padding: 3px 0;
  color: var(--text-color);
}

.back-content td:first-child {
  font-weight: 500;
  width: 40%;
}

.emergency-contact {
  margin-top: 10px;
  padding: 5px;
  background-color: var(--secondary-color);
  border-radius: 4px;
}

.emergency-contact h4 {
  font-size: 11px;
  color: var(--primary-color);
  margin: 0 0 3px 0;
}

.emergency-contact p {
  font-size: 10px;
  color: var(--text-color);
  margin: 0;
}

.validity {
  position: absolute;
  bottom: 10px;
  right: 10px;
  font-size: 9px;
  color: var(--text-color);
}

/* Animation au survol */
.card-template-one:hover .card-front {
  transform: rotateY(180deg);
}

.card-template-one:hover .card-back {
  transform: rotateY(0deg);
}
</style> 


