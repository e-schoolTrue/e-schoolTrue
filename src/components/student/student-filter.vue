<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useYearStore } from '@/stores/yearStore';
import type { IFilterForm, IGradeOption } from '@/types/shared';

const emit = defineEmits(['filter', 'reset']);

/**
 * GARDE-FOU année scolaire (verrou global) :
 * toute l'app est verrouillée sur l'année du badge readonly du menu
 * (store `yearStore.activeYear`). AUCUNE UI année ici — consommation
 * silencieuse : `filterForm.schoolYear` est rempli en interne et transmis
 * au serveur, sans champ visible.
 * Seuls `LoginView` (choix) et `YearRepartitionView`
 * (gouvernance admin) peuvent appeler `setActiveYear` (menu en lecture seule).
 */
const yearStore = useYearStore();

const filterForm = reactive<IFilterForm>({
  schoolYear: '',
  classId: '',
  studentFullName: ''
});

const grades = ref<IGradeOption[]>([]);
const loading = ref(false);

/**
 * Année du menu (badge readonly) : `fetchList()` en interne (canal unique,
 * warm du store) mais AUCUNE liste / switch exposé — consommation silencieuse.
 */
const loadSchoolYears = async () => {
  try {
    const items = yearStore.list.length > 0 ? yearStore.list : await yearStore.fetchList();
    // Verrou : la valeur silencieuse est TOUJOURS l'année du menu.
    if (yearStore.currentSchoolYear) filterForm.schoolYear = yearStore.currentSchoolYear;
    else if (items.length > 0 && !filterForm.schoolYear) await fetchCurrentSchoolYear();
  } catch {
    /* fail-open : valeur conservée */
  }
};

const loadGrades = async () => {
  loading.value = true;
  try {
    const result = await window.ipcRenderer.invoke("grade:all");
    console.log("classes", result);
    if (result?.success && Array.isArray(result.data)) {
      grades.value = result.data.map((grade: { id: number; name: string; }) => ({
        id: grade.id,
        name: grade.name,
        value: grade.id,
        label: grade.name
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
  // Verrou : l'année du menu est conservée au reset (pas de retour multi-années).
  filterForm.schoolYear = yearStore.currentSchoolYear || filterForm.schoolYear;
  filterForm.classId = '';
  filterForm.studentFullName = '';
  emit('reset', { ...filterForm });
};

const fetchCurrentSchoolYear = async () => {
  try {
    // yearStore en priorité (menu), repli IPC direct.
    if (yearStore.currentSchoolYear) {
      filterForm.schoolYear = yearStore.currentSchoolYear;
      return;
    }
    const current = await yearStore.fetchCurrent().catch(() => null);
    if (current?.schoolYear) {
      filterForm.schoolYear = current.schoolYear;
      return;
    }
    const result = await window.ipcRenderer.invoke("yearRepartition:getCurrent");
    if (result.success && result.data) {
      filterForm.schoolYear = result.data.schoolYear;
    }
  } catch (error) {
    console.error("Erreur lors de la récupération de l'année scolaire:", error);
  }
};

onMounted(async () => {
  loadGrades();
  await loadSchoolYears();
  // Verrou : ré-applique l'année du menu après warm.
  await fetchCurrentSchoolYear();
  if (yearStore.currentSchoolYear) filterForm.schoolYear = yearStore.currentSchoolYear;
});
</script>

<template>
  <el-card>
    <el-form :model="filterForm" label-position="top">
      <el-row :gutter="20">
        <el-col :span="12">
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
        <el-col :span="12">
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