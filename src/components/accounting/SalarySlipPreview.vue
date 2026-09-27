<template>
  <div id="salary-slip-print-zone" class="slip">
    <div class="slip__head">
      <div class="slip__school">
        <h3>{{ schoolName }}</h3>
        <p v-if="schoolAddress">{{ schoolAddress }}</p>
        <p v-if="schoolPhone || schoolEmail">Tél : {{ schoolPhone }}<span v-if="schoolEmail"> — {{ schoolEmail }}</span></p>
        <p v-if="schoolYear"><strong>Année scolaire :</strong> {{ schoolYear }}</p>
        <p class="slip__title">Bulletin de paie — {{ periode }}</p>
      </div>
      <div class="slip__num">N° {{ numero }}</div>
    </div>
    <p><strong>Enseignant :</strong> {{ enseignant }} — {{ matiere }}</p>
    <p><strong>Période :</strong> {{ periode }}</p>
    <p v-if="telephone" class="slip__meta">Tél : {{ telephone }}</p>
    <p class="slip__meta">Date : {{ dateJJMMAAAA }} — Mode : {{ mode }} — Réf : {{ numero }}</p>

    <h4 class="slip__section">DÉTAILS</h4>
    <el-table :data="detailRows" border style="width: 100%">
      <el-table-column prop="label" label="Rubrique" />
      <el-table-column prop="montant" :label="`Montant (${currencyCode})`" width="190" align="right">
        <template #default="{ row }">{{ formatMoney(row.montant) }}</template>
      </el-table-column>
    </el-table>

    <h4 class="slip__section">DÉDUCTIONS</h4>
    <el-table :data="deductionRows" border style="width: 100%" empty-text="Aucune déduction">
      <el-table-column prop="label" label="Rubrique" />
      <el-table-column prop="montant" :label="`Montant (${currencyCode})`" width="190" align="right">
        <template #default="{ row }">{{ formatMoney(row.montant) }}</template>
      </el-table-column>
    </el-table>

    <div class="slip__totals">
      <div class="slip__row"><span>TOTAL BRUT ({{ currencyCode }})</span><strong>{{ formatMoney(brut) }}</strong></div>
      <div class="slip__row"><span>Total déductions ({{ currencyCode }})</span><strong>{{ formatMoney(totalDeductions) }}</strong></div>
      <div class="slip__row is-net"><span>NET à payer ({{ currencyCode }})</span><strong>{{ formatMoney(net) }}</strong></div>
    </div>
    <p class="slip__words">En lettres : <em>{{ lettres }}</em></p>
    <div class="slip__sign">
      <div><p>Le Directeur</p><div class="slip__line"></div></div>
      <div><p>L'Enseignant</p><div class="slip__line"></div></div>
      <div><p>Le Caissier</p><div class="slip__line"></div></div>
      <div class="slip__stamp"><p>Cachet</p><div class="slip__box"></div></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useCurrency } from '@/composables/useCurrency'

const props = defineProps<{
  schoolName: string
  schoolAddress?: string
  schoolPhone?: string
  schoolEmail?: string
  schoolYear?: string
  periode: string
  numero: string | number
  enseignant: string
  matiere: string
  heures: number
  tarifHoraire: number
  sousTotal: number
  prime: number
  transport: number
  avance: number
  retenue: number
  brut: number
  deductions: Array<{ label: string; montant: number }>
  date: string
  mode: string
  telephone?: string
  lettres: string
}>()

const { formatMoney, currencyCode } = useCurrency()

const detailRows = computed(() => [
  { label: `Heures (${props.heures} h × ${formatMoney(props.tarifHoraire)})`, montant: props.sousTotal },
  { label: 'Prime', montant: props.prime },
  { label: 'Transport', montant: props.transport },
])
const deductionRows = computed(() => [
  ...props.deductions.map((d) => ({ label: d.label, montant: d.montant })),
  ...(props.avance > 0 ? [{ label: 'Avance', montant: props.avance }] : []),
  ...(props.retenue > 0 ? [{ label: 'Retenue', montant: props.retenue }] : []),
])
const totalDeductions = computed(() => deductionRows.value.reduce((s, d) => s + Number(d.montant ?? 0), 0))
const net = computed(() => props.brut - totalDeductions.value)
const dateJJMMAAAA = computed(() => {
  try {
    const s = String(props.date ?? '')
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10)
    const dt = new Date(s)
    if (Number.isNaN(dt.getTime())) return s || '—'
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return String(props.date) }
})
</script>

<style scoped>
.slip {
  background: #fff;
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 18px;
}
.slip__head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; border-bottom: 2px solid var(--el-color-primary); padding-bottom: 10px; margin-bottom: 10px; }
.slip__school h3 { margin: 0 0 2px; font-size: 17px; }
.slip__school p { margin: 1px 0; font-size: 12px; color: var(--el-text-color-secondary); }
.slip__title { font-weight: 700; color: var(--el-text-color-primary); }
.slip__num { font-weight: 700; color: var(--el-color-primary); white-space: nowrap; }
.slip__meta { font-size: 12px; color: var(--el-text-color-secondary); margin: 2px 0; }
.slip__section { margin: 14px 0 6px; font-size: 13px; letter-spacing: 0.6px; color: var(--el-text-color-secondary); }
.slip__totals { margin-top: 10px; padding: 10px; background: var(--el-fill-color-lighter); border-radius: 8px; display: flex; flex-direction: column; gap: 6px; }
.slip__row { display: flex; justify-content: space-between; font-size: 14px; }
.slip__row.is-net { font-size: 16px; border-top: 1px solid var(--el-border-color); padding-top: 6px; }
.slip__words { font-size: 13px; margin-top: 8px; }
.slip__sign { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 36px; }
.slip__line { border-top: 1px solid var(--el-text-color-primary); margin-top: 48px; width: 170px; }
.slip__stamp p { font-size: 12px; margin: 0; }
.slip__box { border: 1px dashed var(--el-text-color-secondary); border-radius: 6px; margin-top: 8px; width: 140px; height: 80px; }
@media print { .slip { border: none; } }
</style>
