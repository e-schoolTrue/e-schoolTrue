<template>
  <div class="color-scheme-selector">
    <!-- Thèmes prédéfinis -->
    <div class="predefined-schemes">
      <h3>Thèmes prédéfinis</h3>
      <div class="schemes-grid">
        <div
          v-for="scheme in schemes"
          :key="scheme.name"
          class="scheme-item"
          :class="{ active: isSelected(scheme) }"
          @click="selectScheme(scheme)"
        >
          <div class="color-preview">
            <div class="color-dot" :style="{ backgroundColor: scheme.primary }" />
            <div class="color-dot" :style="{ backgroundColor: scheme.secondary }" />
            <div class="color-dot" :style="{ backgroundColor: scheme.text }" />
          </div>
          <span class="scheme-name">{{ scheme.name }}</span>
        </div>
      </div>
    </div>

    <!-- Couleurs personnalisées -->
    <div class="custom-colors">
      <div class="section-header">
        <h3>Couleurs personnalisées</h3>
        <el-switch
          v-model="useCustomColors"
          active-text="Activer"
        />
      </div>
      
      <div class="color-pickers" v-if="useCustomColors">
        <div class="color-picker-item">
          <span>Couleur principale</span>
          <el-color-picker
            v-model="customColors.primary"
            show-alpha
            @change="emitCustomColors"
          />
        </div>
        
        <div class="color-picker-item">
          <span>Couleur secondaire</span>
          <el-color-picker
            v-model="customColors.secondary"
            show-alpha
            @change="emitCustomColors"
          />
        </div>
        
        <div class="color-picker-item">
          <span>Couleur du texte</span>
          <el-color-picker
            v-model="customColors.text"
            show-alpha
            @change="emitCustomColors"
          />
        </div>
        
        <div class="color-picker-item">
          <span>Couleur de fond</span>
          <el-color-picker
            v-model="customColors.background"
            show-alpha
            @change="emitCustomColors"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { ColorScheme } from '@/types/card';
import { COLOR_SCHEMES, DEFAULT_COLOR_SCHEME } from '@/constants/colorSchemes';

const props = defineProps<{
  modelValue: ColorScheme;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: ColorScheme): void;
}>();

const schemes = COLOR_SCHEMES;
const useCustomColors = ref(false);
const customColors = ref({ ...DEFAULT_COLOR_SCHEME });

const isSelected = (scheme: ColorScheme): boolean => {
  return !useCustomColors.value && 
    scheme.primary === props.modelValue.primary &&
    scheme.secondary === props.modelValue.secondary;
};

const selectScheme = (scheme: ColorScheme) => {
  useCustomColors.value = false;
  emit('update:modelValue', { ...scheme });
};

const emitCustomColors = () => {
  if (useCustomColors.value) {
    emit('update:modelValue', { ...customColors.value });
  }
};
</script>

<style scoped>
.color-scheme-selector {
  display: flex;
  flex-direction: column;
  gap: 2rem;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1rem;
}

.schemes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
  gap: 1rem;
}

.scheme-item {
  border: 2px solid #eee;
  border-radius: 8px;
  padding: 0.75rem;
  cursor: pointer;
  transition: all 0.3s ease;
}

.scheme-item:hover {
  transform: translateY(-2px);
}

.scheme-item.active {
  border-color: var(--el-color-primary);
}

.color-preview {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.color-dot {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid #eee;
}

.scheme-name {
  font-size: 0.875rem;
  color: var(--el-text-color-regular);
}

.color-pickers {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.color-picker-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.color-picker-item span {
  font-size: 0.875rem;
  color: var(--el-text-color-regular);
}
</style> 