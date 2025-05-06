<template>
  <div class="card-flip-controller">
    <slot :is-flipped="isFlipped" :toggle-flip="toggleFlip"></slot>
  </div>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue';

const isFlipped = ref(false);

const toggleFlip = () => {
  isFlipped.value = !isFlipped.value;
};

// Fournir l'état et la fonction de retournement aux composants enfants
provide('cardFlipState', {
  isFlipped,
  toggleFlip
});
</script>

<style scoped>
.card-flip-controller {
  perspective: 1000px;
}
</style>