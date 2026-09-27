import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import ElementPlus from 'element-plus'
import { useYearStore } from '@/stores/yearStore'
import StudentFilter from '@/components/student/student-filter.vue'

const yearA = { id: 1, schoolYear: '2024-2025', periodConfigurations: [], isCurrent: true, status: 'active' as const }

/**
 * QA — `student-filter` : AUCUNE UI année (règle UN SEUL sélecteur au menu).
 *
 * Couvre :
 * - aucun champ / label « Année scolaire » rendu à l'écran
 * - consommation silencieuse : `filter` / `reset` émettent quand même
 *   `schoolYear` = année du menu (`yearStore.activeYear`)
 */
describe('student-filter (sans UI année)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    const store = useYearStore()
    store.list = [{ ...yearA }] as any
    store.activeYear = { ...yearA } as any
    ;(window as any).ipcRenderer = {
      invoke: vi.fn(async (channel: string) => {
        if (channel === 'grade:all') return { success: true, data: [] }
        if (channel === 'yearRepartition:getCurrent') return { success: true, data: { ...yearA } }
        return { success: true, data: null }
      }),
    }
  })

  afterEach(() => {
    delete (window as any).ipcRenderer
    vi.clearAllMocks()
  })

  it('1. aucune UI année rendue', async () => {
    const wrapper = mount(StudentFilter, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await nextTick()
    expect(wrapper.text()).not.toContain('Année scolaire')
    expect(wrapper.html()).not.toContain('Année scolaire')
    wrapper.unmount()
  })

  it('2. filter/reset transmettent silencieusement schoolYear du menu', async () => {
    const wrapper = mount(StudentFilter, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await nextTick()
    const buttons = wrapper.findAll('button')
    // « Filtrer » puis « Réinitialiser ».
    await buttons[0].trigger('click')
    expect(wrapper.emitted('filter')).toBeTruthy()
    expect((wrapper.emitted('filter')![0][0] as { schoolYear: string }).schoolYear).toBe('2024-2025')
    await buttons[1].trigger('click')
    expect(wrapper.emitted('reset')).toBeTruthy()
    expect((wrapper.emitted('reset')![0][0] as { schoolYear: string }).schoolYear).toBe('2024-2025')
    wrapper.unmount()
  })
})
