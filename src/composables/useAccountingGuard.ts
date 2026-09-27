import { nextTick, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { strictInvoke } from '@/utils/ipc'

/**
 * Garde mot de passe de connexion — passage obligé avant chaque saisie comptable.
 *
 * @remarks
 * STRICT : CHAQUE écriture exige `ensureUnlock({ force: true, fresh: true })`
 * — la modale s'ouvre systématiquement, plus de réutilisation d'unlock 8 min.
 * Le backend vérifie le MOT DE PASSE DE CONNEXION de l'utilisateur courant
 * (bcrypt vs UserEntity) et exige une preuve < 60 s single-use sur toutes
 * les écritures. Plus de secret comptable séparé à définir.
 * - File d'attente modale unique : les appels concurrents sont chaînés
 *   (`tail`) pour ne jamais empiler deux dialogues.
 * - `NO_SECRET_SET` ne survit que comme garde-fou "compte sans mot de passe"
 *   (quasi impossible : tout utilisateur actif en possède un).
 * - Aucun secret n'est stocké ici (ni Pinia, ni localStorage).
 */

export interface AccountingStatus {
  isSet: boolean
  unlocked: boolean
  fresh: boolean
  locked: boolean
  retryAfterMs: number
  failedAttempts: number
}

export interface EnsureUnlockOptions {
  /** Exige une vérification de moins de 60 s (opérations sensibles). */
  fresh?: boolean
  /** Force la réouverture du dialogue même si le statut semble valide. */
  force?: boolean
}

/** État partagé du dialogue global (monté une fois via AccountingGuardHost). */
export const guardDialogVisible = ref(false)
/** Le dialogue global ne fait que vérifier le mot de passe de connexion (verify seul). */
export const guardDialogFresh = ref(false)

interface Waiter {
  resolve: () => void
  reject: (err: Error) => void
}

let current: Waiter | null = null
/** Chaîne de sérialisation : garantit une seule modale à la fois. */
let tail: Promise<void> = Promise.resolve()

/** Vrai si l'erreur backend impose un (ré)affichage du dialogue. */
export function isAccountingLockError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /ACCOUNTING_LOCKED|ACCOUNTING_FRESH_REQUIRED|FRESH_REQUIRED/.test(msg)
}

/**
 * Vrai si le compte courant n'a aucun mot de passe (garde-fou quasi impossible).
 * Conservé pour compatibilité des appelants (redirect `/comptabilite/setup`).
 */
export function isNoSecretError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '')
  return /NO_SECRET_SET/.test(msg)
}

/**
 * Traduit les codes backend en messages français prêts pour l'UI.
 *
 * @param err - Erreur brute (message contenant le code backend).
 * @returns Message français affichable.
 */
export function mapAccountingError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err ?? '')
  if (/NO_SECRET_SET/.test(raw))
    return "Ce compte n'a pas de mot de passe de connexion. Contactez un administrateur."
  if (/ACCOUNTING_FRESH_REQUIRED|FRESH_REQUIRED/.test(raw))
    return 'Confirmation récente requise (moins de 60 s). Veuillez ressaisir votre mot de passe de connexion.'
  if (/ACCOUNTING_LOCKED/.test(raw))
    return 'Vérification verrouillée (tentatives épuisées ou session expirée). Veuillez ressaisir votre mot de passe.'
  if (/INVALID_SECRET/.test(raw)) return 'Mot de passe de connexion incorrect.'
  if (/WEAK_SECRET/.test(raw)) return 'Mot de passe trop court (4 caractères minimum).'
  if (/ALREADY_SET/.test(raw)) return 'Un mot de passe est déjà configuré. Utilisez la modification.'
  if (/NON_REQUIS/.test(raw)) return "Non requis : utilisez votre mot de passe de connexion."
  return raw || 'Opération comptable refusée.'
}

