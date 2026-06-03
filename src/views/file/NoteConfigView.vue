<template>
  <div class="note-config-view">
    <!-- En-tête compact avec sélection intégrée -->
    <div class="page-header">
      <div class="header-left">
        <h1><el-icon><Setting /></el-icon> Configuration de la Notation</h1>
        <div class="selectors-inline">
          <el-select
            v-model="context.classId"
            placeholder="Choisir une classe"
            clearable
            filterable
            @change="onClassChange"
            style="width: 220px"
          >
            <el-option
              v-for="classe in classesList"
              :key="classe.id"
              :label="classe.name"
              :value="classe.id"
            />
          </el-select>
          
          <el-select
            v-if="context.classId"
            v-model="context.subjectId"
            placeholder="Toutes les matières"
            clearable
            filterable
            @change="loadConfig"
            style="width: 200px"
          >
            <el-option
              v-for="subject in subjectsList"
              :key="subject.id"
              :label="subject.name"
              :value="subject.id"
            />
          </el-select>

          <el-select
            v-if="context.classId"
            v-model="selectedPeriod"
            placeholder="Toutes les périodes"
            clearable
            @change="loadConfig"
            style="width: 180px"
          >
            <el-option
              v-for="period in periods"
              :key="period"
              :label="period"
              :value="period"
            />
          </el-select>

          <el-tag v-if="existingConfig" type="success" effect="light">
            <el-icon><SuccessFilled /></el-icon>
            Config trouvée
          </el-tag>
        </div>
      </div>
      <el-button 
        type="primary" 
        @click="saveConfig"
        :loading="saving"
        :disabled="!context.classId"
      >
        <el-icon><Check /></el-icon>
        Enregistrer
      </el-button>
    </div>

    <!-- Contenu principal -->
    <div v-if="context.classId" class="config-content" v-loading="loading">
      <el-row :gutter="20">
        <!-- Paramètres généraux -->
        <el-col :span="9">
          <el-card class="param-card compact-card">
            <template #header>
              <h3><el-icon><Setting /></el-icon> Paramètres</h3>
            </template>

            <el-form label-position="top" :model="form" class="param-form compact-form">
              <el-form-item label="Note finale sur">
                <el-radio-group v-model="form.finalGradeBase" class="base-radios">
                  <el-radio-button :value="10">10</el-radio-button>
                  <el-radio-button :value="20">20</el-radio-button>
                  <el-radio-button :value="100">100</el-radio-button>
                </el-radio-group>
              </el-form-item>

              <el-form-item label="Méthode">
                <el-select v-model="form.calculationStrategy" style="width: 100%">
                  <el-option value="WEIGHTED" label="Pondérée (avec coefficients)" />
                  <el-option value="SIMPLE" label="Simple (toutes égales)" />
                </el-select>
              </el-form-item>

              <el-form-item label="Normalisation">
                <el-switch 
                  v-model="form.normalizeScores"
                  active-text="Convertir sur base commune"
                  inactive-text="Garder bases originales"
                  style="--el-switch-on-color: #10b981"
                />
              </el-form-item>
            </el-form>

            <!-- Formule compacte -->
            <el-alert 
              type="info" 
              :closable="false"
              :title="form.calculationStrategy === 'WEIGHTED' ? 'Formule: Σ(Note×Coef) / ΣCoef' : 'Formule: ΣNotes / Nb'"
              show-icon
            />
          </el-card>
        </el-col>

        <!-- Types d'évaluations -->
        <el-col :span="15">
          <el-card class="categories-card compact-card">
            <template #header>
              <div class="card-header-flex">
                <h3><el-icon><Document /></el-icon> Types d'Évaluations ({{ form.categories.length }})</h3>
                <div class="header-actions">
                  <el-button-group size="small">
                    <el-button @click="applyPreset('simple')">Simple</el-button>
                    <el-button @click="applyPreset('standard')">Standard</el-button>
                    <el-button @click="applyPreset('avance')">Avancé</el-button>
                  </el-button-group>
                  <el-button type="primary" @click="addCategory">
                    <el-icon><Plus /></el-icon>
                  </el-button>
                </div>
              </div>
            </template>

            <!-- Liste scrollable -->
            <div class="categories-list scrollable-list">
              <div 
                v-for="(cat, index) in form.categories" 
                :key="index"
                class="category-card compact-category"
                :style="{ borderLeftColor: cat.color }"
              >
                <div class="category-row">
                  <el-color-picker v-model="cat.color" size="small" :predefine="presetColors" />
                  <span class="cat-num">{{ index + 1 }}</span>
                  <el-input 
                    v-model="cat.name" 
                    placeholder="Nom"
                    size="small"
                    @blur="generateCode(cat)"
                    style="flex: 1"
                  />
                  <el-input 
                    v-model="cat.code" 
                    placeholder="CODE"
                    size="small"
                    maxlength="5"
                    @input="cat.code = cat.code?.toUpperCase()"
                    style="width: 70px"
                  />
                  <el-input-number 
                    v-model="cat.defaultMaxScore" 
                    :min="1" 
                    :max="1000"
                    size="small"
                    controls-position="right"
                    style="width: 90px"
                  />
                  <el-input-number 
                    v-model="cat.weight" 
                    :min="0.1" 
                    :max="100"
                    :step="0.5"
                    :precision="1"
                    size="small"
                    controls-position="right"
                    style="width: 80px"
                    :disabled="form.calculationStrategy === 'SIMPLE'"
                  />
                  <el-tooltip content="Notes de classe groupées / Examen individuel">
                    <el-checkbox 
                      v-model="cat.isExam"
                      size="small"
                      style="margin: 0 8px"
                    >
                      <el-icon v-if="cat.isExam" color="#e74c3c"><Star /></el-icon>
                      <span v-else style="font-size: 0.75rem;">Exam</span>
                    </el-checkbox>
                  </el-tooltip>
                  <el-button 
                    type="danger" 
                    text
                    :icon="Delete" 
                    size="small"
                    @click="removeCategory(index)"
                    :disabled="form.categories.length <= 1"
                  />
                </div>
              </div>

              <el-empty 
                v-if="form.categories.length === 0" 
                description="Aucune catégorie"
                :image-size="80"
              >
                <el-button type="primary" size="small" @click="addCategory">
                  <el-icon><Plus /></el-icon>
                  Ajouter
                </el-button>
              </el-empty>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue';
