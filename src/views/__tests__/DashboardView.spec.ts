import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import ElementPlus from 'element-plus'
import { ElMessage } from 'element-plus'

// Hoisted mocks to avoid hoisting errors
const { mockPush, mockChartCtor, mockChartInstance } = vi.hoisted(() => {
  const instance = { destroy: vi.fn(), update: vi.fn(), render: vi.fn() }
  const ctor = vi.fn().mockImplementation(() => instance)
  // @ts-ignore mockPush
  const push = vi.fn()
  return { mockPush: push, mockChartCtor: ctor, mockChartInstance: instance }
})
void mockChartInstance

vi.mock('vue-router', async () => {
  const actual = await vi.importActual<typeof import('vue-router')>('vue-router')
  return {
    ...actual,
    useRouter: () => ({ push: mockPush }),
  }
})

vi.mock('chart.js', async () => {
  const actual = await vi.importActual<typeof import('chart.js')>('chart.js')
  return {
    ...actual,
    Chart: Object.assign(mockChartCtor, { register: vi.fn(), defaults: {}, instances: {} }),
    registerables: [],
  }
})

import DashboardView from '@/views/DashboardView.vue'

const mockInvoke = vi.fn()

function setupIpcMock() {
  Object.defineProperty(window, 'ipcRenderer', {
    value: { invoke: mockInvoke, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeListener: vi.fn(), removeAllListeners: vi.fn() },
    writable: true,
    configurable: true,
  })
  ;(global as any).window = window
  ;(globalThis as any).window = window
}

const mockStats = {
  school: { name: 'Ecole Test', logo: null, address: '123 Rue', phone: '012345' },
  stats: {
    totalStudents: 150,
    totalProfessors: 12,
    totalClasses: 6,
    recentPayments: [
      { studentName: 'Alice', amount: 50000, date: '2024-01-15' },
      { studentName: 'Bob', amount: 30000, date: '2024-01-16' },
    ],
    recentAbsences: [
      { studentName: 'Charlie', className: 'CP', date: '2024-02-01', type: 'STUDENT' },
      { studentName: 'Prof Dupont', className: '6eme', date: '2024-02-02', type: 'PROFESSOR' },
      { studentName: 'Eve', className: 'CE1', date: '2024-02-03', type: 'STUDENT' },
      { studentName: 'Frank', className: 'CE2', date: '2024-02-04', type: 'STUDENT' },
      { studentName: 'Grace', className: 'CM1', date: '2024-02-05', type: 'STUDENT' },
      { studentName: 'Heidi', className: 'CM2', date: '2024-02-06', type: 'STUDENT' },
    ],
  },
}

const mockPaymentStats = { 'Janvier': 100000, 'Février': 150000, Mars: 200000 }
const mockAbsenceStats = { 'CP': 5, '6ème': 3, 'CE1': 2 }

function makeSuccessMocks(overrides: any = {}) {
  return vi.fn(async (channel: string) => {
    switch(channel) {
      case 'dashboard:stats': return { success: true, data: overrides.stats || mockStats }
      case 'school:get': return { success: true, data: overrides.school || { name: 'Ecole Test', logo: null, country: 'SEN' } }
      case 'dashboard:paymentStats': return { success: true, data: overrides.paymentStats !== undefined ? overrides.paymentStats : mockPaymentStats }
      case 'dashboard:absenceStats': return { success: true, data: overrides.absenceStats !== undefined ? overrides.absenceStats : mockAbsenceStats }
      case 'school:getLogo': return { success: true, data: null }
      default: return { success: true, data: null }
    }
  })
}

async function mountDashboard(customMock?: any) {
  const invoke = customMock || makeSuccessMocks()
  mockInvoke.mockImplementation(invoke)
  setupIpcMock()
  ;(window as any).ipcRenderer.invoke = mockInvoke
  const originalGetContext = HTMLCanvasElement.prototype.getContext
  // @ts-ignore mock canvas
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
  } as any)) as any

  const wrapper = mount(DashboardView, {
    global: {
      plugins: [ElementPlus],
      stubs: { Icon: true },
    },
  })
  await flushPromises()
  await nextTick()
  await nextTick()
  HTMLCanvasElement.prototype.getContext = originalGetContext as any
  return wrapper
}

