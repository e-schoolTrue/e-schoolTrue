import { computed } from 'vue'
import { useAccountingStore } from '@/stores/accountingStore'

/**
 * Façade caisse : soldes dérivés + actions d'ouverture / mouvement / clôture.
 * Les appels IPC (`cash:*`) sont encapsulés dans le store avec mock fallback.
 */
export function useCash() {
  const store = useAccountingStore()

  const soldeTheorique = computed(() => store.cashDay.soldeTheorique)
  const totalEntrees = computed(() => store.cashDay.totalEntrees)
  const totalSorties = computed(() => store.cashDay.totalSorties)
  const isOpen = computed(() => store.cashDay.ouvert && !store.cashDay.cloture)
  const ecart = computed(() => store.cashDay.ecart ?? 0)

  function load(dateISO: string): Promise<void> {
    return store.fetchCashDay(dateISO)
  }

  return {
    store,
    soldeTheorique,
    totalEntrees,
    totalSorties,
    isOpen,
    ecart,
    load,
    open: (fond: number) => store.openCash(fond),
    close: (reel: number) => store.closeCash(reel),
    add: (p: Parameters<typeof store.addMovement>[0]) => store.addMovement(p),
  }
}