import { 
  Delete, Plus, Setting, 
  Check, Document, SuccessFilled, Star
} from '@element-plus/icons-vue';
import { ElMessage, ElMessageBox } from 'element-plus';

type CalculationStrategy = 'WEIGHTED' | 'SIMPLE';

interface CategoryItem {
  name: string;
  code: string;
  weight: number;
  defaultMaxScore: number;
  color: string;
  displayOrder: number;
  isExam: boolean;
}

interface ConfigForm {
  finalGradeBase: number;
  calculationStrategy: CalculationStrategy;
  normalizeScores: boolean;
  description: string;
  categories: CategoryItem[];
}

interface ExistingConfig {
  id: number;
  updatedAt: string;
}

// État
const loading = ref(false);
const saving = ref(false);

const context = reactive({
  schoolId: 1,
  classId: null as number | null,
  subjectId: null as number | null
});

const classesList = ref<{ id: number; name: string; code: string }[]>([]);
const subjectsList = ref<{ id: number; name: string; coefficient: number }[]>([]);
const existingConfig = ref<ExistingConfig | null>(null);
const periods = ref<string[]>([]);
const selectedPeriod = ref<string | null>(null);

const presetColors = [
  '#3498db', '#e74c3c', '#2ecc71', '#f39c12', 
  '#9b59b6', '#1abc9c', '#e67e22', '#16a085'
];

const form = reactive<ConfigForm>({
  finalGradeBase: 20,
  calculationStrategy: 'WEIGHTED' as CalculationStrategy,
  normalizeScores: true,
  description: '',
  categories: []
});

// Lifecycle
onMounted(async () => {
  await loadSchoolInfo();
  await loadReferenceData();
  await loadPeriods();
});

const loadPeriods = async () => {
  try {
    const yearRes = await window.ipcRenderer.invoke('yearRepartition:getCurrent');
    if (yearRes.success && yearRes.data) {
      periods.value = yearRes.data.periodConfigurations?.map((p: any) => p.name) || [];
    }
  } catch (error) {
    console.error('Erreur chargement périodes:', error);
  }
};

const loadSchoolInfo = async () => {
  try {
    const result = await window.ipcRenderer.invoke('school:get');
    if (result?.success && result.data?.id) {
      context.schoolId = result.data.id;
    }
  } catch (error) {
    console.error('Erreur chargement école:', error);
  }
};

const loadReferenceData = async () => {
  try {
    const gradesRes = await window.ipcRenderer.invoke('grade:all');
    if (gradesRes.success) {
      classesList.value = gradesRes.data || [];
    }
  } catch (error) {
    console.error('Erreur chargement données:', error);
  }
};

