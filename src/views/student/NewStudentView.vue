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

onMounted(fetchClasses);

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
  
  try {
    for (const student of students) {
      try {
        const preparedData = {
          ...student,
          birthDay: student.birthDay ? new Date(student.birthDay) : null,
          gradeId: student.gradeId,
          documents: student.documents || [],
          photo: student.photo || null
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
