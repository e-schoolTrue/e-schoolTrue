/**
 * Ordre d'imputation des paiements mensuels — hook partagé.
 *
 * Extrait de `PayementConfigurationView.vue` pour ne pas grossir le fichier :
 * options, labels, normalisation + preview. La logique pure de tri vit dans
 * `@/utils/receiptCasy` (`resolveImputationOrder`) — ce hook ne fait que
 * l'enrobage réactif pour le formulaire.
 */
import { computed, ref } from 'vue'
import {
  DEFAULT_IMPUTATION_ORDER,
  resolveImputationOrder,
  type PaymentImputationOrder,
} from '@/utils/receiptCasy'

export type { PaymentImputationOrder }
export { DEFAULT_IMPUTATION_ORDER }

export const IMPUTATION_ORDER_OPTIONS: ReadonlyArray<{
  value: PaymentImputationOrder
  label: string
  hint: string
}> = [
  { value: 'FIRST_FIRST', label: 'Premier d’abord (Oct → Juin)', hint: 'Comportement actuel' },
  { value: 'LAST_FIRST', label: 'Dernier d’abord (Juin → Oct)', hint: 'Impute Juin en premier' },
  { value: 'LAST2_THEN_FIRST', label: '2 derniers puis premier (Juin, Mai → Oct…)', hint: 'Juin, Mai puis Oct…' },
  { value: 'LAST3_THEN_FIRST', label: '3 derniers puis premier (Juin, Mai, Avr → Oct…)', hint: 'Juin, Mai, Avr puis Oct…' },
] as const

/** Garde-fou : valeur inconnue → défaut FIRST_FIRST (actuel). */
export function normalizeImputationOrder(v: unknown): PaymentImputationOrder {
  return v === 'LAST_FIRST' || v === 'LAST2_THEN_FIRST' || v === 'LAST3_THEN_FIRST'
    ? v
    : 'FIRST_FIRST'
}

/** Libellé court pour reçu / PDF. */
export function imputationOrderLabel(order: unknown): string {
  const o = normalizeImputationOrder(order)
  return IMPUTATION_ORDER_OPTIONS.find((x) => x.value === o)?.label ?? o
}

/** Tag persisté dans `payments.comment` pour figer l'ordre au paiement (sans migration). */
export function formatImputationTag(order: unknown): string {
  return `[Imputation:${normalizeImputationOrder(order)}]`
}

const IMPUTATION_TAG_RE = /\[Imputation:(FIRST_FIRST|LAST_FIRST|LAST2_THEN_FIRST|LAST3_THEN_FIRST)\]/

/** Extrait l'ordre figé d'un commentaire paiement, `null` si absent. */
export function parseImputationTag(comment: unknown): PaymentImputationOrder | null {
  const m = IMPUTATION_TAG_RE.exec(String(comment ?? ''))
  return m ? (m[1] as PaymentImputationOrder) : null
}

/**
 * Ordre live depuis `payment:getCustomConfigs` (défaut FIRST_FIRST, best effort).
 * Utilisé au moment du paiement pour figer l'ordre ; `useReceipt` reste
 * figé-d'abord puis live en repli.
 * @param gradeId - id classe élève (prioritaire), sinon config défaut.
 */
export async function fetchLiveImputationOrder(gradeId?: unknown): Promise<PaymentImputationOrder> {
  try {
    const { safeInvoke } = await import('@/utils/ipc')
    const all = await safeInvoke<Array<{
      gradeId?: unknown; isDefault?: boolean
      monthlyConfig?: { paymentImputationOrder?: unknown }
    }>>('payment:getCustomConfigs', [], {})
    const list = Array.isArray(all) ? all : []
    const mine = gradeId != null
      ? list.find((c) => Number(c?.gradeId) === Number(gradeId))
      : undefined
    const picked = mine ?? list.find((c) => c?.isDefault) ?? list[0]
    return normalizeImputationOrder(picked?.monthlyConfig?.paymentImputationOrder)
  } catch {
    return DEFAULT_IMPUTATION_ORDER
  }
}

/**
 * Hook formulaire : ordre courant + preview réactive (`Juin → Mai → Oct …`).
 * @param initial - ordre initial (défaut FIRST_FIRST).
 */
export function useImputationOrder(initial: unknown = DEFAULT_IMPUTATION_ORDER) {
  const order = ref<PaymentImputationOrder>(normalizeImputationOrder(initial))
  const preview = computed<string[]>(() =>
    resolveImputationOrder(
      ['Octobre', 'Novembre', 'Décembre', 'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin'],
      order.value,
    ),
  )
  const previewText = computed(() => preview.value.join(' → '))
  function setOrder(v: unknown): void {
    order.value = normalizeImputationOrder(v)
  }
  return { order, preview, previewText, setOrder, options: IMPUTATION_ORDER_OPTIONS }
}
