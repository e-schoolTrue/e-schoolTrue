import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { setActivePinia, createPinia } from 'pinia'
import ElementPlus from 'element-plus'
import { Icon } from '@iconify/vue'
import { useThemeStore } from '@/stores/themeStore'
import { APP_THEMES } from '@/constants/appThemes'
import { CSS_THEME_KEYS } from '@/types/theme'
import ApparenceView from '@/views/settings/ApparenceView.vue'
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
  vi.clearAllMocks()
  setupWindowMock()
  setActivePinia(createPinia())
  // No saved preference
  mockInvoke.mockResolvedValue(mockIpcResponse({ data: null }))
})

// Colour keys that map to actual CSS properties (excludes id, name)
const colorKeys = CSS_THEME_KEYS.map((k) => k.key)

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------
describe('ApparenceView', () => {
  it('renders a preset card for every theme', async () => {
    const wrapper = mount(ApparenceView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const presetCards = wrapper.findAll('.theme-preset-card')
    expect(presetCards.length).toBe(APP_THEMES.length)
  })

  it('displays the name of each preset', async () => {
    const wrapper = mount(ApparenceView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const nameElements = wrapper.findAll('.theme-preset-name')
    const nameTexts = nameElements.map((el) => el.text())

    for (const theme of APP_THEMES) {
      expect(nameTexts).toContain(theme.name)
    }
  })

  it('calls store.selectPreset with the theme id when a preset card is clicked', async () => {
    const wrapper = mount(ApparenceView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const store = useThemeStore()
    const selectPresetSpy = vi.spyOn(store, 'selectPreset')

    // Click the second preset card
    const presetCards = wrapper.findAll('.theme-preset-card')
    expect(presetCards.length).toBeGreaterThanOrEqual(2)

    await presetCards[1].trigger('click')
    await wrapper.vm.$nextTick()

    expect(selectPresetSpy).toHaveBeenCalledWith(APP_THEMES[1].id)
  })

  it('renders a color-field section for each theme colour key that has a CSS variable', async () => {
    const wrapper = mount(ApparenceView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const colorFields = wrapper.findAll('.color-field')
    // The COLOR_FIELDS array in the view has 13 entries (all keys except id, name)
    expect(colorFields.length).toBeGreaterThanOrEqual(colorKeys.length)
  })

  it('displays the correct French label for each colour field', async () => {
    const wrapper = mount(ApparenceView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    // Expected labels as defined in ApparenceView.vue
    const expectedLabels: Record<string, string> = {
      primary: 'Couleur principale',
      warning: "Couleur d'avertissement",
      danger: 'Couleur de danger',
      success: 'Couleur de succès',
      info: "Couleur d'information",
      menuBg: 'Fond du menu',
      menuText: 'Texte du menu',
      menuActiveText: 'Texte actif du menu',
      menuHoverBg: 'Survol du menu',
      pageBg: 'Fond de page',
      pageTitle: 'Couleur des titres',
      buttonHoverBg: 'Fond bouton (survol)',
      buttonHoverText: 'Texte bouton (survol)',
    }

    const colorFields = wrapper.findAll('.color-field')
    for (const field of colorFields) {
      const labelEl = field.find('.color-field-label')
      expect(labelEl.exists()).toBe(true)
      const labelText = labelEl.text()

      // Verify this label corresponds to one of our expected labels
      const matchingExpected = Object.values(expectedLabels).find((l) => labelText.includes(l))
      expect(matchingExpected).toBeDefined()
    }
  })

  it('calls store.updateColor when a colour picker changes', async () => {
    const wrapper = mount(ApparenceView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const store = useThemeStore()
    const updateColorSpy = vi.spyOn(store, 'updateColor')

    // Find an ElColorPicker inside the first .color-field
    const firstColorField = wrapper.find('.color-field')
    const colorPicker = firstColorField.findComponent({ name: 'ElColorPicker' })
    expect(colorPicker.exists()).toBe(true)

    // Element Plus ElColorPicker emits 'change' with the new value
    await colorPicker.vm.$emit('change', '#AA00BB')
    await wrapper.vm.$nextTick()

    expect(updateColorSpy).toHaveBeenCalled()
    const calledValue = updateColorSpy.mock.calls[0][1]
    expect(calledValue).toBe('#AA00BB')
  })

  it('renders a "Réinitialiser" button', async () => {
    const wrapper = mount(ApparenceView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const resetBtn = wrapper.find('.actions-bar .el-button')
    expect(resetBtn.exists()).toBe(true)
    expect(resetBtn.text()).toContain('Réinitialiser')
  })

  it('calls store.resetTheme when the reset button is clicked', async () => {
    const wrapper = mount(ApparenceView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const store = useThemeStore()
    const resetThemeSpy = vi.spyOn(store, 'resetTheme')

    const resetBtn = wrapper.find('.actions-bar .el-button')
    await resetBtn.trigger('click')
    await wrapper.vm.$nextTick()

    expect(resetThemeSpy).toHaveBeenCalled()
  })

  it('renders a heading with "Personnalisation" in the title', async () => {
    const wrapper = mount(ApparenceView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.text()).toContain('Personnalisation')
    expect(wrapper.find('h1').exists()).toBe(true)
  })

  it('renders section titles for presets and advanced customization', async () => {
    const wrapper = mount(ApparenceView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const sectionTitles = wrapper.findAll('.section-title')
    const titleTexts = sectionTitles.map((t) => t.text())

    expect(titleTexts.some((t) => t.includes('Thèmes prédéfinis'))).toBe(true)
    expect(titleTexts.some((t) => t.includes('Personnalisation avancée'))).toBe(true)
  })

  it('reactively updates the selected preset when store.currentTheme changes', async () => {
    const wrapper = mount(ApparenceView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const store = useThemeStore()

    // Manually set a preset and check that the UI updates
    await store.selectPreset('moderne')
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    // The active preset card should have the 'active' class
    const activeCards = wrapper.findAll('.theme-preset-card.active')
    expect(activeCards.length).toBeGreaterThanOrEqual(1)
    const activeName = activeCards[0].find('.theme-preset-name')
    expect(activeName.exists()).toBe(true)
    expect(activeName.text()).toBe('Moderne')
  })

  it('shows colour dots for each preset with the correct colours', async () => {
    const wrapper = mount(ApparenceView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    // Each preset card should contain a .color-dot for each of the 5 shown colours
    const presetCards = wrapper.findAll('.theme-preset-card')
    for (let i = 0; i < presetCards.length; i++) {
      const dots = presetCards[i].findAll('.color-dot')
      // The template renders 5 dots (primary, warning, danger, success, menuBg)
      expect(dots.length).toBe(5)

      // Verify the first dot's background matches the preset's primary
      // jsdom transforms inline 'backgroundColor' to computed 'background-color'
      const firstDotStyle = dots[0].attributes('style')
      const hexColor = APP_THEMES[i].primary
      // Convert a hex colour like #003366 to a partial match for jsdom's rgb(...) format
      const r = parseInt(hexColor.slice(1, 3), 16)
      const g = parseInt(hexColor.slice(3, 5), 16)
      const b = parseInt(hexColor.slice(5, 7), 16)
      expect(firstDotStyle).toContain(`rgb(${r}, ${g}, ${b})`)
    }
  })

  it('renders a hex input next to each colour picker', async () => {
    const wrapper = mount(ApparenceView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })

    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    const colorFields = wrapper.findAll('.color-field')
    expect(colorFields.length).toBeGreaterThan(0)

    for (const field of colorFields) {
      // Each .color-field should have both an ElColorPicker and an ElInput
      const picker = field.findComponent({ name: 'ElColorPicker' })
      const input = field.find('.color-hex-input')
      expect(picker.exists()).toBe(true)
      expect(input.exists()).toBe(true)
    }
  })
})
