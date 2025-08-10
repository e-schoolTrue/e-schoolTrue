<template>
  <div class="card-preview">
    <div class="preview-container" ref="previewContainer">
      <div class="preview-controls">
        <el-button-group>
          <el-tooltip content="Voir le recto">
            <el-button 
              :type="!isFlipped ? 'primary' : 'default'"
              @click="handleFlip"
            >
              <Icon icon="mdi:card-account-details" />
            </el-button>
          </el-tooltip>
          <el-tooltip content="Voir le verso">
            <el-button 
              :type="isFlipped ? 'primary' : 'default'"
              @click="handleFlip"
            >
              <Icon icon="mdi:card-account-details-outline" />
            </el-button>
          </el-tooltip>
        </el-button-group>

        <el-tooltip content="Zoom">
          <el-slider
            v-model="zoom"
            :min="50"
            :max="150"
            :step="10"
            :format-tooltip="(value: number) => `${value}%`"
          />
        </el-tooltip>
      </div>

      <div 
        class="card-container"
        :class="{ 'is-flipped': isFlipped }"
        :style="{ transform: `scale(${zoom / 100})` }"
      >
        <component
          :is="templateComponent"
          :student="student"
          :school-info="schoolInfo"
          :color-scheme="colorScheme"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, provide } from 'vue';
import { Icon } from '@iconify/vue';
import type { Student, SchoolInfo, ColorScheme } from '@/types';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
defineProps<{
  student: Student;
  schoolInfo: SchoolInfo;
  colorScheme: ColorScheme;
  templateComponent: any;
}>();

const zoom = ref(100);
const isFlipped = ref(false);
const previewContainer = ref<HTMLElement | null>(null);

const handleFlip = () => {
  isFlipped.value = !isFlipped.value;
};

// Fournir l'état de retournement aux composants enfants
provide('cardFlipState', {
  isFlipped,
  toggleFlip: handleFlip
});
</script>

<style scoped>
.card-preview {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.preview-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background: linear-gradient(45deg, #f8f9fa, #fff);
  border-radius: 8px;
  position: relative;
  overflow: hidden;
}

.preview-controls {
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  gap: 20px;
  align-items: center;
  z-index: 10;
}

.card-container {
  margin-top: 60px;
  transform-style: preserve-3d;
  transition: transform 0.6s cubic-bezier(0.4, 0, 0.2, 1);
}

:deep(.el-slider) {
  width: 100px;
}

/* Patron de fond */
.preview-container::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 10px,
    rgba(0, 0, 0, 0.01) 10px,
    rgba(0, 0, 0, 0.01) 20px
  );
  pointer-events: none;
}

@media print {
  .preview-controls {
    display: none;
  }

  .preview-container::before {
    display: none;
  }

  .card-container {
    transform: none !important;
    margin: 0;
  }

  .card-preview {
    background: none;
  }
}
</style>