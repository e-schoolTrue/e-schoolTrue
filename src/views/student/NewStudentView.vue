<script setup lang="ts">
import { ref } from 'vue';
import StudentForm from '@/components/student/student-form.vue';
import { ElMessage } from 'element-plus';

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
</script>

<template>
  <el-card>
    <el-row justify="center">
      <el-text size="large" style="font-weight: bold">Ajouter un nouvel élève</el-text>
    </el-row>
  </el-card>

  <student-form :classes="classes" @save="saveStudent" />
</template>

