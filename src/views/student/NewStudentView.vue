<script setup lang="ts">
import { ref } from 'vue';
import StudentForm from '@/components/student/student-form.vue';
import FileUploader from '@/components/student/student-file.vue';
import { ElMessage } from 'element-plus';
import type { StudentData } from '@/types/student';

const classes = ref([
  { id: 1, name: 'CI' },
  { id: 2, name: 'CP' },
  { id: 3, name: 'CE1' },
  { id: 4, name: 'CE2' },
  { id: 5, name: 'CM1' },
  { id: 6, name: 'CM2' },
  { id: 7, name: '6ème' },
  { id: 8, name: '5ème' },
  { id: 9, name: '4ème' },
  { id: 10, name: '3ème' },
  { id: 11, name: '2nde' },
  { id: 12, name: '1ère' },
  { id: 13, name: 'Terminale' }
]);

const isLoading = ref(false);

// Fonction pour gérer les données du formulaire
const saveStudent = async (studentData: any) => {
  try {
    console.log("Données reçues de student-form:", studentData);
    
    // S'assurer que documents est un tableau
    if (studentData.documents && !Array.isArray(studentData.documents)) {
      studentData.documents = Object.values(studentData.documents);
    }
    
    console.log("Données de l'étudiant à enregistrer:", studentData);
    
    // Sérialiser puis désérialiser pour s'assurer que l'objet est clonable
    const serializedData = JSON.parse(JSON.stringify(studentData));
    
    const result = await window.ipcRenderer.invoke('save-student', serializedData);
    if (result.success) {
      ElMessage.success('Étudiant enregistré avec succès');
      // Réinitialiser le formulaire ou rediriger vers la liste des étudiants
    } else {
      let errorMessage = "Échec de l'enregistrement";
      if (result.message) {
        errorMessage = result.message;
      }
      ElMessage.error(errorMessage);
    }
  } catch (error) {
    console.error('Erreur lors de l\'enregistrement:', error);
    ElMessage.error('Une erreur s\'est produite lors de l\'enregistrement');
  }
};

// Fonction pour gérer les données importées
const handleFileLoaded = async (students: StudentData[]) => {
  isLoading.value = true;
  console.log('Données importées reçues:', students);
  
  try {
    for (const student of students) {
      try {
        // Préparation des données
        const preparedData = {
          ...student,
          birthDay: student.birthDay ? new Date(student.birthDay) : null,
          classId: student.classId ? Number(student.classId) : null
        };

        console.log('Tentative d\'enregistrement pour:', preparedData);
        const result = await window.ipcRenderer.invoke('save-student', preparedData);
        
        if (result.success) {
          ElMessage.success(`Étudiant ${student.firstname} ${student.lastname} enregistré avec succès`);
        } else {
          throw new Error(result.message || 'Échec de l\'enregistrement');
        }
      } catch (error) {
        console.error(`Erreur pour ${student.firstname} ${student.lastname}:`, error);
        ElMessage.error(`Erreur pour ${student.firstname} ${student.lastname}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
    }
  } finally {
    isLoading.value = false;
  }
};
</script>
<template>
  <el-card :shadow="'hover'" style="border-radius: 8px;">

    <!-- Conteneur principal pour la séparation horizontale -->
    <el-row :gutter="20" class="main-container">
      <!-- Section d'import de fichier -->
      <el-col :span="6" class="section-container">
        <FileUploader 
          @fileLoaded="handleFileLoaded"
          :disabled="isLoading"
        />
      </el-col>

      <!-- Séparateur vertical entre les sections -->
      <el-divider direction="vertical" class="divider" />

      <!-- Section du formulaire d'ajout manuel -->
      <el-col :span="16" class="section-container">
        <student-form :classes="classes" @save="saveStudent" />
      </el-col>
    </el-row>
  </el-card>
</template>

<style scoped>
.header-container {
  margin-bottom: 1.5rem;
  background-color: var(--background-color);
  padding: 1rem;
  border-radius: 8px;
}

.main-container {
  display: flex;
}

.section-container {
  background-color: #fff;
  padding: 1.5rem;
  border-radius: 8px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  flex: 1;
}

.section-container h3 {
  margin-bottom: 1rem;
  color: var(--text-color);
  font-weight: bold;
}

.title {
  font-size: 1.8rem;
  font-weight: 700;
  color: var(--primary-color);
}

.divider {
  height: 100%;
  border-color: var(--primary-color);
}
</style>
