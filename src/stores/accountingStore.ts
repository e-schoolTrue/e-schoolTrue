import { defineStore } from 'pinia'
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { strictInvoke } from '@/utils/ipc'
import { useYearStore } from '@/stores/yearStore'
import {
  ensureUnlock,
  isAccountingLockError,
  isNoSecretError,
} from '@/composables/useAccountingGuard'

/** Ligne de courbe 30 jours. */
export interface CurvePoint {
  date: string
  entrees: number
  sorties: number
}

/** Indicateurs du tableau de bord comptable (8 KPI). */
export interface AccountingKpis {
  encaisseMois: number
  impayesTotal: number
  depensesMois: number
  soldeCaisse: number
  elevesAJour: number
  elevesEnRetard: number
  effectifTotal: number
  tauxRecouvrement: number
}

/** Impayé élève. */
export interface ArrearRow {
  id: number
  firstname: string
  lastname: string
  matricule: string
  classe: string
  phone?: string
  famillyPhone?: string
  personalPhone?: string
  echeance?: string
  totalDu: number
  totalPaye: number
  reste: number
  joursRetard: number
  statut: 'partiel' | 'impaye'
}

/** Dépense. */
export interface ExpenseRow {
  id: number
  date: string
  categorie: string
  libelle: string
  montant: number
  mode: string
  justificatif?: string
  acteur?: string
}

/** Mouvement de caisse. */
export interface CashMovement {
  id: number
  heure: string
  sens: 'entree' | 'sortie'
  motif: string
  montant: number
  mode: string
  reference?: string
}

/** État journalier de caisse. */
export interface CashDay {
  date: string
  ouvert: boolean
  fondOuverture: number
  totalEntrees: number
  totalSorties: number
  soldeTheorique: number
  soldeReel?: number
  ecart?: number
  cloture?: boolean
}

/** Heure enseignant pour la paie (ventilée maquette 6+7). */
export interface TeacherHourRow {
  id: number
  teacherId?: number
  firstname: string
  lastname: string
  phone?: string
  matiere: string
  mois: string
  annee: number
  heures: number
  tarifHoraire: number
  surcharge: number
  sousTotal: number
  prime: number
  transport: number
  avance: number
  retenue: number
  brut: number
  netAPayer: number
  mode?: string
  observation?: string
  statut: 'brouillon' | 'valide' | 'paye'
}

/**
 * Store comptabilité — 100% dynamique, zéro mock.
 * Toutes les lectures passent par `strictInvoke` (aucun fallback fictif),
 * en dev comme en prod. Échec => état vide + skeleton/empty-state côté vue
 * + `ElMessage.error`. Aucun chiffre en dur.
 */
