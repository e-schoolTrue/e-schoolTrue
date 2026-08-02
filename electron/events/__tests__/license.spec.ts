// =============================================================================
// Tests du contrat IPC de licence (electron/events.ts) + composants UI
// =============================================================================
// L'ancien bypass (LICENSE_BYPASS / license:isValid) a été supprimé. Ces tests
// vérifient le nouveau contrat 100 % offline :
//   license:getMachineId, license:activateMaster|Sub, license:generateSub,
//   license:getStatus, license:getDetails.
//
// Les handlers sont enregistrés via un mock d'electron qui capture
// ipcMain.handle dans un registre ; global.licenseService est remplacé par un
// mock typé avant chaque invocation de handler. Les composants consomment les
// mêmes canaux via window.ipcRenderer.invoke (mocké).

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount } from '@vue/test-utils'
import ElementPlus, { ElMessageBox } from 'element-plus'
import { Icon } from '@iconify/vue'
import LicenseChecker from '@/components/LicenseChecker.vue'
import LicenseStatusView from '@/views/file/LicenseStatusView.vue'
import LicenseView from '@/views/omboarding/LicenseView.vue'

// =============================================================================
// MODULE-LEVEL MOCKS — hoistés avant tout import statique
// =============================================================================

// Capture ipcMain.handle registrations so we can invoke handlers directly.
const handlerRegistry = vi.hoisted(() => new Map<string, (...args: any[]) => any>())

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

