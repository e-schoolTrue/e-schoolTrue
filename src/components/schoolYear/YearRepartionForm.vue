<template>
  <el-form 
    @submit.prevent="submitForm" 
    label-width="120px" 
    :model="form" 
    :rules="rules"
    ref="formRef"
  >
    <el-form-item label="Année Scolaire" prop="schoolYear">
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
      <div 
        v-for="(period, index) in form.periodConfigurations" 
        :key="index" 
        class="period-item"
      >
        <el-row :gutter="10">
          <el-col :span="8">
            <el-input 
              v-model="period.name" 
              :placeholder="`${periodType === 'semester' ? 'Semestre' : 'Trimestre'} ${index + 1}`"
              disabled
            />
          </el-col>
          <el-col :span="8">
            <el-form-item 
              :prop="`periodConfigurations.${index}.start`" 
              :rules="dateRules(`periodConfigurations.${index}.start`)"
            >
              <el-date-picker 
                v-model="period.start" 
                type="date" 
                placeholder="Date de début" 
                :format="'YYYY-MM-DD'"
                value-format="YYYY-MM-DD"
                :disabled-date="(date: Date) => disabledStartDate(date, index)"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item 
              :prop="`periodConfigurations.${index}.end`" 
              :rules="dateRules(`periodConfigurations.${index}.end`)"
            >
              <el-date-picker 
                v-model="period.end" 
                type="date" 
                placeholder="Date de fin" 
                :format="'YYYY-MM-DD'"
                value-format="YYYY-MM-DD"
                :disabled-date="(date: Date) => disabledEndDate(date, index)"
              />
            </el-form-item>
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
import { ref, watch, computed } from 'vue'
import { ElMessage, ElForm } from 'element-plus'
import type { FormInstance, FormRules } from 'element-plus'
import { 
    YearRepartition, 
    PeriodConfiguration, 
    YearRepartitionCreateInput, 
    YearRepartitionUpdateInput 
} from '@/types/year'

interface Props {
  initialData?: YearRepartition | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'submit', data: YearRepartitionCreateInput | YearRepartitionUpdateInput): void
  (e: 'cancel'): void
}>()

const formRef = ref<FormInstance>()
const isSubmitting = ref(false)
const periodType = ref<'semester' | 'trimester'>('semester')

const createDefaultPeriods = (type: 'semester' | 'trimester'): PeriodConfiguration[] => {
  const count = type === 'semester' ? 2 : 3
  return Array.from({ length: count }, (_, index) => ({
    name: `${type === 'semester' ? 'Semestre' : 'Trimestre'} ${index + 1}`,
    start: null as any,
    end: null as any
  }))
}

const form = ref<YearRepartition>({
  schoolYear: '',
  periodConfigurations: createDefaultPeriods(periodType.value)
})

const isEditing = computed(() => !!props.initialData?.id)

const rules = ref<FormRules>({
  schoolYear: [
    { 
      required: true, 
      message: 'L\'année scolaire est requise', 
      trigger: 'blur' 
    },
    { 
      pattern: /^\d{4}-\d{4}$/, 
      message: 'Le format doit être AAAA-AAAA', 
      trigger: 'blur' 
    }
  ]
})

const dateRules = (_path: string) => [
  { 
    required: true, 
    message: 'La date est requise', 
    trigger: 'change' 
  }
]

const disabledStartDate = (date: Date, index: number) => {
  if (index > 0) {
    const previousPeriodEnd = form.value.periodConfigurations[index - 1].end
    return previousPeriodEnd ? new Date(previousPeriodEnd) >= date : false
  }
  return false
}

const disabledEndDate = (date: Date, index: number) => {
  const currentPeriod = form.value.periodConfigurations[index]
  const nextPeriod = form.value.periodConfigurations[index + 1]

  if (!currentPeriod) return false

  // La date de fin doit être après la date de début
  if (currentPeriod.start && new Date(currentPeriod.start) >= date) {
    return true
  }

  // Si un période suivante existe, la date de fin doit être avant son début
  if (nextPeriod && nextPeriod.start) {
    return new Date(date) >= new Date(nextPeriod.start)
  }

  return false
}

const handlePeriodTypeChange = (type: 'semester' | 'trimester') => {
  form.value.periodConfigurations = createDefaultPeriods(type)
}

const submitForm = async () => {
  if (!formRef.value) return

  try {
    // Validation globale du formulaire
    await formRef.value.validate()

    // Validation personnalisée supplémentaire
    const hasOverlap = form.value.periodConfigurations.some((period, index) => {
      if (index < form.value.periodConfigurations.length - 1) {
        const nextPeriod = form.value.periodConfigurations[index + 1]
        return new Date(period.end as string) >= new Date(nextPeriod.start as string)
      }
      return false
    })

    if (hasOverlap) {
      ElMessage.error('Les périodes ne peuvent pas se chevaucher')
      return
    }

    isSubmitting.value = true
    
    // Préparer les données selon qu'il s'agit d'une création ou d'une mise à jour
    if (isEditing.value) {
      const updateData: YearRepartitionUpdateInput = {
        schoolYear: form.value.schoolYear,
        periodConfigurations: form.value.periodConfigurations
      }
      emit('submit', updateData)
    } else {
      const createData: YearRepartitionCreateInput = {
        schoolYear: form.value.schoolYear,
        periodConfigurations: form.value.periodConfigurations
      }
      emit('submit', createData)
    }
  } catch (error) {
    console.error('Validation error:', error)
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
    periodType.value = newValue.periodConfigurations.length === 2 ? 'semester' : 'trimester'
  } else {
    form.value = {
      schoolYear: '',
      periodConfigurations: createDefaultPeriods(periodType.value)
    }
  }
}, { immediate: true })
</script>

<style scoped>
.period-item {
  margin-bottom: 20px;
}

.submit-btn {
  width: 100%;
  margin-top: 20px;
}

:deep(.el-form-item.is-error .el-input__wrapper ){
  box-shadow: 0 0 0 1px red !important;
}

:deep(.el-form-item__error) {
  color: red;
  font-size: 12px;
  padding-top: 4px;
}
</style>