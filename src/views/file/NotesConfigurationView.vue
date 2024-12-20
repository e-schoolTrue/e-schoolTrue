<template>
  <div class="notes-config">
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <h2>Configuration des Notes</h2>
        </div>
      </template>

      <el-form :model="form" label-position="top">
        <!-- Sélection de la classe -->
        <el-form-item label="Classe">
          <el-select 
            v-model="form.gradeId" 
            placeholder="Sélectionner une classe"
            @change="loadCourses"
          >
            <el-option 
              v-for="grade in grades" 
              :key="grade.id" 
              :label="grade.name" 
              :value="grade.id" 
            />
          </el-select>
        </el-form-item>

        <!-- Configuration générale -->
        <div class="config-section" v-if="form.gradeId">
          <h3>Configuration Générale</h3>
          <el-row :gutter="20">
            <el-col :span="8">
              <el-form-item label="Note maximale">
                <el-input-number v-model="form.maxNote" :min="0" :max="100" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="Note minimale">
                <el-input-number v-model="form.minNote" :min="0" :max="form.maxNote" />
              </el-form-item>
            </el-col>
            <el-col :span="8">
              <el-form-item label="Note de passage">
                <el-input-number 
                  v-model="form.passingGrade" 
                  :min="form.minNote" 
                  :max="form.maxNote" 
                />
              </el-form-item>
            </el-col>
          </el-row>
        </div>

        <!-- Configuration des coefficients -->
        <div class="config-section" v-if="courses.length">
          <h3>Coefficients par Matière</h3>
          <el-table :data="courses" border>
            <el-table-column prop="name" label="Matière" />
            <el-table-column label="Coefficient" width="200">
              <template #default="{ row }">
                <el-input-number 
                  v-model="form.coefficients[row.id]" 
                  :min="1" 
                  :max="10" 
                  :precision="0"
                />
              </template>
            </el-table-column>
          </el-table>
        </div>

        <!-- Boutons d'action -->
        <div class="actions">
          <el-button type="primary" @click="saveConfiguration" :loading="saving">
            Enregistrer
          </el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { ReportService } from '@/services/reportService';

const reportService = new ReportService();

// États
const grades = ref([]);
const courses = ref([]);
const saving = ref(false);

// Formulaire
const form = reactive({
  gradeId: null,
  maxNote: 20,
  minNote: 0,
  passingGrade: 10,
  coefficients: {} as Record<string, number>
});

// Chargement des données
const loadGrades = async () => {
  const result = await window.ipcRenderer.invoke('grade:all');
  if (result.success) {
    grades.value = result.data;
  }
};

const loadCourses = async () => {
  if (!form.gradeId) return;
  
  const result = await window.ipcRenderer.invoke('course:getByGrade', form.gradeId);
  if (result.success) {
    courses.value = result.data;
    // Initialiser les coefficients
    courses.value.forEach(course => {
      if (!form.coefficients[course.id]) {
        form.coefficients[course.id] = 1;
      }
    });
  }
};

// Sauvegarde de la configuration
const saveConfiguration = async () => {
  saving.value = true;
  try {
    const result = await reportService.saveConfiguration(form);
    if (result.success) {
      ElMessage.success('Configuration enregistrée avec succès');
    } else {
      throw new Error(result.message);
    }
  } catch (error) {
    ElMessage.error("Erreur lors de l'enregistrement de la configuration");
  } finally {
    saving.value = false;
  }
};

// Initialisation
onMounted(() => {
  loadGrades();
});
</script>

<style scoped>
.notes-config {
  padding: 20px;
}

.config-card {
  max-width: 1200px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.config-section {
  margin: 20px 0;
  padding: 20px;
  border: 1px solid #eee;
  border-radius: 4px;
}

.config-section h3 {
  margin-top: 0;
  margin-bottom: 20px;
  color: var(--el-text-color-primary);
}

.actions {
  margin-top: 20px;
  display: flex;
  justify-content: flex-end;
}
</style>
