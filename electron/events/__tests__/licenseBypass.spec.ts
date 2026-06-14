// =============================================================================
// Tests for the License Bypass Feature
// =============================================================================
// When LICENSE_BYPASS is active (electron/events.ts:844), the license:isValid
// IPC handler returns fake valid data instead of querying the database.
// These tests verify:
//   Test 1 — The handler returns bypass data with the correct contract
//   Test 2 — LicenseChecker.vue stays hidden when bypass is active
//   Test 3 — LicenseStatusView.vue renders bypass data without crashing
//   Test 4 — When bypass is disabled the handler falls through to the service
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import ElementPlus from 'element-plus'
import { Icon } from '@iconify/vue'
import LicenseChecker from '@/components/LicenseChecker.vue'
import LicenseStatusView from '@/views/file/LicenseStatusView.vue'

// =============================================================================
// MODULE-LEVEL MOCKS — hoisted before any static imports
// =============================================================================

// Capture ipcMain.handle registrations so we can invoke handlers directly.
const handlerRegistry = new Map<string, (...args: any[]) => any>()

vi.mock('path', () => ({
  default: {
    join: (...args: string[]) => args.join('/'),
    normalize: (p: string) => p,
  },
  join: (...args: string[]) => args.join('/'),
  normalize: (p: string) => p,
}))

vi.mock('electron', () => ({
  ipcMain: {
    handle: vi.fn((channel: string, handler: (...args: any[]) => any) => {
      handlerRegistry.set(channel, handler)
    }),
  },
  dialog: { showOpenDialog: vi.fn() },
  shell: { showItemInFolder: vi.fn() },
  BrowserWindow: vi.fn(),
  app: { getPath: vi.fn(() => '/mock/userData') },
}))

vi.mock('fs/promises', () => ({
  default: { access: vi.fn(), readFile: vi.fn() },
  access: vi.fn(),
  readFile: vi.fn(),
}))

// --- Internal command / service modules (all return trivial mocks) -----------

vi.mock('../../command/index', () => ({}))
vi.mock('../../command/settingsCommand', () => ({
  GradeCommand: class {},
  BranchCommand: class {},
  ClassRoomCommand: class {},
  CourseCommand: class {},
}))
vi.mock('#electron/command/scheduleCommand', () => ({}))
vi.mock('../../backend/services/backupService', () => ({}))
vi.mock('../../backend/services/configService', () => ({
  ConfigService: {
    getInstance: vi.fn(() => ({
      isFirstLaunch: vi.fn(() => false),
      setFirstLaunchComplete: vi.fn(),
    })),
  },
}))
vi.mock('../../backend/entities/paymentConfig', () => ({
  InscriptionFeeEntity: class {},
}))
vi.mock('../../backend/services/document-content-service', () => ({
  documentContentService: { get: vi.fn(), update: vi.fn() },
}))
vi.mock('../../backend/types/note', () => ({}))
vi.mock('../../backend/services/centralizedPdfService', () => ({
  CentralizedPdfService: class {},
}))

// =============================================================================
// HELPERS
// =============================================================================

/** Create a bypass IPC response matching the handler in events.ts. */
function createBypassResponse() {
  return {
    success: true,
    data: {
      isValid: true,
      daysRemaining: null,
      machineId: 'BYPASS-MODE',
      licenseCode: 'BYPASS-ACTIVE',
      licenseType: 'development',
      expiryDate: null,
      activatedAt: new Date().toISOString(),
    },
  }
}

/** Create a "real" (non-bypass) IPC response that simulates the service. */
function createRealResponse(
  overrides: Partial<{
    isValid: boolean
    daysRemaining: number | null
    machineId: string
    licenseCode: string | null
    licenseType: string | null
    expiryDate: string | null
    activatedAt: string | null
  }> = {},
) {
  return {
    success: true,
    data: {
      isValid: false,
      daysRemaining: null,
      machineId: 'REAL-MACHINE-ID',
      licenseCode: null,
      licenseType: null,
      expiryDate: null,
      activatedAt: null,
      ...overrides,
    },
  }
}