function formatDelay(ms: number): string {
  const s = Math.ceil(ms / 1000)
  const m = Math.floor(s / 60)
  return m > 0 ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`
}

async function doEnsure(opts: EnsureUnlockOptions = {}): Promise<void> {
  let st: AccountingStatus
  try {
    st = await strictInvoke<AccountingStatus>('comptabilite:status')
  } catch (err) {
    // Statut illisible => fail-closed, on exige une vérification.
    st = { isSet: true, unlocked: false, fresh: false, locked: false, retryAfterMs: 0, failedAttempts: 0 }
    if (isNoSecretError(err)) {
      const e = new Error(`NO_SECRET_SET: ${mapAccountingError(err)}`)
      ;(e as Error & { setupRequired?: boolean }).setupRequired = true
      throw e
    }
  }

  // Garde-fou quasi impossible : tout utilisateur actif possède un mot de passe
  // de connexion (le backend retourne isSet=true). Conservé pour compatibilité.
  if (!st.isSet) {
    const e = new Error(`NO_SECRET_SET: ${mapAccountingError('NO_SECRET_SET')}`)
    ;(e as Error & { setupRequired?: boolean }).setupRequired = true
    throw e
  }
  if (st.locked && st.retryAfterMs > 0 && !opts.force) {
    ElMessage.error(`Vérification verrouillée — réessayez dans ${formatDelay(st.retryAfterMs)}.`)
  }
  const needVerify = opts.force || !st.unlocked || (opts.fresh === true && !st.fresh)
  if (!needVerify) return

  if (current) {
    // Un dialogue est déjà ouvert : on s'aligne sur son issue.
    await new Promise<void>((resolve, reject) => {
      const prev = current
      const chainedResolve = (): void => {
        resolve()
      }
      const chainedReject = (e: Error): void => {
        reject(e)
      }
      if (prev) {
        const origResolve = prev.resolve
        const origReject = prev.reject
        prev.resolve = (): void => {
          origResolve()
          chainedResolve()
        }
        prev.reject = (e: Error): void => {
          origReject(e)
          chainedReject(e)
        }
      } else {
        reject(new Error('Dialogue comptable indisponible.'))
      }
    })
    // Après le dialogue partagé, revérifier le statut (dont fraîcheur).
    const after = await strictInvoke<AccountingStatus>('comptabilite:status').catch(
      () => ({ isSet: true, unlocked: false, fresh: false }) as AccountingStatus,
    )
    if (!after.unlocked || (opts.fresh === true && !after.fresh))
      throw new Error(`ACCOUNTING_LOCKED: ${mapAccountingError('ACCOUNTING_LOCKED')}`)
    return
  }

  guardDialogFresh.value = opts.fresh === true
  guardDialogVisible.value = true
  // Laisse le host propager `:model-value` → el-dialog (teleport body)
  // avant de bloquer sur la promesse : évite le `display:none` résiduel
  // quand l'overlay est peint un tick plus tard.
  await nextTick()
  // Fail-fast (fail-closed) : sans host monté, aucun dialogue ne pourra
  // jamais résoudre — rejeter avec un message explicite au lieu de pendre
  // (ex. tests jsdom sans App.vue : timeout silencieux sinon).
  // Le host unique (App.vue) porte `data-testid="accounting-guard-host"`.
  if (typeof document !== 'undefined' && document.querySelector('[data-testid="accounting-guard-host"]') === null) {
    guardDialogVisible.value = false
    throw new Error(
      'AccountingGuardHost introuvable — montez-le une fois dans App.vue (ou moquez ensureUnlock dans les tests).',
    )
  }
  await new Promise<void>((resolve, reject) => {
    current = { resolve, reject }
  }).finally(() => {
    current = null
  })
}

/**
 * Garantit le déverrouillage avant une écriture comptable.
 * Ouvre le dialogue uniquement si le statut l'exige.
 */
export function ensureUnlock(opts: EnsureUnlockOptions = {}): Promise<void> {
  const run = (): Promise<void> => doEnsure(opts)
  const p = tail.then(run)
  // La chaîne ne doit jamais casser sur un rejet (sinon tout se bloque).
  tail = p.catch(() => undefined)
  return p
}

/** Appelé par AccountingGuardHost en cas de succès du dialogue. */
export function resolveGuardDialog(): void {
  guardDialogVisible.value = false
  current?.resolve()
  current = null
}

/** Appelé par AccountingGuardHost en cas d'annulation/fermeture. */
export function rejectGuardDialog(err?: Error): void {
  guardDialogVisible.value = false
  current?.reject(err ?? new Error('Saisie annulée — mot de passe comptable requis.'))
  current = null
}

/**
 * Vrai si un `ensureUnlock()` attend encore l'issue du dialogue.
 * Utilisé par le host pour ne rejeter que les fermetures externes
 * (X / ESC) : `update:model-value=false` suivi de `@success`/`@cancelled`
 * dans le même tick ne doit pas rejeter avant la résolution réelle.
 */
export function hasPendingGuardDialog(): boolean {
  return current !== null
}

/** Verrouillage manuel best-effort (bouton « Verrouiller la caisse », logout). */
export async function lockAccounting(): Promise<void> {
  try {
    await strictInvoke('comptabilite:lock')
  } catch {
    /* best-effort : le backend purge aussi l'unlock au logout/redémarrage */
  }
}

/**
 * Garde d'OUVERTURE de formulaire comptable — popup AVANT l'ouverture, pas au submit.
 *
 * @param openFn - Callback d'ouverture du formulaire (set visible=true, select row…).
 * @returns `true` si le formulaire a été ouvert, `false` si Annuler (ne pas ouvrir).
 * @throws Rejette `NO_SECRET_SET` (garde-fou "compte sans mot de passe",
 * quasi impossible) pour laisser l'appelant rediriger vers `/comptabilite/setup`.
 *
 * @remarks
 * STRICT : `ensureUnlock({ force: true, fresh: true })` D'ABORD, à chaque clic,
 * même si une preuve < 60 s existe (pas de skip — l'utilisateur veut la popup
 * à chaque fois). Si OK → ouvre le formulaire ; la double garde au submit
 * (store / `payment:create`) reste en place et re-vérifiera.
 * @example
 * await openGuardedForm(() => { showAdd.value = true })
 */
export async function openGuardedForm(openFn: () => void | Promise<void>): Promise<boolean> {
  try {
    await ensureUnlock({ force: true, fresh: true })
  } catch (err) {
    if (isNoSecretError(err)) throw err
    return false
  }
  await openFn()
  return true
}

/** Façade du composable (mêmes instances partagées partout). */
export function useAccountingGuard(): {
  ensureUnlock: (opts?: EnsureUnlockOptions) => Promise<void>
  openGuardedForm: (openFn: () => void | Promise<void>) => Promise<boolean>
  lock: () => Promise<void>
  mapError: (err: unknown) => string
  isLockError: (err: unknown) => boolean
  isNoSecret: (err: unknown) => boolean
} {
  return {
    ensureUnlock,
    openGuardedForm,
    lock: lockAccounting,
    mapError: mapAccountingError,
    isLockError: isAccountingLockError,
    isNoSecret: isNoSecretError,
  }
}