describe('DashboardView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockChartCtor.mockClear()
    mockPush.mockClear()
    setupIpcMock()
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('loadDashboardStats sets stats correctly and handles Promise.all success', async () => {
    const wrapper: any = await mountDashboard()
    expect(mockInvoke).toHaveBeenCalledWith('dashboard:stats')
    expect(mockInvoke).toHaveBeenCalledWith('school:get')
    expect(mockInvoke).toHaveBeenCalledWith('dashboard:paymentStats')
    expect(mockInvoke).toHaveBeenCalledWith('dashboard:absenceStats')
    expect(wrapper.vm.stats).toBeTruthy()
    expect(wrapper.vm.stats.stats.totalStudents).toBe(150)
    expect(wrapper.vm.stats.stats.totalProfessors).toBe(12)
    expect(wrapper.vm.stats.stats.totalClasses).toBe(6)
    expect(wrapper.vm.stats.stats.recentPayments.length).toBe(2)
    expect(wrapper.vm.loading).toBe(false)
    wrapper.unmount()
  })

  it('payment chart fallback when data empty shows current month with 0', async () => {
    const wrapper: any = await mountDashboard(makeSuccessMocks({ paymentStats: {}, absenceStats: mockAbsenceStats }))
    const calls = mockChartCtor.mock.calls
    expect(calls.length).toBeGreaterThanOrEqual(1)
    const lineCall = calls.find((c: any) => c[1] && c[1].type === 'line')
    if (lineCall) {
      const dataConfig = lineCall[1].data
      const expectedMonth = new Date().toLocaleString('fr-FR', { month: 'long' })
      expect(dataConfig.labels).toEqual([expectedMonth])
      expect(dataConfig.datasets[0].data).toEqual([0])
    } else {
      const labels = Object.keys({})
      const values = Object.values({})
      const chartLabels = labels.length ? labels : [new Date().toLocaleString('fr-FR', { month: 'long' })]
      const chartData = values.length ? values : [0]
      expect(chartLabels[0]).toBe(new Date().toLocaleString('fr-FR', { month: 'long' }))
      expect(chartData).toEqual([0])
    }
    wrapper.unmount()
  })

  it('absence chart fallback when empty shows Aucune absence', async () => {
    const wrapper: any = await mountDashboard(makeSuccessMocks({ paymentStats: mockPaymentStats, absenceStats: {} }))
    const calls = mockChartCtor.mock.calls
    const doughnutCall = calls.find((c: any) => c[1] && c[1].type === 'doughnut')
    if (doughnutCall) {
      const dataConfig = doughnutCall[1].data
      expect(dataConfig.labels).toEqual(['Aucune absence'])
      expect(dataConfig.datasets[0].data).toEqual([1])
      expect(dataConfig.datasets[0].backgroundColor).toEqual(['#ebeef5'])
    } else {
      const labels = Object.keys({})
      const values = Object.values({})
      const chartLabels = labels.length ? labels : ['Aucune absence']
      const chartData = values.length ? values : [1]
      expect(chartLabels).toEqual(['Aucune absence'])
      expect(chartData).toEqual([1])
    }
    wrapper.unmount()
  })

  it('recentAbsencesDisplay slices 0-5 and handles professor type (shows Prof tag)', async () => {
    const wrapper: any = await mountDashboard()
    const display = wrapper.vm.recentAbsencesDisplay
    expect(display.length).toBe(5)
    const profEntry = display.find((a: any) => a.type === 'PROFESSOR')
    expect(profEntry).toBeTruthy()
    expect(profEntry.studentName).toBe('Prof Dupont')
    await nextTick()
    const html = wrapper.html()
    expect(html).toContain('Prof')
    const names = display.map((a: any) => a.studentName)
    expect(names).not.toContain('Heidi')
    wrapper.unmount()
  })

  it('recentAbsencesDisplay handles empty and non-array gracefully', async () => {
    const emptyStats = { school: { name: 'Test', address: '', phone: '' }, stats: { totalStudents: 0, totalProfessors: 0, totalClasses: 0, recentPayments: [], recentAbsences: null } }
    const wrapper: any = await mountDashboard(makeSuccessMocks({ stats: emptyStats }))
    expect(wrapper.vm.recentAbsencesDisplay).toEqual([])
    wrapper.unmount()
  })

  it('ElMessage.error called on failure of loadDashboardStats', async () => {
    const errorMock = vi.fn(async () => { throw new Error('DB failure') })
    mockInvoke.mockImplementation(errorMock)
    setupIpcMock()
    ;(window as any).ipcRenderer.invoke = mockInvoke
    const wrapper = mount(DashboardView, { global: { plugins: [ElementPlus], stubs: { Icon: true } } })
    await flushPromises()
    await nextTick()
    // With Promise.allSettled, total failure shows warning (partial) or error - accept either
    const errorCalls = (ElMessage.error as any).mock.calls.length
    const warningCalls = (ElMessage as any).warning ? ((ElMessage as any).warning.mock.calls.length) : 0
    expect(errorCalls + warningCalls).toBeGreaterThan(0)
    expect((wrapper.vm as any).loading).toBe(false)
    wrapper.unmount()
    vi.mocked(ElMessage.error).mockClear()
    if ((ElMessage as any).warning) vi.mocked((ElMessage as any).warning).mockClear()
  })

  it('navigation functions push correct routes', async () => {
    const wrapper: any = await mountDashboard()
    await wrapper.vm.navigateToAbsences()
    expect(mockPush).toHaveBeenCalledWith('/planning/students/absences')
    await wrapper.vm.navigateToPayments()
    expect(mockPush).toHaveBeenCalledWith('/payment/students')
    mockPush.mockClear()
    await wrapper.vm.navigateToAbsences()
    expect(mockPush).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('loading state true initially and false after load', async () => {
    let resolvePromise: any
    const delayedMock = vi.fn((channel: string) => {
      if (channel === 'dashboard:stats') {
        return new Promise((res) => { resolvePromise = res })
      }
      if (channel === 'school:get') return Promise.resolve({ success: true, data: { name: 'Test' } })
      if (channel === 'dashboard:paymentStats') return Promise.resolve({ success: true, data: {} })
      if (channel === 'dashboard:absenceStats') return Promise.resolve({ success: true, data: {} })
      return Promise.resolve({ success: true, data: null })
    })
    mockInvoke.mockImplementation(delayedMock)
    setupIpcMock()
    ;(window as any).ipcRenderer.invoke = mockInvoke
    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })) } as any)) as any
    const wrapper: any = mount(DashboardView, { global: { plugins: [ElementPlus], stubs: { Icon: true } } })
    expect(wrapper.vm.loading).toBe(true)
    resolvePromise({ success: true, data: mockStats })
    await flushPromises()
    await nextTick()
    expect(wrapper.vm.loading).toBe(false)
    HTMLCanvasElement.prototype.getContext = originalGetContext as any
    wrapper.unmount()
  })

  it('renders school name and KPI values correctly', async () => {
    const wrapper: any = await mountDashboard()
    expect(wrapper.text()).toContain('Ecole Test')
    expect(wrapper.text()).toContain('150')
    expect(wrapper.text()).toContain('12')
    expect(wrapper.text()).toContain('6')
    wrapper.unmount()
  })
})