vi.mock('path', () => ({
  default: {
    join: (...args: string[]) => args.join('/'),
    normalize: (p: string) => p,
  },
  join: (...args: string[]) => args.join('/'),
  normalize: (p: string) => p,
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

// Contrat du service de licence (mock global.licenseService)
interface MockLicenseStatusData {
  isValid: boolean
  machineId: string
  licenseType: 'master' | 'sub' | null
  customer: string | null
  expiryDate: string | null
  daysRemaining: number | null
  stationIndex: number | null
  maxStations: number | null
  clockError?: boolean
}

interface MockLicenseDetailsData {
  isValid: boolean
  maxStations: number | null
  usedStations: number | null
  customer: string | null
  licenseType: string | null
  expiresAt: string | null
}

interface MockLicenseService {
  getMachineId: () => string
  activateMaster: (code: string) => Promise<{ success: boolean; message?: string; data?: { licenseType: string } }>
  activateSub: (packageText: string) => Promise<{ success: boolean; message?: string; data?: { licenseType: string } }>
  generateSub: (targetMachineId?: string) => Promise<{ success: boolean; message?: string; data?: { subLicenseCode: string } }>
  removeSub: (targetMachineId: string) => Promise<{ success: boolean; message?: string }>
  getStatus: () => Promise<{ success: boolean; data: MockLicenseStatusData }>
  getDetails: () => Promise<{ success: boolean; data: MockLicenseDetailsData }>
}

const DEFAULT_STATUS_DATA: MockLicenseStatusData = {
  isValid: false,
  machineId: 'MACHINE-TEST-1',
  licenseType: null,
  customer: null,
  expiryDate: null,
  daysRemaining: null,
  stationIndex: null,
  maxStations: null,
}

const DEFAULT_DETAILS_DATA: MockLicenseDetailsData = {
  isValid: false,
  maxStations: null,
  usedStations: null,
  customer: null,
  licenseType: null,
  expiresAt: null,
}

/** Installe un mock typé de licenseService sur globalThis et le retourne. */
function installLicenseServiceMock(): MockLicenseService {
  const service: MockLicenseService = {
    getMachineId: vi.fn(() => 'MACHINE-TEST-1'),
    activateMaster: vi.fn(async () => ({
      success: true,
      message: 'Licence maître activée avec succès.',
      data: { licenseType: 'master' },
    })),
    activateSub: vi.fn(async () => ({
      success: true,
      message: 'Sous-licence activée avec succès.',
      data: { licenseType: 'sub' },
    })),
    generateSub: vi.fn(async () => ({ success: true, data: { subLicenseCode: 'SUB-TOKEN-ABC' } })),
    removeSub: vi.fn(async () => ({ success: true })),
    getStatus: vi.fn(async () => ({ success: true, data: DEFAULT_STATUS_DATA })),
    getDetails: vi.fn(async () => ({ success: true, data: DEFAULT_DETAILS_DATA })),
  }
  ;(globalThis as { licenseService?: MockLicenseService }).licenseService = service
  return service
}

// =============================================================================
// SUITE 1 — Handlers IPC
// =============================================================================

describe('Contrat IPC de licence (handlers)', () => {
  beforeEach(async () => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    handlerRegistry.clear()
    const eventsModule = await import('../../events')
    eventsModule.registerIpcHandlers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('license:getMachineId renvoie { machineId } et délègue au service', async () => {
    const service = installLicenseServiceMock()

    const handler = handlerRegistry.get('license:getMachineId')
    expect(handler).toBeDefined()
    const result = await handler()

    expect(result).toEqual({ success: true, data: { machineId: 'MACHINE-TEST-1' } })
    expect(service.getMachineId).toHaveBeenCalledTimes(1)
  })

  it('license:activateMaster transmet le code au service et renvoie sa réponse', async () => {
    const service = installLicenseServiceMock()
    vi.mocked(service.activateMaster).mockResolvedValue({ success: false, message: 'Signature invalide' })

    const handler = handlerRegistry.get('license:activateMaster')
    expect(handler).toBeDefined()
    const result = await handler(null, 'MASTER-CODE')

    expect(service.activateMaster).toHaveBeenCalledWith('MASTER-CODE')
    expect(result).toEqual({ success: false, message: 'Signature invalide' })
  })

  it('license:activateSub transmet le code au service et renvoie sa réponse', async () => {
    const service = installLicenseServiceMock()

    const handler = handlerRegistry.get('license:activateSub')
    expect(handler).toBeDefined()
    const result = await handler(null, 'SUB-CODE')

    expect(service.activateSub).toHaveBeenCalledWith('SUB-CODE')
    expect(result).toEqual({
      success: true,
      message: 'Sous-licence activée avec succès.',
      data: { licenseType: 'sub' },
    })
  })

  it('license:generateSub renvoie le code généré et transmet la machine cible', async () => {
    const service = installLicenseServiceMock()

    const handler = handlerRegistry.get('license:generateSub')
    expect(handler).toBeDefined()
    const result = await handler(null, 'machine-B')

    expect(service.generateSub).toHaveBeenCalledWith('machine-B')
    expect(result).toEqual({ success: true, data: { subLicenseCode: 'SUB-TOKEN-ABC' } })
  })

  it('license:generateSub sans cible appelle le service avec undefined', async () => {
    const service = installLicenseServiceMock()

    const handler = handlerRegistry.get('license:generateSub')!
    const result = await handler(null)

    expect(service.generateSub).toHaveBeenCalledWith(undefined)
    expect(result).toEqual({ success: true, data: { subLicenseCode: 'SUB-TOKEN-ABC' } })
  })

  it('license:generateSub renvoie { success: false, error } quand la génération échoue', async () => {
    const service = installLicenseServiceMock()
    vi.mocked(service.generateSub).mockResolvedValue({
      success: false,
      message: 'Seul le poste principal peut générer des sous-licences.',
    })

    const handler = handlerRegistry.get('license:generateSub')!
    const result = await handler(null)

    expect(result).toEqual({ success: false, error: 'Seul le poste principal peut générer des sous-licences.' })
  })

  it('license:removeSub transmet la machine cible au service et renvoie sa réponse', async () => {
    const service = installLicenseServiceMock()

    const handler = handlerRegistry.get('license:removeSub')
    expect(handler).toBeDefined()
    const result = await handler(null, 'machine-B')

    expect(service.removeSub).toHaveBeenCalledWith('machine-B')
    expect(result).toEqual({ success: true })
  })

  it('license:removeSub renvoie { success: false, message } quand le retrait échoue', async () => {
    const service = installLicenseServiceMock()
    vi.mocked(service.removeSub).mockResolvedValue({
      success: false,
      message: 'Aucune sous-licence pour ce poste.',
    })

    const handler = handlerRegistry.get('license:removeSub')!
    const result = await handler(null, 'machine-inconnue')

    expect(service.removeSub).toHaveBeenCalledWith('machine-inconnue')
    expect(result).toEqual({ success: false, message: 'Aucune sous-licence pour ce poste.' })
  })

  it('license:getStatus renvoie le statut du service', async () => {
    const service = installLicenseServiceMock()
    const statusData: MockLicenseStatusData = {
      isValid: true,
      machineId: 'MACHINE-TEST-1',
      licenseType: 'master',
      customer: 'École Test',
      expiryDate: '2030-01-01T00:00:00.000Z',
      daysRemaining: 365,
      stationIndex: 1,
      maxStations: 5,
    }
    vi.mocked(service.getStatus).mockResolvedValue({ success: true, data: statusData })

    const handler = handlerRegistry.get('license:getStatus')
    expect(handler).toBeDefined()
    const result = await handler()

    expect(result).toEqual({ success: true, data: statusData })
    expect(service.getStatus).toHaveBeenCalledTimes(1)
  })

  it('license:getDetails renvoie les détails du service', async () => {
    const service = installLicenseServiceMock()
    const detailsData: MockLicenseDetailsData = {
      isValid: true,
      maxStations: 5,
      usedStations: 2,
      customer: 'École Test',
      licenseType: 'master',
      expiresAt: '2030-01-01T00:00:00.000Z',
    }
    vi.mocked(service.getDetails).mockResolvedValue({ success: true, data: detailsData })

    const handler = handlerRegistry.get('license:getDetails')
    expect(handler).toBeDefined()
    const result = await handler()

    expect(result).toEqual({ success: true, data: detailsData })
  })
})

// =============================================================================
// SUITE 2 — LicenseChecker.vue (consomme license:getStatus)
// =============================================================================

describe('LicenseChecker.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    setupWindowMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('masque l’overlay et ne bloque pas quand la licence est valide', async () => {
    rendererInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'license:getStatus') {
        return {
          success: true,
          data: {
            isValid: true,
            machineId: 'MACHINE-TEST-1',
            licenseType: 'master',
            customer: 'École Test',
            expiryDate: '2030-01-01',
            daysRemaining: 200,
            stationIndex: 1,
            maxStations: 5,
          },
        }
      }
      return { success: true, data: null }
    })
    const alertSpy = vi.spyOn(ElMessageBox, 'alert').mockResolvedValue(undefined as never)

    const wrapper = mount(LicenseChecker, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })
    await wrapper.vm.$nextTick()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('.overlay').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'LicenseView' }).exists()).toBe(false)
    expect(alertSpy).not.toHaveBeenCalled()
  })

  it('affiche un message d’activation et l’overlay quand il n’y a pas de licence', async () => {
    rendererInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'license:getStatus') {
        return { success: true, data: { ...DEFAULT_STATUS_DATA } }
      }
      if (channel === 'license:getMachineId') {
        return { success: true, data: { machineId: 'MACHINE-TEST-1' } }
      }
      return { success: true, data: null }
    })
    const alertSpy = vi.spyOn(ElMessageBox, 'alert').mockResolvedValue(undefined as never)

    const wrapper = mount(LicenseChecker, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(alertSpy).toHaveBeenCalledTimes(1)
    expect(alertSpy.mock.calls[0][0]).toContain('Veuillez activer une licence')
    expect(wrapper.find('.overlay').exists()).toBe(true)
  })

  it('affiche un message de renouvellement quand la licence est expirée', async () => {
    rendererInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'license:getStatus') {
        return {
          success: true,
          data: {
            isValid: false,
            machineId: 'MACHINE-TEST-1',
            licenseType: 'master',
            customer: 'École Test',
            expiryDate: '2020-01-01',
            daysRemaining: 0,
            stationIndex: 1,
            maxStations: 5,
          },
        }
      }
      if (channel === 'license:getMachineId') {
        return { success: true, data: { machineId: 'MACHINE-TEST-1' } }
      }
      return { success: true, data: null }
    })
    const alertSpy = vi.spyOn(ElMessageBox, 'alert').mockResolvedValue(undefined as never)

    const wrapper = mount(LicenseChecker, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(alertSpy).toHaveBeenCalledTimes(1)
    expect(alertSpy.mock.calls[0][0]).toContain('Votre licence est expirée')
  })

  it('affiche le message d’horloge (pas le prompt d’activation) quand clockError est vrai', async () => {
    rendererInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'license:getStatus') {
        return {
          success: true,
          data: {
            ...DEFAULT_STATUS_DATA,
            licenseType: 'master',
            customer: 'École Test',
            expiryDate: '2030-01-01',
            daysRemaining: 300,
            stationIndex: 1,
            maxStations: 5,
            clockError: true,
          },
        }
      }
      return { success: true, data: null }
    })
    const alertSpy = vi.spyOn(ElMessageBox, 'alert').mockResolvedValue(undefined as never)

    const wrapper = mount(LicenseChecker, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(alertSpy).toHaveBeenCalledTimes(1)
    expect(alertSpy.mock.calls[0][0]).toContain('horloge')
    // Pas de prompt d'activation : la vue d'activation et l'overlay restent masqués
    expect(alertSpy.mock.calls[0][0]).not.toContain('Veuillez activer une licence')
    expect(wrapper.find('.overlay').exists()).toBe(false)
    expect(wrapper.findComponent({ name: 'LicenseView' }).exists()).toBe(false)
  })

  it('bloque l’application sans vue d’activation quand clockError est true', async () => {
    rendererInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'license:getStatus') {
        return {
          success: true,
          data: {
            isValid: false,
            machineId: 'MACHINE-TEST-1',
            licenseType: 'master',
            customer: 'École Test',
            expiryDate: '2030-01-01',
            daysRemaining: 0,
            stationIndex: 1,
            maxStations: 5,
            clockError: true,
          },
        }
      }
      return { success: true, data: null }
    })
    const alertSpy = vi.spyOn(ElMessageBox, 'alert').mockResolvedValue(undefined as never)

    const wrapper = mount(LicenseChecker, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()

    expect(alertSpy).toHaveBeenCalledTimes(1)
    expect(alertSpy.mock.calls[0][0]).toContain('L\'horloge système a été reculée')
    expect(alertSpy.mock.calls[0][1]).toBe('Horloge système modifiée')
    expect(alertSpy.mock.calls[0][2]).toMatchObject({ type: 'warning' })
    // Aucune vue d'activation / overlay ne doit s'afficher tant que l'horloge n'est pas corrigée
    expect(wrapper.findComponent({ name: 'LicenseView' }).exists()).toBe(false)
    expect(wrapper.find('.overlay').exists()).toBe(false)
  })
})

