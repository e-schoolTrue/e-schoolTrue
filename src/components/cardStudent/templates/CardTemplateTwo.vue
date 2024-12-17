<template>
  <div class="card-template-two" :style="cardStyle">
    <!-- Face avant -->
    <div class="card-front">
      <div class="card-header">
        <div class="banner">
          <div class="school-info">
            <h2>{{ schoolInfo?.name }}</h2>
            <p class="school-type">{{ schoolInfo?.type }}</p>
          </div>
          <div class="logo-container">
            <img v-if="schoolInfo?.logo" :src="schoolInfo.logo" class="school-logo" alt="Logo" />
          </div>
        </div>
      </div>

      <div class="card-content">
        <div class="student-photo-container">
          <div class="student-photo">
            <img v-if="student?.photo" :src="student.photo" alt="Photo" />
            <div v-else class="photo-placeholder">
              <Icon icon="mdi:account" />
            </div>
          </div>
        </div>

        <div class="student-details">
          <div class="student-name">
            <h3>{{ student?.firstname }}</h3>
            <h3>{{ student?.lastname }}</h3>
          </div>
          <div class="student-info">
            <p class="matricule">
              <Icon icon="mdi:identifier" />
              {{ student?.matricule }}
            </p>
            <p class="class">
              <Icon icon="mdi:school" />
              {{ student?.grade?.name }}
            </p>
            <p class="year">
              <Icon icon="mdi:calendar" />
              {{ currentYear }}
            </p>
          </div>
        </div>
      </div>

      <div class="card-footer">
        <div class="qr-code" v-if="student?.matricule">
          <qrcode-vue :value="student.matricule" :size="40" level="H" />
        </div>
        <div class="signature">
          <p>Le Directeur</p>
        </div>
      </div>
    </div>

    <!-- Face arrière -->
    <div class="card-back">
      <div class="back-content">
        <div class="rules-section">
          <h4>Règlement</h4>
          <ul>
            <li>Cette carte est strictement personnelle</li>
            <li>Elle doit être présentée à l'entrée de l'établissement</li>
            <li>En cas de perte, informer l'administration</li>
          </ul>
        </div>

        <div class="personal-info">
          <div class="info-row">
            <span class="label">Né(e) le:</span>
            <span class="value">{{ formatDate(student?.birthDay) }}</span>
          </div>
          <div class="info-row">
            <span class="label">À:</span>
            <span class="value">{{ student?.birthPlace }}</span>
          </div>
          <div class="info-row">
            <span class="label">Contact:</span>
            <span class="value">{{ student?.famillyPhone }}</span>
          </div>
        </div>

        <div class="contact-info">
          <p>{{ schoolInfo?.address }}</p>
          <p>Tel: {{ schoolInfo?.phone }}</p>
          <p>{{ schoolInfo?.email }}</p>
        </div>

        <div class="validity-info">
          <p>Valide jusqu'au: {{ formatDate(validUntil) }}</p>
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
@import url('https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700&display=swap');

.card-template-two {
  font-family: 'Montserrat', sans-serif;
  width: 85.6mm;
  height: 54mm;
  position: relative;
  perspective: 1000px;
  background-color: var(--background-color);
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 8px 16px rgba(0, 0, 0, 0.1);
}

.card-front, .card-back {
  position: absolute;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  transition: transform 0.8s cubic-bezier(0.4, 0, 0.2, 1);
}

.banner {
  background: linear-gradient(135deg, var(--primary-color), var(--secondary-color));
  padding: 10px;
  color: white;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.school-info h2 {
  font-size: 14px;
  margin: 0;
  font-weight: 700;
  text-transform: uppercase;
}

.school-type {
  font-size: 10px;
  opacity: 0.9;
  margin: 2px 0;
}

.logo-container {
  width: 40px;
  height: 40px;
  background: white;
  border-radius: 50%;
  padding: 3px;
}

.school-logo {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.card-content {
  padding: 15px;
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 15px;
}

.student-photo {
  width: 70px;
  height: 90px;
  border: 3px solid var(--primary-color);
  border-radius: 8px;
  overflow: hidden;
}

.student-name h3 {
  margin: 0;
  font-size: 16px;
  color: var(--primary-color);
  text-transform: uppercase;
}

.student-info {
  margin-top: 10px;
}

.student-info p {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 5px 0;
  font-size: 12px;
  color: var(--text-color);
}

.card-footer {
  position: absolute;
  bottom: 0;
  width: 100%;
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  padding: 10px;
  background: linear-gradient(to top, rgba(0,0,0,0.05), transparent);
}

.signature {
  font-size: 10px;
  font-style: italic;
  color: var(--text-color);
}

/* Styles pour le dos de la carte */
.card-back {
  transform: rotateY(180deg);
  background-color: var(--background-color);
}

.back-content {
  padding: 15px;
  height: 100%;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.rules-section {
  background-color: rgba(0,0,0,0.03);
  padding: 10px;
  border-radius: 8px;
}

.rules-section h4 {
  color: var(--primary-color);
  margin: 0 0 5px 0;
  font-size: 12px;
}

.rules-section ul {
  margin: 0;
  padding-left: 15px;
  font-size: 9px;
  color: var(--text-color);
}

.personal-info {
  margin: 10px 0;
}

.info-row {
  display: flex;
  font-size: 10px;
  margin: 3px 0;
}

.label {
  width: 60px;
  color: var(--primary-color);
  font-weight: 600;
}

.value {
  color: var(--text-color);
}

.contact-info {
  font-size: 9px;
  text-align: center;
  color: var(--text-color);
}

.contact-info p {
  margin: 2px 0;
}

.validity-info {
  text-align: right;
  font-size: 8px;
  color: var(--text-color);
  font-style: italic;
}

/* Animation au survol */
.card-template-two:hover .card-front {
  transform: rotateY(180deg);
}

.card-template-two:hover .card-back {
  transform: rotateY(0);
}
</style> 