<template>
  <div class="card-preview">
    <div class="preview-header">
      <h3>Prévisualisation</h3>
      <el-button-group>
        <el-button 
          v-for="view in views" 
          :key="view.name"
          :type="currentView === view.name ? 'primary' : 'default'"
          @click="currentView = view.name"
        >
          <el-icon>
            <component :is="view.icon" />
          </el-icon>
        </el-button>
      </el-button-group>
    </div>

    <div class="preview-content" :class="currentView">
      <component 
        :is="selectedTemplate"
        :student="student"
        :school-info="schoolInfo"
        :logo-url="logoUrl"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import { View, Document, CreditCard } from '@element-plus/icons-vue';

const props = defineProps<{
  selectedTemplate: any;
  student: any;
  schoolInfo: any;
  logoUrl: string;
}>();

const currentView = ref('card');

const views = [
  { name: 'card', icon: CreditCard },
  { name: 'single', icon: Document },
  { name: 'multiple', icon: View }
];

// Réinitialiser la vue lors du changement de template
watch(() => props.selectedTemplate, () => {
  currentView.value = 'card';
});
</script>

<style scoped>
.card-preview {
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
}

.preview-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.preview-content {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 400px;
  background: #f5f7fa;
  border-radius: 4px;
  padding: 20px;
}

.preview-content.card {
  transform: scale(1);
}

.preview-content.single {
  transform: scale(0.8);
}

.preview-content.multiple {
  transform: scale(0.5);
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
}
</style> 