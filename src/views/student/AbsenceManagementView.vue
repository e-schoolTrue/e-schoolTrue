<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { View, Plus, TrendCharts } from '@element-plus/icons-vue';
import StudentFilter from "@/components/student/student-filter.vue";
import AbsenceList from '@/components/absence/AbsenceList.vue';
import AddAbsenceDialog from '@/components/absence/AbsenceForm.vue';

// Interface complète pour Student avec toutes les propriétés nécessaires
interface Student {
  id: number;
  firstname: string;  
  lastname: string;  
  classId: number;
  schoolYear: string;
  birthDay?: string;
  address?: string;
  matricule?: string;
  sex?: string;
}

interface Absence {
  id: number;
  date: Date;
  reason: string;
  justified: boolean;
  student: Student;
}

interface FilterData {
  studentFullName?: string;
  classId?: number;
  schoolYear?: string;
}


const showStatsDialog = ref(false);
const allStudents = ref<Student[]>([]); 
const filteredStudents = ref<Student[]>([]);
const selectedStudent = ref<Student | null>(null);
const absences = ref<Absence[]>([]);
const loading = ref(false);
const showAddDialog = ref(false);
const showDetailsDialog = ref(false);

// Add computed properties for statistics
const absenceStats = computed(() => {
  if (!absences.value.length) return null;
  
  const total = absences.value.length;
  const justified = absences.value.filter(a => a.justified).length;
  const unjustified = total - justified;
  
  const byMonth = absences.value.reduce((acc: Record<string, number>, curr) => {
    const month = new Date(curr.date).toLocaleDateString('fr-FR', { month: 'long' });
    acc[month] = (acc[month] || 0) + 1;
    return acc;
  }, {});

  return {
    total,
    justified,
    unjustified,
    justifiedPercentage: ((justified / total) * 100).toFixed(1),
    byMonth
  };
});

const loadStudents = async () => {
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke("student:all");
    console.log("étudiants reçus:", result);
    if (result?.success && Array.isArray(result.data)) {
      // Map API response to match our interface
      allStudents.value = result.data.map((student: any) => ({
        id: student.id,
        firstname: student.firstname,
        lastname: student.lastname,
        classId: student.classId,
        schoolYear: student.schoolYear,
        birthDay: student.birthDay,
        address: student.address,
        matricule: student.matricule,
        sex: student.sex
      }));
      filteredStudents.value = allStudents.value;
    } else {
      console.error("Format de données invalide:", result);
      throw new Error("Format de données invalide");
    }
  } catch (error) {
    console.error("Erreur lors du chargement des étudiants:", error);
    ElMessage.error("Erreur lors du chargement des étudiants");
  } finally {
    loading.value = false;
  }
};


const handleFilter = async (filterData: FilterData) => {
  loading.value = true;
  try {
    console.log("Critères de filtrage:", filterData);
    
    filteredStudents.value = allStudents.value.filter(student => {
      if (filterData.studentFullName) {
        const fullName = `${student.firstname} ${student.lastname}`.toLowerCase();
        if (!fullName.includes(filterData.studentFullName.toLowerCase())) {
          return false;
        }
      }
      if (filterData.classId && student.classId !== filterData.classId) {
        return false;
      }
      if (filterData.schoolYear && student.schoolYear !== filterData.schoolYear) {
        return false;
      }
      return true;
    });

    console.log("Étudiants filtrés:", filteredStudents.value);
  } catch (error) {
    console.error("Erreur lors du filtrage:", error);
    ElMessage.error("Erreur lors du filtrage des étudiants");
  } finally {
    loading.value = false;
  }
};

const handleResetFilter = async () => {
  filteredStudents.value = allStudents.value;
};

const handleStudentSelect = async (student: Student) => {
  selectedStudent.value = student;
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke(
      "absence:getByStudent", 
      student.id
    );
    
    // Vérification que result est un tableau ou a une propriété data qui est un tableau
    if (Array.isArray(result)) {
      absences.value = result;
    } else if (result?.success && Array.isArray(result.data)) {
      absences.value = result.data;
    } else {
      console.error("Format de données reçu:", result);
      throw new Error("Format de données invalide pour les absences");
    }
    
    // Conversion des dates en objets Date
    absences.value = absences.value.map(absence => ({
      ...absence,
      date: new Date(absence.date)
    }));
    
  } catch (error) {
    console.error("Erreur lors du chargement des absences:", error);
    ElMessage.error("Erreur lors du chargement des absences");
  } finally {
    loading.value = false;
  }
};

const handleAddAbsence = async (absenceData: Partial<Absence>) => {
  if (!selectedStudent.value) {
    ElMessage.warning("Veuillez sélectionner un étudiant");
    return;
  }
  
  try {
    const result = await window.ipcRenderer.invoke("absence:add", {
      ...absenceData,
      studentId: selectedStudent.value.id
    });
    
    if (result?.success) {
      ElMessage.success("Absence ajoutée avec succès");
      showAddDialog.value = false;
      // Recharger les absences de l'étudiant
      await handleStudentSelect(selectedStudent.value);
    } else if (result?.error) {
      throw new Error(result.error);
    } else {
      throw new Error("Échec de l'ajout de l'absence");
    }
  } catch (error) {
    console.error("Erreur lors de l'ajout de l'absence:", error);
    ElMessage.error(error instanceof Error ? error.message : "Erreur lors de l'ajout de l'absence");
  }
};

