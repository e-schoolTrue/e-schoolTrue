import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import type { AppTheme, ThemeColorKey } from '@/types/theme'
import { DEFAULT_APP_THEME, CSS_THEME_KEYS } from '@/types/theme'
import { APP_THEMES } from '@/constants/appThemes'

export const useThemeStore = defineStore('theme', () => {
  // --- State ---
  const currentTheme = ref<AppTheme>({ ...DEFAULT_APP_THEME })
  const isLoaded = ref(false)

  // --- Computed ---
  const colors = computed(() => currentTheme.value)

  const themeKeys = computed(() =>
    CSS_THEME_KEYS.filter(({ key }) => key in currentTheme.value)
  )

  // --- Actions ---
  function applyTheme(theme: AppTheme) {
    const root = document.documentElement
    for (const { key, cssVar } of CSS_THEME_KEYS) {
      const value = theme[key as keyof AppTheme]
      if (value && cssVar) {
        root.style.setProperty(cssVar, value)
      }
    }
    currentTheme.value = { ...theme }
  }

  async function loadTheme() {
    try {
      const result = await window.ipcRenderer.invoke('preference:get', 'appTheme')
      if (result?.success && result.data) {
        const saved: Partial<AppTheme> = typeof result.data === 'string' ? JSON.parse(result.data) : result.data
        const merged: AppTheme = { ...DEFAULT_APP_THEME, ...saved }
        applyTheme(merged)
      } else {
        applyTheme(DEFAULT_APP_THEME)
      }
    } catch (error) {
      console.error('Erreur lors du chargement du thème:', error)
      applyTheme(DEFAULT_APP_THEME)
    } finally {
      isLoaded.value = true
    }
  }

  async function selectPreset(id: string) {
    const preset = APP_THEMES.find((t) => t.id === id)
    if (!preset) {
      ElMessage.error('Thème introuvable')
      return
    }
    applyTheme(preset)
    await persistTheme(preset)
    ElMessage.success('Thème appliqué avec succès')
  }

  async function updateColor(key: ThemeColorKey, value: string) {
    if (!currentTheme.value) return
    currentTheme.value = { ...currentTheme.value, [key]: value }
    const cssVar = CSS_THEME_KEYS.find((k) => k.key === key)?.cssVar
    if (cssVar) {
      document.documentElement.style.setProperty(cssVar, value)
    }
    await persistTheme(currentTheme.value)
  }

  async function resetTheme() {
    applyTheme(DEFAULT_APP_THEME)
    await persistTheme(DEFAULT_APP_THEME)
    ElMessage.success('Thème réinitialisé avec succès')
  }

  async function persistTheme(theme: AppTheme) {
    try {
      await window.ipcRenderer.invoke('preference:set', {
        key: 'appTheme',
        value: JSON.stringify({
          id: theme.id,
          name: theme.name,
          primary: theme.primary,
          warning: theme.warning,
          danger: theme.danger,
          success: theme.success,
          info: theme.info,
          menuBg: theme.menuBg,
          menuText: theme.menuText,
          menuActiveText: theme.menuActiveText,
          menuHoverBg: theme.menuHoverBg,
          pageBg: theme.pageBg,
          pageTitle: theme.pageTitle,
          buttonHoverBg: theme.buttonHoverBg,
          buttonHoverText: theme.buttonHoverText,
        }),
      })
    } catch (error) {
      console.error('Erreur lors de la persistance du thème:', error)
    }
  }

  return {
    currentTheme,
    isLoaded,
    colors,
    themeKeys,
    loadTheme,
    applyTheme,
    selectPreset,
    updateColor,
    resetTheme,
  }
})
