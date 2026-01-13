<template>
  <el-dialog
    v-model="visible"
    title="Détail du calcul de la moyenne"
    width="600px"
    :close-on-click-modal="false"
  >
    <div v-if="details" class="calculation-detail">
      <el-alert
        :title="`Configuration: ${details.strategy === 'WEIGHTED' ? 'Moyenne Pondérée' : 'Moyenne Simple'}`"
        type="info"
        :closable="false"
        show-icon
        class="mb-3"
      />

      <div class="categories-breakdown">
        <h4>Notes par catégorie:</h4>
        
        <!-- Notes de classe groupées -->
        <div v-if="classCategories.length > 0" class="category-group">
          <div class="group-header">
            <span class="group-title">📚 Notes de classe (coef. 1 au total)</span>
          </div>
          <div 
            v-for="(cat, index) in classCategories" 
            :key="'class-' + index"
            class="category-detail sub-category"
          >
            <div class="category-header">
              <span class="category-name">{{ cat.name }} ({{ cat.code }})</span>
            </div>
            <div v-if="cat.grades.length > 0" class="category-calc">
              <div class="grades-list">
                <span v-for="(g, i) in cat.grades" :key="i" class="grade-item">
                  {{ g.score }}/{{ g.maxScore }}
                  <span v-if="details.normalized" class="normalized">
                    → {{ g.normalized.toFixed(2) }}
                  </span>
                </span>
              </div>
              <div class="category-average">
                Moyenne: <strong>{{ cat.average.toFixed(2) }}</strong>
              </div>
            </div>
            <div v-else class="no-grades">
              <el-icon><Warning /></el-icon>
              Aucune note
            </div>
          </div>
          <div v-if="classCategories.some(c => c.grades.length > 0)" class="group-summary">
            Moyenne globale classe: <strong>{{ classGlobalAverage.toFixed(2) }}</strong>
          </div>
        </div>

        <!-- Examens -->
        <div v-if="examCategories.length > 0" class="category-group">
          <div class="group-header">
            <span class="group-title">⭐ Examens</span>
          </div>
          <div 
            v-for="(cat, index) in examCategories" 
            :key="'exam-' + index"
            class="category-detail"
          >
            <div class="category-header">
              <span class="category-name">{{ cat.name }} ({{ cat.code }})</span>
              <el-tag type="danger" size="small">Coef. {{ cat.weight }}</el-tag>
            </div>
            <div v-if="cat.grades.length > 0" class="category-calc">
              <div class="grades-list">
                <span v-for="(g, i) in cat.grades" :key="i" class="grade-item">
                  {{ g.score }}/{{ g.maxScore }}
                  <span v-if="details.normalized" class="normalized">
                    → {{ g.normalized.toFixed(2) }}
                  </span>
                </span>
              </div>
              <div class="category-average">
                Moyenne: <strong>{{ cat.average.toFixed(2) }}</strong>
              </div>
              <div v-if="details.strategy === 'WEIGHTED'" class="category-weighted">
                Valeur pondérée: {{ cat.average.toFixed(2) }} × {{ cat.weight }} = 
                <strong>{{ (cat.average * cat.weight).toFixed(2) }}</strong>
              </div>
            </div>
            <div v-else class="no-grades">
              <el-icon><Warning /></el-icon>
              Aucune note
            </div>
          </div>
        </div>
      </div>

      <el-divider />

      <div class="final-calculation">
        <h4>Calcul final:</h4>
        <div v-if="details.strategy === 'WEIGHTED'" class="formula">
          <div class="formula-line">
            Somme pondérée: {{ details.totalWeighted.toFixed(2) }}
          </div>
          <div class="formula-line">
            Somme des coefficients: {{ details.totalWeight }}
          </div>
          <div class="formula-result">
            <strong>{{ details.totalWeighted.toFixed(2) }} ÷ {{ details.totalWeight }} = 
            {{ details.finalAverage.toFixed(2) }}</strong>
          </div>
        </div>
        <div v-else class="formula">
          <div class="formula-line">
            Somme des notes: {{ details.totalSum.toFixed(2) }}
          </div>
          <div class="formula-line">
            Nombre de notes: {{ details.totalCount }}
          </div>
          <div class="formula-result">
            <strong>{{ details.totalSum.toFixed(2) }} ÷ {{ details.totalCount }} = 
            {{ details.finalAverage.toFixed(2) }}</strong>
          </div>
        </div>
      </div>

      <el-alert
        :title="`Moyenne finale: ${details.finalAverage.toFixed(2)} / ${details.base}`"
        type="success"
        :closable="false"
        show-icon
        class="mt-3"
      />
    </div>
    
    <template #footer>
      <el-button @click="visible = false">Fermer</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Warning } from '@element-plus/icons-vue';

