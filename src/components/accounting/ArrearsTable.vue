<template>
  <el-table :data="rows" border stripe style="width: 100%" empty-text="Aucun impayé">
    <el-table-column label="Élève" min-width="210">
      <template #default="{ row }">
        <div class="ar-student">
          <strong>{{ row.firstname }} {{ row.lastname }}</strong>
          <span class="ar-sub">{{ row.matricule }} — {{ row.classe }}</span>
        </div>
      </template>
    </el-table-column>
    <el-table-column prop="classe" label="Classe" width="130" />
    <el-table-column label="Échéance" width="120" align="center">
      <template #default="{ row }">{{ echeanceOf(row) }}</template>
    </el-table-column>
    <el-table-column label="Téléphone" width="170">
      <template #default="{ row }">
        <el-tooltip v-if="!hasPhone(row)" content="Numéro manquant — relance +224 impossible" placement="top">
          <span class="ar-nophone">—</span>
        </el-tooltip>
        <span v-else>{{ phoneOf(row) }}</span>
      </template>
    </el-table-column>
    <el-table-column prop="reste" :label="`Reste (${currencyCode})`" width="150" align="right" sortable>
      <template #default="{ row }"><strong class="ar-reste">{{ formatMoney(row.reste) }}</strong></template>
    </el-table-column>
    <el-table-column prop="joursRetard" label="Retard (j)" width="110" align="center" sortable />
    <el-table-column prop="statut" label="Statut" width="120" align="center">
      <template #default="{ row }">
        <el-tag :type="row.statut === 'partiel' ? 'warning' : 'danger'">{{ row.statut === 'partiel' ? 'Partiel' : 'Non payé' }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column label="Relances" width="190" align="center" fixed="right">
      <template #default="{ row }">
        <RelanceActions
          :phone="rawPhone(row)" :firstname="row.firstname" :lastname="row.lastname"
          :classe="row.classe" :reste="row.reste" :echeance="echeanceOf(row)" compact
        />
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import type { ArrearRow } from '@/stores/accountingStore'
import RelanceActions from '@/components/accounting/RelanceActions.vue'
import { useCurrency } from '@/composables/useCurrency'
import { formatEcheanceJJMMAAAA, normalizeGuineePhone, pickDisplayPhone } from '@/composables/useArrears'

defineProps<{ rows: ArrearRow[] }>()

const { formatMoney, currencyCode } = useCurrency()

function rawPhone(row: ArrearRow): string {
  return pickDisplayPhone(row.phone, row.famillyPhone, row.personalPhone)
}
function hasPhone(row: ArrearRow): boolean {
  return normalizeGuineePhone(rawPhone(row)) !== ''
}
function echeanceOf(row: ArrearRow & { echeance?: string }): string {
  return formatEcheanceJJMMAAAA(row.echeance)
}
function phoneOf(row: ArrearRow): string {
  const raw = rawPhone(row)
  if (!raw) return '—'
  const n = normalizeGuineePhone(raw)
  return n ? `+${n}` : raw.trim()
}
</script>

<style scoped>
.ar-student { display: flex; flex-direction: column; }
.ar-sub { font-size: 12px; color: var(--el-text-color-secondary); }
.ar-reste { color: var(--el-color-danger); }
.ar-nophone { color: var(--el-text-color-placeholder); border-bottom: 1px dashed var(--el-border-color); cursor: help; }
</style>
