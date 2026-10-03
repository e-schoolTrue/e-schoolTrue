import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { YearRepartitionResponse } from '@/types/year'
import { YEAR_CLOSED_CODE } from '@/types/year'

/** Clé de persistance de l'année active (localStorage). */
export const YEAR_STORAGE_KEY = 'activeYear'

type IpcInvoke = (channel: string, ...args: unknown[]) => Promise<unknown>
type IpcEnvelope<T> = { success?: boolean; data?: T | null; message?: string; error?: string; code?: string }

function getIpc(): IpcInvoke | undefined {
  const w = window as unknown as { ipcRenderer?: { invoke: IpcInvoke } }
  return typeof w.ipcRenderer?.invoke === 'function' ? w.ipcRenderer.invoke.bind(w.ipcRenderer) : undefined
}

function unwrapList(res: unknown): YearRepartitionResponse[] {
  const data = (res as IpcEnvelope<unknown>)?.data ?? res
  if (Array.isArray(data)) return data as YearRepartitionResponse[]
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>
    for (const key of ['years', 'items', 'rows', 'list']) {
      if (Array.isArray(obj[key])) return obj[key] as YearRepartitionResponse[]
    }
  }
  return []
}

function unwrapOne<T>(res: unknown): T | null {
  const env = res as IpcEnvelope<T>
  if (env && typeof env === 'object' && 'success' in env) return (env.data ?? null) as T | null
  return (res ?? null) as T | null
}

function isClosedError(err: unknown): boolean {
  const msg =
    err instanceof Error
      ? `${err.message} ${(err as { code?: string }).code ?? ''}`
      : typeof err === 'string'
        ? err
        : JSON.stringify(err ?? '')
  return msg.includes(YEAR_CLOSED_CODE)
}

/**
 * Store année scolaire active — plan V3 + verrou global.
 *
 * Règle produit : AUCUN sélecteur d'année en cours de session.
 * Le header (`dashbord-menu.vue`) affiche l'année en LECTURE SEULE
 * (el-tag, sans dropdown, sans @change). L'année de travail est choisie
 * AU LOGIN puis reste figée pour la session.
 *
 * GARDE-FOU — `setActiveYear` autorisé UNIQUEMENT depuis :
 * - `LoginView` (choix initial),
 * - `YearRepartitionView` admin (gouvernance, après `yearRepartition:setCurrent`).
 * Tout autre appel est INTERDIT (notamment aucun switch dans le menu).
 * - `fetchList` / `fetchCurrent` : lectures autorisées partout (warm store,
 *   N-1 réinscription, bornes rapports) — elles ne changent JAMAIS `activeYear`.
 * - AUCUN écran métier n'expose de sélecteur ou de champ année (même disabled) :
 *   consommation silencieuse de `activeYear` / `currentSchoolYear`.
 *
 * - `activeYear` : année de travail globale (persistée localStorage `activeYear`).
 * - `list` : toutes les répartitions (`yearRepartition:getAll` canonique → `year:list` → `year:getAll`).
 * - `setActiveYear` : réservé au login (`LoginView`) et à la gouvernance
 *   admin (`YearRepartitionView.setCurrentYear` synchronise le store après
 *   `yearRepartition:setCurrent` serveur).
 * - Année clôturée (`status === 'closed'`) = lecture seule : les écrans
 *   d'écriture doivent appeler `warnIfClosed()` (voir `@/composables/useYearGuard`).
 *
 * Chaînage login : `userStore.setUser(u)` PUIS `yearStore.init(defaultYear)` —
 * voir `LoginView.vue`. Guard router : année exigée, redirect
 * `/school-repartition` si absente (sans proposer de switch).
 */
