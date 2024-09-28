<template>
    <el-card class="student-card">
      <el-row>
        <el-col :span="24" class="header-section">
          <h2 class="student-name">{{ student.firstname }} {{ student.lastname }}</h2>
        </el-col>
      </el-row>
  
      <el-row :gutter="20">
        <!-- Section Informations Personnelles -->
        <el-col :span="16">
          <el-row class="personal-info">
            <el-col :span="12">
                <h3>Informations Personnelle</h3>
              <p><el-icon class="icon"><icon-user /></el-icon><strong>Nom:</strong> {{ student.lastname }}</p>
              <p><el-icon class="icon"><icon-user /></el-icon><strong>Prénom:</strong> {{ student.firstname }}</p>
              <p><el-icon class="icon"><icon-calendar /></el-icon><strong>Date de naissance:</strong> {{ formatDate(student.birthDay) }}</p>
              <p><el-icon class="icon"><icon-location /></el-icon><strong>Ville de naissance:</strong> {{ student.birthPlace }}</p>
              <p><el-icon class="icon"><icon-house /></el-icon><strong>Adresse:</strong> {{ student.address }}</p>
              <p><el-icon class="icon"><icon-phone /></el-icon><strong>Téléphone personnel:</strong> {{ student.personalPhone }}</p>
            </el-col>
          </el-row>
        </el-col>
  
        <!-- Section Photo -->
        <el-col :span="8" class="photo-column">
          <el-image
            v-if="student.photo"
            :src="student.photo"
            fit="cover"
            class="student-photo"
          >
            <template #error>
              <div class="image-slot">
                <el-icon><icon-picture /></el-icon>
              </div>
            </template>
          </el-image>
          <el-empty v-else description="Pas de photo" :image-size="100"></el-empty>
        </el-col>
      </el-row>
  
      <el-row :gutter="20" class="parent-info">
        <!-- Section Informations des Parents -->
        <el-col :span="24">
          <h3>Informations des Parents</h3>
          <el-col :span="12">
            <p><el-icon class="icon"><icon-male /></el-icon><strong>Père:</strong> {{ student.fatherFirstname }} {{ student.fatherLastname }}</p>
            <p><el-icon class="icon"><icon-female /></el-icon><strong>Mère:</strong> {{ student.motherFirstname }} {{ student.motherLastname }}</p>
            <p><el-icon class="icon"><icon-phone /></el-icon><strong>Téléphone familial:</strong> {{ student.famillyPhone }}</p>
          </el-col>
        </el-col>
      </el-row>
    </el-card>
  </template>
  
  <script lang="ts" setup>
  import { defineProps } from 'vue';
  import { ElIcon } from 'element-plus';
  import { Picture as IconPicture, User as IconUser, Calendar as IconCalendar, Location as IconLocation, House as IconHouse, Phone as IconPhone, Male as IconMale, Female as IconFemale } from '@element-plus/icons-vue';
  
  // Définir les props pour recevoir les données de l'étudiant
  defineProps<{
    student: {
      birthDay: string;
      lastname: string;
      firstname: string;
      birthPlace: string;
      address: string;
      personalPhone: string;
      fatherFirstname: string;
      fatherLastname: string;
      motherFirstname: string;
      motherLastname: string;
      famillyPhone: string;
      photo?: string;
    }
  }>();
  
  // Fonction pour formater la date
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
  };
  </script>
  
  <style scoped>
  .student-card {
    background-color: #f9fafb;
    border-radius: 12px;
    box-shadow: 0 4px 14px rgba(0, 0, 0, 0.1);
    padding: 30px;
    max-width: 900px;
    margin: 0 auto; /* Centré */
  }
  
  .header-section {
    text-align: center;
    margin-bottom: 20px;
  }
  
  .student-name {
    font-family: 'Roboto', sans-serif;
    color: #333;
    font-size: 28px;
    font-weight: 700;
  }
  
  .personal-info p, .parent-info p {
    font-size: 16px;
    margin: 10px 0;
  }
  
  .parent-info {
    margin-top: 30px;
  }
  
  .el-icon {
    margin-right: 8px;
    color: #4a90e2; /* Bleu légèrement clair pour les icônes */
  }
  
  .student-photo {
    width: 180px;
    height: 180px;
    border-radius: 12px;
    box-shadow: 0 3px 10px rgba(0, 0, 0, 0.15);
  }
  
  .photo-column {
    display: flex;
    justify-content: center;
    align-items: center;
  }
  
  .image-slot {
    width: 180px;
    height: 180px;
    background-color: #eef2f7;
    border-radius: 12px;
    font-size: 24px;
    color: #a0a3a7;
  }
  
  h3 {
    color: #333;
    font-size: 20px;
    margin-bottom: 15px;
  }
  </style>
  