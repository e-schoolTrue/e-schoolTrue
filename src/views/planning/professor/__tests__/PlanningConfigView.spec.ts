import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import ElementPlus from 'element-plus'
import PlanningConfigView from '@/views/planning/professor/PlanningConfigView.vue'
import * as scheduleSlots from '@/composables/useScheduleSlots'

// Mock ipcRenderer -- must be defined before mount
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

const mockProfessors = [
  {
    id: 1,
    firstname: 'Jean',
    lastname: 'Dupont',
    civility: 'M.',
    color: '#409EFF',
    qualification: { id: 1, name: 'Certifié' },
    photo: null,
    teaching: [
      { id: 101, class: { id: 1, name: 'CP' }, schoolType: 'PRIMARY' },
      { id: 102, class: { id: 2, name: '6ème' }, course: { id: 10, name: 'Maths' }, schoolType: 'SECONDARY' },
    ],
  },
  {
    id: 2,
    firstname: 'Marie',
    lastname: 'Curie',
    civility: 'Mme',
    color: '#409EFF',
    qualification: null,
    photo: null,
    teaching: [
      { id: 201, class: { id: 1, name: 'CP' }, schoolType: 'PRIMARY' },
      { id: 202, class: { id: 2, name: '6ème' }, course: { id: 11, name: 'Physique' }, schoolType: 'SECONDARY' },
    ],
  },
  {
    id: 3,
    firstname: 'Paul',
    lastname: 'Martin',
    civility: 'M.',
    color: '#409EFF',
    qualification: null,
    photo: null,
    teaching: [
      { id: 301, class: { id: 1, name: 'CP' }, schoolType: 'PRIMARY' },
    ],
  },
]

const mockClasses = [
  { id: 1, name: 'CP', type: 'PRIMARY' as const },
  { id: 2, name: '6ème', type: 'SECONDARY' as const },
]

const defaultConfig = {
  startHour: 8,
  startMinutes: 0,
  endHour: 18,
  endMinutes: 0,
  slotDuration: 60,
  lunchStart: 12,
  lunchStartMinutes: 0,
  lunchEnd: 14,
  lunchEndMinutes: 0,
}

function createMockInvoke() {
  return vi.fn(async (channel: string, _payload?: any) => {
    switch (channel) {
      case 'professor:all':
        return { success: true, data: mockProfessors }
      case 'grade:all':
        return { success: true, data: mockClasses }
      case 'schedule:all':
        return { success: true, data: [] }
      case 'schedule-config:get':
        return { success: true, data: defaultConfig }
      default:
        return { success: true, data: null }
    }
  })
}

async function mountComponent(customMock?: any) {
  const invoke = customMock || createMockInvoke()
  mockInvoke.mockImplementation(invoke)
  setupIpcMock()
  // Ensure window.ipcRenderer.invoke points to mockInvoke
  ;(window as any).ipcRenderer.invoke = mockInvoke
  const wrapper = mount(PlanningConfigView, {
    global: {
      plugins: [ElementPlus],
      stubs: {
        'el-icon': true,
        Icon: true,
      },
    },
  })
  // wait for onMounted Promise.all
  await flushPromises()
  await nextTick()
  await nextTick()
  return wrapper
}

