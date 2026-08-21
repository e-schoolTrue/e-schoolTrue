import { vi } from 'vitest'

// ---------------------------------------------------------------------------
// global ipcRenderer mock
// Mirrors Electron preload: window.ipcRenderer.invoke(...)
// ---------------------------------------------------------------------------
const mockInvoke = vi.fn(async () => ({ success: true, data: [] }))

const mockIpcRenderer = {
  invoke: mockInvoke,
  send: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  removeListener: vi.fn(),
  removeAllListeners: vi.fn(),
}

// jsdom already provides window / globalThis.window – augment instead of
// replacing to keep document, location, navigator intact.
// Requirement: global.window = { ipcRenderer: ... } and global.window.ipcRenderer = ...
if (typeof globalThis.window === 'undefined') {
  // @ts-ignore
  globalThis.window = {} as Window & typeof globalThis
}

if (typeof window !== 'undefined') {
  // Attach to jsdom window
  ;(window as unknown as Record<string, unknown>).ipcRenderer = mockIpcRenderer
  // Ensure global.window points to the same jsdom window (with ipcRenderer)
  ;(globalThis as unknown as Record<string, unknown>).window = window
  ;(global as unknown as Record<string, unknown>).window = window
} else {
  // Fallback when no jsdom window (should not happen with environment: jsdom)
  ;(globalThis as unknown as Record<string, unknown>).window = {
    ipcRenderer: mockIpcRenderer,
  } as unknown as Window
  ;(global as unknown as Record<string, unknown>).window = (globalThis as unknown as Record<string, unknown>).window
}

// Also expose ipcRenderer on global directly for code that uses global.ipcRenderer
;(globalThis as unknown as Record<string, unknown>).ipcRenderer = mockIpcRenderer
;(global as unknown as Record<string, unknown>).ipcRenderer = mockIpcRenderer

// ---------------------------------------------------------------------------
// Mock ElMessage from element-plus
// ---------------------------------------------------------------------------
vi.mock('element-plus', async () => {
  const actual = await vi.importActual<typeof import('element-plus')>('element-plus')
  return {
    ...actual,
    ElMessage: {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
      closeAll: vi.fn(),
    },
  }
})

// ---------------------------------------------------------------------------
// Mock Chart from chart.js
// Covers both 'chart.js' and 'chart.js/auto' entry points
// ---------------------------------------------------------------------------
vi.mock('chart.js', async () => {
  const actual = await vi.importActual<typeof import('chart.js')>('chart.js')
  return {
    ...actual,
    Chart: {
      register: vi.fn(),
      defaults: {},
      instances: {},
    },
    registerables: [],
    // Keep other named exports if any
  }
})

vi.mock('chart.js/auto', () => ({
  default: vi.fn().mockImplementation(() => ({
    destroy: vi.fn(),
    update: vi.fn(),
    render: vi.fn(),
  })),
  Chart: {
    register: vi.fn(),
    defaults: {},
  },
  registerables: [],
}))

// ---------------------------------------------------------------------------
// Mock @iconify/vue Icon component
// ---------------------------------------------------------------------------
vi.mock('@iconify/vue', () => ({
  Icon: {
    name: 'Icon',
    props: ['icon', 'width', 'height', 'color', 'inline', 'style'],
    template: '<span data-testid="icon-mock" />',
  },
  default: {
    name: 'Icon',
    props: ['icon'],
    template: '<span />',
  },
}))

// ---------------------------------------------------------------------------
// Optional: common DOM mocks that element-plus / chart.js / @vueuse may require
// ---------------------------------------------------------------------------
if (typeof window !== 'undefined' && !window.matchMedia) {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
}

// Robust ResizeObserver / IntersectionObserver mocks for @vueuse/core
// Use class-based mock so `new ResizeObserver()` works reliably and
// instance methods are always present (fixes observer.disconnect is not a function).
class ResizeObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
}
class IntersectionObserverMock {
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
  // @ts-ignore
  root = null
  // @ts-ignore
  rootMargin = ''
  // @ts-ignore
  thresholds = []
}

// Always install – overrides jsdom's undefined or incomplete impl
// and ensures global / globalThis / window all share the same mock.
;(globalThis as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverMock
;(global as unknown as Record<string, unknown>).ResizeObserver = ResizeObserverMock
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.ResizeObserver = ResizeObserverMock
}

;(globalThis as unknown as Record<string, unknown>).IntersectionObserver = IntersectionObserverMock
;(global as unknown as Record<string, unknown>).IntersectionObserver = IntersectionObserverMock
if (typeof window !== 'undefined') {
  // @ts-ignore
  window.IntersectionObserver = IntersectionObserverMock
}

// MutationObserver is present in jsdom but ensure disconnect exists
if (typeof window !== 'undefined' && window.MutationObserver) {
  const OriginalMO = window.MutationObserver
  // @ts-ignore
  window.MutationObserver = class extends OriginalMO {
    // jsdom's MO already works; keep for safety
  }
}
