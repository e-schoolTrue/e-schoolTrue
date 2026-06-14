export interface AppTheme {
  id: string
  name: string
  primary: string
  warning: string
  danger: string
  success: string
  info: string
  menuBg: string
  menuText: string
  menuActiveText: string
  menuHoverBg: string
  pageBg: string
  pageTitle: string
  buttonHoverBg: string
  buttonHoverText: string
}

export type ThemeColorKey = keyof AppTheme

export const THEME_CSS_MAP: Record<ThemeColorKey, string> = {
  id: '',
  name: '',
  primary: '--el-color-primary',
  warning: '--el-color-warning',
  danger: '--el-color-danger',
  success: '--el-color-success',
  info: '--el-color-info',
  menuBg: '--app-menu-bg-color',
  menuText: '--app-menu-text-color',
  menuActiveText: '--app-menu-active-text-color',
  menuHoverBg: '--app-menu-hover-bg-color',
  pageBg: '--app-page-bg-color',
  pageTitle: '--el-page-title-primary-color',
  buttonHoverBg: '--button-hover-bg-color',
  buttonHoverText: '--button-hover-text-color',
}

export const CSS_THEME_KEYS = Object.entries(THEME_CSS_MAP)
  .filter(([_, v]) => v)
  .map(([k, v]) => ({ key: k as ThemeColorKey, cssVar: v }))

export const DEFAULT_APP_THEME: AppTheme = {
  id: 'default',
  name: 'Classique',
  primary: '#003366',
  warning: '#4B0082',
  danger: '#ff4500',
  success: '#32CD32',
  info: '#909399',
  menuBg: '#003366',
  menuText: '#ffffff',
  menuActiveText: '#ff4500',
  menuHoverBg: '#004080',
  pageBg: '#f5f5f5',
  pageTitle: '#007BFF',
  buttonHoverBg: '#014d95',
  buttonHoverText: '#ffffff',
}