export const useAccountingStore = defineStore('accounting', () => {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const kpis = ref<AccountingKpis>({
    encaisseMois: 0,
    impayesTotal: 0,
    depensesMois: 0,
    soldeCaisse: 0,
    elevesAJour: 0,
    elevesEnRetard: 0,
    effectifTotal: 0,
    tauxRecouvrement: 0,
  })
  const curveLabels = ref<string[]>([])
  const curveEntrees = ref<number[]>([])
  const curveSorties = ref<number[]>([])
  const donutTypes = ref<{ labels: string[]; values: number[] }>({ labels: [], values: [] })
  const donutModes = ref<{ labels: string[]; values: number[] }>({ labels: [], values: [] })
  const arrears = ref<ArrearRow[]>([])
  const expenses = ref<ExpenseRow[]>([])
  const cashDay = ref<CashDay>({
    date: new Date().toISOString().slice(0, 10),
    ouvert: false,
    fondOuverture: 0,
    totalEntrees: 0,
    totalSorties: 0,
    soldeTheorique: 0,
    cloture: false,
  })
  const movements = ref<CashMovement[]>([])
  const teacherHours = ref<TeacherHourRow[]>([])

  function fail(op: string, err: unknown): void {
    const msg = err instanceof Error ? err.message : `Échec ${op} — données non chargées (aucun mock)`
    error.value = msg
    ElMessage.error(msg)
  }

  /**
   * Garde mot de passe comptable avant CHAQUE écriture (STRICT).
   * - `ensureUnlock({ force: true, fresh: true })` systématique : la modale
   *   s'ouvre à chaque saisie, aucun cache ne skippe le dialogue.
   *   Backend single-use < 60 s : chaque écriture consomme sa preuve.
   * - Sur verrouillage (`ACCOUNTING_LOCKED` / `FRESH_REQUIRED`), rouvre le
   *   dialogue UNE fois puis rejoue l'opération avec le MÊME objet payload
   *   (l'`idempotencyKey` généré par l'appelant n'est jamais régénéré).
   * - `NO_SECRET_SET` remonte tel quel (redirect `/comptabilite/setup`).
   */
  async function guarded<T>(_fresh: boolean, op: () => Promise<T>): Promise<T> {
    await ensureUnlock({ fresh: true, force: true })
    try {
      return await op()
    } catch (err) {
      if (isNoSecretError(err) || !isAccountingLockError(err)) throw err
      await ensureUnlock({ fresh: true, force: true })
      return await op()
    }
  }

  /** Année du login (verrou global) — explicite à chaque appel IPC comptable. */
  function loginSchoolYear(): string | undefined {
    try {
      return useYearStore().currentSchoolYear || undefined
    } catch {
      return undefined
    }
  }

  /** Charge le tableau de bord (courbes + KPI + donuts) — strict, sans mock. */
  async function fetchDashboard(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      // Verrou : dashboard scopé sur l'année du login (backend `currentSY` en repli).
      const schoolYear = loginSchoolYear()
      const data = await strictInvoke<Partial<AccountingKpis> & {
        curve?: CurvePoint[]
        totalEleves?: number
        effectifTotal?: number
        salairesMois?: number
        paiementsMois?: number
        currency?: string
      }>('comptabilite:dashboard', schoolYear ? { schoolYear } : {})
      const effectif = Number(data.effectifTotal ?? data.totalEleves ?? 0)
      const aJour = Number(data.elevesAJour ?? 0)
      const enRetard = Number(data.elevesEnRetard ?? 0)
      const taux = effectif > 0 ? Math.round((aJour / effectif) * 100) : Number(data.tauxRecouvrement ?? 0)
      kpis.value = {
        encaisseMois: Number(data.encaisseMois ?? 0),
        impayesTotal: Number(data.impayesTotal ?? 0),
        depensesMois: Number(data.depensesMois ?? 0),
        soldeCaisse: Number(data.soldeCaisse ?? 0),
        elevesAJour: aJour,
        elevesEnRetard: enRetard,
        effectifTotal: effectif,
        tauxRecouvrement: taux,
      }
      const curve = data.curve
      if (Array.isArray(curve) && curve.length) {
        curveLabels.value = curve.map((c) => c.date)
        curveEntrees.value = curve.map((c) => Number(c.entrees ?? 0))
        curveSorties.value = curve.map((c) => Number(c.sorties ?? 0))
      } else {
        curveLabels.value = []
        curveEntrees.value = []
        curveSorties.value = []
      }
      const rep = await strictInvoke<{ types?: { labels: string[]; values: number[] }; modes?: { labels: string[]; values: number[] } }>('comptabilite:repartition', schoolYear ? { schoolYear } : {})
      donutTypes.value = rep?.types ?? { labels: [], values: [] }
      donutModes.value = rep?.modes ?? { labels: [], values: [] }
    } catch (err) {
      fail('tableau de bord', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /** Charge les impayés — strict, sans mock. Tolère `{ items }` et `[]`. */
  async function fetchArrears(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      // Verrou : impayés scopés sur l'année du login (vérifié : backend `computeArrearsBase` filtre déjà).
      const schoolYear = loginSchoolYear()
      const raw = await strictInvoke<ArrearRow[] | { items?: ArrearRow[] }>('comptabilite:impayes', schoolYear ? { schoolYear } : {})
      arrears.value = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : []
    } catch (err) {
      arrears.value = []
      fail('impayés', err)
      throw err
    } finally {
      loading.value = false
    }
  }

  /** Charge les dépenses — strict, sans mock. Tolère `{ items }` et `[]`. */
  async function fetchExpenses(): Promise<void> {
    error.value = null
    try {
      const raw = await strictInvoke<ExpenseRow[] | { items?: Array<Record<string, unknown>> }>('expense:list')
      if (Array.isArray(raw)) {
        expenses.value = raw
      } else if (Array.isArray(raw?.items)) {
        expenses.value = raw.items.map((e) => ({
          id: Number((e as Record<string, unknown>).id ?? 0),
          date: String((e as Record<string, unknown>).date ?? ''),
          categorie: String((e as Record<string, unknown>).categorie ?? ''),
          libelle: String((e as Record<string, unknown>).libelle ?? ''),
          montant: Number((e as Record<string, unknown>).montant ?? 0),
          mode: String((e as Record<string, unknown>).mode ?? ''),
          justificatif: (e as Record<string, unknown>).justificatif as string | undefined,
          acteur: (e as Record<string, unknown>).acteur as string | undefined,
        }))
      } else {
        expenses.value = []
      }
    } catch (err) {
      expenses.value = []
      fail('dépenses', err)
      throw err
    }
  }

  /** Crée une dépense — garde mot de passe puis strict, sans mock. */
  async function createExpense(payload: Omit<ExpenseRow, 'id'>): Promise<boolean> {
    try {
      const res = await guarded(true, () => strictInvoke<{ id?: number }>('expense:create', payload))
      const next: ExpenseRow = { ...payload, id: res?.id ?? Date.now() }
      expenses.value = [next, ...expenses.value]
      cashDay.value.totalSorties += payload.montant
      cashDay.value.soldeTheorique = cashDay.value.fondOuverture + cashDay.value.totalEntrees - cashDay.value.totalSorties
      return true
    } catch (err) {
      fail('création dépense', err)
      throw err
    }
  }

  /** Charge la journée de caisse — strict, sans mock. Tolère `{ items }` et `[]` pour mouvements. */
  async function fetchCashDay(dateISO: string): Promise<void> {
    error.value = null
    try {
      const data = await strictInvoke<CashDay>('cash:day', dateISO)
      cashDay.value = { ...data, date: dateISO }
      const rawMov = await strictInvoke<CashMovement[] | { items?: CashMovement[] }>('cash:movements', dateISO)
      movements.value = Array.isArray(rawMov) ? rawMov : Array.isArray(rawMov?.items) ? rawMov.items : []
    } catch (err) {
      movements.value = []
      fail('caisse du jour', err)
      throw err
    }
  }

  /** Ouvre la caisse du jour — garde mot de passe puis strict. */
  async function openCash(fond: number): Promise<void> {
    try {
      await guarded(true, () => strictInvoke('cash:open', { fond }))
      cashDay.value = { ...cashDay.value, ouvert: true, fondOuverture: fond, cloture: false }
    } catch (err) {
      fail('ouverture caisse', err)
      throw err
    }
  }

  /** Clôture la caisse — garde FRAÎCHE (60 s) puis strict. */
  async function closeCash(soldeReel: number): Promise<number> {
    try {
      await guarded(true, () => strictInvoke('cash:close', { soldeReel }))
      const ecart = soldeReel - cashDay.value.soldeTheorique
      cashDay.value = { ...cashDay.value, soldeReel, ecart, cloture: true }
      return ecart
    } catch (err) {
      fail('clôture caisse', err)
      throw err
    }
  }

  /** Ajoute un mouvement de caisse — garde mot de passe puis strict. */
  async function addMovement(payload: Omit<CashMovement, 'id'>): Promise<void> {
    try {
      await guarded(true, () => strictInvoke('cash:addMovement', payload))
      const next: CashMovement = { ...payload, id: Date.now() }
      movements.value = [next, ...movements.value]
      if (payload.sens === 'entree') cashDay.value.totalEntrees += payload.montant
      else cashDay.value.totalSorties += payload.montant
      cashDay.value.soldeTheorique = cashDay.value.fondOuverture + cashDay.value.totalEntrees - cashDay.value.totalSorties
    } catch (err) {
      fail('mouvement caisse', err)
      throw err
    }
  }

  /** Charge les heures enseignants (mois/année) — strict, sans mock. Tolère `{ items }` et `[]`. */
  async function fetchTeacherHours(mois?: string, annee?: number): Promise<void> {
    error.value = null
    try {
      const month = mois ?? (annee ? `${annee}-${String(new Date().getMonth() + 1).padStart(2, '0')}` : undefined)
      const raw = await strictInvoke<TeacherHourRow[] | { items?: TeacherHourRow[] }>('teacher:hours', { month, mois: month, annee })
      const rows = Array.isArray(raw) ? raw : Array.isArray(raw?.items) ? raw.items : []
      teacherHours.value = rows
    } catch (err) {
      teacherHours.value = []
      fail('heures enseignants', err)
      throw err
    }
  }

  /** Valide une ligne enseignant — garde mot de passe puis strict. */
  async function validateTeacher(id: number): Promise<void> {
    try {
      await guarded(true, () => strictInvoke('teacher:validate', id))
      teacherHours.value = teacherHours.value.map((t) => (t.id === id ? { ...t, statut: 'valide' } : t))
    } catch (err) {
      fail('validation ligne', err)
      throw err
    }
  }

  /** Paie une ligne enseignant — garde FRAÎCHE (60 s) puis strict. */
  async function payTeacher(id: number, payload?: Record<string, unknown>): Promise<void> {
    try {
      // Rejoué à l'identique : le MÊME `payload` (même idempotencyKey) est réutilisé.
      const body = payload ? { id, ...payload } : id
      await guarded(true, () => strictInvoke('teacher:pay', body))
      teacherHours.value = teacherHours.value.map((t) => (t.id === id ? { ...t, statut: 'paye' } : t))
    } catch (err) {
      fail('paiement enseignant', err)
      throw err
    }
  }

  /** Paie un lot d'enseignants — garde FRAÎCHE (60 s) puis strict. */
  async function payTeacherBatch(ids: number[], payload?: Record<string, unknown>): Promise<void> {
    try {
      // P1 : le payload contient { month, batchKey, idempotencyKeys: { [profId]: `${batchKey}-${profId}-${month}` } }.
      // Rejoué à l'identique : le MÊME objet est réutilisé (idempotence par enseignant préservée).
      const body = { ids, ...(payload ?? {}) }
      await guarded(true, () => strictInvoke('teacher:payBatch', body))
      teacherHours.value = teacherHours.value.map((t) => (ids.includes(t.id) ? { ...t, statut: 'paye' } : t))
    } catch (err) {
      fail('paiement lot', err)
      throw err
    }
  }

  /** Approuve une dépense — garde FRAÎCHE (60 s) puis strict. */
  async function approveExpense(id: number): Promise<void> {
    try {
      await guarded(true, () => strictInvoke('expense:approve', { id }))
      await fetchExpenses()
    } catch (err) {
      fail('approbation dépense', err)
      throw err
    }
  }

  /** Rejette une dépense — garde FRAÎCHE (60 s) puis strict. */
  async function rejectExpense(id: number): Promise<void> {
    try {
      await guarded(true, () => strictInvoke('expense:reject', { id }))
      await fetchExpenses()
    } catch (err) {
      fail('rejet dépense', err)
      throw err
    }
  }

  /** Crée une transaction bancaire — garde FRAÎCHE (60 s) puis strict. */
  async function createBankTransaction(payload: Record<string, unknown>): Promise<void> {
    try {
      await guarded(true, () => strictInvoke('bank:transaction:create', payload))
    } catch (err) {
      fail('transaction bancaire', err)
      throw err
    }
  }

  return {
    loading,
    error,
    kpis,
    curveLabels,
    curveEntrees,
    curveSorties,
    donutTypes,
    donutModes,
    arrears,
    expenses,
    cashDay,
    movements,
    teacherHours,
    fetchDashboard,
    fetchArrears,
    fetchExpenses,
    createExpense,
    approveExpense,
    rejectExpense,
    createBankTransaction,
    fetchCashDay,
    openCash,
    closeCash,
    addMovement,
    fetchTeacherHours,
    payTeacher,
    payTeacherBatch,
    validateTeacher,
  }
})
