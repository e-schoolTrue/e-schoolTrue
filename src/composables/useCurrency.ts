import { ref } from 'vue';
import { formatCurrency as formatCurrencyUtil, normalizeCurrencyCode } from '@/components/util/currencyFormatter';
import { amountInWordsFR } from '@/utils/amountInWordsFR';

/**
 * Store réactif devise école (singleton).
 *
 * - `currencyCode` : code ISO réactif (XOF / XAF / GNF / MAD — jamais "FCFA" générique).
 * - `currency` : alias d'affichage (= currencyCode).
 * - `loadCurrency()` : à appeler au boot (App.vue) + après `school:save`.
 * - Ne fait PAS de `onMounted` interne : l'appelant gère son cycle de vie.
 */

const currencyCode = ref<string>('XOF');
const currency = ref<string>('XOF');

function codeForCountry(country: string | undefined | null): string {
  const c = String(country ?? '').trim().toUpperCase();
  // ISO distincts : Sénégal => XOF (BCEAO), Centrafrique => XAF (BEAC)
  const isoMap: Record<string, string> = {
    SEN: 'XOF',
    SN: 'XOF',
    CAF: 'XAF',
    CF: 'XAF',
    CMR: 'XAF',
    CM: 'XAF',
    GIN: 'GNF',
    GN: 'GNF',
    GUI: 'GNF',
    MAR: 'MAD',
    MA: 'MAD',
    CIV: 'XOF',
    CI: 'XOF',
    MLI: 'XOF',
    ML: 'XOF',
    BFA: 'XOF',
    BF: 'XOF',
  };
  return isoMap[c] ?? 'XOF';
}

async function loadCurrency(): Promise<string> {
  try {
    const ipc = (window as unknown as { ipcRenderer?: { invoke: (ch: string, ...a: unknown[]) => Promise<unknown> } }).ipcRenderer;
    if (!ipc?.invoke) return currencyCode.value;
    const res = (await ipc.invoke('school:get')) as { success?: boolean; data?: { country?: string; currency?: string } } | null;
    const country = res?.success ? res?.data?.country : undefined;
    const explicit = res?.success ? res?.data?.currency : undefined;
    const code = explicit ? normalizeCurrencyCode(explicit) : codeForCountry(country);
    currencyCode.value = code;
    currency.value = code;
    return code;
  } catch (error) {
    console.error('Erreur lors de la récupération de la devise:', error);
    return currencyCode.value;
  }
}

/** Réécoute les sauvegardes école pour rafraîchir la devise temps réel. */
function watchSchoolSave(): void {
  try {
    const ipc = (window as unknown as { ipcRenderer?: { on?: (ch: string, cb: () => void) => void } }).ipcRenderer;
    ipc?.on?.('school:save', () => {
      void loadCurrency();
    });
  } catch {
    /* écoute optionnelle */
  }
}

watchSchoolSave();

export function useCurrency() {
  const formatCurrency = (value: number): string => formatCurrencyUtil(value, currencyCode.value);
  const formatMoney = (value: number): string => formatCurrencyUtil(value, currencyCode.value);
  const amountInWords = (value: number): string => amountInWordsFR(value, currencyCode.value);
  return {
    currency,
    currencyCode,
    loadCurrency,
    formatCurrency,
    formatMoney,
    amountInWords,
  };
}

export { loadCurrency };
