<script setup lang="ts">
import { ref, onMounted } from 'vue';
import StudentForm from '@/components/student/student-form.vue';
import FileUploader from '@/components/student/student-file.vue';
import { ElMessage } from 'element-plus';
import type { IStudentData } from '@/types/student';
import type { StudentFormInstance } from '@/components/student/student-form.vue';

const isLoading = ref(false);
const classes = ref([]);
const formRef = ref<StudentFormInstance | null>(null);
const currentSchoolYear = ref('');

const fetchClasses = async () => {
  try {
    const result = await window.ipcRenderer.invoke('grade:all');
    if (result.success) {
      classes.value = result.data;
    } else {
      throw new Error(result.message || 'Échec de la récupération des classes');
    }
  } catch (error) {
    console.error('Erreur lors de la récupération des classes:', error);
    ElMessage.error('Impossible de charger les classes');
  }
};

const fetchCurrentSchoolYear = async () => {
  try {
    const result = await window.ipcRenderer.invoke('yearRepartition:getCurrent');
    if (result.success && result.data) {
      currentSchoolYear.value = result.data.year;
      console.log('Année scolaire courante récupérée:', currentSchoolYear.value);
    } else {
      console.warn('Impossible de récupérer l\'année scolaire courante, utilisation de la valeur par défaut');
      currentSchoolYear.value = getCurrentSchoolYear();
    }
  } catch (error) {
    console.error('Erreur lors de la récupération de l\'année scolaire:', error);
    currentSchoolYear.value = getCurrentSchoolYear();
  }
};

onMounted(async () => {
  await Promise.all([fetchClasses(), fetchCurrentSchoolYear()]);
});

const saveStudent = async (studentData: IStudentData) => {
  try {
    console.log("Données reçues de student-form:", studentData);
    
    // Préparation des données pour l'envoi
    const preparedData = {
      ...studentData,
      documents: studentData.documents || [],
      photo: studentData.photo || null
    };
    
    const serializedData = JSON.parse(JSON.stringify(preparedData));
    
    const result = await window.ipcRenderer.invoke('save-student', serializedData);
    if (result.success) {
      ElMessage.success('Étudiant enregistré avec succès');
      if (formRef.value) {
        formRef.value.resetForm();
      }
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

const handleFileLoaded = async (students: IStudentData[]) => {
  isLoading.value = true;
  console.log('Données importées reçues:', students);
  
  let successCount = 0;
  let errorCount = 0;
  
  try {
    for (const student of students) {
      try {
        // Préparer tous les champs requis avec des valeurs par défaut si nécessaire
        const preparedData = {
          // Champs obligatoires
          firstname: student.firstname || 'Importé',
          lastname: student.lastname || 'IMPORTÉ',
          fatherFirstname: student.fatherFirstname || 'Père',
          fatherLastname: student.fatherLastname || 'NON SPÉCIFIÉ',
          // Correction: motherFirstname et motherLastname ne peuvent pas être NULL (contrainte NOT NULL)
          motherFirstname: student.motherFirstname || 'Non spécifié',
          motherLastname: student.motherLastname || 'Non spécifié',
          
          // Classe (obligatoire)
          gradeId: student.gradeId,
          
          // Champs avec valeurs par défaut
          birthDay: student.birthDay ? new Date(student.birthDay) : null,
          birthPlace: student.birthPlace || 'Non spécifié',
          address: student.address || 'Non spécifié',
          famillyPhone: student.famillyPhone || '000000000',
          personalPhone: student.personalPhone || '',
          sex: convertSex(student.sex),
          schoolYear: student.schoolYear || currentSchoolYear.value,
          
          // Champs vides/null
          documents: [],
          photo: null
        };

        console.log('Tentative d\'enregistrement pour:', preparedData);
        const result = await window.ipcRenderer.invoke('save-student', preparedData);
        
        console.log('Résultat de l\'enregistrement:', result);
        
        if (result.success) {
          successCount++;
          ElMessage.success(`Étudiant ${preparedData.firstname} ${preparedData.lastname} enregistré avec succès`);
        } else {
          errorCount++;
          // Message d'erreur détaillé
          const errorMessage = result.error || result.message || 'Échec de l\'enregistrement';
          console.error('Détails de l\'erreur:', result);
          throw new Error(errorMessage);
        }
      } catch (error) {
        errorCount++;
        console.error(`Erreur pour ${student.firstname || 'étudiant'} ${student.lastname || ''}:`, error);
        ElMessage.error(`Erreur pour ${student.firstname || 'étudiant'} ${student.lastname || ''}: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      }
    }
    
    // Résumé de l'importation
    if (successCount > 0) {
      ElMessage.success(`Importation terminée : ${successCount} étudiant(s) importé(s) avec succès`);
    }
    if (errorCount > 0) {
      ElMessage.warning(`${errorCount} étudiant(s) n'ont pas pu être importés`);
    }
  } finally {
    isLoading.value = false;
  }
};

// Fonction utilitaire pour convertir les valeurs de sexe
const convertSex = (value: any): "male" | "female" => {
  if (!value) return "male";
  const sexValue = String(value).toLowerCase();
  return sexValue.includes("f") || sexValue.includes("fille") || sexValue.includes("femme") ? "female" : "male";
};

// Fonction pour déterminer l'année scolaire en cours
const getCurrentSchoolYear = (): string => {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-11 (janvier = 0)
  
  // Si nous sommes entre janvier et août, l'année scolaire est (année-1)-(année)
  // Si nous sommes entre septembre et décembre, l'année scolaire est (année)-(année+1)
  if (currentMonth < 8) { // Avant septembre
    return `${currentYear-1}-${currentYear}`;
  } else { // Septembre à décembre
    return `${currentYear}-${currentYear+1}`;
  }
};
</script>

<template>
  <el-card :shadow="'hover'" style="border-radius: 8px;">
    <el-row :gutter="20" class="main-container">
      <el-col :span="6" class="section-container">
        <FileUploader 
          @fileLoaded="handleFileLoaded"
          :disabled="isLoading"
        />
      </el-col>

      <el-divider direction="vertical" class="divider" />

      <el-col :span="16" class="section-container">
        <student-form 
          ref="formRef"
          :classes="classes" 
          @save="saveStudent" 
        />
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
