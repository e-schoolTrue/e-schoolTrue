<script setup lang="ts">
import { ref } from 'vue';
import StudentForm from '@/components/student/student-form.vue';
import { ElMessage } from 'element-plus';

// Interface pour les données de l'étudiant
interface StudentData {
  firstname: string; // Non optionnel
  lastname: string; // Non optionnel
  matricule: string; // Non optionnel
  fatherFirstname: string; // Non optionnel
  fatherLastname: string; // Non optionnel
  motherFirstname: string; // Non optionnel
  motherLastname: string; // Non optionnel
  birthDay: Date | null; // Peut être null
  birthPlace: string; // Non optionnel
  address: string; // Non optionnel
  famillyPhone: string; 
  personalPhone: string; 
  classId: number | null; 
  photo?: File | null; 
}


// Initialisez les données de l'étudiant
const studentData = ref<StudentData>({
  firstname: '',
  lastname: '',
  matricule: '',
  fatherFirstname: '',
  fatherLastname: '',
  motherFirstname: '',
  motherLastname: '',
  birthDay: null,
  birthPlace: '',
  address: '',
  famillyPhone: '',
  personalPhone: '',
  classId: null,
  photo:null
});

const saveData = async (data: StudentData) => {
  try {
    const result = await window.ipcRenderer.invoke('save-student', data);
    if (result.success) {
      ElMessage.success(result.message);
      // Réinitialiser le formulaire ou naviguer ailleurs après la sauvegarde
    } else {
      ElMessage.error(result.message || 'Échec de l\'enregistrement');
    }
  } catch (error) {
    console.error('Erreur lors de la sauvegarde:', error);
    ElMessage.error('Une erreur s\'est produite lors de la sauvegarde.');
  }
};

interface ClassItem {
  id: number;
  name: string;
}

const classes = ref<ClassItem[]>([]);

const loadClasses = async () => {
  try {
    const result = await window.ipcRenderer.invoke('classRoom:all');
    if (result.success) {
      classes.value = result.data;
    } else {
      ElMessage.error('Erreur lors du chargement des classes');
    }
  } catch (error) {
    console.error('Erreur lors du chargement des classes:', error);
    ElMessage.error('Une erreur s\'est produite lors du chargement des classes.');
  }
};

loadClasses();
</script>

<template>
  <el-card>
    <el-row justify="center">
      <el-text size="large" style="font-weight: bold">Nouvelle Inscription</el-text>
    </el-row>
  </el-card>

  <student-form
    :studentData="studentData"
    :classes="classes"
    @save="saveData"
  />
</template>