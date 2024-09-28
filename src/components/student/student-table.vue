<template>
  <el-table :data="tableData" style="width: 100%">
    <el-table-column prop="birthDay" label="Date de naissance" width="150" />
    <el-table-column prop="lastname" label="Nom" width="120" />
    <el-table-column prop="firstname" label="Prénom" width="120" />
    <el-table-column prop="birthPlace" label="Ville de naissance" width="120" />
    <el-table-column prop="address" label="Adresse" width="600" />
    <el-table-column fixed="right" label="Opérations" min-width="120">
      <template #default="scope">
        <el-space>
          <el-button link type="primary" size="small" @click="() => handleClick(scope.row)">
            Détail
          </el-button>
          <el-button link type="primary" size="small" @click="() => handleEdit(scope.row)">
            Modifier
          </el-button>
        </el-space>
      </template>
    </el-table-column>
  </el-table>
  <el-row justify="center">
    <el-pagination layout="prev, pager, next" :total="tableData.length" />
  </el-row>
</template>

<script lang="ts" setup>
import { ref, onMounted, defineEmits } from 'vue';

// Définir les événements émis par ce composant
const emit = defineEmits(['detail', 'edit']);

// État pour stocker les données des étudiants
const tableData = ref([]);

// Fonction pour récupérer les données des étudiants depuis le back-end
const fetchStudentData = async () => {
  try {
    const students = await window.ipcRenderer.invoke('student:all');
    tableData.value = students || [];
  } catch (error) {
    console.error('Erreur lors de la récupération des données des étudiants:', error);
  }
};

// Charger les données lorsque le composant est monté
onMounted(() => {
  fetchStudentData();
});

// Gestion du clic sur le bouton "Détail"
const handleClick = (student: any) => {
  console.log('Détail d\'un étudiant', student);
  // Émettre un événement avec les données de l'étudiant
  emit('detail', student);
};

// Gestion du clic sur le bouton "Modifier"
const handleEdit = (student: any) => {
  console.log('Modifier un étudiant', student);
  // Émettre un événement avec les données de l'étudiant
  emit('edit', student);
};
</script>

<style scoped>
/* Style optionnel si nécessaire */
</style>
