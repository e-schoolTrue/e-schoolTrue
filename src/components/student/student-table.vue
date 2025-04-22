<template>
  <div class="student-list-container">
    <!-- Statistics Header Section -->
    <div class="header-section">
      <el-card class="stats-card stats-total-students">
        <div class="stats-content">
          <div class="stats-icon">
            <Icon icon="mdi:account-group" class="icon" />
          </div>
          <div class="stats-info">
            <span class="stats-label">Total des élèves</span>
            <span class="stats-value">{{ students.length }}</span>
          </div>
        </div>
      </el-card>

      <el-card class="stats-card stats-boys">
        <div class="stats-content">
          <div class="stats-icon">
            <Icon icon="mdi:gender-male" class="icon" />
          </div>
          <div class="stats-info">
            <span class="stats-label">Garçons</span>
            <span class="stats-value">{{ boysCount }}</span>
          </div>
        </div>
      </el-card>

      <el-card class="stats-card stats-girls">
        <div class="stats-content">
          <div class="stats-icon">
            <Icon icon="mdi:gender-female" class="icon" />
          </div>
          <div class="stats-info">
            <span class="stats-label">Filles</span>
            <span class="stats-value">{{ girlsCount }}</span>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Student Table -->
    <el-card class="table-card">
      <div class="table-header">
        <h3 class="table-title">Liste des élèves</h3>
        <div class="table-actions">
          <el-button
            type="success"
            @click="handleExport"
            :loading="loading"
          >
            <Icon icon="mdi:file-excel" />
            Exporter Excel
          </el-button>
          <el-button
            type="primary"
            :icon="Refresh"
            @click="refreshData"
            :loading="loading"
          >
            Actualiser
          </el-button>
        </div>
      </div>

      <el-table
        :data="paginatedData"
        style="width: 100%"
        :max-height="tableHeight"
        :header-cell-style="headerStyle"
        row-class-name="student-table-row"
      >
        <el-table-column
          prop="matricule"
          label="Matricule"
          min-width="120"
          show-overflow-tooltip
        />
        <el-table-column
          prop="lastname"
          label="Nom"
          min-width="120"
          show-overflow-tooltip
        />
        <el-table-column
          prop="firstname"
          label="Prénom"
          min-width="120"
          show-overflow-tooltip
        />
        <el-table-column
          prop="sex"
          label="Genre"
          min-width="100"
          align="center"
          show-overflow-tooltip
        >
          <template #default="scope">
            <el-tag
              v-if="scope.row.sex !== null"
              size="small"
              :type="scope.row.sex === 'male' ? 'primary' : 'success'"
              class="gender-tag"
            >
              <Icon 
                :icon="scope.row.sex === 'male' ? 'mdi:gender-male' : 'mdi:gender-female'"
                class="gender-icon"
              />
              {{ scope.row.sex === "male" ? "Garçon" : "Fille" }}
            </el-tag>
            <el-tag v-else size="small" type="info">Non défini</el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="schoolYear"
          label="Année scolaire"
          min-width="120"
          align="center"
          show-overflow-tooltip
        />
        <el-table-column
          label="Classe"
          min-width="100"
          align="center"
          show-overflow-tooltip
        >
          <template #default="scope">
            <el-tag size="small" :type="getGradeTagType(scope.row.gradeId)">
              {{ getGradeName(scope.row.gradeId) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column
          prop="famillyPhone"
          label="Contact Parents"
          min-width="150"
          show-overflow-tooltip
        />

        <el-table-column
          fixed="right"
          label="Actions"
          min-width="140"
          align="center"
        >
          <template #default="scope">
            <el-space>
              <el-tooltip content="Voir les détails" placement="top">
                <el-button
                  type="primary"
                  circle
                  size="small"
                  @click="() => handleClick(scope.row)"
                >
                  <Icon icon="mdi:eye" />
                </el-button>
              </el-tooltip>

              <el-tooltip content="Modifier l'élève" placement="top">
                <el-button
                  type="warning"
                  circle
                  size="small"
                  @click="() => handleEdit(scope.row)"
                >
                  <Icon icon="mdi:pencil" />
                </el-button>
              </el-tooltip>

              <el-tooltip content="Supprimer l'élève" placement="top">
                <el-button
                  type="danger"
                  circle
                  size="small"
                  @click="() => handleDelete(scope.row)"
                >
                  <Icon icon="mdi:trash" />
                </el-button>
              </el-tooltip>
            </el-space>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          background
          layout="prev, pager, next"
          :total="students.length"
          :page-size="pageSize"
          :current-page="currentPage"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, PropType } from "vue";
import { Icon } from '@iconify/vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import * as XLSX from "xlsx";
import { Refresh } from '@element-plus/icons-vue';
import type { IStudentFile, IStudentData } from '@/types/student';
import type { IGrade } from '@/types/shared';

interface Student extends Omit<IStudentData, 'documents' | 'photo'> {
  documents?: IStudentFile[];
  photo?: IStudentFile;
}

const props = defineProps({
  students: {
    type: Array as PropType<Student[]>,
    required: true,
  },
});

const emit = defineEmits(["detail", "edit", "pageChange", "delete", "refresh"]);

const currentPage = ref(1);
const pageSize = ref(5);
const tableHeight = ref(500);
const searchQuery = ref('');
const loading = ref(false);

const headerStyle = {
  background: "#f5f7fa",
  color: "#606266",
  fontWeight: "bold",
  borderBottom: "2px solid #EBEEF5",
  padding: "12px 0",
};

// Variables pour stocker les données des grades
const grades = ref<IGrade[]>([]);

// Charger les grades depuis l'IPC au montage
onMounted(async () => {
  try {
    const result = await window.ipcRenderer.invoke("grade:all");
    console.log('Grades loaded:', result);
    grades.value = result.data || [];
  } catch (error) {
    console.error("Erreur lors du chargement des grades :", error);
  }
});

// Computed
const boysCount = computed(
  () => props.students.filter((student) => student.sex === "male").length
);

const girlsCount = computed(
  () => props.students.filter((student) => student.sex === "female").length
);

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return props.students.slice(start, end);
});

