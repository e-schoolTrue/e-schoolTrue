<template>
  <div class="simulation-calculator">
    <div class="simulation-header">
      <p class="simulation-description">
        Testez votre configuration en entrant des notes fictives pour voir comment la moyenne sera calculée.
      </p>
    </div>

    <el-row :gutter="24">
      <!-- Entrée des notes -->
      <el-col :span="14">
        <div class="grades-input">
          <div 
            v-for="(category, catIndex) in props.config.categories" 
            :key="catIndex"
            class="category-grades"
            :style="{ '--cat-color': category.color }"
          >
            <div class="category-label">
              <span class="category-badge" :style="{ background: category.color }">
                {{ category.code || category.name.substring(0, 3).toUpperCase() }}
              </span>
              <span class="category-name">{{ category.name }}</span>
              <span class="category-info">
                (sur {{ category.defaultMaxScore }}, coef. {{ category.weight }})
              </span>
            </div>
            
            <div class="grades-row">
              <div 
                v-for="(_, gradeIndex) in simulationGrades[catIndex]" 
                :key="gradeIndex"
                class="grade-input-wrapper"
              >
                <el-input-number
                  v-model="simulationGrades[catIndex][gradeIndex]"
                  :min="0"
                  :max="category.defaultMaxScore"
                  :precision="1"
                  size="small"
                  controls-position="right"
                  @change="calculateSimulation"
                />
                <span class="grade-base">/{{ category.defaultMaxScore }}</span>
                <el-button 
                  v-if="simulationGrades[catIndex].length > 1"
                  type="danger" 
                  circle 
                  size="small"
                  :icon="Close"
                  @click="removeGrade(catIndex, gradeIndex)"
                />
              </div>
              <el-button 
                type="primary" 
                plain 
                size="small"
                :icon="Plus"
                @click="addGrade(catIndex)"
              >
                Note
              </el-button>
            </div>
          </div>
        </div>
      </el-col>

      <!-- Résultat -->
      <el-col :span="10">
        <div class="result-panel">
          <div class="result-header">
            <el-icon><TrendCharts /></el-icon>
            <span>Résultat du calcul</span>
          </div>

          <div class="result-breakdown">
            <div 
              v-for="(result, index) in categoryResults" 
              :key="index"
              class="result-row"
            >
              <div class="result-category">
                <span 
                  class="result-badge"
                  :style="{ background: props.config.categories[index]?.color }"
                >
                  {{ props.config.categories[index]?.code || '?' }}
                </span>
                <span class="result-name">{{ props.config.categories[index]?.name }}</span>
              </div>
              <div class="result-values">
                <span class="result-avg">
                  Moy: <strong>{{ result.average.toFixed(2) }}</strong>
                </span>
                <span v-if="props.config.calculationStrategy === 'WEIGHTED'" class="result-weighted">
                  × {{ props.config.categories[index]?.weight }} = 
                  <strong>{{ result.weighted.toFixed(2) }}</strong>
                </span>
              </div>
            </div>
          </div>

          <div class="result-divider"></div>

          <div class="result-final">
            <div class="final-label">
              <span>Moyenne finale</span>
              <span class="final-base">(sur {{ props.config.finalGradeBase }})</span>
            </div>
            <div class="final-value" :class="getFinalGradeClass()">
              {{ finalAverage.toFixed(2) }}
            </div>
          </div>

          <div v-if="props.config.calculationStrategy === 'WEIGHTED'" class="calculation-detail">
            <el-icon><InfoFilled /></el-icon>
            <span>
              = {{ totalWeighted.toFixed(2) }} ÷ {{ totalCoef.toFixed(1) }}
            </span>
          </div>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { Plus, Close, TrendCharts, InfoFilled } from '@element-plus/icons-vue';

interface CategoryItem {
  name: string;
  code: string;
  weight: number;
  defaultMaxScore: number;
  color: string;
}

interface ConfigForm {
  finalGradeBase: number;
  calculationStrategy: string;
  normalizeScores: boolean;
  categories: CategoryItem[];
}

interface CategoryResult {
  average: number;
  weighted: number;
  grades: number[];
}

const props = defineProps<{
  config: ConfigForm;
}>();

// Notes de simulation (array de arrays)
const simulationGrades = ref<number[][]>([]);
const categoryResults = ref<CategoryResult[]>([]);
const finalAverage = ref(0);
const totalWeighted = ref(0);
const totalCoef = ref(0);

// Initialiser les notes de simulation
const initializeGrades = () => {
  simulationGrades.value = props.config.categories.map(cat => {
    // Une note par défaut pour chaque catégorie
    return [Math.round(cat.defaultMaxScore * 0.6)]; // 60% par défaut
  });
  calculateSimulation();
};

// Ajouter une note
const addGrade = (categoryIndex: number) => {
  const cat = props.config.categories[categoryIndex];
  simulationGrades.value[categoryIndex].push(Math.round(cat.defaultMaxScore * 0.5));
  calculateSimulation();
};

// Supprimer une note
const removeGrade = (categoryIndex: number, gradeIndex: number) => {
  simulationGrades.value[categoryIndex].splice(gradeIndex, 1);
  calculateSimulation();
};

