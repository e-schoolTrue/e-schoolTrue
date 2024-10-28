<template>
  <div>
    <p>Nombre total d'élèves : {{ students.length }}</p>
    <div class="table-container">
      <el-table :data="paginatedData" style="width: 100%" height="400">
        <el-table-column prop="matricule" label="Matricule" width="120" />
        <el-table-column prop="lastname" label="Nom" width="120" />
        <el-table-column prop="firstname" label="Prénom" width="120" />
        <el-table-column prop="schoolYear" label="Année scolaire" width="120" />
        <el-table-column label="Classe" width="120">
          <template #default="scope">
            {{ getClassName(scope.row.classId) }}
          </template>
        </el-table-column>
        <el-table-column prop="famillyPhone" label="Contact Parents" width="150" />
        <el-table-column fixed="right" label="Opérations" width="150">
          <template #default="scope">
            <el-button link type="primary" size="small" @click="() => handleClick(scope.row)">
              Détail
            </el-button>
            <el-button link type="primary" size="small" @click="() => handleEdit(scope.row)">
              Modifier
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
  <el-row justify="center" style="margin-top: 20px;">
    <el-pagination 
      layout="prev, pager, next" 
      :total="students.length"
      :page-size="pageSize"
      @current-change="handlePageChange"
    />
  </el-row>
</template>

<script lang="ts" setup>
import { ref, computed, PropType } from 'vue';

interface Student {
  id?: number;
  matricule: string;
  lastname: string;
  firstname: string;
  schoolYear: string;
  classId?: number;
  famillyPhone?: string;
}

const props = defineProps({
  students: {
    type: Array as PropType<Student[]>,
    required: true
  }
});

// Définir les événements émis par ce composant
const emit = defineEmits(['detail', 'edit', 'pageChange']);

// État pour stocker les données des étudiants
const currentPage = ref(1);
const pageSize = ref(10);

// Calculer les données paginées
const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return props.students.slice(start, end);
});

// Gestion du clic sur le bouton "Détail"
const handleClick = (student: Student) => {
  console.log('Détail d\'un étudiant', student);
  emit('detail', student);
};

// Modifiez la fonction handleEdit
const handleEdit = (student: Student) => {
  console.log('Modifier un étudiant', student);
  emit('edit', student.id);
};

// Gestion du changement de page
const handlePageChange = (page: number) => {
  console.log('Changement de page:', page);
  currentPage.value = page;
  emit('pageChange', page);
};

// Fonction pour obtenir le nom de la classe à partir de l'ID
const getClassName = (classId: number | undefined) => {
  if (classId === undefined) return 'Non assigné';
  const classes = [
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
  ];
  
  const classObj = classes.find(c => c.id === classId);
  return classObj ? classObj.name : 'Non assigné';
};
</script>

<style scoped>
.table-container {
  width: 100%;
  overflow-x: auto;
  color: #fff;
}
</style>