const onClassChange = async () => {
  context.subjectId = null;
  selectedPeriod.value = null;
  
  // Charger les matières de la classe
  if (context.classId) {
    try {
      const coursesRes = await window.ipcRenderer.invoke('course:getByGrade', context.classId);
      if (coursesRes.success) {
        subjectsList.value = coursesRes.data || [];
      }
    } catch (error) {
      console.error('Erreur chargement matières:', error);
    }
  }
  
  await loadConfig();
};

const loadConfig = async () => {
  if (!context.classId) return;

  loading.value = true;
  try {
    const response = await window.ipcRenderer.invoke('grade-config:get', {
      schoolId: context.schoolId,
      classId: context.classId,
      subjectId: context.subjectId,
      period: selectedPeriod.value
    });

    if (response.success && response.data) {
      const data = response.data;
      form.finalGradeBase = data.finalGradeBase;
      form.calculationStrategy = data.calculationStrategy || 'WEIGHTED';
      form.normalizeScores = data.normalizeScores ?? true;
      form.description = data.description || '';
      form.categories = data.categories.map((cat: any, index: number) => ({
        name: cat.name,
        code: cat.code || '',
        weight: cat.weight,
        defaultMaxScore: cat.defaultMaxScore,
        color: cat.color || presetColors[index % presetColors.length],
        displayOrder: cat.displayOrder || index,
        isExam: cat.isExam || false
      }));
      existingConfig.value = {
        id: data.id,
        updatedAt: data.updatedAt
      };
    } else {
      resetToDefaults();
      existingConfig.value = null;
    }
  } catch (error) {
    console.error('Erreur chargement config:', error);
    ElMessage.error('Impossible de charger la configuration');
    resetToDefaults();
  } finally {
    loading.value = false;
  }
};

const resetToDefaults = () => {
  form.finalGradeBase = 20;
  form.calculationStrategy = 'WEIGHTED';
  form.normalizeScores = true;
  form.description = '';
  form.categories = [
    { name: 'Devoir', code: 'DEV', weight: 1, defaultMaxScore: 20, color: '#3498db', displayOrder: 0, isExam: false }
  ];
};

const saveConfig = async () => {
  if (!context.classId) {
    ElMessage.warning('Veuillez sélectionner une classe.');
    return;
  }

  if (form.categories.length === 0) {
    ElMessage.warning('Ajoutez au moins un type d\'évaluation.');
    return;
  }

  const emptyNames = form.categories.filter(c => !c.name.trim());
  if (emptyNames.length > 0) {
    ElMessage.warning('Tous les types d\'évaluation doivent avoir un nom.');
    return;
  }

  saving.value = true;
  try {
    const payload = {
      schoolId: context.schoolId,
      classId: context.classId,
      subjectId: context.subjectId,
      period: selectedPeriod.value,
      finalGradeBase: form.finalGradeBase,
      calculationStrategy: form.calculationStrategy,
      normalizeScores: form.normalizeScores,
      description: form.description || undefined,
      categories: form.categories.map((cat, index) => ({
        name: cat.name.trim(),
        code: cat.code || undefined,
        weight: cat.weight,
        defaultMaxScore: cat.defaultMaxScore,
        color: cat.color,
        displayOrder: index,
        isExam: cat.isExam
      }))
    };

    const response = await window.ipcRenderer.invoke('grade-config:save', payload);

    if (response.success) {
      ElMessage.success('Configuration enregistrée avec succès !');
      await loadConfig();
    } else {
      ElMessage.error(response.message || 'Erreur lors de l\'enregistrement.');
    }
  } catch (error) {
    console.error('Erreur sauvegarde:', error);
    ElMessage.error('Erreur système.');
  } finally {
    saving.value = false;
  }
};

// Gestion catégories
const addCategory = () => {
  const index = form.categories.length;
  form.categories.push({
    name: '',
    code: '',
    weight: 1,
    defaultMaxScore: 20,
    color: presetColors[index % presetColors.length],
    displayOrder: index,
    isExam: false
  });
};

const removeCategory = async (index: number) => {
  if (form.categories.length <= 1) {
    ElMessage.warning('Au moins une catégorie est requise.');
    return;
  }

  try {
    await ElMessageBox.confirm(
      'Supprimer cette catégorie ?',
      'Confirmation',
      { type: 'warning' }
    );
    form.categories.splice(index, 1);
  } catch {
    // Annulé
  }
};

const generateCode = (cat: CategoryItem) => {
  if (!cat.code && cat.name) {
    cat.code = cat.name.substring(0, 3).toUpperCase().replace(/\s/g, '');
  }
};