// =============================================================================
// SUITE 3 — LicenseStatusView.vue (rendu statut + quota)
// =============================================================================

describe('LicenseStatusView.vue', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    setupWindowMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const VALID_STATUS = {
    success: true,
    data: {
      isValid: true,
      machineId: 'MACHINE-STATUS',
      licenseType: 'master',
      customer: 'École Test',
      expiryDate: '2030-01-01T00:00:00.000Z',
      daysRemaining: 300,
      stationIndex: 1,
      maxStations: 5,
    },
  }

  const DETAILS_USED_2 = {
    success: true,
    data: {
      isValid: true,
      maxStations: 5,
      usedStations: 2,
      customer: 'École Test',
      licenseType: 'master',
      expiresAt: '2030-01-01T00:00:00.000Z',
    },
  }

  function mountView() {
    return mount(LicenseStatusView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })
  }

  async function flushView(wrapper: ReturnType<typeof mountView>) {
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()
  }

  it('affiche le statut ACTIVE et les informations de la licence', async () => {
    rendererInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'license:getStatus') return VALID_STATUS
      if (channel === 'license:getDetails') return DETAILS_USED_2
      return { success: true, data: null }
    })

    const wrapper = mountView()
    await flushView(wrapper)

    expect(wrapper.text()).toContain('ACTIVE')
    expect(wrapper.text()).toContain('MACHINE-STATUS')
    expect(wrapper.text()).toContain('École Test')
    expect(wrapper.text()).toContain('Licence principale')
    expect(wrapper.find('.status-card').exists()).toBe(true)
  })

  it('affiche la section quota avec le nombre de postes utilisés', async () => {
    rendererInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'license:getStatus') return VALID_STATUS
      if (channel === 'license:getDetails') return DETAILS_USED_2
      return { success: true, data: null }
    })

    const wrapper = mountView()
    await flushView(wrapper)

    expect(wrapper.text()).toContain('Postes Autorisés')
    expect(wrapper.text()).toContain('2 postes utilisés sur 5 autorisés')
    expect(wrapper.text()).toContain('Générer une licence pour un autre ordinateur')
  })

  it('affiche l’alerte « Licence requise » quand le statut est invalide', async () => {
    rendererInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'license:getStatus') {
        return { success: true, data: { ...DEFAULT_STATUS_DATA, machineId: 'MACHINE-STATUS' } }
      }
      return { success: true, data: null }
    })

    const wrapper = mountView()
    await flushView(wrapper)

    expect(wrapper.text()).toContain('Licence requise')
    expect(wrapper.find('.status-card').exists()).toBe(false)
  })

  it('affiche « Quota épuisé » quand usedStations == maxStations', async () => {
    rendererInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'license:getStatus') return VALID_STATUS
      if (channel === 'license:getDetails') {
        return {
          success: true,
          data: { isValid: true, maxStations: 5, usedStations: 5, customer: 'École Test', licenseType: 'master', expiresAt: '2030-01-01T00:00:00.000Z' },
        }
      }
      return { success: true, data: null }
    })

    const wrapper = mountView()
    await flushView(wrapper)

    expect(wrapper.text()).toContain('Quota épuisé')
    expect(wrapper.text()).not.toContain('Générer une licence pour un autre ordinateur')
  })
})

