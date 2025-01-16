<template>
  <div class="grade-config-form">
    <!-- Pagination -->
    <el-steps :active="currentStep" finish-status="success" simple>
      <el-step title="Configuration Générale" />
      <el-step title="Plages d'appréciation" />
    </el-steps>

    <!-- Configuration Générale -->
    <div v-if="currentStep === 0" class="step-content">
      <h3>Configuration Générale des Notes</h3>
      <el-form :model="config" label-position="top">
        <el-row :gutter="20">
          <el-col :span="8">
            <el-form-item label="Nombre de devoirs">
              <el-input-number 
                v-model="config.numberOfAssignments"
                :min="1"
                :max="10"
                class="w-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="Note maximale devoir">
              <el-input-number
                v-model="config.assignmentMax"
                :min="0"
                :max="20"
                class="w-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="Note maximale examen">
              <el-input-number
                v-model="config.examMax"
                :min="0"
                :max="40"
                class="w-full"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <div class="step-actions">
        <el-button type="primary" @click="nextStep">
          Suivant
          <Icon icon="mdi:arrow-right" class="ml-2" />
        </el-button>
      </div>
    </div>

    <!-- Plages d'appréciation -->
    <div v-else class="step-content">
      <h3>Plages d'appréciation</h3>
      <el-form :model="config" label-position="top">
        <div class="appreciation-ranges">
          <el-row :gutter="20">
            <el-col :span="24">
              <div v-for="(range, key) in config.appreciationRanges" :key="key" class="range-item">
                <span class="range-label">{{ formatRangeLabel(key) }}</span>
                <el-slider
                  v-model="config.appreciationRanges[key]"
                  range
                  :min="0"
                  :max="20"
                  :step="0.01"
                  :disabled="isRangeDisabled(key)"
                />
                <span class="range-values">{{ formatRange(range) }}</span>
              </div>
            </el-col>
          </el-row>
        </div>
      </el-form>

      <div class="step-actions">
        <el-button @click="previousStep">
          <Icon icon="mdi:arrow-left" class="mr-2" />
          Précédent
        </el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';

const props = defineProps<{
  gradeId: number;
}>();

const emit = defineEmits(['saved']);

const saving = ref(false);

const config = ref({
  numberOfAssignments: 2,
  assignmentMax: 20,
  examMax: 40,
  appreciationRanges: {
    excellent: [16, 20],
    veryGood: [14, 15.99],
    good: [12, 13.99],
    passable: [10, 11.99],
    poor: [0, 9.99]
  }
});

const formatRangeLabel = (key: string) => {
  const labels: Record<string, string> = {
    excellent: 'Excellent',
    veryGood: 'Très Bien',
    good: 'Bien',
    passable: 'Passable',
    poor: 'Insuffisant'
  };
  return labels[key] || key;
};

const formatRange = (range: number[]) => {
  return `${range[0]} - ${range[1]}`;
};

const isRangeDisabled = (_key: string) => {
  // Empêcher la modification des plages prédéfinies
  return true;
};

const saveConfig = async () => {
  saving.value = true;
  try {
    if (!props.gradeId) {
      throw new Error('ID de classe manquant');
    }

    const configData = {
      gradeId: props.gradeId,
      numberOfAssignments: config.value.numberOfAssignments,
      assignmentMax: config.value.assignmentMax,
      examMax: config.value.examMax
    };

    console.log('Configuration à sauvegarder:', configData);
    
    const result = await window.ipcRenderer.invoke('gradeConfig:save', configData);
    
    if (!result.success) {
      throw new Error(result.message || 'Erreur lors de la sauvegarde');
    }

    emit('saved');
    ElMessage.success('Configuration enregistrée avec succès');
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error(error instanceof Error ? error.message : 'Erreur lors de la sauvegarde');
    throw error;
  } finally {
    saving.value = false;
  }
};

const loadConfig = async () => {
  try {
    console.log('Chargement de la configuration pour la classe:', props.gradeId);
    const result = await window.ipcRenderer.invoke('gradeConfig:get', {
      gradeId: props.gradeId
    });
    console.log('Résultat du chargement:', result);

    if (result.success && result.data) {
      config.value = {
        ...config.value,
        numberOfAssignments: result.data.numberOfAssignments || 2,
        assignmentMax: result.data.assignmentMax || 20,
        examMax: result.data.examMax || 40
      };
      console.log('Configuration mise à jour:', config.value);
    }
  } catch (error) {
    console.error('Erreur chargement config:', error);
  }
};

// Modifier onMounted pour charger la configuration
onMounted(async () => {
  console.log('GradeConfigForm monté avec gradeId:', props.gradeId);
  await loadConfig();
});

const currentStep = ref(0);

const nextStep = () => {
  currentStep.value++;
};

const previousStep = () => {
  currentStep.value--;
};

defineExpose({
  config,
  saveConfig
});
</script>

<style scoped>
.grade-config-form {
  padding: 20px;
}

.step-content {
  margin: 20px 0;
}

.step-actions {
  margin-top: 20px;
  display: flex;
  justify-content: space-between;
}

.appreciation-ranges {
  margin-top: 20px;
}

.range-item {
  margin-bottom: 20px;
  padding: 10px;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
}

.range-label {
  display: block;
  margin-bottom: 10px;
  font-weight: bold;
  color: var(--el-text-color-regular);
}

.range-values {
  display: block;
  margin-top: 5px;
  color: var(--el-text-color-secondary);
  font-size: 0.9em;
}

.w-full {
  width: 100%;
}

:deep(.el-steps) {
  margin-bottom: 30px;
}

:deep(.el-step__title) {
  font-size: 14px;
}
</style> 