<script setup lang="ts">
import { onMounted } from 'vue'
import LicenseChecker from './components/LicenseChecker.vue'
import UpdateNotifier from '@/components/common/UpdateNotifier.vue'
import { useThemeStore } from '@/stores/themeStore'

const themeStore = useThemeStore()

onMounted(() => {
  themeStore.loadTheme()
})
</script>

<template>
    <RouterView/>
    <LicenseChecker />
    <UpdateNotifier />
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
