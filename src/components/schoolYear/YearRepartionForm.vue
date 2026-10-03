<template>
  <el-form
    @submit.prevent="submitForm"
    label-width="120px"
    :model="form"
    :rules="rules"
    ref="formRef"
  >
    <el-form-item label="Niveau" prop="level">
      <el-radio-group v-model="level" @change="handleLevelChange">
        <el-radio-button label="PRESCOLAIRE">Préscolaire</el-radio-button>
        <el-radio-button label="PRIMAIRE">Primaire</el-radio-button>
        <el-radio-button label="SECONDAIRE">Secondaire</el-radio-button>
      </el-radio-group>
      <el-tag
        :type="level === 'SECONDAIRE' ? 'warning' : 'success'"
        effect="plain"
        class="level-badge"
      >
        {{ periodBadge }}
      </el-tag>
    </el-form-item>

    <el-form-item label="Année Scolaire" prop="schoolYear">
      <el-input
        v-model="form.schoolYear"
        placeholder="Ex : 2024-2025"
        clearable
        @change="refreshPresetDates"
      />
    </el-form-item>

    <el-form-item label="Type de période">
      <el-radio-group v-model="periodType" @change="handlePeriodTypeChange">
        <el-radio label="semester">Semestre</el-radio>
        <el-radio label="trimester">Trimestre</el-radio>
      </el-radio-group>
      <el-button link type="primary" @click="applyPreset" class="preset-btn">
        Appliquer le preset {{ presetLabel }}
      </el-button>
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
    YearRepartitionUpdateInput,
    type SchoolLevel,
} from '@/types/year'
import {
  buildPresetPeriods,
  normalizeLevel,
  periodBadgeForLevel,
  periodKindForLevel,
  SCHOOL_LEVEL_LABELS,
} from '@/types/schoolLevel'

interface Props {
  initialData?: YearRepartition | null
  /** Niveau présélectionné (onglet appelant). Défaut : niveau des données ou PRIMAIRE. */
  level?: SchoolLevel | null
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'submit', data: YearRepartitionCreateInput | YearRepartitionUpdateInput): void
  (e: 'cancel'): void
}>()

const formRef = ref<FormInstance>()
const isSubmitting = ref(false)
const level = ref<SchoolLevel>(props.level ?? normalizeLevel(props.initialData?.level) ?? 'PRIMAIRE')
const periodType = ref<'semester' | 'trimester'>(periodKindForLevel(level.value))

const periodBadge = computed(() => periodBadgeForLevel(level.value))
const presetLabel = computed(
  () => `${SCHOOL_LEVEL_LABELS[level.value]} (${periodType.value === 'semester' ? '2 semestres' : '3 trimestres'})`,
)

const createDefaultPeriods = (type: 'semester' | 'trimester', schoolYear?: string): PeriodConfiguration[] => {
  if (schoolYear && /^\d{4}-\d{4}$/.test(schoolYear.trim())) {
    const fakeLevel: SchoolLevel = type === 'semester' ? 'SECONDAIRE' : 'PRIMAIRE'
    return buildPresetPeriods(fakeLevel, schoolYear.trim()).map((p) => ({
      name: p.name,
      start: (p.start || null) as any,
      end: (p.end || null) as any,
    }))
  }
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

/** Applique le preset de dates du niveau pour l'année saisie. */
const applyPreset = () => {
  const periods = buildPresetPeriods(level.value, form.value.schoolYear || '----')
    .map((p) => ({ name: p.name, start: (p.start || null) as any, end: (p.end || null) as any }))
  // `buildPresetPeriods` sans année valide renvoie des périodes vides nommées :
  // on garde les noms, l'utilisateur saisit les dates.
  periodType.value = periodKindForLevel(level.value)
  form.value.periodConfigurations = periods.length > 0
    ? periods
    : createDefaultPeriods(periodType.value)
  ElMessage.info(`Preset ${presetLabel.value} appliqué`)
}

/** Re-calcule les dates du preset quand l'année change (si dates vides). */
const refreshPresetDates = () => {
  if (!/^\d{4}-\d{4}$/.test((form.value.schoolYear || '').trim())) return
  const empty = form.value.periodConfigurations.every((p) => !p.start && !p.end)
  if (!empty) return
  form.value.periodConfigurations = buildPresetPeriods(level.value, form.value.schoolYear.trim())
    .map((p) => ({ name: p.name, start: (p.start || null) as any, end: (p.end || null) as any }))
}

const handleLevelChange = (lv: SchoolLevel) => {
  level.value = lv
  periodType.value = periodKindForLevel(lv)
  form.value.periodConfigurations = createDefaultPeriods(periodType.value, form.value.schoolYear)
}

const handlePeriodTypeChange = (type: 'semester' | 'trimester') => {
  form.value.periodConfigurations = createDefaultPeriods(type, form.value.schoolYear)
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
    if (isEditing.value && props.initialData?.id) {
      const updateData: YearRepartitionUpdateInput & { id?: number } = {
        id: props.initialData.id, // Assurer que l'ID est inclus
        schoolYear: form.value.schoolYear,
        level: level.value,
        periodConfigurations: form.value.periodConfigurations.map(period => ({
          name: period.name,
          start: period.start,
          end: period.end
        }))
      }
      emit('submit', updateData)
    } else {
      const createData: YearRepartitionCreateInput = {
        schoolYear: form.value.schoolYear,
        level: level.value,
        periodConfigurations: form.value.periodConfigurations.map(period => ({
          name: period.name,
          start: period.start,
          end: period.end
        }))
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
    level.value = normalizeLevel((newValue as { level?: unknown }).level) ?? normalizeLevel(props.level) ?? (newValue.periodConfigurations.length === 2 ? 'SECONDAIRE' : 'PRIMAIRE')
    form.value = {
      schoolYear: newValue.schoolYear,
      periodConfigurations: [...newValue.periodConfigurations]
    }
    periodType.value = newValue.periodConfigurations.length === 2 ? 'semester' : 'trimester'
  } else {
    level.value = props.level ?? level.value
    periodType.value = periodKindForLevel(level.value)
    form.value = {
      schoolYear: '',
      periodConfigurations: createDefaultPeriods(periodType.value)
    }
  }
}, { immediate: true })

watch(() => props.level, (lv) => {
  if (lv && !props.initialData) handleLevelChange(lv)
})
</script>

<style scoped>
.period-item {
  margin-bottom: 20px;
}

.submit-btn {
  width: 100%;
  margin-top: 20px;
}

.level-badge {
  margin-left: 12px;
}

.preset-btn {
  margin-left: 12px;
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
