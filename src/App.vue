<script setup lang="ts">
import { onMounted } from 'vue'
import UpdateNotifier from '@/components/common/UpdateNotifier.vue'
import AccountingGuardHost from '@/components/accounting/AccountingGuardHost.vue'
import { useThemeStore } from '@/stores/themeStore'
import { loadCurrency } from '@/composables/useCurrency'

const themeStore = useThemeStore()

onMounted(() => {
  themeStore.loadTheme()
  void loadCurrency()
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
