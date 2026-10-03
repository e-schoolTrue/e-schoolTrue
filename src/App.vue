<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import UpdateNotifier from '@/components/common/UpdateNotifier.vue'
import AccountingGuardHost from '@/components/accounting/AccountingGuardHost.vue'
import { useThemeStore } from '@/stores/themeStore'
import { useYearStore, PENDING_DB_REFRESH_KEY } from '@/stores/yearStore'
import { loadCurrency } from '@/composables/useCurrency'

const themeStore = useThemeStore()

/**
 * Fix import/restore "Aucune année ouverte" sans restart : le backend broadcast
 * `backup:db-replaced` après le swap à froid (voir localBackupService).
 * On refetch la liste des années pour que LoginView affiche les données
 * sans redémarrage manuel. Best-effort, jamais bloquant.
 * Note : fetchCurrent seul ne persiste jamais activeYear — la persistance
 * se fait uniquement via init(null) / refreshAfterClose après reload
 * (flag `eschool:pending-db-refresh`), voir onMounted ci-dessous.
 */
function handleDbReplaced(): void {
  try {
    const yearStore = useYearStore()
    void yearStore.fetchList().catch(() => undefined)
  } catch {
    /* best-effort */
  }
}

/** Consomme le flag posé AVANT reload dev : refetch APRÈS reload + repersist. */
async function consumePendingDbRefresh(): Promise<void> {
  let pending = false
  try {
    pending = localStorage.getItem(PENDING_DB_REFRESH_KEY) != null
  } catch {
    return
  }
  if (!pending) return
  try {
    const yearStore = useYearStore()
    await yearStore.fetchList().catch(() => undefined)
    await yearStore.init(null).catch(() => undefined)
  } catch {
    /* best-effort */
  } finally {
    try {
      localStorage.removeItem(PENDING_DB_REFRESH_KEY)
    } catch {
      /* best-effort */
    }
  }
}

onMounted(() => {
  themeStore.loadTheme()
  void loadCurrency()
  // Import/restore dev : le renderer a reloadé APRÈS clear+fetchList.
  // On refetch + init(null) pour repersister activeYear (fetchCurrent seul
  // ne persiste jamais — seul init()/refreshAfterClose le fait).
  void consumePendingDbRefresh()
  try {
    ;(window as unknown as { ipcRenderer?: { on: (...a: unknown[]) => void } }).ipcRenderer?.on?.(
      'backup:db-replaced',
      handleDbReplaced,
    )
  } catch {
    /* best-effort (tests jsdom sans IPC) */
  }
})

onUnmounted(() => {
  try {
    const ipc = (window as unknown as { ipcRenderer?: { removeListener?: (...a: unknown[]) => void } })
      .ipcRenderer
    ipc?.removeListener?.('backup:db-replaced', handleDbReplaced)
  } catch {
    /* best-effort */
  }
})
</script>

<template>
    <RouterView/>
<!--    <LicenseChecker />-->
    <UpdateNotifier />
    <AccountingGuardHost />
</template>

<style>
html, body {
  margin: 0;
  padding: 0;
  height: 100%;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen,
    Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif;
}

#app {
  height: 100vh;
}

* {
  box-sizing: border-box;
}
</style>
