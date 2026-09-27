<template>
  <!-- @deprecated Fusionné dans /payment/professors?tab=heures (ProfessorPaymentView). Redirection via /enseignants. -->
  <div class="pay-page">
    <el-alert type="warning" show-icon closable={false} title="Écran déplacé : utilisez Paie Profs › Heures mensuelles (/payment/professors?tab=heures)" description="TeacherPayView est deprecated et sera supprimé. Redirection automatique via /enseignants." />
    <div class="pay-head">
      <div>
        <h1>Paie profs à l'heure</h1>
        <p>Filtres Mois / Année — 100% dynamique, zéro mock.</p>
      </div>
      <div class="pay-actions">
        <el-select v-model="mois" placeholder="Mois" style="width: 150px">
          <el-option v-for="m in moisOptions" :key="m.value" :label="m.label" :value="m.value" />
        </el-select>
        <el-select v-model="annee" placeholder="Année" style="width: 120px">
          <el-option v-for="y in anneeOptions" :key="y" :label="String(y)" :value="y" />
        </el-select>
        <el-button type="primary" :loading="loading" @click="charger">Charger heures</el-button>
        <el-button type="success" :loading="payingAll" :disabled="!selectedIds.length || payingAll" @click="validerEtPayer">Valider et payer</el-button>
      </div>
    </div>

    <el-card class="pay-card" shadow="hover">
      <el-skeleton v-if="loading" :rows="5" animated />
      <el-empty v-else-if="loadError" :description="loadError" />
      <el-empty v-else-if="!store.teacherHours.length" description="Aucune heure pour cette période — changez Mois / Année (zéro mock)" />
      <div v-else>
        <HourLogTable :rows="store.teacherHours" @view="goSlip" @validate="validateRow" @pay="payRow" @select="selectRow" />
        <div class="pay-select">
          <el-checkbox-group v-model="selectedIds">
            <el-checkbox v-for="r in store.teacherHours" :key="r.id" :value="r.id">{{ r.firstname }} {{ r.lastname }}</el-checkbox>
          </el-checkbox-group>
        </div>
      </div>
    </el-card>

    <el-card v-if="current" class="pay-card pay-panel" shadow="hover">
      <template #header><strong>Détails — {{ current.firstname }} {{ current.lastname }}</strong></template>
      <el-form label-width="150px" class="pay-form">
        <el-row :gutter="16">
          <el-col :xs="24" :md="12">
            <el-form-item label="Heures"><el-input-number v-model="detail.heures" :min="0" style="width: 100%" controls-position="right" /></el-form-item>
            <el-form-item label="Tarif"><el-input-number v-model="detail.tarif" :min="0" style="width: 100%" controls-position="right" /></el-form-item>
            <el-form-item label="Sous-total"><el-input :value="formatMoney(sousTotal)" disabled /></el-form-item>
            <el-form-item label="Prime"><el-input-number v-model="detail.prime" :min="0" style="width: 100%" controls-position="right" /></el-form-item>
            <el-form-item label="Transport"><el-input-number v-model="detail.transport" :min="0" style="width: 100%" controls-position="right" /></el-form-item>
          </el-col>
          <el-col :xs="24" :md="12">
            <el-form-item label="Avance"><el-input-number v-model="detail.avance" :min="0" style="width: 100%" controls-position="right" /></el-form-item>
            <el-form-item label="Retenue"><el-input-number v-model="detail.retenue" :min="0" style="width: 100%" controls-position="right" /></el-form-item>
            <el-form-item label="Montant à payer"><el-input :value="formatMoney(montantAPayer)" disabled /></el-form-item>
            <el-form-item label="Mode">
              <el-select v-model="detail.mode" style="width: 100%">
                <el-option label="Espèces" value="cash" />
                <el-option label="Mobile Money" value="mobile_money" />
                <el-option label="Virement" value="transfer" />
              </el-select>
            </el-form-item>
            <el-form-item label="Téléphone"><el-input v-model="detail.telephone" placeholder="Téléphone enseignant" /></el-form-item>
            <el-form-item label="Observation"><el-input v-model="detail.observation" type="textarea" :rows="2" /></el-form-item>
          </el-col>
        </el-row>
        <p class="pay-words">En lettres : <em>{{ amountInWords(montantAPayer) }}</em></p>
        <div class="pay-actions">
          <el-button type="primary" :loading="saving" :disabled="saving" @click="enregistrer">Enregistrer</el-button>
          <el-button @click="apercu">Aperçu bulletin</el-button>
        </div>
      </el-form>
    </el-card>

    <SalarySlipPreview
      v-if="current && showPreview"
      :school-name="schoolName"
      :periode="`${moisLabel} ${annee}`"
      :numero="`PAY-ENS-${annee}-${String(current.id).padStart(4, '0')}`"
      :enseignant="`${current.firstname} ${current.lastname}`"
      :matiere="current.matiere"
      :heures="detail.heures"
      :tarif-horaire="detail.tarif"
      :sous-total="sousTotal"
      :prime="detail.prime"
      :transport="detail.transport"
      :avance="detail.avance"
      :retenue="detail.retenue"
      :brut="sousTotal + detail.prime + detail.transport"
      :deductions="[]"
      :date="today"
      :mode="detail.mode"
      :telephone="detail.telephone"
      :lettres="amountInWords(montantAPayer)"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * @deprecated Fusion paie : utiliser ProfessorPaymentView (/payment/professors?tab=heures).
 * Conservé temporairement pour compatibilité, route /enseignants redirige vers le shell fusionné.
 */
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import HourLogTable from '@/components/accounting/HourLogTable.vue'
import SalarySlipPreview from '@/components/accounting/SalarySlipPreview.vue'
import { useAccountingStore, type TeacherHourRow } from '@/stores/accountingStore'
import { useCurrency } from '@/composables/useCurrency'
import { strictInvoke } from '@/utils/ipc'
import { isNoSecretError, mapAccountingError, openGuardedForm } from '@/composables/useAccountingGuard'

