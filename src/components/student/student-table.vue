<template>
  <div class="student-list-container">
    <!-- Section Header pour les statistiques -->
    <div class="header-section">
      <el-card class="stats-card">
        <div class="stats-content">
          <div class="stats-icon">
            <el-icon :size="24"><UserFilled /></el-icon>
          </div>
          <div class="stats-info">
            <span class="stats-label">Total des élèves</span>
            <span class="stats-value">{{ students.length }}</span>
          </div>
        </div>
      </el-card>

      <!-- Carte pour les garçons -->
      <el-card class="stats-card">
        <div class="stats-content">
          <div class="stats-icon boy-icon">
            <el-icon :size="24"><Male /></el-icon>
          </div>
          <div class="stats-info">
            <span class="stats-label">Garçons</span>
            <span class="stats-value">{{ boysCount }}</span>
          </div>
        </div>
      </el-card>

      <!-- Carte pour les filles -->
      <el-card class="stats-card">
        <div class="stats-content">
          <div class="stats-icon girl-icon">
            <el-icon :size="24"><Female /></el-icon>
          </div>
          <div class="stats-info">
            <span class="stats-label">Filles</span>
            <span class="stats-value">{{ girlsCount }}</span>
          </div>
        </div>
      </el-card>
    </div>

    <!-- Table des étudiants -->
    <el-card class="table-card">
      <el-table
        :data="paginatedData"
        style="width: 100%"
        :max-height="tableHeight"
        :header-cell-style="{ background: '#f5f7fa' }"
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
          show-overflow-tooltip
        >
          <template #default="scope">
            <el-tag
              v-if="scope.row.sex !== null"
              size="small"
              :type="scope.row.sex === 'male' ? 'primary' : 'success'"
            >
              <el-icon class="mr-1">
                <Male v-if="scope.row.sex === 'male'" />
                <Female v-else />
              </el-icon>
              {{ scope.row.sex === "male" ? "Garçon" : "Fille" }}
            </el-tag>
            <el-tag v-else size="small" type="info"> Non défini </el-tag>
          </template>
        </el-table-column>
        <el-table-column
          prop="schoolYear"
          label="Année scolaire"
          min-width="120"
          show-overflow-tooltip
        />
        <el-table-column label="Classe" min-width="100" show-overflow-tooltip>
          <template #default="scope">
            <el-tag size="small" :type="getClassTagType(scope.row.classId)">
              {{ getClassName(scope.row.classId) }}
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
          min-width="180"
          align="center"
        >
          <template #default="scope">
            <el-button-group>
              <el-button
                type="primary"
                :icon="Document"
                size="small"
                @click="() => handleClick(scope.row)"
                title="Voir les détails"
                >Détail</el-button
              >
              <el-button
                type="warning"
                :icon="Edit"
                size="small"
                @click="() => handleEdit(scope.row)"
                title="Modifier l'élève"
                >Modifier</el-button
              >
              <el-button
                type="danger"
                :icon="Delete"
                size="small"
                @click="() => handleDelete(scope.row)"
                title="Supprimer l'élève"
              />
            </el-button-group>
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

<script lang="ts" setup>
import { ref, computed, PropType, onMounted } from "vue";
import {
  Document,
  Edit,
  Delete,
  UserFilled,
  Male,
  Female,
} from "@element-plus/icons-vue";
import { ElMessageBox } from "element-plus";

interface Student {
  id?: number;
  matricule: string;
  lastname: string;
  firstname: string;
  schoolYear: string;
  classId?: number;
  famillyPhone?: string;
  sex: "male" | "female";
}

const props = defineProps({
  students: {
    type: Array as PropType<Student[]>,
    required: true,
  },
});

const boysCount = computed(
  () => props.students.filter((student) => student.sex === "male").length
);

const girlsCount = computed(
  () => props.students.filter((student) => student.sex === "female").length
);

// Définir les événements émis par ce composant
const emit = defineEmits(["detail", "edit", "pageChange", "delete"]);

// État pour stocker les données des étudiants
const currentPage = ref(1);
const pageSize = ref(7);

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return props.students.slice(start, end);
});

