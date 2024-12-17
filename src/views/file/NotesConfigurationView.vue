<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { 
  Document, 
  Plus, 
  Delete, 
  Edit, 
  Search,
  DataAnalysis 
} from '@element-plus/icons-vue'
import { 
  ElTable, 
  ElTableColumn, 
  ElCard, 
  ElButton, 
  ElDialog, 
  ElForm, 
  ElFormItem, 
  ElInput, 
  ElMessageBox,
  ElMessage,
  ElRow,
  ElCol,
  ElTag
} from 'element-plus'

// Interfaces pour typer nos données
interface GradeCategory {
  id: number
  name: string
  weight: number
  coefficient: number
}

interface GradeConfiguration {
  categories: GradeCategory[]
  passingGrade: number
  maxGrade: number
}

// Configuration initiale des notes
const gradeConfig = reactive<GradeConfiguration>({
  categories: [
    { id: 1, name: 'Contrôle Continu', weight: 0.4, coefficient: 2 },
    { id: 2, name: 'Examen', weight: 0.6, coefficient: 3 }
  ],
  passingGrade: 10,
  maxGrade: 20
})

// États pour le dialogue de modification
const dialogVisible = ref(false)
const currentCategory = reactive<GradeCategory>({
  id: 0,
  name: '',
  weight: 0,
  coefficient: 1
})

// Calcul du total des poids
const totalWeight = computed(() => {
  return gradeConfig.categories.reduce((sum, cat) => sum + cat.weight, 0)
})

// Validation du total des poids
const isWeightValid = computed(() => {
  return Math.abs(totalWeight.value - 1) < 0.01
})

// Méthodes de gestion des catégories
const openAddCategoryDialog = () => {
  Object.assign(currentCategory, {
    id: Date.now(),
    name: '',
    weight: 0,
    coefficient: 1
  })
  dialogVisible.value = true
}

const openEditCategoryDialog = (category: GradeCategory) => {
  Object.assign(currentCategory, { ...category })
  dialogVisible.value = true
}

const saveCategory = () => {
  // Vérification des données
  if (!currentCategory.name || currentCategory.weight <= 0) {
    ElMessage.error('Veuillez remplir tous les champs correctement')
    return
  }

  const index = gradeConfig.categories.findIndex(c => c.id === currentCategory.id)
  
  if (index !== -1) {
    // Mise à jour d'une catégorie existante
    gradeConfig.categories[index] = { ...currentCategory }
  } else {
    // Ajout d'une nouvelle catégorie
    gradeConfig.categories.push({ ...currentCategory })
  }

  dialogVisible.value = false
}

const deleteCategory = (id: number) => {
  ElMessageBox.confirm(
    'Voulez-vous vraiment supprimer cette catégorie ?',
    'Confirmation de suppression',
    {
      confirmButtonText: 'Supprimer',
      cancelButtonText: 'Annuler',
      type: 'warning'
    }
  ).then(() => {
    gradeConfig.categories = gradeConfig.categories.filter(cat => cat.id !== id)
    ElMessage.success('Catégorie supprimée avec succès')
  }).catch(() => {
    ElMessage.info('Suppression annulée')
  })
}

// Sauvegarde de la configuration
const saveConfiguration = () => {
  if (!isWeightValid.value) {
    ElMessage.error('La somme des poids doit être égale à 1 (100%)')
    return
  }

  // Logique de sauvegarde (à implémenter selon votre backend)
  console.log('Configuration des notes sauvegardée:', gradeConfig)
  ElMessage.success('Configuration des notes sauvegardée avec succès')
}
</script>

<template>
  <div class="grade-config-container">
    <el-card shadow="hover" class="grade-config-card">
      <template #header>
        <div class="card-header">
          <el-icon :size="24" color="#409EFF">
            <DataAnalysis />
          </el-icon>
          <span class="card-title">Configuration Avancée des Notes</span>
        </div>
      </template>

      <el-row :gutter="20" class="config-summary">
        <el-col :span="8">
          <div class="summary-item">
            <span class="label">Note de Passage</span>
            <el-tag type="success" effect="dark">
              {{ gradeConfig.passingGrade }}/{{ gradeConfig.maxGrade }}
            </el-tag>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="summary-item">
            <span class="label">Total Poids</span>
            <el-tag :type="isWeightValid ? 'success' : 'danger'" effect="dark">
              {{ (totalWeight * 100).toFixed(2) }}%
            </el-tag>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="summary-item">
            <span class="label">Nb. Catégories</span>
            <el-tag type="info" effect="dark">
              {{ gradeConfig.categories.length }}
            </el-tag>
          </div>
        </el-col>
      </el-row>

      <el-table 
        :data="gradeConfig.categories" 
        stripe 
        style="width: 100%"
        class="categories-table"
      >
        <el-table-column prop="name" label="Nom de la Catégorie" width="200" />
        <el-table-column label="Poids" width="150">
          <template #default="scope">
            {{ (scope.row.weight * 100).toFixed(2) }}%
          </template>
        </el-table-column>
        <el-table-column label="Coefficient" width="150">
          <template #default="scope">
            {{ scope.row.coefficient }}
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="200">
          <template #default="scope">
            <el-button 
              type="primary" 
              size="small" 
              :icon="Edit"
              @click="openEditCategoryDialog(scope.row)"
            >
              Modifier
            </el-button>
            <el-button 
              type="danger" 
              size="small" 
              :icon="Delete"
              @click="deleteCategory(scope.row.id)"
            >
              Supprimer
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="action-buttons">
        <el-button 
          type="success" 
          :icon="Plus"
          @click="openAddCategoryDialog"
        >
          Ajouter une Catégorie
        </el-button>
        <el-button 
          type="primary" 
          :icon="Document"
          @click="saveConfiguration"
          :disabled="!isWeightValid"
        >
          Sauvegarder la Configuration
        </el-button>
      </div>
    </el-card>

    <!-- Dialogue de configuration des catégories -->
    <el-dialog 
      v-model="dialogVisible" 
      :title="currentCategory.id ? 'Modifier Catégorie' : 'Ajouter une Catégorie'"
    >
      <el-form label-position="top">
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Nom de la Catégorie">
              <el-input 
                v-model="currentCategory.name" 
                placeholder="Ex: Contrôle Continu"
              >
                <template #prefix>
                  <el-icon><Document /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="Poids (%)">
              <el-input 
                v-model.number="currentCategory.weight" 
                type="number" 
                :min="0" 
                :max="1" 
                step="0.1"
                placeholder="Entre 0 et 1"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Coefficient">
              <el-input 
                v-model.number="currentCategory.coefficient" 
                type="number" 
                :min="1" 
                placeholder="Coefficient"
              >
                <template #prefix>
                  <el-icon><DataAnalysis /></el-icon>
                </template>
              </el-input>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">Annuler</el-button>
        <el-button type="primary" @click="saveCategory">
          {{ currentCategory.id ? 'Mettre à Jour' : 'Ajouter' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.grade-config-container {
  max-width: 1000px;
  margin: 0 auto;
  padding: 20px;
}

.grade-config-card {
  border-radius: 12px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.card-header {
  display: flex;
  align-items: center;
  gap: 10px;
}

.card-title {
  font-size: 18px;
  font-weight: bold;
  color: #409EFF;
}

.config-summary {
  margin-bottom: 20px;
  text-align: center;
}

.summary-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.summary-item .label {
  font-weight: bold;
  color: #606266;
}

.categories-table {
  margin-bottom: 20px;
}

.action-buttons {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
</style>