const store = useAccountingStore()
const router = useRouter()
const { formatMoney, amountInWords } = useCurrency()

const now = new Date()
const mois = ref(String(now.getMonth() + 1).padStart(2, '0'))
const annee = ref(now.getFullYear())
const moisOptions = [
  { value: '01', label: 'Janvier' }, { value: '02', label: 'Février' }, { value: '03', label: 'Mars' },
  { value: '04', label: 'Avril' }, { value: '05', label: 'Mai' }, { value: '06', label: 'Juin' },
  { value: '07', label: 'Juillet' }, { value: '08', label: 'Août' }, { value: '09', label: 'Septembre' },
  { value: '10', label: 'Octobre' }, { value: '11', label: 'Novembre' }, { value: '12', label: 'Décembre' },
]
const anneeOptions = computed(() => {
  const y = now.getFullYear()
  return [y - 2, y - 1, y, y + 1]
})
const moisLabel = computed(() => moisOptions.find((m) => m.value === mois.value)?.label ?? mois.value)

const loading = ref(false)
const loadError = ref<string | null>(null)
const payingAll = ref(false)
const saving = ref(false)
const selectedIds = ref<number[]>([])
const current = ref<TeacherHourRow | null>(null)
const showPreview = ref(false)
const schoolName = ref('')
const today = ref(new Date().toISOString().slice(0, 10))

const detail = ref({ heures: 0, tarif: 0, prime: 0, transport: 0, avance: 0, retenue: 0, mode: 'cash', telephone: '', observation: '' })
const sousTotal = computed(() => Number(detail.value.heures ?? 0) * Number(detail.value.tarif ?? 0))
const montantAPayer = computed(() => Math.max(0, sousTotal.value + Number(detail.value.prime ?? 0) + Number(detail.value.transport ?? 0) - Number(detail.value.avance ?? 0) - Number(detail.value.retenue ?? 0)))

function uuidv4(): string {
  const c = window.crypto as unknown as { randomUUID?: () => string }
  if (c?.randomUUID) return c.randomUUID()
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0
    return (ch === 'x' ? r : (r & 0x3) | 0x8).toString(16)
  })
}

async function charger(): Promise<void> {
  loading.value = true
  loadError.value = null
  current.value = null
  showPreview.value = false
  try {
    await store.fetchTeacherHours(`${annee.value}-${mois.value}`, annee.value)
    if (!store.teacherHours.length) return
    const s = await strictInvoke<{ name?: string }>('school:get', {})
    schoolName.value = String((s as unknown as { name?: string })?.name ?? '')
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Chargement heures impossible (zéro mock)'
    loadError.value = msg
  } finally {
    loading.value = false
  }
}

function selectRow(row: TeacherHourRow): void {
  // Garde d'OUVERTURE : popup AVANT d'afficher le panneau de détail/paie.
  void (async () => {
    try {
      await openGuardedForm(() => {
        current.value = row
        showPreview.value = false
        detail.value = {
          heures: Number(row.heures ?? 0),
          tarif: Number(row.tarifHoraire ?? 0),
          prime: Number(row.prime ?? 0),
          transport: Number(row.transport ?? 0),
          avance: Number(row.avance ?? 0),
          retenue: Number(row.retenue ?? 0),
          mode: String(row.mode ?? 'cash'),
          telephone: String(row.phone ?? ''),
          observation: String(row.observation ?? ''),
        }
      })
    } catch (err) {
      handleGuardError(err)
    }
  })()
}