// Calculer la simulation
const calculateSimulation = () => {
  const results: CategoryResult[] = [];
  let sumWeighted = 0;
  let sumCoef = 0;
  let allGrades: number[] = [];

  props.config.categories.forEach((category, index) => {
    const grades = simulationGrades.value[index] || [];
    
    if (grades.length === 0) {
      results.push({ average: 0, weighted: 0, grades: [] });
      return;
    }

    // Calculer la moyenne de la catégorie
    let categoryAvg = grades.reduce((a, b) => a + b, 0) / grades.length;

    // Normaliser si nécessaire
    if (props.config.normalizeScores) {
      categoryAvg = (categoryAvg / category.defaultMaxScore) * props.config.finalGradeBase;
    }

    const weighted = categoryAvg * category.weight;
    
    results.push({
      average: categoryAvg,
      weighted: weighted,
      grades: grades
    });

    sumWeighted += weighted;
    sumCoef += category.weight;

    // Pour la moyenne simple
    grades.forEach(g => {
      const normalized = props.config.normalizeScores 
        ? (g / category.defaultMaxScore) * props.config.finalGradeBase 
        : g;
      allGrades.push(normalized);
    });
  });

  categoryResults.value = results;
  totalWeighted.value = sumWeighted;
  totalCoef.value = sumCoef;

  // Calcul final selon la stratégie
  if (props.config.calculationStrategy === 'SIMPLE') {
    finalAverage.value = allGrades.length > 0 
      ? allGrades.reduce((a, b) => a + b, 0) / allGrades.length 
      : 0;
  } else {
    finalAverage.value = sumCoef > 0 ? sumWeighted / sumCoef : 0;
  }
};

// Classe CSS pour la note finale
const getFinalGradeClass = () => {
  const ratio = finalAverage.value / props.config.finalGradeBase;
  if (ratio >= 0.7) return 'grade-excellent';
  if (ratio >= 0.5) return 'grade-good';
  if (ratio >= 0.4) return 'grade-average';
  return 'grade-poor';
};

// Watcher pour recalculer quand la config change
watch(() => props.config, () => {
  // Réajuster les tableaux si le nombre de catégories change
  if (simulationGrades.value.length !== props.config.categories.length) {
    initializeGrades();
  } else {
    calculateSimulation();
  }
}, { deep: true });

onMounted(() => {
  initializeGrades();
});
</script>

<style scoped>
.simulation-calculator {
  background: #f8fafc;
  border-radius: 8px;
  padding: 20px;
}

.simulation-header {
  margin-bottom: 20px;
}

.simulation-description {
  color: #64748b;
  font-size: 0.9rem;
  margin: 0;
}

/* Grades input */
.grades-input {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.category-grades {
  background: white;
  border-radius: 8px;
  padding: 12px 16px;
  border-left: 3px solid var(--cat-color, #3498db);
}

.category-label {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 12px;
}

.category-badge {
  color: white;
  font-size: 0.7rem;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 4px;
}

.category-name {
  font-weight: 500;
  color: #334155;
}

.category-info {
  font-size: 0.8rem;
  color: #94a3b8;
}

.grades-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.grade-input-wrapper {
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f1f5f9;
  padding: 4px 8px;
  border-radius: 6px;
}

.grade-base {
  font-size: 0.8rem;
  color: #64748b;
}

/* Result panel */
.result-panel {
  background: white;
  border-radius: 12px;
  padding: 20px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.result-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 16px;
  padding-bottom: 12px;
  border-bottom: 1px solid #e2e8f0;
}

.result-breakdown {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.result-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}

.result-category {
  display: flex;
  align-items: center;
  gap: 8px;
}

.result-badge {
  color: white;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 2px 5px;
  border-radius: 3px;
}

.result-name {
  font-size: 0.85rem;
  color: #475569;
}

.result-values {
  display: flex;
  gap: 12px;
  font-size: 0.85rem;
  color: #64748b;
}

.result-values strong {
  color: #334155;
}

.result-divider {
  height: 1px;
  background: linear-gradient(to right, transparent, #e2e8f0, transparent);
  margin: 16px 0;
}

.result-final {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.final-label {
  display: flex;
  flex-direction: column;
}

.final-label span:first-child {
  font-weight: 600;
  color: #334155;
}

.final-base {
  font-size: 0.8rem;
  color: #94a3b8;
}

.final-value {
  font-size: 2rem;
  font-weight: 700;
  padding: 8px 16px;
  border-radius: 8px;
}

.grade-excellent {
  background: linear-gradient(135deg, #d1fae5, #a7f3d0);
  color: #047857;
}

.grade-good {
  background: linear-gradient(135deg, #dbeafe, #bfdbfe);
  color: #1d4ed8;
}

.grade-average {
  background: linear-gradient(135deg, #fef3c7, #fde68a);
  color: #b45309;
}

.grade-poor {
  background: linear-gradient(135deg, #fee2e2, #fecaca);
  color: #b91c1c;
}

.calculation-detail {
  display: flex;
  align-items: center;
  gap: 6px;
  justify-content: flex-end;
  margin-top: 8px;
  font-size: 0.8rem;
  color: #94a3b8;
}
</style>