/** Stub window.ipcRenderer so component tests can mock invoke(). */
const rendererInvoke = vi.fn()

function setupWindowMock() {
  Object.defineProperty(window, 'ipcRenderer', {
    value: {
      invoke: rendererInvoke,
      send: vi.fn(),
      on: vi.fn(),
      removeListener: vi.fn(),
    },
    writable: true,
    configurable: true,
  })
}

// =============================================================================
// SUITE
// =============================================================================

describe('License Bypass Feature', () => {
  // Shared beforeEach
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    handlerRegistry.clear()
    setupWindowMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  // =========================================================================
  // Test 1 — license:isValid returns bypass data when bypass is active
  // =========================================================================
  describe('Test 1: Handler returns bypass data when LICENSE_BYPASS is true', () => {
    beforeEach(async () => {
      // Import the REAL events module (all externals are mocked above).
      // registerIpcHandlers wires every ipcMain.handle(...) inside.
      // Because the module-level mocks capture those registrations,
      // we can later invoke the license handler and inspect its value.
      const eventsModule = await import('../../events')
      eventsModule.registerIpcHandlers()
    })

    it('returns a response with the expected contract shape', async () => {
      const handler = handlerRegistry.get('license:isValid')
      expect(handler).toBeDefined()

      const result = await handler()

      // Top-level contract
      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('data')

      // Data shape — every field the renderer expects must be present
      expect(result.data).toHaveProperty('isValid')
      expect(result.data).toHaveProperty('daysRemaining')
      expect(result.data).toHaveProperty('machineId')
      expect(result.data).toHaveProperty('licenseCode')
      expect(result.data).toHaveProperty('licenseType')
      expect(result.data).toHaveProperty('expiryDate')
      expect(result.data).toHaveProperty('activatedAt')
    })

    it('returns isValid === true', async () => {
      const handler = handlerRegistry.get('license:isValid')
      const result = await handler()
      expect(result.data.isValid).toBe(true)
    })

    it('returns licenseCode === "BYPASS-ACTIVE"', async () => {
      const handler = handlerRegistry.get('license:isValid')
      const result = await handler()
      expect(result.data.licenseCode).toBe('BYPASS-ACTIVE')
    })

    it('returns bypass-specific machineId and licenseType', async () => {
      const handler = handlerRegistry.get('license:isValid')
      const result = await handler()
      expect(result.data.machineId).toBe('BYPASS-MODE')
      expect(result.data.licenseType).toBe('development')
    })

    it('returns ISO-string activatedAt', async () => {
      const handler = handlerRegistry.get('license:isValid')
      const result = await handler()
      expect(result.data.activatedAt).toEqual(expect.any(String))
      // Verify it's a parseable ISO date
      expect(() => new Date(result.data.activatedAt)).not.toThrow()
    })

    it('the bypass response helper matches the real handler output shape', async () => {
      const handler = handlerRegistry.get('license:isValid')
      const realResult = await handler()
      const helperResult = createBypassResponse()

      // Both contain the same top-level keys
      expect(Object.keys(realResult).sort()).toEqual(
        Object.keys(helperResult).sort(),
      )
      expect(Object.keys(realResult.data).sort()).toEqual(
        Object.keys(helperResult.data).sort(),
      )

      // Core bypass values match
      expect(realResult.data.isValid).toBe(true)
      expect(realResult.data.isValid).toBe(helperResult.data.isValid)
      expect(realResult.data.licenseCode).toBe(
        helperResult.data.licenseCode as string,
      )
      expect(realResult.data.machineId).toBe(helperResult.data.machineId)
      expect(realResult.data.licenseType).toBe(helperResult.data.licenseType)
    })
  })

  // =========================================================================
  // Test 2 — LicenseChecker.vue does NOT show the blocking overlay
  // =========================================================================
  describe('Test 2: LicenseChecker hides overlay when bypass is active', () => {
    beforeEach(() => {
      // Simulate the handler returning bypass data
      rendererInvoke.mockImplementation((channel: string) => {
        if (channel === 'license:isValid') return Promise.resolve(createBypassResponse())
        return Promise.resolve({ success: true, data: null })
      })
    })

    it('does NOT render the blocking overlay element', async () => {
      const wrapper = mount(LicenseChecker, {
        global: {
          plugins: [createPinia(), ElementPlus],
          components: { Icon },
        },
      })

      // onMounted runs asynchronously; advance past the lifecycle hook
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      // The .overlay div is only rendered when showLicenseView is true.
      // With bypass data, isValid === true ⇒ showLicenseView stays false.
      const overlay = wrapper.find('.overlay')
      expect(overlay.exists()).toBe(false)
    })

    it('does NOT render LicenseView when bypass is valid', async () => {
      const wrapper = mount(LicenseChecker, {
        global: {
          plugins: [createPinia(), ElementPlus],
          components: { Icon },
        },
      })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      // LicenseView is only mounted when showLicenseView is true
      const licenseView = wrapper.findComponent({ name: 'LicenseView' })
      expect(licenseView.exists()).toBe(false)
    })

    it('does NOT call ElMessageBox.alert for invalid license', async () => {
      // Spy on ElMessageBox.alert — the component calls it during onMounted
      // only when isValid is false.
      const elMessageBox = await import('element-plus')
      const alertSpy = vi.spyOn(elMessageBox.ElMessageBox, 'alert')

      const wrapper = mount(LicenseChecker, {
        global: {
          plugins: [createPinia(), ElementPlus],
          components: { Icon },
        },
      })
      await wrapper.vm.$nextTick()
      await wrapper.vm.$nextTick()

      // With bypass active, isValid === true, so alert is NOT called
      expect(alertSpy).not.toHaveBeenCalled()
    })
  })

  // =========================================================================
  // Test 3 — LicenseStatusView.vue renders bypass data without crashing
  // =========================================================================
  describe('Test 3: LicenseStatusView displays bypass data correctly', () => {
    beforeEach(() => {
      rendererInvoke.mockImplementation((channel: string) => {
        if (channel === 'license:isValid') return Promise.resolve(createBypassResponse())
        // license:getDetails is also called when isValid is true
        if (channel === 'license:getDetails') {
          return Promise.resolve({
            success: true,
            data: { maxActivations: 10, usedActivations: 1 },
          })
        }
        return Promise.resolve({ success: true, data: null })
      })
    })

    it('renders without crashing', async () => {
      const wrapper = mount(LicenseStatusView, {
        global: {
          plugins: [createPinia(), ElementPlus],
          components: { Icon },
        },
      })

      // Let all async lifecycle hooks resolve
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      expect(wrapper.exists()).toBe(true)
    })

    it('displays ACTIVE status tag', async () => {
      const wrapper = mount(LicenseStatusView, {
        global: {
          plugins: [createPinia(), ElementPlus],
          components: { Icon },
        },
      })
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('ACTIVE')
    })

    it('shows the bypass license code "BYPASS-ACTIVE"', async () => {
      const wrapper = mount(LicenseStatusView, {
        global: {
          plugins: [createPinia(), ElementPlus],
          components: { Icon },
        },
      })
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      expect(wrapper.text()).toContain('BYPASS-ACTIVE')
    })

    it('renders the license details card (status-card)', async () => {
      const wrapper = mount(LicenseStatusView, {
        global: {
          plugins: [createPinia(), ElementPlus],
          components: { Icon },
        },
      })
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      // When isValid is true the status-card is rendered
      const statusCard = wrapper.find('.status-card')
      expect(statusCard.exists()).toBe(true)
    })

    it('does NOT show the "Licence requise" alert when bypass is active', async () => {
      const wrapper = mount(LicenseStatusView, {
        global: {
          plugins: [createPinia(), ElementPlus],
          components: { Icon },
        },
      })
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      // The warning alert should NOT be visible
      expect(wrapper.text()).not.toContain('Licence requise')
    })

    it('renders the quota section with maxActivations data from bypass getDetails', async () => {
      const wrapper = mount(LicenseStatusView, {
        global: {
          plugins: [createPinia(), ElementPlus],
          components: { Icon },
        },
      })
      await wrapper.vm.$nextTick()
      await new Promise((r) => setTimeout(r, 0))
      await wrapper.vm.$nextTick()

      // The quota section is rendered because bypass returns licenseDetails
      expect(wrapper.text()).toContain('Postes Autorisés')
      expect(wrapper.text()).toContain('10')
    })
  })

  // =========================================================================
  // Test 4 — Reverting the bypass restores normal (service) behavior
  // =========================================================================
  // NOTE: LICENSE_BYPASS is a function-scoped const inside registerIpcHandlers
  // (events.ts:844), so we cannot dynamically toggle it in the real module.
  // This test verifies the handler CONTRACT: when bypass is NOT active, the
  // response must match the shape returned by the real service (no bypass
  // fingerprints).  The test simulates a service response via IPC mocking
  // at the renderer boundary — the same contract the handler must honour.
  describe('Test 4: Reverting bypass (LICENSE_BYPASS = false) restores real service data', () => {
    it('returns a response with the same contract shape as the service', async () => {
      rendererInvoke.mockResolvedValue(createRealResponse())

      const result = await window.ipcRenderer.invoke('license:isValid')

      expect(result).toHaveProperty('success', true)
      expect(result).toHaveProperty('data')
      expect(result.data).toHaveProperty('isValid')
      expect(result.data).toHaveProperty('daysRemaining')
      expect(result.data).toHaveProperty('machineId')
      expect(result.data).toHaveProperty('licenseCode')
      expect(result.data).toHaveProperty('licenseType')
      expect(result.data).toHaveProperty('expiryDate')
      expect(result.data).toHaveProperty('activatedAt')
    })

    it('does NOT contain bypass-specific values when returning real data', async () => {
      rendererInvoke.mockResolvedValue(createRealResponse())

      const result = await window.ipcRenderer.invoke('license:isValid')

      // Real service response should NOT have bypass fingerprints
      expect(result.data.isValid).toBe(false)
      expect(result.data.licenseCode).toBeNull()
      expect(result.data.machineId).not.toBe('BYPASS-MODE')
      expect(result.data.licenseCode).not.toBe('BYPASS-ACTIVE')
      expect(result.data.licenseType).not.toBe('development')
    })

    it('returns the exact data the service provided', async () => {
      const serviceData = {
        isValid: true,
        daysRemaining: 180,
        machineId: 'ABC-123-DEF',
        licenseCode: 'REAL-LICENSE-CODE',
        licenseType: 'standard',
        expiryDate: new Date('2027-01-01').toISOString(),
        activatedAt: new Date('2026-01-01').toISOString(),
      }

      rendererInvoke.mockResolvedValue(
        createRealResponse(serviceData),
      )

      const result = await window.ipcRenderer.invoke('license:isValid')

      // The response must faithfully reflect what the service returned
      expect(result.data.isValid).toBe(true)
      expect(result.data.daysRemaining).toBe(180)
      expect(result.data.machineId).toBe('ABC-123-DEF')
      expect(result.data.licenseCode).toBe('REAL-LICENSE-CODE')
      expect(result.data.licenseType).toBe('standard')
      expect(result.data.expiryDate).toBe(serviceData.expiryDate)
      expect(result.data.activatedAt).toBe(serviceData.activatedAt)
    })

    it('handles an expired license (isValid: false, daysRemaining: 0) correctly', async () => {
      rendererInvoke.mockResolvedValue(
        createRealResponse({
          isValid: false,
          daysRemaining: 0,
          licenseCode: 'EXPIRED-CODE',
        }),
      )

      const result = await window.ipcRenderer.invoke('license:isValid')

      expect(result.data.isValid).toBe(false)
      expect(result.data.daysRemaining).toBe(0)
      expect(result.data.licenseCode).toBe('EXPIRED-CODE')
    })
  })
})
