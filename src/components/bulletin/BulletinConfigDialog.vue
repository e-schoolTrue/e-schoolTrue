<template>
  <el-dialog 
    :model-value="modelValue" 
    @update:model-value="$emit('update:modelValue', $event)"
    title="Configuration du Bulletin"
    width="750px"
    class="template-config-dialog"
  >
    <div class="config-content">
      <!-- Sélection du modèle -->
      <div class="section">
        <h3 class="section-title">
          <el-icon><Document /></el-icon>
          Choix du modèle
        </h3>
        <div class="templates-grid">
          <div 
            v-for="template in templates" 
            :key="template.id"
            class="template-card"
            :class="{ 'selected': selectedTemplate === template.id }"
            @click="selectTemplate(template.id)"
          >
            <div class="template-preview" :style="{ borderColor: selectedTemplate === template.id ? colorOptions.primaryColor : '#eee' }">
              <div class="preview-mini" :style="getPreviewStyle(template.id)">
                <div class="mini-header"></div>
                <div class="mini-title"></div>
                <div class="mini-table">
                  <div class="mini-row" v-for="i in 4" :key="i"></div>
                </div>
              </div>
            </div>
            <div class="template-info">
              <h4>{{ template.name }}</h4>
              <p>{{ template.description }}</p>
            </div>
            <el-icon v-if="selectedTemplate === template.id" class="check-icon" color="#67c23a"><Check /></el-icon>
          </div>
        </div>
      </div>

      <el-divider />

      <!-- Personnalisation des couleurs -->
      <div class="section">
        <h3 class="section-title">
          <el-icon><Brush /></el-icon>
          Personnalisation des couleurs
        </h3>
        
        <div class="colors-row">
          <div class="color-picker-group">
            <label>Couleur principale</label>
            <div class="color-input-row">
              <el-color-picker v-model="localColorOptions.primaryColor" size="large" />
              <el-input v-model="localColorOptions.primaryColor" size="small" class="color-hex-input" />
            </div>
            <p class="color-hint">En-têtes, titres, bordures principales</p>
          </div>
          
          <div class="color-picker-group">
            <label>Couleur secondaire</label>
            <div class="color-input-row">
              <el-color-picker v-model="localColorOptions.secondaryColor" size="large" />
              <el-input v-model="localColorOptions.secondaryColor" size="small" class="color-hex-input" />
            </div>
            <p class="color-hint">Accents, fonds, sous-titres</p>
          </div>
        </div>

        <!-- Préréglages de couleurs -->
        <div class="color-presets">
          <span class="presets-label">Préréglages :</span>
          <div class="preset-buttons">
            <button 
              v-for="preset in colorPresets" 
              :key="preset.name"
              class="preset-btn"
              :style="{ background: `linear-gradient(135deg, ${preset.primary} 50%, ${preset.secondary} 50%)` }"
              :title="preset.name"
              @click="applyPreset(preset)"
            ></button>
          </div>
        </div>
      </div>

      <el-divider />

      <!-- Signataires -->
      <div class="section">
        <h3 class="section-title">
          <el-icon><Document /></el-icon>
          Signataires
        </h3>
        <div class="signatories-row">
          <div class="signatory-group">
            <label>Signataire gauche</label>
            <el-input v-model="localColorOptions.signatoryLeft" placeholder="Ex: Le Professeur Principal" />
          </div>
          <div class="signatory-group">
            <label>Signataire droite</label>
            <el-input v-model="localColorOptions.signatoryRight" placeholder="Ex: Le Directeur" />
          </div>
        </div>
      </div>

      <el-divider />

      <!-- Aperçu en direct -->
      <div class="section">
        <h3 class="section-title">
          <el-icon><View /></el-icon>
          Aperçu
        </h3>
        <div class="live-preview-container">
          <div class="live-preview" :style="{ transform: 'scale(0.35)', transformOrigin: 'top center' }">
            <component
              :is="currentTemplateComponent"
              :student="sampleStudent"
              :school-info="schoolInfo"
              :grades="sampleGrades"
              :period="period"
              :options="localColorOptions"
              :current-year="currentYear"
              :rank="3"
              :total-students="25"
              :class-average="12.5"
              :absences="4"
            />
          </div>
        </div>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="$emit('update:modelValue', false)">Annuler</el-button>
        <el-button type="primary" @click="saveAndClose">
          <el-icon class="mr-1"><Check /></el-icon>
          Appliquer
        </el-button>
      </div>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue';
