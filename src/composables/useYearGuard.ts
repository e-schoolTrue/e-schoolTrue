import { ElMessage } from 'element-plus'
import { useYearStore } from '@/stores/yearStore'
import { YEAR_CLOSED_CODE } from '@/types/year'

/**
 * Garde année clôturée — plan V3 (lecture seule).
 *
 * Une année au `status === 'closed'` interdit toute écriture :
 * - à l'entrée d'un écran d'écriture → `warnIfClosed()` (toast warning, on reste en lecture) ;
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
 * Avertit à l'entrée d'un écran d'écriture si l'année active est clôturée.
 *
 * @param screen - Nom de l'écran (pour un message explicite).
 * @returns `true` si clôturée (l'appelant désactive alors ses actions d'écriture).
 */
export function warnIfClosed(screen = 'cet écran'): boolean {
  try {
    const yearStore = useYearStore()
    if (yearStore.isClosed) {
      ElMessage.warning(
        `Année ${yearStore.currentSchoolYear || ''} clôturée — ${screen} en lecture seule.`.trim(),
      )
      return true
    }
  } catch {
    /* Pinia indisponible (tests) : fail-open */
  }
  return false
}
