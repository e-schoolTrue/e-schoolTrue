<template>
    <el-form @submit.prevent="submitForm" label-width="120px">
      <el-form-item label="Année Scolaire">
        <el-input 
          v-model="form.schoolYear" 
          placeholder="Ex : 2024-2025" 
          clearable
        />
      </el-form-item>
  
      <el-form-item label="Périodes">
        <div v-for="(period, index) in form.periodConfigurations" :key="index" class="period-item">
          <el-row :gutter="10">
            <el-col :span="6">
              <el-input 
                v-model="period.name" 
                placeholder="Nom de la période" 
                clearable
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
            <el-col :span="2">
              <el-button 
                @click="removePeriod(index)" 
                type="danger" 
                circle
              >
                -
              </el-button>
            </el-col>
          </el-row>
        </div>
        
        <el-button 
          @click="addPeriod" 
          type="primary" 
          class="add-period-btn"
        >
          Ajouter une Période
        </el-button>
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
  
  const props = withDefaults(defineProps<{
    initialData?: YearRepartition
  }>(), {
    initialData: () => ({
      schoolYear: '',
      periodConfigurations: [{ name: '', start: null, end: null }]
    })
  })
  
  const emit = defineEmits<{
  (e: 'submit', data: YearRepartition): void
}>()
  
  const form = ref<YearRepartition>({
    schoolYear: props.initialData?.schoolYear || '',
    periodConfigurations: props.initialData?.periodConfigurations?.length 
      ? [...props.initialData.periodConfigurations]
      : [{ name: '', start: null, end: null }]
  })
  
  const isEditing = ref(!!props.initialData?.id)
  const isSubmitting = ref(false)
  
  const addPeriod = () => {
    form.value.periodConfigurations.push({ name: '', start: null, end: null })
  }
  
  const removePeriod = (index: number) => {
    if (form.value.periodConfigurations.length > 1) {
      form.value.periodConfigurations.splice(index, 1)
    } else {
      ElMessage.warning('Au moins une période est requise')
    }
  }
  
  const submitForm = async () => {
    if (!validateForm()) return
  
    isSubmitting.value = true
    try {
      emit('submit', {
        ...form.value,
        id: props.initialData?.id
      })
    } catch (error) {
      ElMessage.error('Échec de l\'enregistrement de la répartition')
      console.error(error)
    } finally {
      isSubmitting.value = false
    }
  }
  
  const validateForm = () => {
    if (!form.value.schoolYear) {
      ElMessage.error('L\'année scolaire est requise')
      return false
    }
  
    if (form.value.periodConfigurations.some(p => !p.name || !p.start || !p.end)) {
      ElMessage.error('Tous les champs de période doivent être remplis')
      return false
    }
  
    return true
  }
  
  // Watch for changes in initial data
  watch(() => props.initialData, (newValue) => {
    form.value = {
      schoolYear: newValue?.schoolYear || '',
      periodConfigurations: newValue?.periodConfigurations?.length 
        ? [...newValue.periodConfigurations]
        : [{ name: '', start: null, end: null }]
    }
    isEditing.value = !!newValue?.id
  })
  </script>
  
  <style scoped>
  .period-item {
    margin-bottom: 10px;
  }
  
  .add-period-btn {
    margin-top: 10px;
  }
  
  .submit-btn {
    width: 100%;
    margin-top: 10px;
  }
  </style>