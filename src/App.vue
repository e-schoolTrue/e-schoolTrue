<script setup lang="ts">
import LicenseChecker from './components/LicenseChecker.vue'
</script>


<template>
    <RouterView/>
    <LicenseChecker />
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
