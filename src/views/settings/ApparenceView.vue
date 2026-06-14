<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Icon } from '@iconify/vue'
import { useThemeStore } from '@/stores/themeStore'
import { APP_THEMES } from '@/constants/appThemes'
import type { ThemeColorKey } from '@/types/theme'

const themeStore = useThemeStore()

const currentThemeId = computed(() => themeStore.colors.id)

const COLOR_FIELDS: { key: ThemeColorKey; label: string }[] = [
  { key: 'primary', label: 'Couleur principale' },
  { key: 'warning', label: "Couleur d'avertissement" },
  { key: 'danger', label: 'Couleur de danger' },
  { key: 'success', label: 'Couleur de succès' },
  { key: 'info', label: "Couleur d'information" },
  { key: 'menuBg', label: 'Fond du menu' },
  { key: 'menuText', label: 'Texte du menu' },
  { key: 'menuActiveText', label: 'Texte actif du menu' },
  { key: 'menuHoverBg', label: 'Survol du menu' },
  { key: 'pageBg', label: 'Fond de page' },
  { key: 'pageTitle', label: 'Couleur des titres' },
  { key: 'buttonHoverBg', label: 'Fond bouton (survol)' },
  { key: 'buttonHoverText', label: 'Texte bouton (survol)' },
]

function selectPreset(id: string) {
  themeStore.selectPreset(id)
}

function onColorChange(key: ThemeColorKey, value: string) {
  themeStore.updateColor(key, value)
  ElMessage.success('Couleur mise à jour')
}

function resetToDefault() {
  themeStore.resetTheme()
}
</script>

<template>
  <div class="apparence-view">
    <div class="apparence-header">
      <Icon icon="mdi:palette" class="header-icon" :width="40" :height="40" />
      <h1>Personnalisation de l'apparence</h1>
      <p class="header-subtitle">
        Personnalisez les couleurs de l'application selon vos préférences
      </p>
    </div>

    <!-- Thèmes prédéfinis -->
    <section class="section">
      <h2 class="section-title">
        <Icon icon="mdi:format-paint" :width="20" :height="20" />
        Thèmes prédéfinis
      </h2>
      <p class="section-description">
        Choisissez un thème prédéfini pour changer rapidement l'apparence de l'application.
      </p>

      <el-radio-group
        :model-value="currentThemeId"
        class="theme-presets-grid"
        @change="selectPreset"
      >
        <div
          v-for="theme in APP_THEMES"
          :key="theme.id"
          class="theme-preset-card"
          :class="{ active: currentThemeId === theme.id }"
          @click="selectPreset(theme.id)"
        >
          <el-radio :value="theme.id" class="theme-radio">
            <div class="theme-preset-content">
              <div class="theme-color-dots">
                <span
                  class="color-dot"
                  :style="{ backgroundColor: theme.primary }"
                  title="Principale"
                />
                <span
                  class="color-dot"
                  :style="{ backgroundColor: theme.warning }"
                  title="Avertissement"
                />
                <span
                  class="color-dot"
                  :style="{ backgroundColor: theme.danger }"
                  title="Danger"
                />
                <span
                  class="color-dot"
                  :style="{ backgroundColor: theme.success }"
                  title="Succès"
                />
                <span
                  class="color-dot"
                  :style="{ backgroundColor: theme.menuBg }"
                  title="Menu"
                />
              </div>
              <span class="theme-preset-name">{{ theme.name }}</span>
            </div>
          </el-radio>
        </div>
      </el-radio-group>
    </section>

    <!-- Personnalisation avancée -->
    <section class="section">
      <h2 class="section-title">
        <Icon icon="mdi:palette-swatch" :width="20" :height="20" />
        Personnalisation avancée
      </h2>
      <p class="section-description">
        Ajustez chaque couleur individuellement pour un rendu sur mesure.
      </p>

      <el-row :gutter="16">
        <el-col
          v-for="field in COLOR_FIELDS"
          :key="field.key"
          :xs="24"
          :sm="12"
          :md="8"
          :lg="6"
        >
          <div class="color-field">
            <label class="color-field-label">{{ field.label }}</label>
            <div class="color-field-controls">
              <el-color-picker
                :model-value="(themeStore.colors as any)[field.key]"
                :predefine="[
                  themeStore.colors.primary,
                  themeStore.colors.warning,
                  themeStore.colors.danger,
                  themeStore.colors.success,
                  themeStore.colors.info,
                ]"
                size="small"
                @change="(val: string) => onColorChange(field.key, val)"
              />
              <el-input
                :model-value="(themeStore.colors as any)[field.key]"
                size="small"
                class="color-hex-input"
                @update:model-value="(val: string) => onColorChange(field.key, val)"
              />
            </div>
          </div>
        </el-col>
      </el-row>

      <div class="actions-bar">
        <el-button type="danger" plain @click="resetToDefault">
          <Icon icon="mdi:restore" :width="16" :height="16" class="btn-icon" />
          Réinitialiser
        </el-button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.apparence-view {
  padding: 2rem;
  max-width: 1200px;
  margin: 0 auto;
}

