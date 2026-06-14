import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useThemeStore } from '@/stores/themeStore'
import { DEFAULT_APP_THEME, CSS_THEME_KEYS, type AppTheme } from '@/types/theme'
import { APP_THEMES } from '@/constants/appThemes'
import type { ResponseType } from '@/types'

// ---------------------------------------------------------------------------
// IPC mock
// ---------------------------------------------------------------------------
const mockInvoke = vi.fn()

function mockIpcResponse(overrides: Partial<ResponseType> = {}): ResponseType {
  return {
    success: true,
    data: null,
    message: null,
    error: null,
    ...overrides,
  }
}

function setupWindowMock() {
  Object.defineProperty(window, 'ipcRenderer', {
    value: {
      invoke: mockInvoke,
      send: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  })
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  setupWindowMock()
})

// ---------------------------------------------------------------------------
// Suite: loadTheme
// ---------------------------------------------------------------------------
describe('themeStore – loadTheme', () => {
  it('applies DEFAULT_APP_THEME when no saved preference exists', async () => {
    mockInvoke.mockResolvedValue(mockIpcResponse({ data: null }))

    const store = useThemeStore()
    await store.loadTheme()

    expect(mockInvoke).toHaveBeenCalledWith('preference:get', 'appTheme')
    expect(store.currentTheme).toEqual(DEFAULT_APP_THEME)
    expect(store.isLoaded).toBe(true)
  })

  it('parses and applies a saved theme preference', async () => {
    const saved: AppTheme = {
      id: 'custom-1',
      name: 'Custom',
      primary: '#FF0000',
      warning: '#FFA500',
      danger: '#DC143C',
      success: '#228B22',
      info: '#708090',
      menuBg: '#111111',
      menuText: '#CCCCCC',
      menuActiveText: '#FF4444',
      menuHoverBg: '#222222',
      pageBg: '#EEEEEE',
      pageTitle: '#FF0000',
      buttonHoverBg: '#333333',
      buttonHoverText: '#FFFFFF',
    }
    mockInvoke.mockResolvedValue(mockIpcResponse({ data: JSON.stringify(saved) }))

    const store = useThemeStore()
    await store.loadTheme()

    // Check all properties were merged correctly
    expect(store.currentTheme.primary).toBe('#FF0000')
    expect(store.currentTheme.menuBg).toBe('#111111')
    expect(store.isLoaded).toBe(true)
  })

  it('falls back to DEFAULT_APP_THEME when IPC returns an error', async () => {
    mockInvoke.mockResolvedValue(mockIpcResponse({ success: false, error: 'DB error' }))

    const store = useThemeStore()
    await store.loadTheme()

    expect(store.currentTheme).toEqual(DEFAULT_APP_THEME)
  })

  it('falls back to DEFAULT_APP_THEME when IPC call throws', async () => {
    mockInvoke.mockRejectedValue(new Error('Connection lost'))

    const store = useThemeStore()
    await store.loadTheme()

    expect(store.currentTheme).toEqual(DEFAULT_APP_THEME)
  })

  it('handles malformed JSON gracefully', async () => {
    mockInvoke.mockResolvedValue(mockIpcResponse({ data: '{ broken json }' }))

    const store = useThemeStore()
    await store.loadTheme()

    expect(store.currentTheme).toEqual(DEFAULT_APP_THEME)
  })

  it('merges partial saved data with DEFAULT_APP_THEME', async () => {
    const partial = JSON.stringify({ primary: '#FF00FF', id: 'partial' })
    mockInvoke.mockResolvedValue(mockIpcResponse({ data: partial }))

    const store = useThemeStore()
    await store.loadTheme()

    expect(store.currentTheme.primary).toBe('#FF00FF')
    // Non-saved properties keep defaults
    expect(store.currentTheme.menuBg).toBe(DEFAULT_APP_THEME.menuBg)
  })
})