import { Document, Brush, View, Check } from '@element-plus/icons-vue';
import BulletinTemplateOne from '@/components/bulletin/templates/BulletinTemplateOne.vue';
import BulletinTemplateTwo from '@/components/bulletin/templates/BulletinTemplateTwo.vue';

interface Props {
  modelValue: boolean;
  templateId: string;
  colorOptions: { primaryColor: string; secondaryColor: string; signatoryLeft: string; signatoryRight: string };
  schoolInfo: any;
  period: string;
  currentYear: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  'update:modelValue': [value: boolean];
  'update:templateId': [value: string];
  'update:colorOptions': [value: { primaryColor: string; secondaryColor: string; signatoryLeft: string; signatoryRight: string }];
  'save': [];
}>();

// Templates disponibles
const templates = [
  { 
    id: 'template1', 
    name: 'Classique', 
    description: 'Design moderne et épuré, idéal pour un rendu professionnel.',
    component: BulletinTemplateOne 
  },
  { 
    id: 'template2', 
    name: 'Officiel', 
    description: 'Style administratif traditionnel, inspiré des bulletins officiels.',
    component: BulletinTemplateTwo 
  },
];

// Préréglages de couleurs
const colorPresets = [
  { name: 'Bleu Classique', primary: '#2c3e50', secondary: '#3498db' },
  { name: 'Vert Académique', primary: '#1b5e20', secondary: '#4caf50' },
  { name: 'Rouge Officiel', primary: '#b71c1c', secondary: '#e53935' },
  { name: 'Violet Moderne', primary: '#4a148c', secondary: '#7b1fa2' },
  { name: 'Orange Dynamique', primary: '#e65100', secondary: '#ff9800' },
  { name: 'Bleu Marine', primary: '#1a237e', secondary: '#3f51b5' },
];

// État local
const selectedTemplate = ref(props.templateId);
const localColorOptions = reactive({
  primaryColor: props.colorOptions.primaryColor,
  secondaryColor: props.colorOptions.secondaryColor,
  signatoryLeft: props.colorOptions.signatoryLeft || 'Le Professeur Principal',
  signatoryRight: props.colorOptions.signatoryRight || 'Le Directeur'
});

// Données d'exemple pour l'aperçu
const sampleStudent = {
  firstname: 'Jean',
  lastname: 'DUPONT',
  matricule: 'E2024001',
  gender: 'M',
  dateOfBirth: '2010-05-15',
  grade: { name: '6ème Année' },
  photo: { url: '' }
};

const sampleGrades = [
  { courseId: 1, courseName: 'Mathématiques', coefficient: 3, average: 14.5, appreciation: 'Très Bien' },
  { courseId: 2, courseName: 'Français', coefficient: 3, average: 12.0, appreciation: 'Bien' },
  { courseId: 3, courseName: 'Sciences', coefficient: 2, average: 15.5, appreciation: 'Excellent' },
  { courseId: 4, courseName: 'Histoire-Géo', coefficient: 2, average: 11.0, appreciation: 'Assez Bien' },
  { courseId: 5, courseName: 'Anglais', coefficient: 2, average: 13.5, appreciation: 'Bien' },
];

// Computed
const currentTemplateComponent = computed(() => {
  const tmpl = templates.find(t => t.id === selectedTemplate.value);
  return tmpl ? tmpl.component : BulletinTemplateOne;
});

// Watchers
watch(() => props.templateId, (newVal) => {
  selectedTemplate.value = newVal;
});

