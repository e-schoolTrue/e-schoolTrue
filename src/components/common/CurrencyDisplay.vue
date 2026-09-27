<template>
  <span>{{ formatted }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCurrency } from '@/composables/useCurrency';

const props = defineProps<{
  amount: number;
}>();

const { currencyCode } = useCurrency();

/** Affichage devise via formatCurrency seul (code ISO réactif XOF/XAF/GNF/MAD). */
const formatted = computed(() => {
  const { formatCurrency } = useCurrency();
  return formatCurrency(Number(props.amount ?? 0));
});

void currencyCode;
</script>
