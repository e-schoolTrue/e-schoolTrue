<template>
  <el-table :data="rows" border stripe style="width: 100%" empty-text="Aucune heure pour cette période — chargez un autre mois (zéro mock)" highlight-current-row @row-click="onSelect">
    <el-table-column label="Enseignant" min-width="210">
      <template #default="{ row }">
        <strong>{{ row.firstname }} {{ row.lastname }}</strong>
        <div class="hl-sub">{{ row.matiere || '—' }} — {{ row.phone || 'Sans téléphone' }}</div>
      </template>
    </el-table-column>
    <el-table-column prop="heures" label="Heures" width="90" align="center" sortable />
    <el-table-column prop="tarifHoraire" label="Tarif" width="150" align="right">
      <template #default="{ row }">{{ formatMoney(row.tarifHoraire) }}</template>
    </el-table-column>
    <el-table-column prop="brut" label="Montant" width="160" align="right" sortable>
      <template #default="{ row }"><strong>{{ formatMoney(row.sousTotal ?? row.brut) }}</strong></template>
    </el-table-column>
    <el-table-column prop="statut" label="Statut" width="120" align="center">
      <template #default="{ row }">
        <el-tag :type="row.statut === 'paye' ? 'success' : row.statut === 'valide' ? 'primary' : 'info'">
          {{ row.statut === 'paye' ? 'Payé' : row.statut === 'valide' ? 'Validé' : 'Brouillon' }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="Actions" width="200" align="center" fixed="right">
      <template #default="{ row }">
        <el-button size="small" @click="$emit('view', row)">Bulletin</el-button>
        <el-button size="small" type="primary" :disabled="row.statut !== 'brouillon'" @click="$emit('validate', row)">Valider</el-button>
        <el-button size="small" type="success" :disabled="row.statut === 'paye'" @click="$emit('pay', row)">Payer</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import type { TeacherHourRow } from '@/stores/accountingStore'
import { useCurrency } from '@/composables/useCurrency'

defineProps<{ rows: TeacherHourRow[] }>()
const emit = defineEmits<{
  (e: 'view', row: TeacherHourRow): void
  (e: 'validate', row: TeacherHourRow): void
  (e: 'pay', row: TeacherHourRow): void
  (e: 'select', row: TeacherHourRow): void
}>()

const { formatMoney } = useCurrency()

function onSelect(r: TeacherHourRow): void {
  emit('select', r)
}
</script>

<style scoped>
.hl-sub { font-size: 12px; color: var(--el-text-color-secondary); }
</style>
