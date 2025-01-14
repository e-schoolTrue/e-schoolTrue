<template>
  <span>{{ formattedAmount }} {{ currency }}</span>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useCurrency } from '@/composables/useCurrency';

const props = defineProps<{
  amount: number;
}>();

const { currency } = useCurrency();

const formattedAmount = computed(() => {
  return new Intl.NumberFormat('fr-FR').format(props.amount);
});
</script> 