const handleShowDetails = (student: Student) => {
  selectedStudent.value = student;
  showDetailsDialog.value = true;
  handleStudentSelect(student);
};

const handleShowAddDialog = (student: Student) => {
  selectedStudent.value = student;
  showAddDialog.value = true;
};
const handleShowStats = (student: Student) => {
  selectedStudent.value = student;
  handleStudentSelect(student).then(() => {
    showStatsDialog.value = true;
  });
};

onMounted(() => {
  loadStudents();
});
</script>

<template>
  <div class="absence-management">
    <div class="container">
      <el-card class="student-list-card">
        <template #header>
          <div class="card-header">
            <h2>Liste des Étudiants</h2>
            <StudentFilter
              @filter="handleFilter"
              @reset="handleResetFilter"
            />
          </div>
        </template>

        <el-table
          :data="filteredStudents"
          v-loading="loading"
          style="width: 100%"
          :height="600"
        >
          <el-table-column prop="matricule" label="Matricule" width="120" />
          <el-table-column prop="firstname" label="Prénom" width="180" />
          <el-table-column prop="lastname" label="Nom" width="180" />
          <el-table-column prop="schoolYear" label="Année" width="120" />
          <el-table-column label="Actions" width="280" fixed="right">
            <template #default="scope">
              <el-button-group>
                <el-tooltip
                  content="Voir les détails des absences"
                  placement="top"
                >
                  <el-button
                    type="primary"
                    :icon="View"
                    @click="handleShowDetails(scope.row)"
                  />
                </el-tooltip>
                <el-tooltip
                  content="Ajouter une absence"
                  placement="top"
                >
                  <el-button
                    type="success"
                    :icon="Plus"
                    @click="handleShowAddDialog(scope.row)"
                  />
                </el-tooltip>
                <el-tooltip
                  content="Voir les statistiques"
                  placement="top"
                >
                  <el-button
                    type="info"
                    :icon="TrendCharts"
                    @click="handleShowStats(scope.row)"
                  />
                </el-tooltip>
              </el-button-group>
            </template>
          </el-table-column>
        </el-table>
      </el-card>
    </div>

    <!-- Existing dialogs -->
    <el-dialog
      v-model="showDetailsDialog"
      title="Détails des absences"
    >
      <AbsenceList
        :absences="absences"
        :loading="loading"
        :student="selectedStudent as Record<string, any> | undefined"
      />
    </el-dialog>

    <AddAbsenceDialog
      v-model:visible="showAddDialog"
      :student="selectedStudent as Record<string, any> | undefined"
      @submit="handleAddAbsence"
    />

    <!-- New Statistics Dialog -->
    <el-dialog
      v-model="showStatsDialog"
      title="Statistiques des absences"
      width="600px"
    >
      <el-card v-if="absenceStats && selectedStudent" class="stats-card">
        <template #header>
          <h3>Statistiques pour {{ selectedStudent.firstname }} {{ selectedStudent.lastname }}</h3>
        </template>
        
        <div class="stats-grid">
          <el-card shadow="hover" class="stat-item">
            <h4>Total des absences</h4>
            <div class="stat-value">{{ absenceStats.total }}</div>
          </el-card>
          
          <el-card shadow="hover" class="stat-item">
            <h4>Absences justifiées</h4>
            <div class="stat-value text-success">
              {{ absenceStats.justified }}
              <small>({{ absenceStats.justifiedPercentage }}%)</small>
            </div>
          </el-card>
          
          <el-card shadow="hover" class="stat-item">
            <h4>Absences non justifiées</h4>
            <div class="stat-value text-danger">{{ absenceStats.unjustified }}</div>
          </el-card>
        </div>

        <div class="monthly-stats">
          <h4>Répartition mensuelle</h4>
          <el-table :data="Object.entries(absenceStats.byMonth)">
            <el-table-column prop="0" label="Mois" />
            <el-table-column prop="1" label="Nombre d'absences">
              <template #default="{ row }">
                <el-progress
                  :percentage="(row[1] / absenceStats.total) * 100"
                  :format="() => row[1]"
                />
              </template>
            </el-table-column>
          </el-table>
        </div>
      </el-card>
    </el-dialog>
  </div>
</template>

<style scoped>
.absence-management {
  padding: 20px;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
}

.student-list-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.el-table {
  margin-top: 1rem;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  margin-bottom: 2rem;
}

.stat-item {
  text-align: center;
  padding: 1rem;
}

.stat-item h4 {
  margin: 0;
  color: #606266;
  font-size: 0.9rem;
}

.stat-value {
  font-size: 2rem;
  font-weight: bold;
  margin-top: 0.5rem;
}

.text-success {
  color: #67C23A;
}

.text-danger {
  color: #F56C6C;
}

.monthly-stats {
  margin-top: 2rem;
}

.monthly-stats h4 {
  margin-bottom: 1rem;
  color: #606266;
}

:deep(.el-button-group) {
  display: flex;
  gap: 0.5rem;
}

:deep(.el-table__header) {
  font-weight: bold;
  background-color: #f5f7fa;
}

:deep(.el-table__row) {
  cursor: pointer;
}

:deep(.el-table__row:hover) {
  background-color: #f5f7fa;
}
</style>