<template>
  <div class="grade-config-form">
    <el-form :model="config" label-position="top">
      <div class="general-config">
        <h3>Configuration Générale des Notes</h3>
        
        <!-- Nombre de devoirs et barèmes -->
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
                :min="20"
                :max="20"
                disabled
                class="w-full"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="Note maximale examen">
              <el-input-number
                v-model="config.examMax"
                :min="40"
                :max="40"
                disabled
                class="w-full"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <!-- Plages d'appréciation -->
        <div class="appreciation-ranges">
          <h4>Plages d'appréciation</h4>
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
      </div>
    </el-form>

    <div class="actions">
      <el-button type="primary" @click="saveConfig" :loading="saving">
        Enregistrer la configuration
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ElMessage } from 'element-plus';

const props = defineProps<{
  gradeId: number;
}>();

const emit = defineEmits(['saved']);

const saving = ref(false);

const config = ref({
  numberOfAssignments: 2,
  assignmentMax: 20, // Fixé à 20
  examMax: 40, // Fixé à 40
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
    // Créer un objet simple et sérialisable
    const configData = {
      gradeId: props.gradeId,
      numberOfAssignments: config.value.numberOfAssignments,
      assignmentMax: 20,
      examMax: 40,
      appreciationRanges: {
        excellent: [16, 20],
        veryGood: [14, 15.99],
        good: [12, 13.99],
        passable: [10, 11.99],
        poor: [0, 9.99]
      }
    };

    console.log('Configuration à sauvegarder:', JSON.stringify(configData, null, 2));
    
    const result = await window.ipcRenderer.invoke('gradeConfig:save', configData);
    
    if (result.success) {
      emit('saved');
      ElMessage.success('Configuration enregistrée avec succès');
    }
  } catch (error) {
    console.error('Erreur:', error);
    ElMessage.error('Erreur lors de la sauvegarde');
  } finally {
    saving.value = false;
  }
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

.general-config {
  margin-bottom: 30px;
}

.appreciation-ranges {
  margin-top: 30px;
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

.actions {
  margin-top: 20px;
  text-align: right;
}
</style> 