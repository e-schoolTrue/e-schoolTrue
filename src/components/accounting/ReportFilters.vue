<template>
  <el-card class="acc-filters" shadow="never">
    <el-row :gutter="12">
      <el-col :xs="24" :sm="8">
        <el-date-picker v-model="model.debut" type="date" placeholder="Date début" format="DD/MM/YYYY" value-format="YYYY-MM-DD" style="width: 100%" @change="emitChange" />
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-date-picker v-model="model.fin" type="date" placeholder="Date fin" format="DD/MM/YYYY" value-format="YYYY-MM-DD" style="width: 100%" @change="emitChange" />
      </el-col>
      <el-col :xs="24" :sm="8">
        <el-select v-model="model.classe" placeholder="Toutes les classes" clearable style="width: 100%" @change="emitChange">
          <el-option v-for="c in classes" :key="c" :label="c" :value="c" />
        </el-select>
      </el-col>
    </el-row>
  </el-card>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

export interface ReportFilterValue {
  debut: string
  fin: string
  classe: string
}

const props = defineProps<{ classes?: string[]; modelValue: ReportFilterValue }>()
const emit = defineEmits<{ (e: 'update:modelValue', v: ReportFilterValue): void; (e: 'change', v: ReportFilterValue): void }>()

const model = ref<ReportFilterValue>({ ...props.modelValue })

watch(() => props.modelValue, (v) => { model.value = { ...v } }, { deep: true })

function emitChange(): void {
  emit('update:modelValue', { ...model.value })
  emit('change', { ...model.value })
}
</script>

<style scoped>
.acc-filters { border-radius: 8px; margin-bottom: 12px; }
</style>
