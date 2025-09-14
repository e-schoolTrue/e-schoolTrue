<template>
  <div 
    contenteditable="true"
    @blur="onBlur"
    @input="onInput"
    @keydown.enter.prevent="onEnter"
    class="editable-cell"
    :class="{ 'modified': isModified }"
  >
    {{ localValue }}
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';

const props = defineProps<{ modelValue: number | null, isModified: boolean }>();
const emit = defineEmits(['update:modelValue']);

const localValue = ref(props.modelValue);

watch(() => props.modelValue, (newValue) => {
  localValue.value = newValue;
});

const onInput = (event: Event) => {
  const target = event.target as HTMLDivElement;
  const value = target.textContent;
  // Allow only numbers and a single dot
  if (value && !/^[0-9]*\.?[0-9]*$/.test(value)) {
    // Restore old value
    target.textContent = String(localValue.value || '');
    return;
  }
  const parsedValue = value ? parseFloat(value) : null;
  if (parsedValue !== localValue.value) {
    emit('update:modelValue', parsedValue);
  }
};

const onBlur = (event: FocusEvent) => {
  const target = event.target as HTMLDivElement;
  target.textContent = String(localValue.value || '');
};

const onEnter = (event: KeyboardEvent) => {
  (event.target as HTMLDivElement).blur();
};

</script>

<style scoped>
.editable-cell {
  padding: 5px;
  border: 1px solid transparent;
}

.editable-cell:focus {
  outline: none;
  border-color: #4a90e2;
  background-color: #f0f8ff;
}

.modified {
  background-color: #fff3cd; /* Light yellow to indicate modification */
}
</style>
