<template>
  <div class="acc-page">
    <div class="acc-head">
      <div>
        <h1>Rapports financiers</h1>
        <p>9 rapports d'aide à la décision, exportables en Excel et PDF.</p>
      </div>
      <div class="acc-actions">
        <el-button type="primary" @click="requestBank">Nouvelle transaction bancaire</el-button>
      </div>
    </div>

    <el-dialog v-model="bankVisible" title="Nouvelle transaction bancaire" width="440px">
      <el-form label-width="130px">
        <el-form-item :label="`Montant (${currencyCode})`">
          <el-input-number v-model="bankDraft.montant" :min="1" style="width: 100%" controls-position="right" />
        </el-form-item>
        <el-form-item label="Sens">
          <el-select v-model="bankDraft.sens" style="width: 100%">
            <el-option label="Crédit" value="credit" />
            <el-option label="Débit" value="debit" />
          </el-select>
        </el-form-item>
        <el-form-item label="Libellé"><el-input v-model="bankDraft.libelle" placeholder="Ex : Virement reçu" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="bankVisible = false">Annuler</el-button>
        <el-button type="primary" :loading="bankSaving" @click="submitBank">Enregistrer</el-button>
      </template>
    </el-dialog>

    <ReportFilters v-model="filters" :classes="classes" @change="noop" />

    <div class="acc-grid">
      <el-card v-for="r in reports" :key="r.key" class="acc-card" shadow="hover">
        <template #header><strong>{{ r.title }}</strong></template>
        <p class="acc-desc">{{ r.desc }}</p>
        <p class="acc-val">{{ r.value }}</p>
        <div class="acc-actions">
          <el-button size="small" type="success" @click="exportExcel(r)">Excel</el-button>
          <el-button size="small" type="danger" @click="exportPdf(r)">PDF</el-button>
        </div>
      </el-card>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { isNoSecretError, mapAccountingError, openGuardedForm } from '@/composables/useAccountingGuard'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import ReportFilters, { type ReportFilterValue } from '@/components/accounting/ReportFilters.vue'
import { useAccountingStore } from '@/stores/accountingStore'
import { loadGradeNames } from '@/composables/useArrears'
import { useYearStore } from '@/stores/yearStore'
import { useCurrency } from '@/composables/useCurrency'
import { strictInvoke } from '@/utils/ipc'

interface ReportDef {
  key: string
  title: string
  desc: string
  value: string
}

const store = useAccountingStore()
const router = useRouter()
const { formatMoney, currencyCode } = useCurrency()
const bankVisible = ref(false)
const bankSaving = ref(false)
const bankDraft = ref({ montant: 0, sens: 'credit', libelle: '' })