// Présets
const applyPreset = async (preset: 'simple' | 'standard' | 'avance') => {
  try {
    await ElMessageBox.confirm(
      'Remplacer la configuration actuelle ?',
      'Appliquer un modèle',
      { type: 'info' }
    );

    if (preset === 'simple') {
      form.calculationStrategy = 'SIMPLE';
      form.categories = [
        { name: 'Note', code: 'NOTE', weight: 1, defaultMaxScore: 20, color: '#3498db', displayOrder: 0, isExam: false }
      ];
    } else if (preset === 'standard') {
      form.calculationStrategy = 'WEIGHTED';
      form.categories = [
        { name: 'Devoir', code: 'DEV', weight: 1, defaultMaxScore: 20, color: '#3498db', displayOrder: 0, isExam: false },
        { name: 'Composition', code: 'COM', weight: 2, defaultMaxScore: 20, color: '#e74c3c', displayOrder: 1, isExam: true }
      ];
    } else {
      form.calculationStrategy = 'WEIGHTED';
      form.categories = [
        { name: 'Interrogation', code: 'INT', weight: 1, defaultMaxScore: 10, color: '#2ecc71', displayOrder: 0, isExam: false },
        { name: 'Devoir', code: 'DEV', weight: 2, defaultMaxScore: 20, color: '#3498db', displayOrder: 1, isExam: false },
        { name: 'TP', code: 'TP', weight: 1, defaultMaxScore: 20, color: '#f39c12', displayOrder: 2, isExam: false },
        { name: 'Composition', code: 'COM', weight: 3, defaultMaxScore: 40, color: '#e74c3c', displayOrder: 3, isExam: true }
      ];
    }

    ElMessage.success('Modèle appliqué');
  } catch {
    // Annulé
  }
};
</script>

<style scoped>
.note-config-view {
  height: 100vh;
  background: #f5f7fa;
  padding: 16px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* Header compact */
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 16px;
  flex-shrink: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 20px;
}

.header-left h1 {
  margin: 0;
  font-size: 1.25rem;
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
}

.selectors-inline {
  display: flex;
  align-items: center;
  gap: 12px;
}

.help-icon {
  color: #95a5a6;
  cursor: help;
  font-size: 14px;
}

/* Config content */
.config-content {
  flex: 1;
  overflow: hidden;
}

.config-content :deep(.el-row) {
  height: 100%;
}

.config-content :deep(.el-col) {
  height: 100%;
}

.compact-card {
  border-radius: 8px;
  border: none;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  height: 100%;
  display: flex;
  flex-direction: column;
}

.compact-card :deep(.el-card__header) {
  padding: 12px 16px;
  border-bottom: 1px solid #f0f2f5;
  flex-shrink: 0;
}

.compact-card :deep(.el-card__body) {
  padding: 16px;
  flex: 1;
  overflow: auto;
}

h3 {
  margin: 0;
  font-size: 1rem;
  font-weight: 600;
  color: #2c3e50;
  display: flex;
  align-items: center;
  gap: 6px;
}

.card-header-flex {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

/* Form compact */
.compact-form :deep(.el-form-item) {
  margin-bottom: 16px;
}

.compact-form :deep(.el-form-item__label) {
  font-weight: 500;
  color: #2c3e50;
  margin-bottom: 6px;
  font-size: 0.9rem;
}

.base-radios {
  width: 100%;
}

.base-radios :deep(.el-radio-button) {
  flex: 1;
}

.base-radios :deep(.el-radio-button__inner) {
  width: 100%;
  font-weight: 500;
  padding: 8px 12px;
}


/* Categories compact */
.scrollable-list {
  max-height: calc(100vh - 320px);
  overflow-y: auto;
  padding-right: 4px;
}

.categories-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.compact-category {
  background: white;
  border: 1px solid #e1e4e8;
  border-left: 3px solid #3498db;
  border-radius: 6px;
  padding: 8px 12px;
  transition: all 0.15s;
}

.compact-category:hover {
  box-shadow: 0 2px 6px rgba(0,0,0,0.06);
}

.category-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cat-num {
  background: #2c3e50;
  color: white;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  font-size: 0.8rem;
  flex-shrink: 0;
}

/* Scrollbar */
.scrollable-list::-webkit-scrollbar {
  width: 6px;
}

.scrollable-list::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.scrollable-list::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.scrollable-list::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Responsive */
@media (max-width: 1400px) {
  .header-left {
    flex-wrap: wrap;
  }
  
  .selectors-inline {
    flex-wrap: wrap;
  }
}
</style>