describe('PlanningConfigView', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupIpcMock()
    mockInvoke.mockReset()
    mockInvoke.mockImplementation(createMockInvoke())
  })
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('calls ipcRenderer.invoke for professor:all, grade:all, schedule:all, schedule-config:get on mount', async () => {
    const wrapper = await mountComponent()
    // verify calls
    expect(mockInvoke).toHaveBeenCalledWith('professor:all')
    expect(mockInvoke).toHaveBeenCalledWith('grade:all')
    expect(mockInvoke).toHaveBeenCalledWith('schedule:all')
    expect(mockInvoke).toHaveBeenCalledWith('schedule-config:get', expect.any(Object))
    wrapper.unmount()
  })

  it('availableTeachingItems filters by selectedClassId - PRIMARY generic vs SECONDARY per course', async () => {
    const wrapper: any = await mountComponent()
    // set professors and classes manually to control
    wrapper.vm.professors = JSON.parse(JSON.stringify(mockProfessors))
    wrapper.vm.classes = JSON.parse(JSON.stringify(mockClasses))

    // PRIMARY class (id 1) -> should create generic course per professor teaching PRIMARY
    wrapper.vm.filters.selectedClassId = 1
    await nextTick()
    let items = wrapper.vm.availableTeachingItems
    expect(items.length).toBe(3)
    // All PRIMARY items should have generic course name and id starting with primary-
    for (const item of items) {
      expect(item.course.name).toBe('Enseignement général')
      expect(String(item.course.id)).toMatch(/^primary-/)
    }

    // SECONDARY class (id 2) -> should use specific courses
    wrapper.vm.filters.selectedClassId = 2
    await nextTick()
    items = wrapper.vm.availableTeachingItems
    expect(items.length).toBe(2)
    const courseNames = items.map((i: any) => i.course.name)
    expect(courseNames).toContain('Maths')
    expect(courseNames).toContain('Physique')
    expect(courseNames).not.toContain('Enseignement général')

    // No class selected -> empty
    wrapper.vm.filters.selectedClassId = null
    await nextTick()
    expect(wrapper.vm.availableTeachingItems.length).toBe(0)

    wrapper.unmount()
  })

  it('generateCourseColors creates distinct palette when 3 professors share same default color', async () => {
    const wrapper: any = await mountComponent()
    // set 3 professors with same default color
    const profsSameColor = [
      { id: 1, firstname: 'A', lastname: 'A', civility: 'M.', color: '#409EFF', teaching: [{ id: 1, class: { id: 1, name: 'CP' }, schoolType: 'PRIMARY' }] },
      { id: 2, firstname: 'B', lastname: 'B', civility: 'M.', color: '#409EFF', teaching: [{ id: 2, class: { id: 1, name: 'CP' }, schoolType: 'PRIMARY' }] },
      { id: 3, firstname: 'C', lastname: 'C', civility: 'M.', color: '#409EFF', teaching: [{ id: 3, class: { id: 1, name: 'CP' }, schoolType: 'PRIMARY' }] },
    ]
    wrapper.vm.professors = profsSameColor
    // call generateCourseColors explicitly
    wrapper.vm.generateCourseColors()
    await nextTick()
    const colors = Object.values(wrapper.vm.professorColors) as string[]
    expect(colors.length).toBe(3)
    // distinct
    const uniq = new Set(colors)
    expect(uniq.size).toBe(3)
    // none should be undefined and should be valid hex palette
    for (const c of colors) {
      expect(c).toMatch(/^#/)
    }
    wrapper.unmount()
  })

  it('getCourseColor prioritizes professorColors over courseColors', async () => {
    const wrapper: any = await mountComponent()
    wrapper.vm.professors = JSON.parse(JSON.stringify(mockProfessors))
    wrapper.vm.courseColors = { 10: '#00FF00' }
    wrapper.vm.professorColors = { 1: '#FF0000' }
    await nextTick()
    // professor 1 has course 10, should return professor color
    expect(wrapper.vm.getCourseColor(10, 1)).toBe('#FF0000')
    // without professor, fallback to course color
    expect(wrapper.vm.getCourseColor(10, 99)).toBe('#00FF00')
    // with unknown course and unknown professor fallback to default
    expect(wrapper.vm.getCourseColor(999, 999)).toBe('#409EFF')
    // priority even when both present
    wrapper.vm.courseColors[11] = '#00FF00'
    wrapper.vm.professorColors[2] = '#123456'
    expect(wrapper.vm.getCourseColor(11, 2)).toBe('#123456')
    wrapper.unmount()
  })

  it('loadScheduleConfig calls generateSlots and sets timeSlots', async () => {
    const wrapper: any = await mountComponent()
    // spy on generateSlots via the composable export
    const spy = vi.spyOn(scheduleSlots, 'generateSlots')
    // ensure mock returns known config
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'schedule-config:get') {
        return { success: true, data: { startHour: 8, startMinutes: 0, endHour: 10, endMinutes: 0, slotDuration: 60, lunchStart: 12, lunchStartMinutes: 0, lunchEnd: 14, lunchEndMinutes: 0 } }
      }
      if (channel === 'professor:all') return { success: true, data: [] }
      if (channel === 'grade:all') return { success: true, data: [] }
      if (channel === 'schedule:all') return { success: true, data: [] }
      return { success: true, data: null }
    })
    await wrapper.vm.loadScheduleConfig(1)
    await nextTick()
    expect(spy).toHaveBeenCalled()
    // 8-10 with slot 60 => 2 slots
    expect(wrapper.vm.timeSlots.length).toBe(2)
    expect(wrapper.vm.timeSlots[0].key).toBe('08:00-09:00')
    spy.mockRestore()

    // test fallback when config fetch fails -> should use defaultSlots (8 slots skipping lunch)
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'schedule-config:get') return { success: false, data: null }
      return { success: true, data: [] }
    })
    await wrapper.vm.loadScheduleConfig(null)
    await nextTick()
    // defaultSlots from 8-18 skipping 12-14 with 60min => 8 slots
    expect(wrapper.vm.timeSlots.length).toBe(8)
    wrapper.unmount()
  })

  it('day toggle flips enabled state', async () => {
    const wrapper: any = await mountComponent()
    const initial = wrapper.vm.days[0].enabled
    expect(initial).toBe(true)
    wrapper.vm.toggleDay(0)
    await nextTick()
    expect(wrapper.vm.days[0].enabled).toBe(false)
    wrapper.vm.toggleDay(0)
    await nextTick()
    expect(wrapper.vm.days[0].enabled).toBe(true)

    // disabled day samedi (index 5) initially false
    expect(wrapper.vm.days[5].enabled).toBe(false)
    wrapper.vm.toggleDay(5)
    await nextTick()
    expect(wrapper.vm.days[5].enabled).toBe(true)
    wrapper.unmount()
  })

  it('teacher-item border color uses getCourseColor with professorId', async () => {
    const wrapper: any = await mountComponent()
    wrapper.vm.professors = JSON.parse(JSON.stringify(mockProfessors))
    wrapper.vm.classes = JSON.parse(JSON.stringify(mockClasses))
    wrapper.vm.filters.selectedClassId = 1
    // ensure distinct colors
    wrapper.vm.generateCourseColors()
    await nextTick()
    await wrapper.vm.$nextTick()

    const items = wrapper.vm.availableTeachingItems
    expect(items.length).toBeGreaterThan(0)
    // force render update
    await nextTick()
    const teacherItems = wrapper.findAll('.teacher-item')
    expect(teacherItems.length).toBe(items.length)
    for (let i = 0; i < items.length; i++) {
      const expectedColor = wrapper.vm.getCourseColor(items[i].course.id, items[i].professor.id)
      const style = teacherItems[i].attributes('style') || ''
      // Vue binds :style="{ borderLeftColor: getCourseColor(...) }"
      // check style contains expected color (jsdom may convert to rgb, so check either hex or rgb form)
      // We'll just call getCourseColor and verify borderLeftColor style property
      const el = teacherItems[i].element as HTMLElement
      const borderColor = el.style.borderLeftColor
      // borderLeftColor may be rgb converted; ensure not empty and matches expected via getCourseColor
      expect(borderColor).toBeTruthy()
      // also verify wrapper's computed color is hex and borderColor corresponds (hex -> rgb conversion check)
      if (expectedColor.startsWith('#')) {
        const hex = expectedColor.slice(1)
        const r = parseInt(hex.slice(0,2),16)
        const g = parseInt(hex.slice(2,4),16)
        const b = parseInt(hex.slice(4,6),16)
        // jsdom may keep hex or convert to rgb
        const containsHex = style.includes(expectedColor) || borderColor.includes(expectedColor) || borderColor.includes(`rgb(${r}, ${g}, ${b})`) || style.includes(`rgb(${r}, ${g}, ${b})`)
        expect(containsHex).toBe(true)
      }
    }
    wrapper.unmount()
  })

  it('schedule cell background uses professor color via getCourseColor', async () => {
    const wrapper: any = await mountComponent()
    wrapper.vm.professors = JSON.parse(JSON.stringify(mockProfessors))
    wrapper.vm.classes = JSON.parse(JSON.stringify(mockClasses))
    wrapper.vm.filters.selectedClassId = 1
    wrapper.vm.generateCourseColors()
    await nextTick()
    // add a schedule item for lundi first slot
    const firstSlot = wrapper.vm.timeSlots[0]?.key
    expect(firstSlot).toBeTruthy()
    const profId = 1
    const expectedColor = wrapper.vm.getCourseColor(`primary-${profId}`, profId)
    wrapper.vm.schedule = [
      { id: 's1', professorId: profId, courseId: `primary-${profId}`, classId: 1, day: 'lundi', timeSlot: firstSlot }
    ]
    await nextTick()
    await wrapper.vm.$nextTick()
    const scheduleItem = wrapper.find('.schedule-item')
    expect(scheduleItem.exists()).toBe(true)
    const styleAttr = scheduleItem.attributes('style') || ''
    const bg = (scheduleItem.element as HTMLElement).style.backgroundColor
    // should contain expected color
    if (expectedColor.startsWith('#')) {
      const hex = expectedColor.slice(1)
      const r = parseInt(hex.slice(0,2),16)
      const g = parseInt(hex.slice(2,4),16)
      const b = parseInt(hex.slice(4,6),16)
      const match = styleAttr.includes(expectedColor) || bg.includes(expectedColor) || bg.includes(`rgb(${r}, ${g}, ${b})`) || styleAttr.includes(`rgb(${r}, ${g}, ${b})`)
      expect(match).toBe(true)
    } else {
      expect(styleAttr || bg).toBeTruthy()
    }
    // also check secondary case
    wrapper.vm.filters.selectedClassId = 2
    wrapper.vm.schedule = [
      { id: 's2', professorId: 2, courseId: 11, classId: 2, day: 'mardi', timeSlot: firstSlot }
    ]
    await nextTick()
    const secColor = wrapper.vm.getCourseColor(11, 2)
    // even if slot not mardi time same, we trigger re-render and find schedule-item if day matches slot; use mardi slot cell
    // ensure secondary schedule item rendered
    await nextTick()
    const secItems = wrapper.findAll('.schedule-item')
    // at least one should have bg with secColor
    if (secItems.length > 0) {
      const anyMatch = secItems.some((w: any) => {
        const s = w.attributes('style') || ''
        const b = (w.element as HTMLElement).style.backgroundColor
        const hex = secColor.slice(1); const r=parseInt(hex.slice(0,2),16); const g=parseInt(hex.slice(2,4),16); const bl=parseInt(hex.slice(4,6),16);
        return s.includes(secColor) || b.includes(secColor) || s.includes(`rgb(${r}, ${g}, ${bl})`) || b.includes(`rgb(${r}, ${g}, ${bl})`)
      })
      expect(anyMatch).toBe(true)
    }
    wrapper.unmount()
  })

  it('handles ipc failure gracefully for professors', async () => {
    mockInvoke.mockImplementation(async (channel: string) => {
      if (channel === 'professor:all') return { success: false, message: 'DB error' }
      if (channel === 'grade:all') return { success: true, data: mockClasses }
      if (channel === 'schedule:all') return { success: true, data: [] }
      if (channel === 'schedule-config:get') return { success: true, data: defaultConfig }
      return { success: true, data: null }
    })
    setupIpcMock()
    ;(window as any).ipcRenderer.invoke = mockInvoke
    const wrapper = mount(PlanningConfigView, { global: { plugins: [ElementPlus] } })
    await flushPromises()
    await nextTick()
    // professors should remain empty on failure, not crash
    expect((wrapper.vm as any).professors).toEqual([])
    wrapper.unmount()
  })
})