function uuidv4(): string {
  const c = window.crypto as unknown as { randomUUID?: () => string }
  if (c?.randomUUID) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

/** Bouton « Nouvelle transaction bancaire » — garde d'OUVERTURE AVANT l'ouverture du dialogue. */
async function requestBank(): Promise<void> {
  try {
    await openGuardedForm(() => { bankVisible.value = true })
  } catch (err) {
    if (isNoSecretError(err)) {
      ElMessage.warning(mapAccountingError(err))
      void router.push('/comptabilite/setup')
    }
  }
}

/** Transaction bancaire — garde FRAÎCHE (60 s) appliquée dans le store. */
async function submitBank(): Promise<void> {
  if (bankDraft.value.montant <= 0 || !bankDraft.value.libelle.trim()) {
    ElMessage.warning('Montant et libellé requis')
    return
  }
  bankSaving.value = true
  try {
    // Clé générée UNE fois : le rejeu store réutilise le même objet.
    await store.createBankTransaction({
      montant: bankDraft.value.montant,
      sens: bankDraft.value.sens,
      libelle: bankDraft.value.libelle.trim(),
      idempotencyKey: uuidv4(),
    })
    ElMessage.success('Transaction bancaire enregistrée')
    bankVisible.value = false
    bankDraft.value = { montant: 0, sens: 'credit', libelle: '' }
  } catch (err) {
    if (isNoSecretError(err)) {
      ElMessage.warning(mapAccountingError(err))
      void router.push('/comptabilite/setup')
    }
  } finally {
    bankSaving.value = false
  }
}
const filters = ref<ReportFilterValue>({ debut: '', fin: '', classe: '' })
// Source canonique grade:all (repli : classes des impayés) — cf. useArrears.
const classes = ref<string[]>([])
void loadGradeNames().then((names) => {
  classes.value = names.length
    ? names
    : [...new Set(store.arrears.map((a) => a.classe))]
})

/**
 * Bornes de l'année scolaire du menu (`YearSwitcher`) — civil conservé pour les
 * filtres date, mais pré-rempli sur l'année scolaire : min(periodConfigurations.start) → max(end),
 * repli 01/09/N → 31/08/N+1 depuis le libellé `AAAA-AAAA`).
 */
function schoolYearBounds(): { debut: string; fin: string } {
  const toISO = (v: unknown): string => {
    try {
      const d = v instanceof Date ? v : new Date(String(v ?? ''))
      if (Number.isNaN(d.getTime())) return ''
      return d.toISOString().slice(0, 10)
    } catch {
      return ''
    }
  }
  try {
    const active = useYearStore().activeYear
    const periods = Array.isArray(active?.periodConfigurations) ? active!.periodConfigurations : []
    const starts = periods.map((p) => toISO((p as { start?: unknown }).start)).filter(Boolean).sort()
    const ends = periods.map((p) => toISO((p as { end?: unknown }).end)).filter(Boolean).sort()
    if (starts.length && ends.length) return { debut: starts[0], fin: ends[ends.length - 1] }
    const label = String(active?.schoolYear ?? useYearStore().currentSchoolYear ?? '')
    const m = /^(\d{4})-(\d{4})$/.exec(label.trim())
    if (m) return { debut: `${m[1]}-09-01`, fin: `${m[2]}-08-31` }
  } catch {
    /* fail-open : filtres vides */
  }
  return { debut: '', fin: '' }
}

function applySchoolYearBounds(): void {
  const { debut, fin } = schoolYearBounds()
  if (debut && !filters.value.debut) filters.value.debut = debut
  if (fin && !filters.value.fin) filters.value.fin = fin
}

function noop(): void {
  /* filtres réactifs via computed */
}

const reports = computed<ReportDef[]>(() => {
  const fmt = (n: number): string => formatMoney(Number(n ?? 0))
  const classeTxt = filters.value.classe ? ` — ${filters.value.classe}` : ''
  return [
    { key: 'journal', title: 'Journal des encaissements', desc: `Toutes les entrées${classeTxt}`, value: fmt(store.kpis.encaisseMois) },
    { key: 'impayes', title: 'État des impayés', desc: `Soldes restants${classeTxt}`, value: fmt(store.kpis.impayesTotal) },
    { key: 'depenses', title: 'État des dépenses', desc: 'Sorties par catégorie', value: fmt(store.kpis.depensesMois) },
    { key: 'caisse', title: 'Brouillard de caisse', desc: 'Mouvements journaliers', value: fmt(store.cashDay.soldeTheorique) },
    { key: 'paie', title: 'Livre de paie', desc: 'Bruts enseignants', value: fmt(store.teacherHours.reduce((s, t) => s + t.brut, 0)) },
    { key: 'classe', title: 'Recettes par classe', desc: `Ventilation${classeTxt}`, value: `${classes.value.length} classes` },
    { key: 'mode', title: 'Recettes par mode', desc: 'Espèces / Orange Money / MTN / Virement', value: fmt(store.kpis.encaisseMois) },
    { key: 'retard', title: 'Balance âgée', desc: 'Retards 0-30 / 30-60 / 60+ jours', value: `${store.arrears.length} dossiers` },
    { key: 'resultat', title: 'Compte de résultat', desc: 'Entrées − sorties', value: fmt(store.kpis.encaisseMois - store.kpis.depensesMois) },
  ]
})

function formatJJMMAAAA(d: unknown): string {
  if (!d) return '—'
  try {
    const s = String(d)
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10)
    const dt = new Date(s)
    if (Number.isNaN(dt.getTime())) return s
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch { return String(d) }
}

async function schoolName(): Promise<string> {
  try {
    const s = await strictInvoke<Record<string, unknown>>('school:get', {})
    return String(((s ?? {}) as Record<string, unknown>).name ?? 'École')
  } catch { return 'École' }
}

function periodeJJMMAAAA(): string {
  const d = filters.value.debut ? formatJJMMAAAA(filters.value.debut) : '—'
  const f = filters.value.fin ? formatJJMMAAAA(filters.value.fin) : '—'
  return `${d} au ${f}`
}

async function exportExcel(r: ReportDef): Promise<void> {
  const ecole = await schoolName()
  const ws = XLSX.utils.json_to_sheet([{
    École: ecole,
    Rapport: r.title,
    Filtres: JSON.stringify(filters.value),
    Période: periodeJJMMAAAA(),
    [`Valeur (${currencyCode.value})`]: r.value,
    Date: formatJJMMAAAA(new Date().toISOString()),
  }])
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, r.key.slice(0, 31))
  XLSX.writeFile(wb, `rapport_${r.key}.xlsx`)
  ElMessage.success(`Rapport « ${r.title} » exporté en Excel`)
}

async function exportPdf(r: ReportDef): Promise<void> {
  const ecole = await schoolName()
  const doc = new jsPDF()
  doc.setFont('helvetica', 'bold')
  doc.text(String(ecole), 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.text(r.title, 14, 28)
  doc.text(r.desc, 14, 36)
  doc.text(`Valeur (${currencyCode.value}) : ${r.value}`, 14, 44)
  doc.text(`Période : ${periodeJJMMAAAA()}`, 14, 52)
  doc.save(`rapport_${r.key}.pdf`)
  ElMessage.success(`Rapport « ${r.title} » exporté en PDF`)
}

onMounted(() => {
  // Pré-remplit debut/fin sur les bornes de l'année scolaire du menu (filtres civils conservés).
  applySchoolYearBounds()
  void store.fetchDashboard()
  void store.fetchArrears()
})
</script>

<style scoped>
.acc-page { padding: 20px 20px 48px; background: var(--app-page-bg-color, #f5f5f5); height: calc(100vh - 70px); overflow-y: auto; box-sizing: border-box; }
.acc-head h1 { margin: 0 0 4px; font-size: 22px; }
.acc-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 12px; }
.acc-card { border-radius: 8px; }
.acc-desc { color: var(--el-text-color-secondary); font-size: 13px; min-height: 36px; }
.acc-val { font-weight: 700; font-size: 16px; }
.acc-actions { display: flex; gap: 8px; margin-top: 8px; }
</style>
