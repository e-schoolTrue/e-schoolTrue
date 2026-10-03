import { ElMessage } from 'element-plus'
import { useYearStore } from '@/stores/yearStore'
import { YEAR_CLOSED_CODE } from '@/types/year'

/**
 * Garde année clôturée — plan V3 (lecture seule, SANS UI).
 *
 * Une année au `status === 'closed'` interdit toute écriture :
 * - à l'entrée d'un écran d'écriture → `warnIfClosed()` (retourne `true`,
 *   AUCUN toast/bandeau : l'UI reste silencieuse, l'appelant verrouille
 *   ses actions d'écriture via la valeur de retour) ;
 * - à l'échec IPC portant `YEAR_CLOSED` → `handleYearClosedError()` (toast error).
 */

/** Vrai si l'erreur (rejet IPC, envelope, message) signale une année clôturée. */
export function isYearClosedError(err: unknown): boolean {
  if (!err) return false
  const haystack =
    err instanceof Error
      ? `${err.message} ${JSON.stringify(err as unknown as Record<string, unknown>)}`
      : typeof err === 'string'
        ? err
        : JSON.stringify(err)
  return haystack.includes(YEAR_CLOSED_CODE)
}

/**
 * Toast d'erreur standardisé sur refus `YEAR_CLOSED`.
 *
 * @param err - Erreur d'origine (rejet IPC ou envelope `success:false`).
 */
export function handleYearClosedError(err: unknown): void {
  if (isYearClosedError(err)) {
    ElMessage.error('Année clôturée — écriture interdite (lecture seule).')
  }
}

/**
 * Indique si l'app est en lecture seule (aucune année courante ouverte :
 * getCurrent null / activeYear null ou closed). SANS UI : aucun toast ni
 * bandeau — l'appelant verrouille ses actions via la valeur de retour.
 *
 * @param _screen - Nom de l'écran (conservé pour compatibilité d'appel, ignoré).
 * @returns `true` si lecture seule (l'appelant désactive alors ses actions d'écriture).
 */
export function warnIfClosed(_screen = 'cet écran'): boolean {
  try {
    const yearStore = useYearStore()
    const readOnly = (yearStore as unknown as { isReadOnly?: boolean }).isReadOnly ?? yearStore.isClosed
    void _screen
    return !!readOnly
  } catch {
    /* Pinia indisponible (tests) : fail-open */
  }
  return false
}

/** Alias explicite du nouveau comportement (lecture seule globale). */
export const warnIfReadOnly = warnIfClosed
