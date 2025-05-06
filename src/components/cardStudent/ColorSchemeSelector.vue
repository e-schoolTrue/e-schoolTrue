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
        
        <!-- Prévisualisation et sauvegarde -->
        <div class="preview-custom-scheme">
          <div class="preview-card" :style="previewStyle">
            <div class="preview-header" :style="{ backgroundColor: customColors.primary, color: '#fff' }">
              <div class="preview-title">Aperçu</div>
            </div>
            <div class="preview-body">
              <div class="preview-name" :style="{ color: customColors.secondary }">
                Nom Prénom
              </div>
              <div class="preview-details" :style="{ color: customColors.text }">
                Texte exemple
              </div>
            </div>
          </div>
          
          <el-button type="primary" size="small" @click="showSaveDialog = true">
            Enregistrer ce thème
          </el-button>
        </div>
      </div>
    </div>
    
    <!-- Dialog pour sauvegarder le thème -->
    <el-dialog
      v-model="showSaveDialog"
      title="Enregistrer le thème personnalisé"
      width="400px"
    >
      <el-form>
        <el-form-item label="Nom du thème">
          <el-input v-model="newSchemeName" placeholder="Ex: Mon thème personnalisé" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showSaveDialog = false">Annuler</el-button>
        <el-button type="primary" @click="saveCustomScheme" :disabled="!newSchemeName">
          Enregistrer
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import type { ColorScheme } from '@/types/card';
import { COLOR_SCHEMES, DEFAULT_COLOR_SCHEME } from '@/constants/colorSchemes';

const props = defineProps<{
  modelValue: ColorScheme;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: ColorScheme): void;
}>();

const schemes = ref([...COLOR_SCHEMES]);
const useCustomColors = ref(false);
const customColors = ref({ ...DEFAULT_COLOR_SCHEME });
const showSaveDialog = ref(false);
const newSchemeName = ref('');

// Computed pour le style de prévisualisation
const previewStyle = computed(() => ({
  backgroundColor: customColors.value.background,
  border: `1px solid ${customColors.value.primary}`
}));

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

const saveCustomScheme = () => {
  const newScheme: ColorScheme = {
    name: newSchemeName.value,
    primary: customColors.value.primary,
    secondary: customColors.value.secondary,
    text: customColors.value.text,
    background: customColors.value.background
  };
  
  // Ajouter le nouveau schéma à la liste
  schemes.value.push(newScheme);
  
  // Sélectionner automatiquement le nouveau schéma
  selectScheme(newScheme);
  
  // Fermer le dialogue et réinitialiser
  showSaveDialog.value = false;
  newSchemeName.value = '';
  useCustomColors.value = false;
  
  ElMessage.success(`Thème "${newScheme.name}" enregistré avec succès`);
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

/* Styles pour la prévisualisation */
.preview-custom-scheme {
  grid-column: 1 / -1;
  margin-top: 1rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.preview-card {
  width: 240px;
  height: 140px;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.preview-header {
  height: 40px;
  display: flex;
  align-items: center;
  padding: 0 16px;
}

.preview-title {
  font-weight: bold;
}

.preview-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-name {
  font-weight: bold;
  font-size: 16px;
}

.preview-details {
  font-size: 14px;
}
</style> 