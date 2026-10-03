<template>
  <div class="acc-page">
    <div class="acc-head">
      <div>
        <h1>Caisse du jour</h1>
        <p>Ouverture, mouvements (entrées / sorties) et clôture avec écart.</p>
      </div>
      <div class="acc-actions">
        <el-date-picker v-model="date" type="date" format="DD/MM/YYYY" value-format="YYYY-MM-DD" @change="load" />
        <el-button v-if="!cash.ouvert" type="primary" @click="requestOpen">Ouvrir la caisse</el-button>
        <el-button v-if="isOpen" type="danger" @click="requestClose">Clôturer</el-button>
        <el-tooltip content="Caisse jamais ouverte — ouverture requise" placement="top" :disabled="hasEverOpened">
          <span>
            <el-button plain :disabled="!hasEverOpened" @click="doLock">Verrouiller la caisse</el-button>
          </span>
        </el-tooltip>
        <el-button type="success" @click="exportJournalExcel">Export journal Excel</el-button>
        <el-button type="danger" @click="exportJournalPdf">Export journal PDF</el-button>
      </div>
    </div>

    <div class="acc-kpis">
      <KpiCard label="Fond d'ouverture" :amount="store.cashDay.fondOuverture" icon="mdi:wallet-outline" color="blue" />
      <KpiCard label="Entrées" :amount="totalEntrees" icon="mdi:arrow-down-bold-circle-outline" color="green" />
      <KpiCard label="Sorties" :amount="totalSorties" icon="mdi:arrow-up-bold-circle-outline" color="orange" />
      <KpiCard label="Solde théorique" :amount="solde" icon="mdi:safe" color="blue" />
    </div>

    <el-card class="acc-card" shadow="hover">
      <template #header>
        <div class="acc-cardhead">
          <strong>Mouvements du {{ date }}</strong>
          <el-tooltip content="Ouvrez la caisse pour saisir" placement="top" :disabled="isOpen">
            <span>
              <el-button type="warning" size="small" :disabled="!isOpen" @click="requestAdd">Ajouter un mouvement</el-button>
            </span>
          </el-tooltip>
        </div>
      </template>
      <MovementTable :rows="store.movements" />
      <p v-if="store.cashDay.ecart != null" class="acc-ecart">
        Écart de clôture : <strong>{{ formatMoney(store.cashDay.ecart) }}</strong>
      </p>
    </el-card>

    <CashOpenDialog v-model:visible="openVisible" @confirm="doOpen" />
    <CashCloseDialog v-model:visible="closeVisible" :theorique="solde" @confirm="doClose" />

    <el-dialog v-model="showAdd" title="Nouveau mouvement" width="440px">
      <el-form label-width="110px">
        <el-form-item label="Sens">
          <el-select v-model="draft.sens" style="width: 100%">
            <el-option label="Entrée" value="entree" />
            <el-option label="Sortie" value="sortie" />
          </el-select>
        </el-form-item>
        <el-form-item label="Motif"><el-input v-model="draft.motif" /></el-form-item>
        <el-form-item :label="`Montant (${currencyCode})`"><el-input-number v-model="draft.montant" :min="1" style="width: 100%" controls-position="right" /></el-form-item>
        <el-form-item label="Mode">
          <el-select v-model="draft.mode" style="width: 100%">
            <el-option label="Espèces" value="Espèces" />
            <el-option label="Orange Money" value="Orange Money" />
            <el-option label="MTN Mobile Money" value="MTN Mobile Money" />
            <el-option label="Virement" value="Virement" />
            <el-option label="Chèque" value="Chèque" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">Annuler</el-button>
        <el-button type="primary" @click="doAdd">Ajouter</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'
import { jsPDF } from 'jspdf'
import KpiCard from '@/components/accounting/KpiCard.vue'
import MovementTable from '@/components/accounting/MovementTable.vue'
import CashOpenDialog from '@/components/accounting/CashOpenDialog.vue'
import CashCloseDialog from '@/components/accounting/CashCloseDialog.vue'
import { useCash } from '@/composables/useCash'
import { useCurrency } from '@/composables/useCurrency'
import { strictInvoke } from '@/utils/ipc'
import { formatJJMMAAAA } from '@/utils/receiptCasy'
import { isNoSecretError, lockAccounting, mapAccountingError, openGuardedForm } from '@/composables/useAccountingGuard'

const date = ref(new Date().toISOString().slice(0, 10))
const openVisible = ref(false)
const closeVisible = ref(false)
const showAdd = ref(false)
const draft = ref({ sens: 'entree' as 'entree' | 'sortie', motif: '', montant: 0, mode: 'Espèces' })

const { store, soldeTheorique, totalEntrees, totalSorties, isOpen, load, open, close, add } = useCash()
const { formatMoney, currencyCode } = useCurrency()
const router = useRouter()
const solde = computed(() => soldeTheorique.value)
const cash = computed(() => store.cashDay)
/** Vrai dès que la caisse a déjà été ouverte (jour courant ou historique). */
const hasEverOpened = computed(() => {
  const c = store.cashDay
  return Boolean(
    c.ouvert || c.cloture || (c.ecart != null) || Number(c.fondOuverture ?? 0) > 0 ||
    Number(c.totalEntrees ?? 0) > 0 || Number(c.totalSorties ?? 0) > 0 ||
    store.movements.length > 0
  )
})