watch(() => props.colorOptions, (newVal) => {
  localColorOptions.primaryColor = newVal.primaryColor;
  localColorOptions.secondaryColor = newVal.secondaryColor;
  localColorOptions.signatoryLeft = newVal.signatoryLeft || 'Le Professeur Principal';
  localColorOptions.signatoryRight = newVal.signatoryRight || 'Le Directeur';
}, { deep: true });

// Methods
const selectTemplate = (id: string) => {
  selectedTemplate.value = id;
};

const applyPreset = (preset: { primary: string; secondary: string }) => {
  localColorOptions.primaryColor = preset.primary;
  localColorOptions.secondaryColor = preset.secondary;
};

const getPreviewStyle = (templateId: string) => {
  // Style différent selon le template
  if (templateId === 'template2') {
    return { backgroundColor: '#f5f5f5' };
  }
  return { backgroundColor: '#fff' };
};

const saveAndClose = () => {
  emit('update:templateId', selectedTemplate.value);
  emit('update:colorOptions', { ...localColorOptions });
  emit('save');
  emit('update:modelValue', false);
};
</script>

<style scoped>
.config-content {
  max-height: 65vh;
  overflow-y: auto;
  padding-right: 10px;
}

.section {
  margin-bottom: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 16px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 15px;
}

/* Templates Grid */
.templates-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 15px;
}

.template-card {
  position: relative;
  border: 2px solid #eee;
  border-radius: 8px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fafafa;
}

.template-card:hover {
  border-color: #c0c4cc;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.template-card.selected {
  border-color: var(--el-color-primary);
  background: #f0f7ff;
}

.template-preview {
  height: 120px;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 10px;
  background: white;
}

.preview-mini {
  padding: 8px;
  height: 100%;
}

.mini-header {
  height: 15px;
  background: linear-gradient(90deg, #ddd 30%, transparent 30%);
  margin-bottom: 8px;
  border-radius: 2px;
}

.mini-title {
  height: 12px;
  width: 60%;
  margin: 0 auto 10px;
  background: #e0e0e0;
  border-radius: 2px;
}

.mini-table {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.mini-row {
  height: 8px;
  background: linear-gradient(90deg, #f0f0f0 40%, #e8e8e8 40% 50%, #f5f5f5 50%);
  border-radius: 1px;
}

.template-info h4 {
  margin: 0 0 4px;
  font-size: 14px;
  font-weight: 600;
}

.template-info p {
  margin: 0;
  font-size: 12px;
  color: #909399;
}

.check-icon {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 20px;
}

/* Colors */
.colors-row {
  display: flex;
  gap: 30px;
  margin-bottom: 20px;
}

.color-picker-group {
  flex: 1;
}

.color-picker-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 13px;
}

.color-input-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.color-hex-input {
  width: 100px;
}

.color-hint {
  margin: 6px 0 0;
  font-size: 11px;
  color: #909399;
}

/* Presets */
.color-presets {
  display: flex;
  align-items: center;
  gap: 12px;
}

.presets-label {
  font-size: 13px;
  color: #606266;
}

.preset-buttons {
  display: flex;
  gap: 8px;
}

.preset-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0,0,0,0.2);
  cursor: pointer;
  transition: transform 0.2s;
}

.preset-btn:hover {
  transform: scale(1.15);
}

/* Signatories */
.signatories-row {
  display: flex;
  gap: 30px;
}

.signatory-group {
  flex: 1;
}

.signatory-group label {
  display: block;
  font-weight: 600;
  margin-bottom: 8px;
  font-size: 13px;
}

/* Live Preview */
.live-preview-container {
  background: #525659;
  border-radius: 8px;
  padding: 15px;
  height: 280px;
  overflow: hidden;
  display: flex;
  justify-content: center;
}

.live-preview {
  box-shadow: 0 4px 20px rgba(0,0,0,0.3);
}

/* Footer */
.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

.mr-1 {
  margin-right: 4px;
}
</style>
