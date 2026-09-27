<script setup lang="ts">
import { computed } from 'vue'
import { useYearStore } from '@/stores/yearStore'

const yearStore = useYearStore()

/** Bannière globale lecture seule — même pattern que l'onboarding (`el-alert` warning, non fermable). */
const visible = computed(() => yearStore.isClosed)
const label = computed(() => yearStore.currentSchoolYear || '')
</script>

<template>
  <el-alert
    v-if="visible"
    :title="`Année ${label} clôturée — lecture seule`"
    type="warning"
    :closable="false"
    show-icon
    class="year-closed-banner"
  />
</template>

<style scoped>
.year-closed-banner {
  border-radius: 0;
  position: sticky;
  top: 0;
  z-index: 2000;
}
</style>