function goSlip(row: TeacherHourRow): void {
  void router.push(`/bulletins/${row.id}`)
}

/** Redirige vers le setup si aucun secret n'est configuré (garde store). */
function handleGuardError(err: unknown): void {
  if (isNoSecretError(err)) {
    ElMessage.warning(mapAccountingError(err))
    void router.push('/comptabilite/setup')
  }
  /* sinon le store notifie déjà */
}

async function validateRow(row: TeacherHourRow): Promise<void> {
  // Garde d'OUVERTURE AVANT validation (double garde store au submit conservée).
  let opened = false
  try {
    opened = await openGuardedForm(async () => undefined)
  } catch (err) { handleGuardError(err); return }
  if (!opened) return
  try {
    await store.validateTeacher(row.id)
    ElMessage.success('Ligne validée')
  } catch (err) { handleGuardError(err) }
}

async function payRow(row: TeacherHourRow): Promise<void> {
  // Garde d'OUVERTURE AVANT paiement (double garde store au submit conservée).
  let opened = false
  try {
    opened = await openGuardedForm(async () => undefined)
  } catch (err) { handleGuardError(err); return }
  if (!opened) return
  try {
    // Clé générée UNE fois : le rejeu store réutilise le même objet.
    await store.payTeacher(row.id, { month: `${annee.value}-${mois.value}`, idempotencyKey: uuidv4() })
    ElMessage.success('Paiement enregistré')
  } catch (err) { handleGuardError(err) }
}

async function validerEtPayer(): Promise<void> {
  if (!selectedIds.value.length || payingAll.value) return
  // Garde d'OUVERTURE AVANT paiement groupé (double garde store conservée).
  let opened = false
  try {
    opened = await openGuardedForm(async () => undefined)
  } catch (err) { handleGuardError(err); return }
  if (!opened) return
  payingAll.value = true
  try {
    // P1 fix : clé d'idempotence PAR enseignant — ${batchKey}-${professorId}-${month}.
    // Un uuid unique partagé pour tout le lot faisait que teacherPay(#2) retrouvait
    // le paiement #1 via findOne global. Chaque enseignant a désormais sa propre clé.
    const month = `${annee.value}-${mois.value}`
    const batchKey = uuidv4()
    const idempotencyKeys: Record<number, string> = Object.fromEntries(
      selectedIds.value.map((id) => [id, `${batchKey}-${id}-${month}`]),
    )
    await store.payTeacherBatch(selectedIds.value, { month, batchKey, idempotencyKeys })
    ElMessage.success(`${selectedIds.value.length} enseignant(s) payé(s)`)
    selectedIds.value = []
    await charger()
  } catch (err) { handleGuardError(err) } finally {
    payingAll.value = false
  }
}

async function enregistrer(): Promise<void> {
  if (!current.value || saving.value) return
  // Garde d'OUVERTURE AVANT enregistrement paie (double garde store conservée).
  let opened = false
  try {
    opened = await openGuardedForm(async () => undefined)
  } catch (err) { handleGuardError(err); return }
  if (!opened) return
  saving.value = true
  try {
    // Clé générée UNE fois : le rejeu store réutilise le même objet.
    await store.payTeacher(current.value.id, {
      month: `${annee.value}-${mois.value}`,
      heures: detail.value.heures,
      tarifHoraire: detail.value.tarif,
      prime: detail.value.prime,
      transport: detail.value.transport,
      avance: detail.value.avance,
      retenue: detail.value.retenue,
      mode: detail.value.mode,
      telephone: detail.value.telephone,
      observation: detail.value.observation,
      montant: montantAPayer.value,
      idempotencyKey: uuidv4(),
    })
    ElMessage.success('Paie enregistrée')
  } catch (err) { handleGuardError(err) } finally {
    saving.value = false
  }
}

function apercu(): void {
  showPreview.value = true
}

onMounted(charger)
</script>

<style scoped>
.pay-page { padding: 20px 20px 48px; background: var(--app-page-bg-color, #f5f5f5); min-height: calc(100vh - 70px); box-sizing: border-box; }
.pay-head { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.pay-head h1 { margin: 0; font-size: 22px; }
.pay-head p { margin: 4px 0 0; color: var(--el-text-color-secondary); }
.pay-actions { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
.pay-card { border-radius: 8px; margin-bottom: 12px; }
.pay-panel { border: 1px solid var(--el-color-primary); }
.pay-select { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px; }
.pay-words { font-size: 13px; color: var(--el-text-color-secondary); }
.pay-form { margin-top: 4px; }
</style>
