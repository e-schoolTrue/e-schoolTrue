import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import ElementPlus from 'element-plus'
import AuditLogView from '@/views/admin/AuditLogView.vue'

const mockInvoke = vi.fn()

function setupWindowMock() {
  Object.defineProperty(window, 'ipcRenderer', {
    value: {
      invoke: mockInvoke,
      send: vi.fn(),
      on: vi.fn(),
      off: vi.fn(),
      removeListener: vi.fn(),
      removeAllListeners: vi.fn(),
    },
    writable: true,
    configurable: true,
  })
  ;(global as any).window = window
  ;(globalThis as any).window = window
}

const loginEntry = {
  id: 1,
  actorUserId: 2,
  actorUsername: 'admin1',
  actorRole: 'admin',
  action: 'login',
  targetEntity: 'User',
  targetId: 5,
  summary: 'Connexion de admin1',
  createdAt: '2026-01-15 10:00:00',
}

const updateEntry = {
  id: 2,
  actorUsername: 'systeme',
  actorRole: null,
  action: 'update',
  targetEntity: 'Student',
  targetId: 12,
  summary: 'Modification des notes',
  createdAt: '2026-01-16 11:00:00',
}

const auditResponse = (items: unknown[], total: number) => ({ success: true, data: { items, total } })

beforeEach(() => {
  vi.clearAllMocks()
  setupWindowMock()
})

async function mountView() {
  const wrapper = mount(AuditLogView, {
    global: {
      plugins: [ElementPlus],
      stubs: { Icon: true },
    },
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

describe('AuditLogView', () => {
  it('1. loads the audit log and the user filter options on mount', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'audit:list') return auditResponse([loginEntry, updateEntry], 2)
      if (channel === 'users:list') {
        return { success: true, data: { items: [{ id: 2, username: 'admin1', displayName: 'Admin Principal' }], total: 1 } }
      }
      return { success: true, data: null }
    })

    const wrapper = await mountView()

    expect(mockInvoke).toHaveBeenCalledWith('audit:list', { page: 1, pageSize: 20, filters: {} })
    expect(mockInvoke).toHaveBeenCalledWith('users:list', { page: 1, pageSize: 1000, search: '' })
    // Table rows: French action/entity labels + formatted date + summary
    expect(wrapper.text()).toContain('admin1')
    expect(wrapper.text()).toContain('Connexion')
    expect(wrapper.text()).toContain('Modification')
    expect(wrapper.text()).toContain('Utilisateur')
    expect(wrapper.text()).toContain('Élève')
    expect(wrapper.text()).toContain('Connexion de admin1')
    expect(wrapper.text()).toContain('15/01/2026')
    wrapper.unmount()
  })

  it('2. filters by action "login" and reloads from page 1', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'audit:list') return auditResponse([loginEntry], 1)
      if (channel === 'users:list') return { success: true, data: { items: [], total: 0 } }
      return { success: true, data: null }
    })

    const wrapper = await mountView()

    const selects = wrapper.find('.filters-bar').findAllComponents({ name: 'ElSelect' })
    expect(selects.length).toBe(3) // utilisateur, action, entité
    await selects[1].vm.$emit('update:modelValue', 'login')
    await nextTick()

    const filterBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Filtrer')
    await filterBtn!.trigger('click')
    await flushPromises()

    expect(mockInvoke).toHaveBeenLastCalledWith('audit:list', {
      page: 1,
      pageSize: 20,
      filters: { action: 'login' },
    })
    wrapper.unmount()
  })

  it('3. date range filter pushes the end boundary to 23:59:59', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'audit:list') return auditResponse([loginEntry], 1)
      if (channel === 'users:list') return { success: true, data: { items: [], total: 0 } }
      return { success: true, data: null }
    })

    const wrapper = await mountView()

    const picker = wrapper.findComponent({ name: 'ElDatePicker' })
    expect(picker.exists()).toBe(true)
    await picker.vm.$emit('update:modelValue', ['2026-01-01 00:00:00', '2026-01-31 12:00:00'])
    await nextTick()

    const filterBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Filtrer')
    await filterBtn!.trigger('click')
    await flushPromises()

    expect(mockInvoke).toHaveBeenLastCalledWith('audit:list', {
      page: 1,
      pageSize: 20,
      filters: { from: '2026-01-01 00:00:00', to: '2026-01-31 23:59:59' },
    })
    wrapper.unmount()
  })

  it('4. filters by actor user id', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'audit:list') return auditResponse([loginEntry], 1)
      if (channel === 'users:list') return { success: true, data: { items: [], total: 0 } }
      return { success: true, data: null }
    })

    const wrapper = await mountView()

    const selects = wrapper.find('.filters-bar').findAllComponents({ name: 'ElSelect' })
    await selects[0].vm.$emit('update:modelValue', 2)
    await nextTick()

    const filterBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Filtrer')
    await filterBtn!.trigger('click')
    await flushPromises()

    expect(mockInvoke).toHaveBeenLastCalledWith('audit:list', {
      page: 1,
      pageSize: 20,
      filters: { actorUserId: 2 },
    })
    wrapper.unmount()
  })

  it('5. reset clears all filters and keeps page 1', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'audit:list') return auditResponse([loginEntry], 1)
      if (channel === 'users:list') return { success: true, data: { items: [], total: 0 } }
      return { success: true, data: null }
    })

    const wrapper = await mountView()

    const selects = wrapper.find('.filters-bar').findAllComponents({ name: 'ElSelect' })
    await selects[1].vm.$emit('update:modelValue', 'logout')
    await nextTick()

    const resetBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Réinitialiser')
    await resetBtn!.trigger('click')
    await flushPromises()

    expect(mockInvoke).toHaveBeenLastCalledWith('audit:list', { page: 1, pageSize: 20, filters: {} })
    wrapper.unmount()
  })

  it('6. pagination loads the requested page', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'audit:list') return auditResponse([loginEntry], 45)
      if (channel === 'users:list') return { success: true, data: { items: [], total: 0 } }
      return { success: true, data: null }
    })

    const wrapper = await mountView()

    const pageLinks = wrapper.findAll('.el-pager li.number')
    expect(pageLinks.length).toBeGreaterThanOrEqual(2)
    await pageLinks[1].trigger('click')
    await flushPromises()

    expect(mockInvoke).toHaveBeenLastCalledWith('audit:list', { page: 2, pageSize: 20, filters: {} })
    wrapper.unmount()
  })
})