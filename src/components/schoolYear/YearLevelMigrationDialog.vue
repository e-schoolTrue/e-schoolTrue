<template>
  <el-dialog
    :model-value="modelValue"
    title="Ventiler l'année unique vers 3 niveaux"
    width="640px"
    :close-on-click-modal="false"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <el-alert
      type="warning"
      :closable="false"
      show-icon
      title="Base legacy : une seule année sans niveau"
      :description="`« ${source?.schoolYear ?? '—'} » sera copiée vers PRESCOLAIRE / PRIMAIRE / SECONDAIRE. Les dates sont adaptées par niveau (trimestres depuis l'année trimestrielle, semestres depuis l'année semestrielle), puis chaque niveau vit indépendamment (courante, clôture).`"
    />

    <el-form label-width="160px" class="migrate-form">
      <el-form-item label="Année source">
        <el-select v-model="sourceId" placeholder="Année unique legacy" style="width: 100%">
          <el-option
            v-for="y in legacyYears"
            :key="y.id"
            :label="`${y.schoolYear} — ${y.periodConfigurations.length} période(s)`"
            :value="y.id"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <el-table :data="preview" size="small" class="preview-table">
      <el-table-column prop="level" label="Niveau" width="140">
        <template #default="scope">
          <el-tag :type="scope.row.level === 'SECONDAIRE' ? 'warning' : 'success'" effect="plain">
            {{ scope.row.level }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="kind" label="Régime" width="120" />
      <el-table-column label="Périodes">
        <template #default="scope">
          <div v-for="p in scope.row.periods" :key="p.name" class="preview-period">
            {{ p.name }} : {{ p.start || '—' }} → {{ p.end || '—' }}
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="exists" label="État" width="130">
        <template #default="scope">
          <el-tag v-if="scope.row.exists" type="info">Existe déjà</el-tag>
          <el-tag v-else type="primary">À créer</el-tag>
        </template>
      </el-table-column>
    </el-table>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">Annuler</el-button>
      <el-button type="primary" :loading="migrating" :disabled="!canMigrate" @click="confirm">
        Ventiler vers les 3 niveaux
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ElMessage } from 'element-plus'
import type { YearRepartitionResponse } from '@/types/year'
import { adaptReferencePeriods, periodBadgeForLevel, type SchoolLevel } from '@/types/schoolLevel'

const props = defineProps<{
  modelValue: boolean
  legacyYears: YearRepartitionResponse[]
  existing: YearRepartitionResponse[]
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'done'): void
}>()

const sourceId = ref<number | null>(null)
const migrating = ref(false)

const source = computed(() => props.legacyYears.find((y) => y.id === sourceId.value) ?? null)

const levelOf = (y: YearRepartitionResponse): string | null => {
  const lv = (y as { level?: unknown }).level
  return typeof lv === 'string' && lv ? lv.toUpperCase() : null
}

const preview = computed(() => {
  const levels: SchoolLevel[] = ['PRESCOLAIRE', 'PRIMAIRE', 'SECONDAIRE']
  return levels.map((lv) => {
    const periods = source.value
      ? adaptReferencePeriods(source.value.periodConfigurations as any, lv, source.value.schoolYear)
      : []
    const exists = !!props.existing.find(
      (y) => y.schoolYear === source.value?.schoolYear && levelOf(y) === lv,
    )
    return { level: lv, kind: periodBadgeForLevel(lv), periods, exists }
  })
})

const canMigrate = computed(
  () => !!source.value && preview.value.some((p) => !p.exists),
)

watch(
  () => props.modelValue,
  (open) => {
    if (open && sourceId.value == null && props.legacyYears.length > 0) {
      sourceId.value = [...props.legacyYears].sort((a, b) =>
        String(b.schoolYear).localeCompare(String(a.schoolYear)),
      )[0].id
    }
  },
  { immediate: true },
)

const confirm = async () => {
  if (!source.value) return
  migrating.value = true
  try {
    let created = 0
    let skipped = 0
    for (const row of preview.value) {
      if (row.exists) {
        skipped++
        continue
      }
      const payload = {
        schoolYear: source.value.schoolYear,
        level: row.level,
        periodConfigurations: row.periods.map((p) => ({ ...p })),
        isCurrent: false,
      }
      const res = await (window as any).ipcRenderer.invoke('yearRepartition:create', payload)
      if (res?.success) created++
      else if (String(res?.error || res?.message || '').includes('DUPLICATE')) skipped++
      else throw new Error(res?.message || res?.error || `Échec création ${row.level}`)
    }
    // L'année source legacy reste en place (traçabilité) : elle est masquée
    // des onglets niveaux dès que les 3 ventilations existent.
    ElMessage.success(`Ventilation terminée : ${created} niveau(x) créé(s)${skipped ? `, ${skipped} déjà existant(s)` : ''}`)
    emit('done')
    emit('update:modelValue', false)
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Échec de la ventilation')
  } finally {
    migrating.value = false
  }
}
</script>

<style scoped>
.migrate-form {
  margin: 16px 0 8px;
}
.preview-table {
  width: 100%;
  margin-top: 8px;
}
.preview-period {
  font-size: 12px;
  line-height: 1.6;
}
</style>
