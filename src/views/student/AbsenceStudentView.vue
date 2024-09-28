<template>
    <el-card>
      <h2>Gestion des Absences</h2>
  
      <!-- Filtres de recherche -->
      <el-row :gutter="20">
        <el-col :span="8">
          <el-input v-model="filters.studentName" placeholder="Rechercher un étudiant" />
        </el-col>
        <el-col :span="8">
          <el-date-picker
            v-model="filters.absenceDate"
            type="date"
            placeholder="Choisir une date"
          />
        </el-col>
      </el-row>
  
      <!-- Tableau des absences -->
      <el-table :data="filteredAbsences" style="width: 100%" v-if="absences.length">
        <el-table-column prop="studentName" label="Étudiant" />
        <el-table-column prop="date" label="Date de l'absence" />
        <el-table-column prop="justified" label="Justifiée" :formatter="(row) => row.justified ? 'Oui' : 'Non'" />
        <el-table-column prop="reason" label="Raison" />
        <el-table-column label="Actions">
          <template #default="scope">
            <el-button size="mini" @click="editAbsence(scope.row)">Modifier</el-button>
            <el-button size="mini" type="danger" @click="deleteAbsence(scope.row)">Supprimer</el-button>
          </template>
        </el-table-column>
      </el-table>
  
      <!-- Formulaire d'ajout d'absence -->
      <el-dialog title="Ajouter une absence" :visible.sync="dialogVisible">
        <el-form :model="newAbsence">
          <el-form-item label="Étudiant">
            <el-input v-model="newAbsence.studentName" />
          </el-form-item>
          <el-form-item label="Date">
            <el-date-picker v-model="newAbsence.date" type="date" />
          </el-form-item>
          <el-form-item label="Justifiée">
            <el-switch v-model="newAbsence.justified" />
          </el-form-item>
          <el-form-item label="Raison">
            <el-input v-model="newAbsence.reason" />
          </el-form-item>
        </el-form>
  
        <span slot="footer" class="dialog-footer">
          <el-button @click="dialogVisible = false">Annuler</el-button>
          <el-button type="primary" @click="addAbsence">Ajouter</el-button>
        </span>
      </el-dialog>
    </el-card>
  </template>
  
  <script setup>
  import { ref } from 'vue';
  
  const absences = ref([
    { studentName: 'Jean Dupont', date: '2024-09-28', justified: false, reason: 'Malade' },
    // Autres absences...
  ]);
  
  const filters = ref({
    studentName: '',
    absenceDate: '',
  });
  
  const filteredAbsences = computed(() => {
    return absences.value.filter(abs => {
      return (!filters.value.studentName || abs.studentName.includes(filters.value.studentName)) &&
             (!filters.value.absenceDate || abs.date === filters.value.absenceDate);
    });
  });
  
  const dialogVisible = ref(false);
  const newAbsence = ref({ studentName: '', date: '', justified: false, reason: '' });
  
  const addAbsence = () => {
    absences.value.push({ ...newAbsence.value });
    dialogVisible.value = false;
  };
  
  const editAbsence = (absence) => {
    // Code pour modifier une absence existante
  };
  
  const deleteAbsence = (absence) => {
    absences.value = absences.value.filter(a => a !== absence);
  };
  </script>
  