// ---------------------------------------------------------------------------
// Suite: selectPreset
// ---------------------------------------------------------------------------
describe('themeStore – selectPreset', () => {
  beforeEach(() => {
    mockInvoke.mockResolvedValue(mockIpcResponse({ data: null }))
  })

  it('switches theme to the preset matching the given id', async () => {
    const store = useThemeStore()
    await store.loadTheme()

    await store.selectPreset('moderne')

    expect(store.currentTheme.id).toBe('moderne')
    expect(store.currentTheme.primary).toBe(APP_THEMES[1].primary)
    expect(store.currentTheme.menuBg).toBe(APP_THEMES[1].menuBg)
  })

  it('selects any available preset', async () => {
    const store = useThemeStore()
    await store.loadTheme()

    await store.selectPreset('royal')
    expect(store.currentTheme).toEqual(APP_THEMES[4])

    await store.selectPreset('nature')
    expect(store.currentTheme).toEqual(APP_THEMES[3])
  })

  it('persists the selected preset via IPC', async () => {
    const store = useThemeStore()
    await store.loadTheme()
    await store.selectPreset('epure')

    expect(mockInvoke).toHaveBeenCalledWith('preference:set', {
      key: 'appTheme',
      value: JSON.stringify(APP_THEMES[2]),
    })
  })

  it('does not change theme when preset id is unknown', async () => {
    const store = useThemeStore()
    await store.loadTheme()
    const before = { ...store.currentTheme }

    await store.selectPreset('non-existent-id')

    expect(store.currentTheme).toEqual(before)
  })
})

// ---------------------------------------------------------------------------
// Suite: updateColor
// ---------------------------------------------------------------------------
describe('themeStore – updateColor', () => {
  beforeEach(async () => {
    mockInvoke.mockResolvedValue(mockIpcResponse({ data: null }))
  })

  it('changes a single color property and keeps others intact', async () => {
    const store = useThemeStore()
    await store.loadTheme()

    const originalSecondary = store.currentTheme.warning

    await store.updateColor('primary', '#FF0000')

    expect(store.currentTheme.primary).toBe('#FF0000')
    expect(store.currentTheme.warning).toBe(originalSecondary)
    expect(store.currentTheme.menuBg).toBe(DEFAULT_APP_THEME.menuBg)
  })

  it('persists the updated theme after a single color change', async () => {
    const store = useThemeStore()
    await store.loadTheme()

    await store.updateColor('menuBg', '#0A0A0A')

    expect(mockInvoke).toHaveBeenCalledWith('preference:set', {
      key: 'appTheme',
      value: expect.stringContaining('#0A0A0A'),
    })
  })

  it('updates the CSS custom property on the document root', async () => {
    const store = useThemeStore()
    await store.loadTheme()

    const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty')

    await store.updateColor('success', '#00FF00')

    expect(setPropertySpy).toHaveBeenCalledWith('--el-color-success', '#00FF00')
    setPropertySpy.mockRestore()
  })

  it('does nothing for id or name keys (no CSS var)', async () => {
    const store = useThemeStore()
    await store.loadTheme()

    // id and name map to empty string in THEME_CSS_MAP, so updating them
    // should not affect CSS but should still update state
    await store.updateColor('id' as any, 'custom-id')
    await store.updateColor('name' as any, 'Custom Name')

    expect(store.currentTheme.id).toBe('custom-id')
    expect(store.currentTheme.name).toBe('Custom Name')
  })

  it('persists all required properties after update', async () => {
    const store = useThemeStore()
    await store.loadTheme()

    await store.updateColor('danger', '#FF6347')

    const persistCall = mockInvoke.mock.calls.find(
      (c: unknown[]) => c[0] === 'preference:set',
    )
    expect(persistCall).toBeDefined()
    const persistedValue = JSON.parse(persistCall![1].value)
    // Persisted object should include the updated field
    expect(persistedValue.danger).toBe('#FF6347')
  })
})

