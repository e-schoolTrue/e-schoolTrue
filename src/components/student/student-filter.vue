<script setup lang="ts">
import { reactive} from "vue";
import {defineEmits} from 'vue';

const emit = defineEmits(['filter']);

const filterForm = reactive({
  schoolYear: '',
  schoolClass: '',
  schoolSection: '',
  studentPV: '',
  studentLastName: '',
  studentFirstName: ''
});

const schoolYearOptions = [
  { value: '2023-2024', label: '2023-2024' },
  { value: '2024-2025', label: '2024-2025' },
  // ... ajoutez d'autres années scolaires si nécessaire
];

const studentClassesOptions = [
  { value: '1', label: '1ère' },
  { value: '2', label: '2ème' },
  // ... ajoutez d'autres classes
];

const studentClassesSectionOptions = [
  { value: 'A', label: 'A' },
  { value: 'B', label: 'B' },
  // ... ajoutez d'autres sections
];

const applyFilter = () => {
  emit('filter', filterForm);
};

const resetFilter = () => {
  (Object.keys(filterForm) as Array<keyof typeof filterForm>).forEach(key => {
    filterForm[key] = '';
  });
  emit('filter', filterForm);
};
</script>

<template>
  <el-card>
    <el-form :model="filterForm">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="Année scolaire">
            <el-select v-model="filterForm.schoolYear" placeholder="Année scolaire">
              <el-option
                v-for="item in schoolYearOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="Classe">
            <el-select v-model="filterForm.schoolClass" placeholder="Classe">
              <el-option
                v-for="item in studentClassesOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="Section">
            <el-select v-model="filterForm.schoolSection" placeholder="Section">
              <el-option
                v-for="item in studentClassesSectionOptions"
                :key="item.value"
                :label="item.label"
                :value="item.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      
      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="PV de l'élève">
            <el-input v-model="filterForm.studentPV" placeholder="PV de l'élève" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="Nom de l'élève">
            <el-input v-model="filterForm.studentLastName" placeholder="Nom de l'élève" />
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="Prénom de l'élève">
            <el-input v-model="filterForm.studentFirstName" placeholder="Prénom de l'élève" />
          </el-form-item>
        </el-col>
      </el-row>
      
      <el-row justify="center" :gutter="20">
        <el-col :span="12">
          <el-button type="primary" @click="applyFilter">Filtrer</el-button>
        </el-col>
        <el-col :span="12">
          <el-button @click="resetFilter">Réinitialiser</el-button>
        </el-col>
      </el-row>
    </el-form>
  </el-card>
</template>

<style scoped>
.el-form-item {
  margin-bottom: 18px;
}
</style>
