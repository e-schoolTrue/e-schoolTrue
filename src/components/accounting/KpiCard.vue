<template>
  <el-card class="acc-kpi" shadow="hover">
    <div class="acc-kpi__row">
      <div class="acc-kpi__icon" :class="`is-${color}`">
        <Icon :icon="icon" />
      </div>
      <div class="acc-kpi__body">
        <span class="acc-kpi__label">{{ label }}</span>
        <span v-if="plain" class="acc-kpi__value">{{ plain }}</span>
        <span v-else class="acc-kpi__value"><CurrencyDisplay :amount="amount" /></span>
        <span v-if="hint" class="acc-kpi__hint">{{ hint }}</span>
      </div>
    </div>
  </el-card>
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import CurrencyDisplay from '@/components/common/CurrencyDisplay.vue'

/** Carte indicateur comptable (ombre légère, radius 8px gamme finance). */
defineProps<{
  label: string
  amount: number
  plain?: string
  icon: string
  color?: 'blue' | 'green' | 'orange' | 'red'
  hint?: string
}>()
</script>

<style scoped>
.acc-kpi {
  border-radius: 8px;
}
.acc-kpi__row {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 4px;
}
.acc-kpi__icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  flex-shrink: 0;
}
.acc-kpi__icon.is-blue { background: rgba(64, 158, 255, 0.12); color: var(--el-color-primary); }
.acc-kpi__icon.is-green { background: rgba(103, 194, 58, 0.12); color: var(--el-color-success); }
.acc-kpi__icon.is-orange { background: rgba(230, 162, 60, 0.14); color: var(--el-color-warning); }
.acc-kpi__icon.is-red { background: rgba(245, 108, 108, 0.12); color: var(--el-color-danger); }
.acc-kpi__body {
  display: flex;
  flex-direction: column;
  min-width: 0;
}
.acc-kpi__label {
  font-size: 12px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--el-text-color-secondary);
}
.acc-kpi__value {
  font-size: 22px;
  font-weight: 700;
  color: var(--el-text-color-primary);
}
.acc-kpi__hint {
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