// Gestion du clic sur le bouton "Détail"
const handleClick = (student: Student) => {
  console.log("Détail d'un étudiant", student);
  emit("detail", student);
};

// Modifiez la fonction handleEdit
const handleEdit = (student: Student) => {
  console.log("Modifier un étudiant", student);
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

// Gestion du changement de page
const handlePageChange = (page: number) => {
  console.log("Changement de page:", page);
  currentPage.value = page;
  emit("pageChange", page);
};

// Fonction pour obtenir le nom de la classe à partir de l'ID
const getClassName = (classId: number | undefined) => {
  if (classId === undefined) return "Non assigné";
  const classes = [
    { id: 1, name: "CI" },
    { id: 2, name: "CP" },
    { id: 3, name: "CE1" },
    { id: 4, name: "CE2" },
    { id: 5, name: "CM1" },
    { id: 6, name: "CM2" },
    { id: 7, name: "6ème" },
    { id: 8, name: "5ème" },
    { id: 9, name: "4ème" },
    { id: 10, name: "3ème" },
    { id: 11, name: "2nde" },
    { id: 12, name: "1ère" },
    { id: 13, name: "Terminale" },
  ];

  const classObj = classes.find((c) => c.id === classId);
  return classObj ? classObj.name : "Non assigné";
};
const tableHeight = ref(300);

onMounted(() => {
  calculateTableHeight();
  window.addEventListener("resize", calculateTableHeight);
});

const calculateTableHeight = () => {
  const windowHeight = window.innerHeight;
  // Ajuster ces valeurs selon vos besoins
  const headerHeight = 100; // Hauteur du header
  const paginationHeight = 60; // Hauteur de la pagination
  const padding = 40; // Padding supplémentaire

  tableHeight.value =
    windowHeight - (headerHeight + paginationHeight + padding);
};

// Fonction pour déterminer le type de tag pour les classes
const getClassTagType = (classId: number | undefined) => {
  if (classId === undefined) return "info";
  if (classId <= 6) return "success"; // Classes primaires
  if (classId <= 10) return "warning"; // Classes collège
  return "danger"; // Classes lycée
};
</script>

<style scoped>
.student-list-container {
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  height: 100%;
  box-sizing: border-box;
}
:deep(.el-button-group .el-button) {
  padding: 4px 8px; /* Ajustez selon le besoin */
}

.header-section {
  display: flex;
  gap: 20px;
}

.stats-card {
  padding: 10px 20px;
}

.stats-content {
  display: flex;
  align-items: center;
  gap: 12px;
}

.stats-icon {
  color: var(--el-color-primary);
}

.stats-info {
  display: flex;
  flex-direction: column;
}

.stats-label {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}

.stats-value {
  font-size: 24px;
  font-weight: bold;
  color: var(--el-text-color-primary);
}

.table-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

:deep(.el-table) {
  flex: 1;
}

.pagination-container {
  padding: 15px 0;
  display: flex;
  justify-content: center;
}

/* Personnalisation des boutons */
:deep(.el-button-group) {
  display: flex;
  gap: 4px;
}

:deep(.el-button) {
  padding: 6px 12px;
}

:deep(.el-tag) {
  width: 100%;
  text-align: center;
}

/* Personnalisation de la scrollbar du tableau */
:deep(.el-table__body-wrapper::-webkit-scrollbar) {
  width: 6px;
  height: 6px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-track) {
  background: #f1f1f1;
  border-radius: 3px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb) {
  background: #888;
  border-radius: 4px;
}

:deep(.el-table__body-wrapper::-webkit-scrollbar-thumb:hover) {
  background: #555;
}

.stats-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background-color: var(--el-color-primary-light-9);
}

.boy-icon {
  background-color: var(--el-color-primary-light-9);
}

.boy-icon :deep(svg) {
  color: var(--el-color-primary);
}

.girl-icon {
  background-color: #f0f9eb;
}

.girl-icon :deep(svg) {
  color: var(--el-color-success);
}

:deep(.el-tag) {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

:deep(.el-tag .el-icon) {
  margin-right: 4px;
}
</style>
