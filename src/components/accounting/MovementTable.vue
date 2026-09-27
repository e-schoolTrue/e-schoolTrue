<template>
  <el-table :data="rows" border stripe style="width: 100%" empty-text="Aucun mouvement">
    <el-table-column prop="heure" label="Heure" width="90" />
    <el-table-column prop="motif" label="Motif" min-width="220" />
    <el-table-column prop="sens" label="Sens" width="110" align="center">
      <template #default="{ row }">
        <el-tag :type="row.sens === 'entree' ? 'success' : 'danger'">{{ row.sens === 'entree' ? 'Entrée' : 'Sortie' }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column prop="montant" :label="`Montant (${currencyCode})`" width="170" align="right">
      <template #default="{ row }">
        <span :class="row.sens === 'entree' ? 'mv-in' : 'mv-out'">
          {{ row.sens === 'entree' ? '+' : '-' }}{{ formatMoney(row.montant).replace(/^[-+\s]*/, '') }}
        </span>
      </template>
    </el-table-column>
    <el-table-column prop="mode" label="Mode" width="150">
      <template #default="{ row }">{{ modeGuinee(row.mode) }}</template>
    </el-table-column>
    <el-table-column prop="reference" label="Référence" width="140" />
  </el-table>
</template>

<script setup lang="ts">
import type { CashMovement } from '@/stores/accountingStore'
import { useCurrency } from '@/composables/useCurrency'

defineProps<{ rows: CashMovement[] }>()

const { formatMoney, currencyCode } = useCurrency()

function modeGuinee(v: unknown): string {
  const k = String(v ?? '').toLowerCase().trim()
  const map: Record<string, string> = {
    cash: 'Espèces', especes: 'Espèces', 'espèces': 'Espèces',
    'mobile money': 'Orange Money', mobile_money: 'Orange Money',
    orange_money: 'Orange Money', orange: 'Orange Money',
    mtn_money: 'MTN Mobile Money', mtn: 'MTN Mobile Money',
    virement: 'Virement', transfer: 'Virement',
    cheque: 'Chèque', 'chèque': 'Chèque', check: 'Chèque',
  }
  return map[k] ?? String(v ?? '—')
}
</script>

<style scoped>
.mv-in { color: var(--el-color-success); font-weight: 600; }
.mv-out { color: var(--el-color-danger); font-weight: 600; }
</style>
