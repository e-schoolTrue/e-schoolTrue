<template>
  <el-form @submit.prevent="submitForm" label-width="120px">
    <el-form-item label="Année Scolaire">
      <el-input 
        v-model="form.schoolYear" 
        placeholder="Ex : 2024-2025" 
        clearable
      />
    </el-form-item>

    <el-form-item label="Type de période">
      <el-radio-group v-model="periodType" @change="handlePeriodTypeChange">
        <el-radio label="semester">Semestre</el-radio>
        <el-radio label="trimester">Trimestre</el-radio>
      </el-radio-group>
    </el-form-item>

    <el-form-item label="Périodes">
      <div v-for="(period, index) in form.periodConfigurations" :key="index" class="period-item">
        <el-row :gutter="10">
          <el-col :span="8">
            <el-input 
              v-model="period.name" 
              :placeholder="`${periodType === 'semester' ? 'Semestre' : 'Trimestre'} ${index + 1}`"
              disabled
            />
          </el-col>
          <el-col :span="8">
            <el-date-picker 
              v-model="period.start" 
              type="date" 
              placeholder="Date de début" 
              :format="'YYYY-MM-DD'"
              value-format="YYYY-MM-DD"
            />
          </el-col>
          <el-col :span="8">
            <el-date-picker 
              v-model="period.end" 
              type="date" 
              placeholder="Date de fin" 
              :format="'YYYY-MM-DD'"
              value-format="YYYY-MM-DD"
            />
          </el-col>
        </el-row>
      </div>
    </el-form-item>

    <el-form-item>
      <el-button 
        type="primary" 
        native-type="submit" 
        :loading="isSubmitting"
        class="submit-btn"
      >
        {{ isEditing ? 'Mettre à jour' : 'Créer' }} la Répartition
      </el-button>
    </el-form-item>
  </el-form>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { ElMessage } from 'element-plus'

interface Period {
  name: string
  start: string | null
  end: string | null
}

interface YearRepartition {
  id?: string | number
  schoolYear: string
  periodConfigurations: Period[]
}

const emit = defineEmits(['submit'])

const props = defineProps<{
  initialData?: YearRepartition | null
}>()

const periodType = ref<'semester' | 'trimester'>('semester')
const isEditing = ref(!!props.initialData?.id)
const isSubmitting = ref(false)

const createDefaultPeriods = (type: 'semester' | 'trimester') => {
  const count = type === 'semester' ? 2 : 3
  return Array.from({ length: count }, (_, index) => ({
    name: `${type === 'semester' ? 'Semestre' : 'Trimestre'} ${index + 1}`,
    start: null,
    end: null
  }))
}

const form = ref<YearRepartition>({
  schoolYear: props.initialData?.schoolYear || '',
  periodConfigurations: props.initialData?.periodConfigurations || createDefaultPeriods('semester')
})

const handlePeriodTypeChange = (type: 'semester' | 'trimester') => {
  form.value.periodConfigurations = createDefaultPeriods(type)
}

const validateForm = () => {
  if (!form.value.schoolYear) {
    ElMessage.error('L\'année scolaire est requise')
    return false
  }

  if (form.value.periodConfigurations.some(p => !p.start || !p.end)) {
    ElMessage.error('Toutes les dates doivent être remplies')
    return false
  }

  // Vérifier que les dates sont cohérentes
  for (let i = 0; i < form.value.periodConfigurations.length - 1; i++) {
    const currentPeriod = form.value.periodConfigurations[i]
    const nextPeriod = form.value.periodConfigurations[i + 1]
    
    if (new Date(currentPeriod.end!) >= new Date(nextPeriod.start!)) {
      ElMessage.error('Les périodes ne peuvent pas se chevaucher')
      return false
    }
  }

  return true
}

const submitForm = async () => {
  if (!validateForm()) return

  isSubmitting.value = true
  try {
    const formData = {
      ...form.value,
      id: props.initialData?.id
    }
    emit('submit', JSON.parse(JSON.stringify(formData)))
  } catch (error) {
    ElMessage.error('Échec de l\'enregistrement de la répartition')
    console.error(error)
  } finally {
    isSubmitting.value = false
  }
}

watch(() => props.initialData, (newValue) => {
  if (newValue) {
    form.value = {
      schoolYear: newValue.schoolYear,
      periodConfigurations: [...newValue.periodConfigurations]
    }
    // Déterminer le type de période en fonction du nombre de périodes
    periodType.value = newValue.periodConfigurations.length === 2 ? 'semester' : 'trimester'
    isEditing.value = !!newValue.id
  } else {
    form.value = {
      schoolYear: '',
      periodConfigurations: createDefaultPeriods(periodType.value)
    }
    isEditing.value = false
  }
}, { deep: true })
</script>

<style scoped>
.period-item {
  margin-bottom: 20px;
}

.submit-btn {
  width: 100%;
  margin-top: 20px;
}
</style>