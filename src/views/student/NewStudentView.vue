<script setup lang="ts">
import { ref } from 'vue';
import StudentForm from '@/components/student/student-form.vue';
import FileUploader from '@/components/student/FileUploader.vue';
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
        errorMessage = result.message; // Utiliser le message tel quel, sans décodage
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
  <el-card>
    <div class="header-container">
      <el-row align="middle" justify="space-between">
        <el-col :span="12">
          <el-text size="large" class="title">Ajouter un nouvel élève</el-text>
        </el-col>
      </el-row>
    </div>

    <!-- Section d'import de fichier -->
    <div class="section-container">
      <h3>Import par fichier</h3>
      <FileUploader 
        @fileLoaded="handleFileLoaded"
        :disabled="isLoading"
      />
    </div>

    <!-- Séparateur -->
    <el-divider />

    <!-- Section du formulaire -->
    <div class="section-container">
      <h3>Ajout manuel</h3>
      <student-form :classes="classes" @save="saveStudent" />
    </div>
  </el-card>
</template>

<style scoped>
.header-container {
  margin-bottom: 2rem;
}

.section-container {
  margin: 1rem 0;
}

.section-container h3 {
  margin-bottom: 1rem;
  color: var(--el-text-color-primary);
}

.el-divider {
  margin: 2rem 0;
}
</style>