<template>
  <div class="card-preview">
    <div class="preview-container" :class="{ 'is-flipped': isFlipped }">
      <div class="preview-controls">
        <el-button-group>
          <el-tooltip content="Voir le recto">
            <el-button 
              :type="!isFlipped ? 'primary' : 'default'"
              @click="isFlipped = false"
            >
              <Icon icon="mdi:card-account-details" />
            </el-button>
          </el-tooltip>
          <el-tooltip content="Voir le verso">
            <el-button 
              :type="isFlipped ? 'primary' : 'default'"
              @click="isFlipped = true"
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
        class="preview-card"
        :style="{ transform: `scale(${zoom / 100})` }"
      >
        <component
          :is="props.templateComponent"
          :student="props.student"
          :school-info="props.schoolInfo"
          :color-scheme="props.colorScheme"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { Icon } from '@iconify/vue';
import type { Student, SchoolInfo, ColorScheme } from '@/types/card';

const props = defineProps<{
  student: Student;
  schoolInfo: SchoolInfo;
  colorScheme: ColorScheme;
  templateComponent: any;
}>();

const isFlipped = ref(false);
const zoom = ref(100);
</script>

<style scoped>
.card-preview {
  padding: 20px;
  background-color: #f5f7fa;
  border-radius: 8px;
}

.preview-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.preview-controls {
  display: flex;
  gap: 20px;
  align-items: center;
  width: 100%;
  max-width: 400px;
}

.preview-controls :deep(.el-slider) {
  flex: 1;
}

.preview-card {
  transition: transform 0.3s ease;
  transform-origin: center center;
}

.is-flipped .preview-card {
  transform: rotateY(180deg);
}
</style> 