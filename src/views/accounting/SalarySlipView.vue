<template>
  <!-- @deprecated Fusionné dans /payment/professors?tab=bulletins&id= (ProfessorPaymentView). Redirection via /bulletins/:id. -->
  <div class="acc-page">
    <el-alert type="warning" show-icon title="Écran déplacé : utilisez Paie Profs › Bulletins" description="SalarySlipView est deprecated et sera supprimé. La route /bulletins/:id redirige vers ?tab=bulletins&id=." />
    <div class="acc-head no-print">
      <el-button @click="$router.back()">Retour</el-button>
      <div class="acc-actions">
        <el-button type="primary" @click="print">Imprimer</el-button>
        <el-button type="danger" @click="pdf">Exporter PDF</el-button>
      </div>
    </div>
    <SalarySlipPreview
      v-if="!loading && row"
      :school-name="schoolName"
      :periode="periode"
      :numero="numero"
      :enseignant="enseignant"
      :matiere="matiere"
      :heures="heures"
      :tarif-horaire="tarif"
      :sous-total="sousTotal"
      :prime="prime"
      :transport="transport"
      :avance="avance"
      :retenue="retenue"
      :brut="brut"
      :deductions="deductions"
      :date="today"
      :mode="mode"
      :telephone="telephone"
      :lettres="lettres"
    />
    <el-skeleton v-else-if="loading" :rows="8" animated />
    <el-empty v-else :description="error ?? 'Bulletin introuvable — validez d\u2019abord les heures (zéro mock)'" />
  </div>
</template>

<script setup lang="ts">
/**
 * @deprecated Fusion paie : utiliser ProfessorPaymentView onglet Bulletins (?tab=bulletins&id=).
 * Conservé temporairement, route /bulletins/:id redirige vers le shell fusionné.
 */
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { jsPDF } from 'jspdf'
import { ElMessage } from 'element-plus'
import SalarySlipPreview from '@/components/accounting/SalarySlipPreview.vue'
import { useAccountingStore } from '@/stores/accountingStore'
import { strictInvoke } from '@/utils/ipc'
import { useCurrency } from '@/composables/useCurrency'

const route = useRoute()
const store = useAccountingStore()
const { formatMoney, amountInWords } = useCurrency()
const schoolName = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const periode = ref(new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }))
const today = ref(new Date().toISOString().slice(0, 10))
const mode = ref('Espèces')
/** Référence backend PAY-ENS-AAAA-NNNN — aucun fallback local. */
const numero = ref('')

const row = computed(() => store.teacherHours.find((t) => String(t.id) === String(route.params.id)) ?? null)
const enseignant = computed(() => (row.value ? `${row.value.firstname} ${row.value.lastname}` : ''))
const matiere = computed(() => row.value?.matiere ?? '')
const telephone = computed(() => row.value?.phone ?? '')
const heures = computed(() => Number(row.value?.heures ?? 0))
const tarif = computed(() => Number(row.value?.tarifHoraire ?? 0))
const sousTotal = computed(() => Number(row.value?.sousTotal ?? heures.value * tarif.value))
const prime = computed(() => Number(row.value?.prime ?? 0))
const transport = computed(() => Number(row.value?.transport ?? 0))
const avance = computed(() => Number(row.value?.avance ?? 0))
const retenue = computed(() => Number(row.value?.retenue ?? 0))
const brut = computed(() => Number(row.value?.brut ?? sousTotal.value + prime.value + transport.value))
const deductions = computed(() => [])
const lettres = computed(() => amountInWords(brut.value - avance.value - retenue.value))

async function load(): Promise<void> {
  loading.value = true
  error.value = null
  try {
    await store.fetchTeacherHours()
    const s = await strictInvoke<{ name?: string }>('school:get', {})
    schoolName.value = String((s as unknown as { name?: string })?.name ?? '')
    const id = String(route.params.id ?? '')
    if (!row.value) throw new Error(`Bulletin ${id} introuvable — validez d'abord les heures (zéro mock)`)
    const r = row.value
    periode.value = `${r.mois ?? ''} ${r.annee ?? ''}`.trim() || periode.value
    mode.value = String(r.mode ?? 'Espèces')
    numero.value = `PAY-ENS-${r.annee ?? new Date().getFullYear()}-${String(r.id).padStart(4, '0')}`
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Chargement bulletin impossible (zéro mock)'
    error.value = msg
    ElMessage.error(msg)
  } finally {
    loading.value = false
  }
}

function print(): void {
  try {
    const w = window as unknown as { electronAPI?: { print?: (o: unknown) => Promise<unknown> } }
    if (w.electronAPI?.print) void w.electronAPI.print({ title: `Bulletin ${numero.value}` }).catch(() => window.print())
    else window.print()
  } catch {
    window.print()
  }
}

function pdf(): void {
  if (!row.value) {
    ElMessage.warning('Aucun bulletin chargé — export impossible')
    return
  }
  const doc = new jsPDF()
  doc.text(`Bulletin ${numero.value}`, 14, 18)
  doc.text(`Enseignant : ${enseignant.value}`, 14, 28)
  doc.text(`Brut : ${formatMoney(brut.value)}`, 14, 36)
  doc.text(`Net : ${formatMoney(brut.value - avance.value - retenue.value)}`, 14, 44)
  doc.save(`bulletin_${numero.value}.pdf`)
  ElMessage.success('Bulletin exporté en PDF')
}

onMounted(load)
</script>

<style scoped>
.acc-page { padding: 20px 20px 48px; background: var(--app-page-bg-color, #f5f5f5); height: calc(100vh - 70px); overflow-y: auto; box-sizing: border-box; }
.acc-head { display: flex; justify-content: space-between; margin-bottom: 12px; }
.acc-actions { display: flex; gap: 8px; }
@media print { .no-print { display: none !important; } .acc-page { padding: 0; background: #fff; } }
</style>