.apparence-header {
  text-align: center;
  margin-bottom: 2.5rem;
}

.header-icon {
  color: var(--el-color-primary, #409EFF);
  background: color-mix(in srgb, var(--el-color-primary, #409EFF) 10%, transparent);
  padding: 12px;
  border-radius: 12px;
  margin-bottom: 1rem;
}

.apparence-header h1 {
  font-size: 1.75rem;
  color: var(--el-page-title-primary-color, #2c3e50);
  margin: 0 0 0.5rem 0;
  font-weight: 600;
}

.header-subtitle {
  color: #909399;
  font-size: 1rem;
  margin: 0;
}

/* Sections */
.section {
  background: #ffffff;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(0, 0, 0, 0.03);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 1.15rem;
  color: #2c3e50;
  margin: 0 0 0.5rem 0;
  font-weight: 600;
}

.section-description {
  color: #909399;
  font-size: 0.9rem;
  margin: 0 0 1.5rem 0;
}

/* Thèmes prédéfinis */
.theme-presets-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 12px;
  width: 100%;
}

.theme-preset-card {
  border: 2px solid #e4e7ed;
  border-radius: 10px;
  padding: 12px;
  cursor: pointer;
  transition: all 0.2s ease;
  background: #fafafa;
}

.theme-preset-card:hover {
  border-color: var(--el-color-primary, #409EFF);
  background: color-mix(in srgb, var(--el-color-primary, #409EFF) 5%, transparent);
}

.theme-preset-card.active {
  border-color: var(--el-color-primary, #409EFF);
  background: color-mix(in srgb, var(--el-color-primary, #409EFF) 8%, transparent);
}

.theme-radio {
  display: flex;
  width: 100%;
}

.theme-preset-content {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.theme-color-dots {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.color-dot {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  border: 2px solid #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
  display: inline-block;
}

.theme-preset-name {
  font-size: 0.9rem;
  font-weight: 500;
  color: #2c3e50;
}

/* Champs de couleur */
.color-field {
  margin-bottom: 1rem;
  padding: 0.75rem;
  background: #f9f9f9;
  border-radius: 8px;
  border: 1px solid #f0f0f0;
}

.color-field-label {
  display: block;
  font-size: 0.85rem;
  font-weight: 500;
  color: #2c3e50;
  margin-bottom: 0.5rem;
}

.color-field-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}

.color-hex-input {
  flex: 1;
  min-width: 0;
}

.color-hex-input :deep(.el-input__wrapper) {
  font-family: 'Courier New', monospace;
  font-size: 0.8rem;
}

/* Actions */
.actions-bar {
  margin-top: 1.5rem;
  display: flex;
  justify-content: flex-end;
}

.btn-icon {
  margin-right: 4px;
}

/* Responsive */
@media (max-width: 768px) {
  .apparence-view {
    padding: 1rem;
  }

  .apparence-header h1 {
    font-size: 1.4rem;
  }

  .theme-presets-grid {
    grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  }

  .section {
    padding: 1rem;
  }
}
</style>