// =============================================================================
// SUITE 4 — LicenseView.vue (activation : le jeton ne doit JAMAIS être
// transformé par l'UI — anti-régression C1)
// =============================================================================

describe('LicenseView.vue (activation sans transformation du jeton)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setActivePinia(createPinia())
    setupWindowMock()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  async function flush(wrapper: ReturnType<typeof mount>) {
    await wrapper.vm.$nextTick()
    await new Promise((resolve) => setTimeout(resolve, 0))
    await wrapper.vm.$nextTick()
  }

  it('C1 : transmet le jeton brut (trim uniquement) à license:activateMaster', async () => {
    // Jeton signé réaliste : base64url(JSON).signatureHex — contient un '.',
    // des minuscules et des majuscules. Toute transformation (uppercase/strip)
    // le rendrait invalide côté vérification.
    const rawToken =
      'eyJhbGciOi.abcdefghijklmnopqrstuvwxyz0123456789-_.ABCDEFGHIJKLMNOPQRSTUVWXYZ'

    rendererInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'license:getMachineId') {
        return { success: true, data: { machineId: 'MACHINE-UI-1' } }
      }
      if (channel === 'license:activateMaster') {
        return { success: true, message: 'Licence maître activée avec succès.', data: { licenseType: 'master' } }
      }
      return { success: true, data: null }
    })

    const wrapper = mount(LicenseView, {
      global: {
        plugins: [createPinia(), ElementPlus],
        components: { Icon },
      },
    })
    await flush(wrapper)

    // Étape 1 : l'identifiant machine est chargé → aller à l'étape 2
    const goToStep2 = wrapper.findAll('button').find((b) => b.text().includes('J\'ai ma licence'))
    expect(goToStep2).toBeDefined()
    await goToStep2!.trigger('click')
    await flush(wrapper)

    // Étape 2 (mode maître par défaut) : coller le jeton dans la textarea
    const textarea = wrapper.find('.license-input textarea')
    expect(textarea.exists()).toBe(true)
    await textarea.setValue(rawToken)
    await flush(wrapper)

    const activateBtn = wrapper.findAll('button').find((b) => b.text().includes('Activer la Licence'))
    expect(activateBtn).toBeDefined()
    await activateBtn!.trigger('click')
    await flush(wrapper)

    // Le jeton exact (brut) est transmis : ni uppercase, ni stripping
    expect(rendererInvoke).toHaveBeenCalledWith('license:activateMaster', rawToken)
    // Anti-régression explicite : aucune version transformée ne doit partir
    const masterCalls = rendererInvoke.mock.calls.filter(([channel]) => channel === 'license:activateMaster')
    expect(masterCalls).toHaveLength(1)
    const sent = masterCalls[0][1]
    expect(sent).toBe(rawToken)
    expect(sent).not.toBe(rawToken.toUpperCase())
    expect(sent).not.toContain('+') // aucun caractère ajouté par un nettoyage regex
  })
})
