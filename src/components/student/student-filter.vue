<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';

interface Grade {
  id: number;
  name: string;
  value: number;
  label: string;
}

interface FilterForm {
  schoolYear: string;
  classId: string | number;
  studentFullName: string;
}

const emit = defineEmits(['filter', 'reset']);

const filterForm = reactive<FilterForm>({
  schoolYear: '',
  classId: '',
  studentFullName: ''
});

const grades = ref<Grade[]>([]);
const loading = ref(false);

const schoolYearOptions = [
  { value: '2019-2020', label: '2019-2020' },
  { value: '2020-2021', label: '2020-2021' },
  { value: '2021-2022', label: '2021-2022' },
  { value: '2022-2023', label: '2022-2023' },
  { value: '2023-2024', label: '2023-2024' },
  { value: '2024-2025', label: '2024-2025' },
  { value: '2025-2026', label: '2025-2026' },
  { value: '2026-2027', label: '2026-2027' },
  { value: '2027-2028', label: '2027-2028' },
];

const loadGrades = async () => {
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke("grade:all");
    console.log("classes", result);
    if (result?.success && Array.isArray(result.data)) {
      // Mapping correct en conservant les propriétés originales et en ajoutant value/label
      grades.value = result.data.map((grade: { id: number; name: string; }) => ({
        id: grade.id,
        name: grade.name,
        value: grade.id,    // Pour la valeur du select
        label: grade.name   // Pour l'affichage dans le select
      }));
    } else {
      console.error("Format de données invalide pour les niveaux scolaires");
      throw new Error("Format de données invalide");
    }
  } catch (error) {
    console.error("Erreur lors du chargement des niveaux scolaires:", error);
    ElMessage.error("Erreur lors du chargement des niveaux scolaires");
  } finally {
    loading.value = false;
  }
};

const applyFilter = () => {
  console.log('Filtres appliqués:', filterForm);
  emit('filter', filterForm);
};
const resetFilter = () => {
  filterForm.schoolYear = '';
  filterForm.classId = '';
  filterForm.studentFullName = '';
  emit('reset', filterForm);
};

onMounted(() => {
  loadGrades();
});
</script>

<template>
  <el-card>
    <el-form :model="filterForm" label-position="top">
      <el-row :gutter="20">
        <el-col :span="8">
          <el-form-item label="Année scolaire">
            <el-select v-model="filterForm.schoolYear" placeholder="Année scolaire" clearable>
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
            <el-select 
              v-model="filterForm.classId" 
              placeholder="Classe"
              :loading="loading"
              clearable
            >
              <el-option
                v-for="grade in grades"
                :key="grade.value"
                :label="grade.label"
                :value="grade.value"
              />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="8">
          <el-form-item label="Nom complet">
            <el-input 
              v-model="filterForm.studentFullName" 
              placeholder="Nom complet de l'élève" 
              clearable
            />
          </el-form-item>
        </el-col>
      </el-row>

      <el-row justify="center" :gutter="20" class="button-row">
        <el-col :span="6" class="center-align">
          <el-button 
            type="primary" 
            @click="applyFilter" 
            block
            :loading="loading"
          >
            Filtrer
          </el-button>
        </el-col>
        <el-col :span="6" class="center-align">
          <el-button 
            @click="resetFilter" 
            block
            :disabled="loading"
          >
            Réinitialiser
          </el-button>
        </el-col>
      </el-row>
    </el-form>
  </el-card>
</template>

<style scoped>
.el-form-item {
  margin-bottom: 5px;
}

.button-row {
  margin-top: 10px;
}

.center-align {
  display: flex;
  justify-content: center;
}
</style>