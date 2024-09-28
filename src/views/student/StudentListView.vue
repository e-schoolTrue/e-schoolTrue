<script setup lang="ts">
import { ref } from 'vue';
import StudentFilter from "@/components/student/student-filter.vue";
import StudentTable from "@/components/student/student-table.vue";
import StudentDetail from "@/components/student/student-detail.vue"; // Le composant de détail

// État pour gérer le modal de détail et l'élève sélectionné
const isDetailDialogVisible = ref(false);
const selectedStudent = ref(null);

// Méthode pour gérer l'événement "detail" et ouvrir le modal avec les infos de l'élève
const handleDetail = (student: any) => {
  selectedStudent.value = student;
  isDetailDialogVisible.value = true; // Ouvrir le modal
};

// Méthode pour gérer l'événement "edit"
const handleEdit = (student: any) => {
  console.log('Modification de l\'étudiant', student);
  // Ici, tu peux implémenter la logique pour éditer l'étudiant
};
</script>

<template>
  <el-row :gutter="20">
    <el-col :span="6">
      <el-card>
        <el-row justify="center">
          <el-text size="large" style="font-weight: bold">Liste des Elèves</el-text>
        </el-row>
      </el-card>
    </el-col>

    <el-col :span="18">
      <el-card>
        <student-filter />
        <student-table @detail="handleDetail" @edit="handleEdit" />
      </el-card>
    </el-col>
  </el-row>

  <!-- Modal pour afficher les détails de l'élève -->
  <el-dialog v-model="isDetailDialogVisible" title="Détail de l'élève" width="50%">
    <student-detail v-if="selectedStudent" :student="selectedStudent" />
  </el-dialog>
</template>

<style scoped>
.el-row {
  margin-bottom: 20px;
}

.el-col {
  padding: 10px;
}
</style>
