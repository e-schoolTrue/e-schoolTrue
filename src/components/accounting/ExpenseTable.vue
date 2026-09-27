<template>
  <el-table :data="rows" border stripe style="width: 100%" empty-text="Aucune dépense">
    <el-table-column prop="date" label="Date" width="120">
      <template #default="{ row }">{{ formatDate(row.date) }}</template>
    </el-table-column>
    <el-table-column prop="categorie" label="Catégorie" width="140">
      <template #default="{ row }"><el-tag effect="plain">{{ row.categorie }}</el-tag></template>
    </el-table-column>
    <el-table-column prop="libelle" label="Libellé" min-width="200" />
    <el-table-column prop="montant" label="Montant" width="150" align="right">
      <template #default="{ row }"><CurrencyDisplay :amount="row.montant" /></template>
    </el-table-column>
    <el-table-column prop="mode" label="Mode" width="130" />
    <el-table-column prop="justificatif" label="Justificatif" width="140">
      <template #default="{ row }">
        <span v-if="row.justificatif" class="exp-ok">Joint</span>
        <span v-else class="exp-ko">—</span>
      </template>
    </el-table-column>
    <el-table-column label="Actions" width="190" align="center" fixed="right">
      <template #default="{ row }">
        <el-button size="small" type="success" @click="$emit('approve', row)">Approuver</el-button>
        <el-button size="small" type="danger" plain @click="$emit('reject', row)">Rejeter</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue'
import type { ExpenseRow } from '@/stores/accountingStore'

defineProps<{ rows: ExpenseRow[] }>()
defineEmits<{
  (e: 'approve', row: ExpenseRow): void
  (e: 'reject', row: ExpenseRow): void
}>()

function formatDate(d: string): string {
  try {
    return new Date(d).toLocaleDateString('fr-FR')
  } catch {
    return d
  }
}
</script>

<style scoped>
.exp-ok { color: var(--el-color-success); font-weight: 600; }
.exp-ko { color: var(--el-text-color-secondary); }
</style>
