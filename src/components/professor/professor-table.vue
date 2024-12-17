<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { ElMessageBox, ElMessage } from 'element-plus';
import { CIVILITY, FAMILY_SITUATION } from "#electron/command";
import { Icon } from '@iconify/vue';
import { useRouter } from 'vue-router';
import * as XLSX from "xlsx";

interface Professor {
  id?: number;
  firstname: string;
  lastname: string;
  civility: CIVILITY;
  nbr_child: number;
  family_situation: FAMILY_SITUATION;
  birth_date: Date | null;
  birth_town: string;
  address: string;
  town: string;
  cni_number: string;
  diploma?: {
    name: string;
  };
  qualification?: {
    name: string;
  };
}

const props = defineProps({
  professors: {
    type: Array as () => Professor[],
    required: true,
  },
});

const emit = defineEmits(['detail', 'edit', 'delete', 'pageChange']);

const currentPage = ref(1);
const pageSize = ref(10);
const searchQuery = ref('');
const filteredProfessors = ref<Professor[]>([]);

// Initialiser filteredProfessors avec les données de props.professors
onMounted(() => {
  filteredProfessors.value = props.professors;
});

// Observer les changements de props.professors
watch(() => props.professors, (newProfessors) => {
  if (!searchQuery.value) {
    filteredProfessors.value = newProfessors;
  } else {
    handleSearch(searchQuery.value);
  }
}, { immediate: true });

const paginatedData = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value;
  const end = start + pageSize.value;
  return filteredProfessors.value.slice(start, end);
});

const handleDetail = (professor: Professor) => {
  emit('detail', professor);
};

const handleEdit = (professor: Professor) => {
  emit('edit', professor.id);
};

const handleDelete = async (professor: Professor) => {
  try {
    await ElMessageBox.confirm(
      `Êtes-vous sûr de vouloir supprimer le professeur ${professor.firstname} ${professor.lastname} ?`,
      'Confirmation',
      {
        confirmButtonText: 'Supprimer',
        cancelButtonText: 'Annuler',
        type: 'warning',
      }
    );
    emit('delete', professor.id);
  } catch {
    // L'utilisateur a annulé
  }
};

const handlePageChange = (page: number) => {
  currentPage.value = page;
  emit('pageChange', page);
};

const getCivilityLabel = (civility: CIVILITY): string => {
  const labels: Record<CIVILITY, string> = {
    [CIVILITY.MR]: 'Monsieur',
    [CIVILITY.MME]: 'Madame',
    [CIVILITY.MLLE]: 'Mademoiselle'
  };
  return labels[civility] || civility;
};

const getFamilySituationLabel = (situation: FAMILY_SITUATION): string => {
  const labels: Record<FAMILY_SITUATION, string> = {
    [FAMILY_SITUATION.SINGLE]: 'Célibataire',
    [FAMILY_SITUATION.MARRIED]: 'Marié(e)',
    [FAMILY_SITUATION.DIVORCED]: 'Divorcé(e)',
    [FAMILY_SITUATION.WIDOWED]: 'Veuf/Veuve'
  };
  return labels[situation] || situation;
};

const router = useRouter();
const loading = ref(false);

const handleAdd = () => {
  router.push('/professor/add');
};

const handleSearch = (value: string) => {
  if (value) {
    filteredProfessors.value = props.professors.filter(prof => 
      prof.firstname.toLowerCase().includes(value.toLowerCase()) ||
      prof.lastname.toLowerCase().includes(value.toLowerCase()) ||
      prof.diploma?.name.toLowerCase().includes(value.toLowerCase())
    );
  } else {
    filteredProfessors.value = props.professors;
  }
};

const handleExport = () => {
  try {
    // Préparer les données pour l'export
    const exportData = filteredProfessors.value.map(prof => ({
      'Civilité': getCivilityLabel(prof.civility),
      'Nom': prof.lastname,
      'Prénom': prof.firstname,
      'Situation Familiale': getFamilySituationLabel(prof.family_situation),
      'Nombre d\'enfants': prof.nbr_child,
      'Date de naissance': prof.birth_date ? new Date(prof.birth_date).toLocaleDateString() : '',
      'Ville de naissance': prof.birth_town,
      'Adresse': prof.address,
      'Ville': prof.town,
      'N° CNI': prof.cni_number,
      'Diplôme': prof.diploma?.name || '',
      'Qualification': prof.qualification?.name || ''
    }));

    // Créer un nouveau classeur
    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Ajouter la feuille au classeur
    XLSX.utils.book_append_sheet(wb, ws, 'Professeurs');

    // Générer le nom du fichier avec la date
    const date = new Date().toISOString().split('T')[0];
    const fileName = `liste_professeurs_${date}.xlsx`;

    // Déclencher le téléchargement
    XLSX.writeFile(wb, fileName);

    ElMessage.success('Export réussi !');
  } catch (error) {
    console.error('Erreur lors de l\'export:', error);
    ElMessage.error('Erreur lors de l\'export du fichier');
  }
};

