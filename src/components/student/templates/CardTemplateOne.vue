<template>
  <card-template-base :student="student" :school-info="schoolInfo" :logo-url="logoUrl">
    <div class="template-one">
      <div class="header">
        <img v-if="logoUrl" :src="logoUrl" class="school-logo" alt="Logo">
        <div class="school-info">
          <h2>{{ schoolInfo?.name }}</h2>
          <p>{{ schoolInfo?.address }}</p>
        </div>
      </div>
      
      <div class="student-info">
        <div class="photo-container">
          <img 
            v-if="student?.photo" 
            :src="student.photoUrl" 
            class="student-photo" 
            alt="Photo"
          >
        </div>
        <div class="details">
          <h3>{{ student?.firstname }} {{ student?.lastname }}</h3>
          <p>Classe: {{ student?.grade?.name }}</p>
          <p>Matricule: {{ student?.matricule }}</p>
        </div>
      </div>
    </div>
  </card-template-base>
</template>

<script setup lang="ts">
import CardTemplateBase from './CardTemplateBase.vue';

defineProps<{
  student: any;
  schoolInfo: any;
  logoUrl: string;
}>();
</script>

<style scoped>
.template-one {
  padding: 10px;
  height: 100%;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.school-logo {
  width: 40px;
  height: 40px;
  object-fit: contain;
}

.school-info {
  flex: 1;
}

.school-info h2 {
  font-size: 14px;
  margin: 0;
}

.school-info p {
  font-size: 10px;
  margin: 2px 0;
}

.student-info {
  display: flex;
  gap: 10px;
  flex: 1;
}

.photo-container {
  width: 80px;
  height: 100px;
  border: 1px solid #ddd;
  overflow: hidden;
}

.student-photo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.details {
  flex: 1;
}

.details h3 {
  font-size: 12px;
  margin: 0 0 5px 0;
}

.details p {
  font-size: 10px;
  margin: 3px 0;
}
</style>