import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import ElementPlus, { ElMessage, ElMessageBox } from 'element-plus'
import UserManagementView from '@/views/admin/UserManagementView.vue'

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

const adminUser = {
  id: 1,
  username: 'admin1',
  displayName: 'Admin Principal',
  role: 'admin',
  isActive: true,
  createdAt: '2026-01-10 09:00:00',
}

const professorUser = {
  id: 2,
  username: 'prof1',
  displayName: 'M. Dupont',
  role: 'professor',
  isActive: false,
  createdAt: '2026-02-01 10:30:00',
}

const listResponse = (items: unknown[], total: number) => ({ success: true, data: { items, total } })

beforeEach(() => {
  vi.clearAllMocks()
  setupWindowMock()
})

async function mountView() {
  const wrapper = mount(UserManagementView, {
    global: {
      plugins: [ElementPlus],
      stubs: { Icon: true },
    },
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

describe('UserManagementView', () => {
  it('1. loads the user list on mount and renders rows with French role/status labels', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'users:list') return listResponse([adminUser, professorUser], 2)
      return { success: true, data: null }
    })

    const wrapper = await mountView()

    expect(mockInvoke).toHaveBeenCalledWith('users:list', { page: 1, pageSize: 10, search: '' })
    expect(wrapper.text()).toContain('admin1')
    expect(wrapper.text()).toContain('Admin Principal')
    expect(wrapper.text()).toContain('Administrateur')
    expect(wrapper.text()).toContain('Professeur')
    expect(wrapper.text()).toContain('Actif')
    expect(wrapper.text()).toContain('Inactif')
    wrapper.unmount()
  })

  it('2. search resets to page 1 and reloads with the typed query', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'users:list') return listResponse([adminUser], 1)
      return { success: true, data: null }
    })

    const wrapper = await mountView()

    const searchInput = wrapper
      .findAll('input')
      .find((i) => i.attributes('placeholder') === "Rechercher par nom d'utilisateur ou nom affiché")
    expect(searchInput).toBeTruthy()
    await searchInput!.setValue('admi')

    const searchBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Rechercher')
    await searchBtn!.trigger('click')
    await flushPromises()

    expect(mockInvoke).toHaveBeenLastCalledWith('users:list', { page: 1, pageSize: 10, search: 'admi' })
    wrapper.unmount()
  })

  it('3. creates a user with role and security question then shows the French success message', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'users:list') return listResponse([professorUser], 1)
      if (channel === 'users:create') return { success: true, data: { id: 99 } }
      return { success: true, data: null }
    })

    const wrapper = await mountView()

    const createBtn = wrapper.findAll('button').find((b) => b.text().includes('Créer un utilisateur'))
    await createBtn!.trigger('click')
    await nextTick()

    const createForm = (wrapper.vm as any).createForm
    createForm.username = 'nouveladmin'
    createForm.password = 'secret123'
    createForm.displayName = 'Nouvel Admin'
    createForm.role = 'admin'
    createForm.securityQuestion = 'Ville natale ?'
    createForm.securityAnswer = 'Dakar'
    await nextTick()

    const submitBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Créer')
    await submitBtn!.trigger('click')
    await flushPromises()

    expect(mockInvoke).toHaveBeenCalledWith('users:create', {
      username: 'nouveladmin',
      password: 'secret123',
      displayName: 'Nouvel Admin',
      role: 'admin',
      securityQuestion: 'Ville natale ?',
      securityAnswer: 'Dakar',
    })
    expect(ElMessage.success).toHaveBeenCalledWith('Utilisateur créé avec succès')
    // Reload after creation
    expect(mockInvoke).toHaveBeenLastCalledWith('users:list', { page: 1, pageSize: 10, search: '' })
    wrapper.unmount()
  })

  it('4. creates a user without a security question (server picks the default)', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'users:list') return listResponse([professorUser], 1)
      if (channel === 'users:create') return { success: true, data: { id: 100 } }
      return { success: true, data: null }
    })

    const wrapper = await mountView()

    const createBtn = wrapper.findAll('button').find((b) => b.text().includes('Créer un utilisateur'))
    await createBtn!.trigger('click')
    await nextTick()

    const createForm = (wrapper.vm as any).createForm
    createForm.username = 'eleve1'
    createForm.password = 'secret123'
    createForm.role = 'student'
    await nextTick()

    const submitBtn = wrapper.findAll('button').find((b) => b.text().trim() === 'Créer')
    await submitBtn!.trigger('click')
    await flushPromises()

    expect(mockInvoke).toHaveBeenCalledWith('users:create', {
      username: 'eleve1',
      password: 'secret123',
      displayName: null,
      role: 'student',
    })
    expect(ElMessage.success).toHaveBeenCalledWith('Utilisateur créé avec succès')
    wrapper.unmount()
  })

  it('5. deactivates a user through the popconfirm and shows "Compte désactivé"', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'users:list') return listResponse([adminUser], 1)
      if (channel === 'users:setActive') return { success: true, data: null }
      return { success: true, data: null }
    })

    const wrapper = await mountView()

    const popconfirms = wrapper.findAllComponents({ name: 'ElPopconfirm' })
    expect(popconfirms.length).toBe(1)
    await popconfirms[0].vm.$emit('confirm')
    await flushPromises()

    expect(mockInvoke).toHaveBeenCalledWith('users:setActive', { id: 1, isActive: false })
    expect(ElMessage.success).toHaveBeenCalledWith('Compte désactivé')
    wrapper.unmount()
  })

  it('6. shows the French refusal dialog when toggling the last active admin (LAST_ADMIN)', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'users:list') return listResponse([adminUser], 1)
      if (channel === 'users:setActive') {
        return { success: false, message: 'LAST_ADMIN: impossible de désactiver le dernier administrateur actif' }
      }
      return { success: true, data: null }
    })

    const alertSpy = vi.spyOn(ElMessageBox, 'alert').mockResolvedValue('confirm' as never)

    const wrapper = await mountView()

    const popconfirms = wrapper.findAllComponents({ name: 'ElPopconfirm' })
    await popconfirms[0].vm.$emit('confirm')
    await flushPromises()

    expect(alertSpy).toHaveBeenCalledWith(
      'Impossible de désactiver ce compte : au moins un administrateur actif doit subsister.',
      'Opération refusée',
      expect.objectContaining({ confirmButtonText: 'OK', type: 'warning' })
    )
    expect(ElMessage.error).not.toHaveBeenCalled()
    expect(ElMessage.success).not.toHaveBeenCalled()
    alertSpy.mockRestore()
    wrapper.unmount()
  })

  it('7. pagination reloads with the requested page number', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'users:list') return listResponse([professorUser], 45)
      return { success: true, data: null }
    })

    const wrapper = await mountView()

    const pageLinks = wrapper.findAll('.el-pager li.number')
    expect(pageLinks.length).toBeGreaterThanOrEqual(2)
    await pageLinks[1].trigger('click')
    await flushPromises()

    expect(mockInvoke).toHaveBeenLastCalledWith('users:list', { page: 2, pageSize: 10, search: '' })
    wrapper.unmount()
  })
})