const handleSizeChange = (val: number) => {
  pageSize.value = val;
  currentPage.value = 1;
};

</script>

<template>
  <div class="professor-table-container">
    <el-card class="table-card" :body-style="{ padding: '0px' }">
      <template #header>
        <div class="card-header">
          <div class="header-title">
            <Icon icon="mdi:account-school" class="header-icon" />
            <h3>Liste des Professeurs</h3>
            <el-tag type="info" class="total-count">
              Total: {{ filteredProfessors.length }}
            </el-tag>
          </div>
          
          <div class="header-actions">
            <el-input
              v-model="searchQuery"
              placeholder="Rechercher un professeur..."
              class="search-input"
              @input="handleSearch"
              clearable
            >
              <template #prefix>
                <Icon icon="mdi:magnify" />
              </template>
            </el-input>

            <div class="action-buttons">
              <el-button
                type="primary"
                @click="handleAdd"
              >
                <Icon icon="mdi:plus" />
                Nouveau Professeur
              </el-button>

              <el-button
                type="success"
                @click="handleExport"
                :loading="loading"
              >
                <Icon icon="mdi:file-excel" />
                Exporter Excel
              </el-button>
            </div>
          </div>
        </div>
      </template>

      <el-table 
        :data="paginatedData" 
        style="width: 100%"
        :max-height="500"
        v-loading="loading"
        stripe
        border
      >
        <el-table-column 
          label="Civilité" 
          prop="civility"
          width="120"
        >
          <template #default="{ row }">
            {{ getCivilityLabel(row.civility) }}
          </template>
        </el-table-column>

        <el-table-column 
          label="Nom" 
          prop="lastname"
          min-width="120"
        />

        <el-table-column 
          label="Prénom" 
          prop="firstname"
          min-width="120"
        />

        <el-table-column 
          label="Situation" 
          prop="family_situation"
          min-width="120"
        >
          <template #default="{ row }">
            {{ getFamilySituationLabel(row.family_situation) }}
          </template>
        </el-table-column>

        <el-table-column 
          label="Diplôme" 
          prop="diploma.name"
          min-width="150"
        />

        <el-table-column 
          label="Qualification" 
          prop="qualification.name"
          min-width="150"
        />

        <el-table-column
          fixed="right"
          label="Actions"
          width="180"
          align="center"
        >
          <template #default="{ row }">
            <el-button-group class="action-group">
              <el-button
                type="primary"
                @click="handleDetail(row)"
                class="action-button"
              >
                <Icon icon="mdi:eye" />
              </el-button>

              <el-button
                type="warning"
                @click="handleEdit(row)"
                class="action-button"
              >
                <Icon icon="mdi:pencil" />
              </el-button>

              <el-button
                type="danger"
                @click="handleDelete(row)"
                class="action-button"
              >
                <Icon icon="mdi:delete" />
              </el-button>
            </el-button-group>
          </template>
        </el-table-column>
      </el-table>

      <div class="pagination-container">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :total="filteredProfessors.length"
          :page-sizes="[10, 20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @size-change="handleSizeChange"
          @current-change="handlePageChange"
        />
      </div>
    </el-card>
  </div>
</template>

<style scoped>
.professor-table-container {
  padding: 20px;
  background-color: #f0f2f5;
  min-height: calc(100vh - 40px);
}

.table-card {
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
}

.card-header {
  padding: 16px 20px;
  background-color: white;
}

.header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-icon {
  font-size: 24px;
  color: var(--el-color-primary);
}

.total-count {
  margin-left: auto;
}

.header-actions {
  margin-top: 16px;
  display: flex;
  gap: 16px;
  align-items: center;
}

.search-input {
  width: 300px;
}

.action-buttons {
  display: flex;
  gap: 8px;
}

.action-group {
  display: flex;
  gap: 4px;
}

.action-button {
  padding: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
}

:deep(.el-table) {
  --el-table-header-bg-color: #f5f7fa;
  --el-table-row-hover-bg-color: #ecf5ff;
}

:deep(.el-table th) {
  font-weight: 600;
  color: #606266;
  background-color: #f5f7fa;
}

:deep(.el-pagination) {
  padding: 16px;
  background-color: white;
  border-top: 1px solid #ebeef5;
}

.iconify {
  font-size: 18px;
}
</style>