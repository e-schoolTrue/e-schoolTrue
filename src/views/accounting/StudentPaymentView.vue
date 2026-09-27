<template>
  <div class="pay-page">
    <div class="pay-head">
      <div>
        <h1>Paiement élèves</h1>
        <p>Recherche Nom / matricule / téléphone — 100% dynamique, zéro mock.</p>
      </div>
      <el-button @click="$router.push('/comptabilite')">Tableau de bord</el-button>
    </div>

    <!-- Recherche -->
    <el-card class="pay-card" shadow="hover">
      <div class="pay-search">
        <el-input
          v-model="search"
          placeholder="Nom, matricule, téléphone…"
          clearable
          class="pay-search__input"
          @keyup.enter="searchStudents"
        >
          <template #prefix><el-icon><Search /></el-icon></template>
        </el-input>
        <el-button type="primary" :loading="searching" @click="searchStudents">Rechercher</el-button>
      </div>
      <el-skeleton v-if="searching" :rows="2" animated />
      <el-empty v-else-if="searchError" :description="searchError" />
      <el-empty v-else-if="searched && !students.length" description="Aucun élève trouvé — vérifiez Nom / matricule / téléphone (zéro mock)" />
      <el-table
        v-else-if="students.length"
        :data="students"
        border
        stripe
        highlight-current-row
        style="width: 100%"
        @row-click="selectStudent"
      >
        <el-table-column label="Élève" min-width="220">
          <template #default="{ row }">
            <strong>{{ row.firstname }} {{ row.lastname }}</strong>
            <div class="pay-sub">{{ row.matricule }} — {{ row.grade?.name ?? 'Sans classe' }}</div>
          </template>
        </el-table-column>
        <el-table-column label="Téléphone" width="170">
          <template #default="{ row }">{{ displayPhone(row.famillyPhone, row.personalPhone) }}</template>
        </el-table-column>
        <el-table-column label="Actions" width="140" align="center" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="primary" @click.stop="selectStudent(row)">Sélectionner</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 3 blocs maquette -->
    <div v-if="selected" class="pay-grid">
      <!-- Bloc 1 : carte élève -->
      <el-card class="pay-card" shadow="hover">
        <template #header><strong>Carte élève</strong></template>
        <div class="pay-student">
          <el-avatar :size="64" :src="photoUrl">{{ initials }}</el-avatar>
          <div>
            <h3>{{ selected.firstname }} {{ selected.lastname }}</h3>
            <p><strong>Matricule :</strong> {{ selected.matricule }}</p>
            <p><strong>Classe :</strong> {{ selected.grade?.name ?? '—' }}</p>
            <p><strong>Parent :</strong> {{ parentName }}</p>
            <p><strong>Téléphone :</strong> {{ parentPhone }}</p>
            <p><strong>Inscrit :</strong> {{ inscritLe }}</p>
            <p><strong>Statut :</strong> <el-tag :type="statutType">{{ statutLabel }}</el-tag></p>
          </div>
        </div>
      </el-card>

      <!-- Bloc 2 : situation financière -->
      <el-card class="pay-card" shadow="hover">
        <template #header><strong>Situation financière</strong></template>
        <el-skeleton v-if="situationLoading" :rows="4" animated />
        <el-empty v-else-if="situationError" :description="situationError" />
        <el-table v-else :data="situationRows" border stripe style="width: 100%" empty-text="Aucune échéance — configuration scolarité manquante (zéro mock)">
          <el-table-column prop="nature" label="Nature" min-width="140" />
          <el-table-column prop="montant" :label="`Montant (${currencyCode})`" width="130" align="right">
            <template #default="{ row }">{{ formatMoney(row.montant) }}</template>
          </el-table-column>
          <el-table-column prop="paye" label="Payé" width="130" align="right">
            <template #default="{ row }">{{ formatMoney(row.paye) }}</template>
          </el-table-column>
          <el-table-column prop="reste" label="Reste" width="130" align="right">
            <template #default="{ row }"><strong>{{ formatMoney(row.reste) }}</strong></template>
          </el-table-column>
          <el-table-column prop="echeance" label="Échéance" width="110" />
          <el-table-column prop="statut" label="Statut" width="110" align="center">
            <template #default="{ row }">
              <el-tag :type="row.reste <= 0 ? 'success' : row.paye > 0 ? 'warning' : 'danger'">
                {{ row.reste <= 0 ? 'Payé' : row.paye > 0 ? 'Partiel' : 'Non payé' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-card>

      <!-- Bloc 3 : historique -->
      <el-card class="pay-card" shadow="hover">
        <template #header><strong>Historique</strong></template>
        <el-skeleton v-if="historyLoading" :rows="4" animated />
        <el-empty v-else-if="historyError" :description="historyError" />
        <el-table v-else :data="historyRows" border stripe style="width: 100%" empty-text="Aucun paiement enregistré (zéro mock)">
          <el-table-column prop="date" label="Date" width="105" />
          <el-table-column prop="nature" label="Nature" min-width="130" />
          <el-table-column prop="montant" :label="`Montant (${currencyCode})`" width="125" align="right">
            <template #default="{ row }">{{ formatMoney(row.montant) }}</template>
          </el-table-column>
          <el-table-column prop="mode" label="Mode" width="130">
            <template #default="{ row }">{{ labelModeGuinee(row.mode) }}</template>
          </el-table-column>
          <el-table-column prop="recu" label="Reçu" width="130" />
          <el-table-column prop="caissier" label="Caissier" width="130" />
        </el-table>
      </el-card>
    </div>

    <!-- Panneau persistant Enregistrer -->
    <el-card v-if="selected" class="pay-card pay-panel" shadow="hover">
      <template #header><strong>Enregistrer un paiement — {{ selected.firstname }} {{ selected.lastname }}</strong></template>
      <el-form :model="form" label-width="140px" class="pay-form">
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item label="Nature">
              <el-select v-model="form.nature" style="width: 100%">
                <el-option label="Inscription" value="inscription" />
                <el-option label="Réinscription" value="reinscription" />
                <el-option label="Scolarité — Tranche 1" value="tranche1" />
                <el-option label="Scolarité — Tranche 2" value="tranche2" />
                <el-option label="Scolarité — Tranche 3" value="tranche3" />
                <el-option label="Uniforme" value="uniform" />
                <el-option label="Transport" value="transport" />
                <el-option label="Cantine" value="cafeteria" />
                <el-option label="Autre" value="other" />
              </el-select>
            </el-form-item>
            <el-form-item :label="`Montant (${currencyCode})`">
              <el-input-number v-model="form.montant" :min="0" :step="1000" style="width: 100%" controls-position="right" />
            </el-form-item>
            <el-form-item label="Remise">
              <el-input-number v-model="form.remise" :min="0" :max="form.montant" :step="500" style="width: 100%" controls-position="right" />
            </el-form-item>
            <el-form-item label="Montant à payer">
              <el-input :value="formatMoney(montantAPayer)" disabled />
            </el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="Mode">
              <el-select v-model="form.mode" style="width: 100%">
                <el-option label="Espèces" value="cash" />
                <el-option label="Orange Money" value="orange_money" />
                <el-option label="MTN Mobile Money" value="mtn_money" />
                <el-option label="Virement" value="transfer" />
                <el-option label="Chèque" value="check" />
              </el-select>
            </el-form-item>
            <el-form-item label="Date">
              <el-date-picker v-model="form.date" type="date" format="DD/MM/YYYY" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
            <el-form-item label="Référence">
              <el-input v-model="form.reference" placeholder="N° chèque, ID transaction…" />
            </el-form-item>
            <el-form-item label="Observation">
              <el-input v-model="form.observation" type="textarea" :rows="2" placeholder="Observation optionnelle…" />
            </el-form-item>
          </el-col>
        </el-row>
        <p class="pay-words">En lettres : <em>{{ amountInWords(montantAPayer) }}</em></p>
        <div class="pay-actions">
          <el-button type="warning" :loading="paying" :disabled="paying || montantAPayer <= 0" @click="encaisser">Encaisser</el-button>
          <el-button :disabled="!lastReceiptId" @click="printLastReceipt">Imprimer</el-button>
          <el-button type="danger" :disabled="!lastReceiptId" @click="pdfLastReceipt">PDF</el-button>
          <el-button type="success" :disabled="!lastReceiptId" @click="sendLastReceipt">Envoyer</el-button>
        </div>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import { strictInvoke } from '@/utils/ipc'
import { useCurrency } from '@/composables/useCurrency'
import { useReceipt } from '@/composables/useReceipt'
import { buildCasyReceiptHtml, openCasyPrintWindow } from '@/utils/receiptCasy'
import { ensureUnlock, isAccountingLockError, isNoSecretError, mapAccountingError, openGuardedForm } from '@/composables/useAccountingGuard'
import { useRouter } from 'vue-router'

const router = useRouter()

interface StudentRow {
  id: number
  firstname: string
  lastname: string
  matricule: string
  grade?: { id: number; name: string }
  famillyPhone?: string
  personalPhone?: string
  parentName?: string
  photo?: { url?: string; path?: string }
  created_at?: string
  isNew?: boolean
}

interface SituationRow {
  nature: string
  montant: number
  paye: number
  reste: number
  echeance: string
}

interface HistoryRow {
  date: string
  nature: string
  montant: number
  mode: string
  recu: string
  caissier: string
  id: number | string
}

const { formatMoney, amountInWords, currencyCode } = useCurrency()
const search = ref('')
const students = ref<StudentRow[]>([])
const searching = ref(false)
const searched = ref(false)
const searchError = ref<string | null>(null)
const selected = ref<StudentRow | null>(null)

const situationRows = ref<SituationRow[]>([])
const situationLoading = ref(false)
const situationError = ref<string | null>(null)

const historyRows = ref<HistoryRow[]>([])
const historyLoading = ref(false)
const historyError = ref<string | null>(null)

const form = ref({
  nature: 'tranche1',
  montant: 0,
  remise: 0,
  mode: 'cash',
  date: new Date().toISOString().slice(0, 10),
  reference: '',
  observation: '',
})
const paying = ref(false)
const lastReceiptId = ref<string | number | null>(null)

const montantAPayer = computed(() => Math.max(0, Number(form.value.montant ?? 0) - Number(form.value.remise ?? 0)))
const photoUrl = computed(() => selected.value?.photo?.url ?? selected.value?.photo?.path ?? '')
const initials = computed(() => `${selected.value?.firstname?.[0] ?? ''}${selected.value?.lastname?.[0] ?? ''}`.toUpperCase())
const parentName = computed(() => selected.value?.parentName ?? '—')
function displayPhone(...candidates: Array<string | undefined>): string {
  for (const c of candidates) {
    const v = String(c ?? '').trim()
    if (v) return v
  }
  return '—'
}
const parentPhone = computed(() => displayPhone(selected.value?.famillyPhone, selected.value?.personalPhone))
const inscritLe = computed(() => {
  const d = selected.value?.created_at
  if (!d) return '—'
  try { return new Date(d).toLocaleDateString('fr-FR') } catch { return '—' }
})
const statutLabel = computed(() => {
  const totalReste = situationRows.value.reduce((s, r) => s + Number(r.reste ?? 0), 0)
  const totalPaye = situationRows.value.reduce((s, r) => s + Number(r.paye ?? 0), 0)
  if (!situationRows.value.length) return '—'
  if (totalReste <= 0) return 'Payé'
  if (totalPaye > 0) return 'Partiel'
  return 'Non payé'
})
const statutType = computed(() => (statutLabel.value === 'Payé' ? 'success' : statutLabel.value === 'Partiel' ? 'warning' : 'danger'))

function uuidv4(): string {
  const c = window.crypto as unknown as { randomUUID?: () => string }
  if (c?.randomUUID) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

function fmtDate(d: unknown): string {
  if (!d) return '—'
  try {
    const dt = d instanceof Date ? d : new Date(String(d))
    if (Number.isNaN(dt.getTime())) return '—'
    return dt.toLocaleDateString('fr-FR')
  } catch { return '—' }
}

function labelNature(v: unknown): string {
  const map: Record<string, string> = {
    tuition: 'Scolarité', inscription: 'Inscription', reinscription: 'Réinscription',
    re_inscription: 'Réinscription', tranche1: 'Scolarité — Tranche 1',
    tranche2: 'Scolarité — Tranche 2', tranche3: 'Scolarité — Tranche 3',
    uniform: 'Uniforme', transport: 'Transport', cafeteria: 'Cantine', other: 'Autre',
  }
  return map[String(v ?? '')] ?? String(v ?? '—')
}

function labelModeGuinee(v: unknown): string {
  const k = String(v ?? '').toLowerCase().trim()
  const map: Record<string, string> = {
    cash: 'Espèces', orange_money: 'Orange Money', orange: 'Orange Money',
    mobile_money: 'Orange Money', mtn_money: 'MTN Mobile Money', mtn: 'MTN Mobile Money',
    transfer: 'Virement', check: 'Chèque',
  }
  return map[k] ?? String(v ?? '—')
}

function labelMode(v: unknown): string {
  return labelModeGuinee(v)
}

async function searchStudents(): Promise<void> {
  searching.value = true
  searchError.value = null
  try {
    const q = search.value.trim()
    const raw = await strictInvoke<{ students?: StudentRow[] } | StudentRow[]>('student:all', {
      page: 1, pageSize: 20,
      filters: { studentFullName: q },
    })
    const list: StudentRow[] = Array.isArray(raw) ? raw : Array.isArray((raw as { students?: StudentRow[] })?.students) ? (raw as { students: StudentRow[] }).students : []
    const ql = q.toLowerCase()
    students.value = q ? list.filter((s) => `${s.firstname} ${s.lastname} ${s.matricule} ${s.famillyPhone ?? ''} ${s.personalPhone ?? ''}`.toLowerCase().includes(ql)) : list
    searched.value = true
    if (!students.value.length) searchError.value = null
  } catch (err) {
    students.value = []
    searched.value = true
    const msg = err instanceof Error ? err.message : 'Recherche impossible (zéro mock)'
    searchError.value = msg
    ElMessage.error(msg)
  } finally {
    searching.value = false
  }
}

async function selectStudent(row: StudentRow): Promise<void> {
  // Garde d'OUVERTURE : popup AVANT d'afficher la fiche + panneau Encaisser.
  // Annuler/NO_SECRET_SET -> ne pas ouvrir. Double garde au submit conservée (encaisser()).
  let opened = false
  try {
    opened = await openGuardedForm(async () => {
      selected.value = row
      form.value = { nature: 'tranche1', montant: 0, remise: 0, mode: 'cash', date: new Date().toISOString().slice(0, 10), reference: '', observation: '' }
      lastReceiptId.value = null
      await Promise.all([loadSituation(row.id), loadHistory(row.id)])
    })
  } catch (err) {
    if (isNoSecretError(err)) {
      ElMessage.warning(mapAccountingError(err))
      void router.push('/comptabilite/setup')
    }
    return
  }
  if (!opened) return
}

async function loadSituation(studentId: number): Promise<void> {
  situationLoading.value = true
  situationError.value = null
  try {
    const data = await strictInvoke<{
      tuitionFeeDue?: number; inscriptionFeeDue?: number; totalDue?: number
      totalPaid?: number; totalRemaining?: number; payments?: Array<{ paymentType?: string; amount?: number }>
    }>('payment:getByStudent', studentId)
    const totalDu = Number(data?.totalDue ?? (Number(data?.tuitionFeeDue ?? 0) + Number(data?.inscriptionFeeDue ?? 0)))
    const totalPaye = Number(data?.totalPaid ?? 0)
    const totalReste = Number(data?.totalRemaining ?? Math.max(0, totalDu - totalPaye))
    const pays: Array<{ paymentType?: string; amount?: number }> = Array.isArray(data?.payments) ? data.payments : []
    const byNature = new Map<string, number>()
    for (const p of pays) byNature.set(String(p.paymentType ?? 'other'), (byNature.get(String(p.paymentType ?? 'other')) ?? 0) + Number(p.amount ?? 0))
    const natures = ['inscription', 'reinscription', 'tranche1', 'tranche2', 'tranche3']
    if (!natures.some((n) => byNature.has(n)) && totalDu > 0) {
      situationRows.value = [{ nature: 'Scolarité', montant: totalDu, paye: totalPaye, reste: totalReste, echeance: '—' }]
    } else {
      situationRows.value = natures
        .filter((n) => byNature.has(n) || totalDu > 0)
        .map((n) => {
          const paye = byNature.get(n) ?? 0
          const part = totalDu > 0 ? Math.round(totalDu / natures.length) : 0
          return { nature: labelNature(n), montant: part, paye, reste: Math.max(0, part - paye), echeance: '—' }
        })
    }
  } catch (err) {
    situationRows.value = []
    const msg = err instanceof Error ? err.message : 'Situation financière non chargée (zéro mock)'
    situationError.value = msg
    ElMessage.error(msg)
  } finally {
    situationLoading.value = false
  }
}

async function loadHistory(studentId: number): Promise<void> {
  historyLoading.value = true
  historyError.value = null
  try {
    const data = await strictInvoke<{
      payments?: Array<{ id?: number; created_at?: string; createdAt?: string; paymentType?: string; type?: string; amount?: number; paymentMethod?: string; receiptNumber?: string; caissier?: string; actor?: string }>
    }>('payment:getByStudent', studentId)
    const pays = Array.isArray(data?.payments) ? data.payments : []
    historyRows.value = pays.map((p) => ({
      id: Number(p.id ?? 0),
      date: fmtDate(p.created_at ?? p.createdAt),
      nature: labelNature(p.paymentType ?? p.type),
      montant: Number(p.amount ?? 0),
      mode: labelMode(p.paymentMethod),
      recu: String(p.receiptNumber ?? `R-${p.id ?? '—'}`),
      caissier: String(p.caissier ?? p.actor ?? '—'),
    }))
  } catch (err) {
    historyRows.value = []
    const msg = err instanceof Error ? err.message : 'Historique non chargé (zéro mock)'
    historyError.value = msg
    ElMessage.error(msg)
  } finally {
    historyLoading.value = false
  }
}

async function encaisser(): Promise<void> {
  if (!selected.value || paying.value) return
  if (montantAPayer.value <= 0) {
    ElMessage.warning('Montant à payer invalide')
    return
  }
  paying.value = true
  try {
    // Garde mot de passe comptable avant CHAQUE saisie (STRICT : force + frais, modale systématique).
    // Messages distincts conservés (NO_SECRET / LOCK / FRESH) — jamais de toast générique.
    try {
      await ensureUnlock({ force: true, fresh: true })
    } catch (guardErr) {
      if (isNoSecretError(guardErr)) {
        ElMessage.warning(mapAccountingError(guardErr))
        void router.push('/comptabilite/setup')
      } else if (isAccountingLockError(guardErr)) {
        ElMessage.warning(mapAccountingError(guardErr))
      }
      throw guardErr
    }
    // Clé générée UNE fois : le rejeu sur verrouillage réutilise le même objet.
    // Rétro-compat : reference/paymentDate/remise n'ont pas de colonne payments dédiée.
    // Report dans `comment` (persisté) + envoi séparé pour cash_movements côté backend.
    const extraBits: string[] = []
    if (form.value.reference?.trim()) extraBits.push(`[Réf: ${form.value.reference.trim()}]`)
    if (Number(form.value.remise ?? 0) > 0) extraBits.push(`[Remise: ${Number(form.value.remise)}]`)
    if (form.value.date) extraBits.push(`[Date saisie: ${form.value.date}]`)
    const enrichedObservation = [form.value.observation?.trim(), ...extraBits].filter(Boolean).join(' | ') || undefined
    const payload = {
      studentId: selected.value.id,
      amount: montantAPayer.value,
      paymentType: form.value.nature,
      paymentMethod: form.value.mode,
      reference: form.value.reference || undefined,
      comment: enrichedObservation,
      paymentDate: form.value.date,
      remise: Number(form.value.remise ?? 0),
      idempotencyKey: uuidv4(),
    }
    let res: { id?: number | string; receiptNumber?: string }
    try {
      res = await strictInvoke<{ id?: number | string; receiptNumber?: string }>('payment:create', payload)
    } catch (ipcErr) {
      if (!isAccountingLockError(ipcErr)) throw ipcErr
      await ensureUnlock({ force: true, fresh: true })
      res = await strictInvoke<{ id?: number | string; receiptNumber?: string }>('payment:create', payload)
    }
    const newId = (res as unknown as { id?: number | string })?.id ?? (res as unknown as { receiptNumber?: string })?.receiptNumber
    if (!newId) throw new Error('Paiement sans identifiant retourné (zéro mock)')
    lastReceiptId.value = newId as string | number
    ElMessage.success('Paiement encaissé')
    await Promise.all([loadSituation(selected.value.id), loadHistory(selected.value.id)])
    await printLastReceipt()
  } catch (err) {
    // NO_SECRET déjà notifié + redirection : pas de 2e toast générique.
    if (isNoSecretError(err)) {
      console.warn('[student-payment] abandon (NO_SECRET_SET déjà notifié).')
      return
    }
    // Log détaillé : montant, référence, remise, date — jamais de perte silencieuse.
    // mapAccountingError préserve les codes verrou (LOCK/FRESH) au lieu d'un générique.
    const raw = err instanceof Error ? err.message : 'Encaissement impossible (zéro mock)'
    const msg = isAccountingLockError(err) ? mapAccountingError(err) : raw
    console.error('[student-payment] Échec encaissement:', {
      studentId: selected.value?.id,
      montant: form.value.montant,
      remise: form.value.remise,
      montantAPayer: montantAPayer.value,
      nature: form.value.nature,
      mode: form.value.mode,
      date: form.value.date,
      reference: form.value.reference,
      observation: form.value.observation,
      message: raw,
      error: err,
    })
    ElMessage.error(msg)
  } finally {
    paying.value = false
  }
}

async function printLastReceipt(): Promise<void> {
  if (!lastReceiptId.value) {
    ElMessage.warning('Aucun reçu à imprimer')
    return
  }
  try {
    // Maquette CASY factorisée : même HTML que ReceiptTemplate (2 colonnes mensuel/tranches).
    const { load, casyInput, receipt } = useReceipt(lastReceiptId.value)
    await load()
    if (!casyInput.value || !receipt.value) throw new Error('Reçu introuvable (réponse vide — aucun mock)')
    const html = buildCasyReceiptHtml(casyInput.value, { title: `Reçu ${receipt.value.numero}` })
    const opened = openCasyPrintWindow(html, `recu_${String(receipt.value.numero || lastReceiptId.value).replace(/[^A-Za-z0-9-]+/g, '-')}.html`)
    if (opened) ElMessage.success("Fenêtre d'impression ouverte")
    else ElMessage.warning('Pop-up bloquée — reçu téléchargé en HTML.')
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : 'Impression reçu impossible (zéro mock)')
  }
}

async function pdfLastReceipt(): Promise<void> {
  if (!lastReceiptId.value) {
    ElMessage.warning('Aucun reçu à exporter')
    return
  }
  try {
    const { load, exportPdf } = useReceipt(lastReceiptId.value)
    await load()
    exportPdf()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : 'Export PDF impossible (zéro mock)')
  }
}

async function sendLastReceipt(): Promise<void> {
  if (!lastReceiptId.value) {
    ElMessage.warning('Aucun reçu à envoyer')
    return
  }
  // Garde d'OUVERTURE avant l'envoi (double garde : useReceipt re-vérifie au submit IPC).
  let opened = false
  try {
    opened = await openGuardedForm(async () => undefined)
  } catch (err) {
    if (isNoSecretError(err)) {
      ElMessage.warning(mapAccountingError(err))
      void router.push('/comptabilite/setup')
    }
    return
  }
  if (!opened) return
  try {
    const { load, sendReceipt } = useReceipt(lastReceiptId.value)
    await load()
    await sendReceipt()
  } catch (err) {
    ElMessage.error(err instanceof Error ? err.message : 'Envoi reçu impossible (zéro mock)')
  }
}
</script>

<style scoped>
.pay-page { padding: 20px 20px 48px; background: var(--app-page-bg-color, #f5f5f5); min-height: calc(100vh - 70px); box-sizing: border-box; }
.pay-head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.pay-head h1 { margin: 0; font-size: 22px; }
.pay-head p { margin: 4px 0 0; color: var(--el-text-color-secondary); }
.pay-card { border-radius: 8px; margin-bottom: 12px; }
.pay-search { display: flex; gap: 10px; flex-wrap: wrap; }
.pay-search__input { flex: 1; min-width: 240px; }
.pay-sub { font-size: 12px; color: var(--el-text-color-secondary); }
.pay-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 12px; }
.pay-student { display: flex; gap: 14px; }
.pay-student h3 { margin: 0 0 6px; }
.pay-student p { margin: 2px 0; font-size: 13px; }
.pay-panel { border: 1px solid var(--el-color-warning); }
.pay-form { margin-top: 4px; }
.pay-words { font-size: 13px; color: var(--el-text-color-secondary); }
.pay-actions { display: flex; gap: 8px; margin-top: 8px; flex-wrap: wrap; }
</style>