// ---------------------------------------------------------------------------
// Suite: resetTheme
// ---------------------------------------------------------------------------
describe('themeStore – resetTheme', () => {
  beforeEach(async () => {
    mockInvoke.mockResolvedValue(mockIpcResponse({ data: null }))
  })

  it('restores the theme to DEFAULT_APP_THEME', async () => {
    const store = useThemeStore()
    await store.loadTheme()

    await store.updateColor('primary', '#FF0000')
    await store.updateColor('menuBg', '#000000')
    await store.updateColor('success', '#00FF00')

    await store.resetTheme()

    expect(store.currentTheme).toEqual(DEFAULT_APP_THEME)
  })

  it('persists the default theme after reset', async () => {
    const store = useThemeStore()
    await store.loadTheme()

    await store.updateColor('primary', '#FF0000')
    await store.resetTheme()

    const setCalls = mockInvoke.mock.calls.filter(
      (call: unknown[]) => call[0] === 'preference:set',
    )
    const lastSetCall = setCalls[setCalls.length - 1]
    expect(lastSetCall).toBeDefined()

    const persistedValue = JSON.parse(lastSetCall[1].value)
    expect(persistedValue.primary).toBe(DEFAULT_APP_THEME.primary)
    expect(persistedValue.menuBg).toBe(DEFAULT_APP_THEME.menuBg)
  })
})

// ---------------------------------------------------------------------------
// Suite: applyTheme
// ---------------------------------------------------------------------------
describe('themeStore – applyTheme', () => {
  beforeEach(async () => {
    mockInvoke.mockResolvedValue(mockIpcResponse({ data: null }))
  })

  it('sets all valid CSS custom properties on document.documentElement', async () => {
    const store = useThemeStore()
    await store.loadTheme()
    const customTheme: AppTheme = { ...DEFAULT_APP_THEME, primary: '#FF0000', menuBg: '#111111' }

    const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty')

    store.applyTheme(customTheme)

    for (const { key, cssVar } of CSS_THEME_KEYS) {
      expect(setPropertySpy).toHaveBeenCalledWith(
        cssVar,
        (customTheme as unknown as Record<string, string>)[key],
      )
    }

    setPropertySpy.mockRestore()
  })

  it('updates currentTheme with the provided theme', async () => {
    const store = useThemeStore()
    await store.loadTheme()

    const newTheme: AppTheme = {
      ...DEFAULT_APP_THEME,
      primary: '#AA0000',
      menuBg: '#222222',
    }

    store.applyTheme(newTheme)

    expect(store.currentTheme.primary).toBe('#AA0000')
    expect(store.currentTheme.menuBg).toBe('#222222')
  })

  it('does not set CSS properties for keys with empty cssVar (id, name)', () => {
    const store = useThemeStore()

    const setPropertySpy = vi.spyOn(document.documentElement.style, 'setProperty')

    store.applyTheme(DEFAULT_APP_THEME)

    // id and name have empty cssVar – should NOT call setProperty for them
    expect(setPropertySpy).not.toHaveBeenCalledWith('', expect.anything())

    setPropertySpy.mockRestore()
  })
})

// ---------------------------------------------------------------------------
// Suite: integration – full workflow
// ---------------------------------------------------------------------------
describe('themeStore – full workflow', () => {
  it('loads → selects preset → updates color → resets', async () => {
    mockInvoke.mockResolvedValue(mockIpcResponse({ data: null }))

    const store = useThemeStore()
    expect(store.isLoaded).toBe(false)

    // 1. Load
    await store.loadTheme()
    expect(store.isLoaded).toBe(true)
    expect(store.currentTheme).toEqual(DEFAULT_APP_THEME)

    // 2. Select preset
    await store.selectPreset('nature')
    expect(store.currentTheme.id).toBe('nature')

    // 3. Update single color
    await store.updateColor('primary', '#FF00FF')
    expect(store.currentTheme.primary).toBe('#FF00FF')
    // Preset values outside the changed key remain
    expect(store.currentTheme.menuBg).toBe(APP_THEMES[3].menuBg)

    // 4. Reset
    await store.resetTheme()
    expect(store.currentTheme).toEqual(DEFAULT_APP_THEME)
  })
})