const filteredStudents = computed(() => {
  if (!searchQuery.value) {
    return props.students;
  }
  return props.students.filter(student => {
    const firstname = student.firstname?.toLowerCase() || '';
    const lastname = student.lastname?.toLowerCase() || '';
    const matricule = student.matricule?.toLowerCase() || '';
    const query = searchQuery.value.toLowerCase();
    
    return firstname.includes(query) || 
           lastname.includes(query) || 
           matricule.includes(query);
  });
});

// Methods
const handleClick = (student: Student) => {
  emit("detail", student);
};

const handleEdit = (student: Student) => {
  emit("edit", student.id);
};

const handleDelete = async (student: Student) => {
  try {
    await ElMessageBox.confirm(
      `Êtes-vous sûr de vouloir supprimer l'élève ${student.firstname} ${student.lastname} ?`,
      "Confirmation",
      {
        confirmButtonText: "Supprimer",
        cancelButtonText: "Annuler",
        type: "warning",
      }
    );
    emit("delete", student.id);
  } catch {
    // L'utilisateur a annulé
  }
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  emit("pageChange", page);
};

const handleExport = () => {
  try {
    const wb = XLSX.utils.book_new();
    
    const exportData = filteredStudents.value.map(student => ({
      'Matricule': student.matricule,
      'Nom': student.lastname,
      'Prénom': student.firstname,
      'Genre': student.sex === 'male' ? 'Garçon' : 'Fille',
      'Année scolaire': student.schoolYear,
      'Classe': getGradeName(student.gradeId),
      'Contact Parents': student.famillyPhone,
      'Date de naissance': student.birthDay ? new Date(student.birthDay).toLocaleDateString() : '',
      'Lieu de naissance': student.birthPlace || '',
      'Adresse': student.address || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    XLSX.utils.book_append_sheet(wb, ws, 'Élèves');

    const date = new Date().toISOString().split('T')[0];
    const fileName = `liste_eleves_${date}.xlsx`;

    XLSX.writeFile(wb, fileName);

    ElMessage.success('Export réussi !');
  } catch (error) {
    console.error('Erreur lors de l\'export:', error);
    ElMessage.error('Erreur lors de l\'export du fichier');
  }
};

const getGradeName = (gradeId: number | undefined): string => {
  // Si gradeId est 0, c'est une valeur valide mais considérée comme falsy en JavaScript
  if (gradeId === undefined || gradeId === null) {
    return "Non assigné";
  }
  
  // Si gradeId est 0, on pourrait avoir un cas particulier
  if (gradeId === 0) {
    // Vérifier s'il existe une définition spéciale pour le grade 0
    const grade = grades.value.find((g) => g.id === 0);
    return (grade && grade.name) ? grade.name : "Non assigné";
  }
  
  // Pour les valeurs positives de gradeId
  const grade = grades.value.find((g) => g.id === gradeId);
  return (grade && grade.name) ? grade.name : "Non assigné";
};

const getGradeTagType = (gradeId: number | undefined): string => {
  if (!gradeId) return "info";
  if (gradeId <= 6) return "success";
  if (gradeId <= 10) return "warning";
  return "danger";
};

const refreshData = () => {
  loading.value = true;
  try {
    emit('refresh');
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.student-list-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  background-color: #f7f9fc;
}

.header-section {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
  gap: 20px;
}

.stats-card {
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
  transition: transform 0.3s ease;
}

.stats-card:hover {
  transform: translateY(-5px);
}

.stats-total-students .stats-icon {
  background-color: rgba(64, 158, 255, 0.1);
  color: #409eff;
}

.stats-boys .stats-icon {
  background-color: rgba(103, 194, 58, 0.1);
  color: #67c23a;
}

.stats-girls .stats-icon {
  background-color: rgba(245, 108, 108, 0.1);
  color: #f56c6c;
}

.stats-content {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
}

.stats-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 50px;
  height: 50px;
  border-radius: 50%;
}

.stats-icon .icon {
  font-size: 24px;
}

.stats-info {
  display: flex;
  flex-direction: column;
}

.stats-label {
  font-size: 14px;
  color: #6c757d;
  margin-bottom: 5px;
}

.stats-value {
  font-size: 26px;
  font-weight: 700;
  color: #2c3e50;
}

.table-card {
  border-radius: 12px;
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);
}

.table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  border-bottom: 1px solid #ebeef5;
}

.table-title {
  margin: 0;
  font-size: 20px;
  color: #2c3e50;
  font-weight: 600;
}

.gender-tag {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.gender-icon {
  font-size: 16px;
}

.student-table-row {
  transition: background-color 0.3s ease;
}

.student-table-row:hover {
  background-color: #f5f7fa !important;
}

.pagination-container {
  padding: 20px;
  display: flex;
  justify-content: center;
  border-top: 1px solid #ebeef5;
}

/* Custom Scrollbar */
:deep(.el-table__body-wrapper::-webkit-scrollbar) {
  width: 10px;
  height: 10px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-track) {
  background: #f1f2f6;
  border-radius: 5px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb) {
  background: #a0a0a0;
  border-radius: 5px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb:hover) {
  background: #7c7c7c;
}
</style>

