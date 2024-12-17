<template>
  <div class="card-view">
    <div class="template-selector">
      <el-scrollbar class="template-scrollbar">
        <div class="template-list">
          <div 
            v-for="(template, index) in templates" 
            :key="index"
            class="template-item"
            :class="{ active: selectedTemplate === index }"
            @click="selectedTemplate = index"
          >
            <div class="template-preview">
              <component 
                :is="template.component"
                :student="previewStudent"
                :school-info="schoolInfo"
                :logo-url="logoUrl"
                class="preview-card"
              />
            </div>
            <span>{{ template.name }}</span>
          </div>
        </div>
      </el-scrollbar>
    </div>

    <div class="template-container">
      <component 
        :is="currentTemplate" 
        :student="student"
        :school-info="schoolInfo"
        :logo-url="logoUrl"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import CardTemplateOne from '@/components/student/templates/CardTemplateOne.vue';
import CardTemplateTwo from '@/components/student/templates/CardTemplateTwo.vue';
import CardTemplateThree from '@/components/student/templates/CardTemplateThree.vue';
import defaultAvatar from '@/assets/default-avatar.png';

const selectedTemplate = ref(0);
const logoUrl = ref('');
const student = ref(null);
const schoolInfo = ref(null);

// Données de prévisualisation avec image importée
const previewStudent = {
  firstname: 'John',
  lastname: 'Doe',
  matricule: '2023001',
  photo: defaultAvatar,
  photoUrl: defaultAvatar,
  grade: { name: 'Classe A' }
};

// Liste des templates
const templates = [
  { 
    component: CardTemplateOne, 
    name: 'Carte Simple'
  },
  { 
    component: CardTemplateTwo, 
    name: 'Carte Moderne'
  },
  { 
    component: CardTemplateThree, 
    name: 'Carte Premium'
  }
];

const currentTemplate = computed(() => templates[selectedTemplate.value].component);

// Fonction pour charger une image depuis le système de fichiers
const loadImage = async (path: string) => {
  try {
    const result = await window.ipcRenderer.invoke('file:getImageUrl', path);
    if (result.success) {
      return `data:image/png;base64,${result.data}`;
    }
    return defaultAvatar;
  } catch (error) {
    console.error('Erreur lors du chargement de l\'image:', error);
    return defaultAvatar;
  }
};

// Chargement du logo et des informations
onMounted(async () => {
  try {
    const schoolResult = await window.ipcRenderer.invoke('school:get');
    if (schoolResult.success && schoolResult.data) {
      schoolInfo.value = schoolResult.data;
      if (schoolResult.data.logo) {
        logoUrl.value = await loadImage(schoolResult.data.logo);
      }
    }
  } catch (error) {
    console.error('Erreur lors du chargement des informations:', error);
  }
});

// Surveiller les changements de template pour CardPreview
watch(selectedTemplate, () => {
  // Émettre un événement pour mettre à jour la prévisualisation
  emit('template-change', templates[selectedTemplate.value]);
});
</script>

<style scoped>
.card-view {
  padding: 20px;
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.template-selector {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
  overflow: hidden;
}

.template-scrollbar {
  width: 100%;
  height: 180px;
}

.template-list {
  display: inline-flex;
  gap: 20px;
  padding: 10px;
  white-space: nowrap;
}

.template-item {
  flex: 0 0 auto;
  width: 220px;
  cursor: pointer;
  text-align: center;
  transition: all 0.3s ease;
  padding: 10px;
  border-radius: 8px;
}

.template-item:hover {
  background-color: #f5f7fa;
}

.template-item.active {
  background-color: #ecf5ff;
  border: 1px solid #409eff;
}

.template-preview {
  width: 200px;
  height: 120px;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
  display: flex;
  justify-content: center;
  align-items: center;
}

.preview-card {
  transform: scale(0.4);
  transform-origin: center;
}

.template-container {
  flex: 1;
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 12px 0 rgba(0,0,0,0.1);
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: center;
}

:deep(.el-scrollbar__wrap) {
  overflow-x: auto;
  overflow-y: hidden;
}

:deep(.el-scrollbar__bar.is-horizontal) {
  height: 6px;
}

:deep(.el-scrollbar__thumb) {
  background-color: #409eff;
  opacity: 0.3;
}

:deep(.el-scrollbar__thumb:hover) {
  opacity: 0.5;
}
</style> 