async function schoolHeader(): Promise<string> {
  try {
    const s = await strictInvoke<Record<string, unknown>>('school:get', {})
    const d = (s ?? {}) as Record<string, unknown>
    return String((d.name as string) ?? 'École')
  } catch { return 'École' }
}

async function exportJournalExcel(): Promise<void> {
  const ecole = await schoolHeader()
  const rows = store.movements.map((m) => ({
    École: ecole,
    Date: formatJJMMAAAA(date.value),
    Heure: m.heure,
    Motif: m.motif,
    Sens: m.sens === 'entree' ? 'Entrée' : 'Sortie',
    [`Montant (${currencyCode.value})`]: m.montant,
    Mode: m.mode,
    Référence: m.reference ?? '',
  }))
  if (!rows.length) { ElMessage.warning('Aucun mouvement à exporter'); return }
  const ws = XLSX.utils.json_to_sheet(rows)
  const wb = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(wb, ws, 'Journal')
  XLSX.writeFile(wb, `journal_caisse_${date.value}.xlsx`)
  ElMessage.success('Journal exporté en Excel')
}

async function exportJournalPdf(): Promise<void> {
  const ecole = await schoolHeader()
  const doc = new jsPDF()
  doc.setFont('helvetica', 'bold')
  doc.text(String(ecole), 14, 18)
  doc.setFont('helvetica', 'normal')
  doc.text(`Journal de caisse — ${formatJJMMAAAA(date.value)}`, 14, 28)
  let y = 38
  doc.text(`Entrées : ${formatMoney(totalEntrees.value)} — Sorties : ${formatMoney(totalSorties.value)} — Solde : ${formatMoney(solde.value)}`, 14, y); y += 8
  for (const m of store.movements.slice(0, 40)) {
    doc.text(`${m.heure} | ${m.motif} | ${m.sens} | ${formatMoney(m.montant)} | ${m.mode}`, 14, y)
    y += 6
    if (y > 280) { doc.addPage(); y = 18 }
  }
  doc.save(`journal_caisse_${date.value}.pdf`)
  ElMessage.success('Journal exporté en PDF')
}

function reload(): Promise<void> {
  return load(date.value)
}

/** Redirige vers l'écran setup si aucun secret n'est configuré. */
function handleGuardError(err: unknown): void {
  if (isNoSecretError(err)) {
    ElMessage.warning(mapAccountingError(err))
    void router.push('/comptabilite/setup')
  }
}

/** Garde d'OUVERTURE générique : popup AVANT d'afficher le formulaire cible. */
async function guardOpen(openFn: () => void): Promise<void> {
  try {
    await openGuardedForm(openFn)
  } catch (err) {
    handleGuardError(err)
  }
}

/** Bouton « Ouvrir la caisse » — popup AVANT l'ouverture du dialogue. */
function requestOpen(): Promise<void> {
  return guardOpen(() => { openVisible.value = true })
}

/** Bouton « Ajouter un mouvement » — popup AVANT l'ouverture du dialogue. */
function requestAdd(): Promise<void> {
  return guardOpen(() => { showAdd.value = true })
}

/** Bouton « Clôturer » — popup AVANT l'ouverture du dialogue. */
function requestClose(): Promise<void> {
  return guardOpen(() => { closeVisible.value = true })
}

async function doOpen(fond: number): Promise<void> {
  try {
    await open(fond)
    ElMessage.success('Caisse ouverte')
  } catch (err) {
    handleGuardError(err)
  }
}

async function doClose(reel: number): Promise<void> {
  try {
    const ecart = await close(reel)
    ElMessage.success(`Caisse clôturée (écart ${formatMoney(ecart)})`)
  } catch (err) {
    handleGuardError(err)
  }
}

async function doAdd(): Promise<void> {
  if (!draft.value.motif || draft.value.montant <= 0) {
    ElMessage.warning('Motif et montant requis')
    return
  }
  try {
    await add({
      heure: new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
      sens: draft.value.sens,
      motif: draft.value.motif,
      montant: draft.value.montant,
      mode: draft.value.mode,
    })
    showAdd.value = false
    draft.value = { sens: 'entree', motif: '', montant: 0, mode: 'Espèces' }
    ElMessage.success('Mouvement ajouté')
  } catch (err) {
    handleGuardError(err)
  }
}

async function doLock(): Promise<void> {
  await lockAccounting()
  ElMessage.success('Caisse verrouillée — mot de passe requis pour la prochaine saisie')
}

onMounted(reload)
</script>

<style scoped>
.acc-page { padding: 20px 20px 48px; background: var(--app-page-bg-color, #f5f5f5); height: calc(100vh - 70px); overflow-y: auto; box-sizing: border-box; }
.acc-head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.acc-head h1 { margin: 0; font-size: 22px; }
.acc-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.acc-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin-bottom: 12px; }
.acc-card { border-radius: 8px; }
.acc-cardhead { display: flex; justify-content: space-between; align-items: center; }
.acc-ecart { margin-top: 10px; }
</style>