interface GradeDetail {
  score: number;
  maxScore: number;
  normalized: number;
}

interface CategoryDetail {
  name: string;
  code: string;
  weight: number;
  grades: GradeDetail[];
  average: number;
  isExam?: boolean;
}

interface CalculationDetails {
  strategy: 'WEIGHTED' | 'SIMPLE';
  base: number;
  normalized: boolean;
  categories: CategoryDetail[];
  totalWeighted: number;
  totalWeight: number;
  totalSum: number;
  totalCount: number;
  finalAverage: number;
}

const visible = ref(false);
const details = ref<CalculationDetails | null>(null);

const classCategories = computed(() => 
  details.value?.categories.filter(c => !c.isExam) || []
);

const examCategories = computed(() => 
  details.value?.categories.filter(c => c.isExam) || []
);

const classGlobalAverage = computed(() => {
  const withGrades = classCategories.value.filter(c => c.grades.length > 0);
  if (withGrades.length === 0) return 0;
  const sum = withGrades.reduce((acc, c) => acc + c.average, 0);
  return sum / withGrades.length;
});

const show = (calculationDetails: CalculationDetails) => {
  details.value = calculationDetails;
  visible.value = true;
};

defineExpose({ show });
</script>

<style scoped>
.calculation-detail {
  font-size: 0.9rem;
}

.mb-3 {
  margin-bottom: 16px;
}

.mt-3 {
  margin-top: 16px;
}

h4 {
  margin: 0 0 12px 0;
  color: #2c3e50;
  font-size: 1rem;
}

.categories-breakdown {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
}

.category-group {
  margin-bottom: 20px;
}

.group-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 8px 12px;
  border-radius: 6px;
  margin-bottom: 12px;
  font-weight: 600;
}

.group-title {
  font-size: 0.95rem;
}

.category-detail {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #e0e6ed;
}

.category-detail:last-child {
  margin-bottom: 0;
  padding-bottom: 0;
  border-bottom: none;
}

.sub-category {
  padding-left: 12px;
  border-left: 3px solid #667eea;
}

.group-summary {
  background: #f0f5ff;
  padding: 10px;
  border-radius: 6px;
  margin-top: 8px;
  font-size: 0.95rem;
  color: #2c3e50;
  border-left: 4px solid #1890ff;
}

.category-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.category-name {
  font-weight: 600;
  color: #2c3e50;
}

.category-calc {
  padding-left: 12px;
}

.grades-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 8px;
}

.grade-item {
  background: white;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.85rem;
  border: 1px solid #e0e6ed;
}

.normalized {
  color: #1890ff;
  font-weight: 500;
}

.category-average,
.category-weighted {
  font-size: 0.9rem;
  color: #5a6c7d;
  margin-top: 4px;
}

.category-weighted strong {
  color: #1890ff;
}

.no-grades {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #909399;
  font-size: 0.85rem;
  padding-left: 12px;
}

.final-calculation {
  background: #fff8e1;
  padding: 16px;
  border-radius: 8px;
}

.formula-line {
  margin-bottom: 6px;
  color: #5a6c7d;
}

.formula-result {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 2px solid #ffd54f;
  font-size: 1.1rem;
  color: #2c3e50;
}
</style>

