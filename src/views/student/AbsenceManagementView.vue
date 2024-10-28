<template>
  <el-container>
    <el-aside width="200px">
      <el-card class="auto">
        <el-row justify="center">
          <el-text size="large" style="font-weight: bold; ">
            Gestion des Absences
          </el-text>
        </el-row>
      </el-card>
    </el-aside>
    
    <el-main>
      <el-card class="h-90">
        <el-row :gutter="20">
          <el-col :span="24">
            <AbsenceList 
              :absences="absences" 
              :loading="loading"
              :totalAbsences="totalAbsences"
              @refresh="loadAbsences" 
              @page-change="handlePageChange"
            />
          </el-col>
        </el-row>

        <el-row :gutter="20" style="margin-top: 20px;">
          <el-col :span="24">
            <AbsenceForm @absence-added="handleAbsenceAdded" />
          </el-col>
        </el-row>
      </el-card>
    </el-main>
  </el-container>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AbsenceList from '@/components/absence/AbsenceList.vue';
import AbsenceForm from '@/components/absence/AbsenceForm.vue';
import { ElMessage } from 'element-plus';

interface Absence {
  id: number;
  studentId: number;
  date: string;
  reason: string;
  justified: boolean;
}

const absences = ref<Absence[]>([]);
const loading = ref(false);
const totalAbsences = ref(0);

const loadAbsences = async (page = 1) => {
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke('absence:getAll', page);
    if (result.success) {
      absences.value = result.data.absences;
      totalAbsences.value = result.data.total;
    } else {
      ElMessage.error("Erreur lors du chargement des absences");
    }
  } catch (error) {
    console.error("Erreur lors du chargement des absences:", error);
    ElMessage.error("Une erreur s'est produite lors du chargement des absences");
  } finally {
    loading.value = false;
  }
};

const handleAbsenceAdded = (newAbsence: Absence) => {
  absences.value.unshift(newAbsence);
  totalAbsences.value++;
  ElMessage.success("Absence ajoutée avec succès");
};

const handlePageChange = (page: number) => {
  loadAbsences(page);
};

onMounted(() => loadAbsences());
</script>

<style scoped>
.el-container {
  height: calc(100vh - 60px); /* Ajustez selon la hauteur de votre en-tête */
}

.el-aside {
  background-color: #f0f2f5;
}

.el-main {
  padding: 20px;
}

.h-100 {
  height: 100%;
}
</style>