export const useYearStore = defineStore('year', () => {
  // --- State ---
  const activeYear = ref<YearRepartitionResponse | null>(null)
  const list = ref<YearRepartitionResponse[]>([])
  const loading = ref(false)
  const initialized = ref(false)

  // --- Computed ---
  const activeYearId = computed(() => activeYear.value?.id ?? null)
  const currentSchoolYear = computed(() => activeYear.value?.schoolYear ?? '')
  /** Vrai si l'année active est clôturée → lecture seule. */
  const isClosed = computed(() => activeYear.value?.status === 'closed')
  const isCurrent = computed(() => activeYear.value?.isCurrent === true)
  /**
   * Lecture seule globale : vrai quand AUCUNE année courante ouverte.
   * - `activeYear` null (getCurrent null, DB vide ou clôture sans N+1),
   * - ou année clôturée,
   * - ou année non courante (stale / pas encore définie courante).
   * Se lève automatiquement dès qu'une nouvelle année est créée +
   * définie courante (`setActiveYear` → année ouverte courante).
   * Alias `writeLocked` conservé pour les vues existantes.
   */
  const isReadOnly = computed(
    () =>
      activeYear.value == null ||
      activeYear.value.status === 'closed' ||
      activeYear.value.isCurrent !== true,
  )
  const writeLocked = computed(() => isReadOnly.value)

  // --- Helpers persistance ---
  function persist(year: YearRepartitionResponse | null) {
    try {
      if (year) localStorage.setItem(YEAR_STORAGE_KEY, JSON.stringify(year))
      else localStorage.removeItem(YEAR_STORAGE_KEY)
    } catch {
      /* stockage indisponible : état mémoire seul */
    }
  }

  /** Valide qu'une année candidate existe dans la liste serveur (m6 : jamais d'écrasement aveugle). */
  function isKnownYear(candidate: YearRepartitionResponse | null, scope: YearRepartitionResponse[]): boolean {
    if (!candidate || typeof candidate !== 'object' || candidate.id == null) return false
    if (scope.length === 0) return true // liste vide : on ne peut pas invalider (fail-open)
    return scope.some((y) => y.id === candidate.id)
  }

  function hydrateStored(): YearRepartitionResponse | null {
    try {
      const raw = localStorage.getItem(YEAR_STORAGE_KEY)
      if (!raw) return null
      const parsed = JSON.parse(raw) as YearRepartitionResponse
      if (!parsed || typeof parsed !== 'object' || parsed.id == null) return null
      if (typeof parsed.schoolYear !== 'string' || !/^\d{4}-\d{4}$/.test(parsed.schoolYear.trim())) return null
      return parsed
    } catch {
      return null
    }
  }

  async function tryChannels<T>(channels: Array<{ name: string; args?: unknown[] }>): Promise<T | null> {
    const invoke = getIpc()
    if (!invoke) return null
    for (const ch of channels) {
      try {
        const res = await invoke(ch.name, ...(ch.args ?? []))
        const env = res as IpcEnvelope<T>
        if (env && typeof env === 'object' && 'success' in env) {
          if (env.success) return (env.data ?? null) as T | null
          // `success:false` explicite : canal existant mais échec → on arrête le fallback ?
          // Non : on continue, un alias peut réussir (ex. year:list inconnu → yearRepartition:getAll).
          continue
        }
        if (res !== undefined && res !== null) return res as T
      } catch {
        continue
      }
    }
    return null
  }

  // --- Actions ---
  /**
   * Charge la liste des années (m7 : point d'entrée unique — `student-filter` et
   * `PaymentManagement` doivent passer par ici, plus d'invoke `year:*` en direct).
   * Canal canonique `yearRepartition:getAll` en premier, alias V3 en repli.
   */
  async function fetchList(): Promise<YearRepartitionResponse[]> {
    const invoke = getIpc()
    if (!invoke) return list.value
    loading.value = true
    try {
      for (const channel of ['yearRepartition:getAll', 'year:list', 'year:getAll']) {
        try {
          const res = await invoke(channel)
          const env = res as IpcEnvelope<unknown>
          if (env && typeof env === 'object' && 'success' in env && !env.success) continue
          const items = unwrapList(res)
          // Le canal canonique `yearRepartition:getAll` fait foi même vide ;
          // les alias V3 ne sont acceptés que non vides (fallback suivant sinon).
          if (items.length > 0 || channel === 'yearRepartition:getAll') {
            list.value = items
            return items
          }
        } catch {
          continue
        }
      }
      return list.value
    } finally {
      loading.value = false
    }
  }

  /** Année courante côté serveur (`year:getCurrent` → `yearRepartition:getCurrent`). */
  async function fetchCurrent(): Promise<YearRepartitionResponse | null> {
    const current = await tryChannels<YearRepartitionResponse>([
      { name: 'year:getCurrent' },
      { name: 'yearRepartition:getCurrent' },
    ])
    return unwrapOne<YearRepartitionResponse>(current) as YearRepartitionResponse | null
  }

  /**
   * Initialise le store après login : liste + année active.
   *
   * @param defaultYear - Année choisie au login (prioritaire). `null` = init serveur seule.
   */
  async function init(defaultYear?: YearRepartitionResponse | null): Promise<void> {
    // m6 : fail-open total — aucun rejet IPC ne doit empêcher le shell de démarrer.
    try {
      await fetchList().catch(() => undefined)
    } catch {
      /* fail-open : liste conservée en l'état */
    }
    if (defaultYear?.id != null) {
      // Choix explicite du login (déjà validé via setActiveYear par l'appelant).
      activeYear.value = defaultYear
      persist(defaultYear)
    } else {
      // m6 : hydrateStored validé contre la liste serveur avant tout écrasement.
      const stored = hydrateStored()
      if (stored && isKnownYear(stored, list.value)) activeYear.value = stored
    }
    // Réconcilie avec le serveur : le flag `isCurrent` fait foi, mais validé.
    try {
      const serverCurrent = await fetchCurrent().catch(() => null)
      if (serverCurrent?.id != null && isKnownYear(serverCurrent, list.value)) {
        const full = list.value.find((y) => y.id === serverCurrent.id) ?? serverCurrent
        // Ne pas écraser un choix explicite de login sans validation serveur.
        if (!defaultYear) {
          activeYear.value = full
          persist(full)
        }
      } else if (!activeYear.value) {
        const flagged = list.value.find((y) => y.isCurrent) ?? null
        if (flagged) {
          activeYear.value = flagged
          persist(flagged)
        }
      }
    } catch {
      /* fail-open : on garde l'état local validé */
    }
    initialized.value = true
  }

  /**
   * Fixe l'année active via validation serveur — usage restreint :
   * login (`LoginView`) et gouvernance admin (`YearRepartitionView` après
   * `yearRepartition:setCurrent`). Tout autre appel est interdit
   * (les écrans métier consomment `activeYear` silencieusement, sans UI année ;
   * le header menu est en lecture seule, sans switch).
   *
   * B2 : canal canonique `yearRepartition:setCurrent` en premier,
   * alias V3 `year:switch` en repli (le backend actuel n'expose que
   * `yearRepartition:*`).
   *
   * @param yearId - Identifiant de l'année cible.
   * @throws {Error} `YEAR_CLOSED` si l'année est clôturée (toast déjà affiché).
   */
  async function setActiveYear(yearId: number): Promise<YearRepartitionResponse> {
    const invoke = getIpc()
    if (!invoke) throw new Error('IPC indisponible : bascule d’année impossible')
    loading.value = true
    try {
      const attempts: Array<{ name: string; args: unknown[] }> = [
        { name: 'yearRepartition:setCurrent', args: [yearId] },
        { name: 'year:switch', args: [{ yearId }] },
        { name: 'year:switch', args: [yearId] },
      ]
      let lastError: unknown = null
      for (const ch of attempts) {
        try {
          const res = (await invoke(ch.name, ...ch.args)) as IpcEnvelope<YearRepartitionResponse>
          if (res && typeof res === 'object' && 'success' in res) {
            if (res.success && res.data) {
              activeYear.value = res.data
              persist(res.data)
              return res.data
            }
            lastError = new Error(res.message || res.error || `Échec ${ch.name}`)
            if (isClosedError(lastError) || String(res.code ?? '').includes(YEAR_CLOSED_CODE)) {
              ElMessage.error('Année clôturée — bascule refusée (lecture seule).')
              throw lastError
            }
            continue
          }
          if (res) {
            const year = res as unknown as YearRepartitionResponse
            if (year && (year as { id?: number }).id != null) {
              activeYear.value = year
              persist(year)
              return year
            }
          }
        } catch (err) {
          if (isClosedError(err)) {
            ElMessage.error('Année clôturée — bascule refusée (lecture seule).')
            throw err
          }
          lastError = err
          // Canal inconnu côté backend → on essaie l'alias suivant.
          continue
        }
      }
      throw lastError instanceof Error ? lastError : new Error('Bascule d’année impossible')
    } finally {
      loading.value = false
    }
  }

  /** Libellé N+1 (ex. `2024-2025` → `2025-2026`), `null` si incalculable. */
  function nextSchoolYearLabel(from?: string): string | null {
    const base = from ?? currentSchoolYear.value
    const m = /^(\d{4})-(\d{4})$/.exec(base.trim())
    if (!m) return null
    const a = Number(m[1]) + 1
    const b = Number(m[2]) + 1
    return `${a}-${b}`
  }

  function clear() {
    activeYear.value = null
    list.value = []
    initialized.value = false
    persist(null)
  }

  /**
   * Resynchronise après clôture / création : `getCurrent` serveur fait foi.
   * - serveur null → lecture seule globale (`activeYear = null`).
   * - serveur ouvert → année active mise à jour (levée du verrou).
   */
  async function refreshAfterClose(): Promise<void> {
    try {
      const serverCurrent = await fetchCurrent().catch(() => null)
      if (serverCurrent?.id != null && serverCurrent.status !== 'closed') {
        const full = list.value.find((y) => y.id === serverCurrent.id) ?? serverCurrent
        activeYear.value = full
        persist(full)
      } else {
        activeYear.value = null
        persist(null)
      }
    } catch {
      /* fail-open */
    }
  }

  return {
    activeYear,
    list,
    loading,
    initialized,
    activeYearId,
    currentSchoolYear,
    isClosed,
    isCurrent,
    isReadOnly,
    writeLocked,
    fetchList,
    fetchCurrent,
    init,
    setActiveYear,
    nextSchoolYearLabel,
    clear,
    refreshAfterClose,
  }
})
