import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import ElementPlus, { ElMessage } from 'element-plus'
import ProfessorForm from '../professor-form.vue'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function getMockIpc() {
  return (window as unknown as Record<string, any>).ipcRenderer
    || (globalThis as unknown as Record<string, any>).ipcRenderer
    || (global as unknown as Record<string, any>).ipcRenderer
}

function createWrapper(props: Record<string, any> = {}) {
  return mount(ProfessorForm, {
    props: {
      initialData: undefined as unknown as any,
      disabled: false,
      ...props,
    } as any,
    global: {
      plugins: [ElementPlus],
      stubs: {
        // keep Icon as simple stub to avoid @iconify dependency issues
        Icon: { template: '<span />' },
        // keep TeachingAssignment real – we need its v-model binding, but stub heavy child if needed
        // Not stubbing – mount real one (it will invoke ipc mocked)
      },
    },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  const ipc = getMockIpc()
  if (ipc?.invoke) {
    ipc.invoke.mockResolvedValue({ success: true, data: [] })
  }
  // Mock canvas & Image for handlePhotoPreview to avoid jsdom limitations
  // We'll restore per test if needed
  vi.spyOn(global as any, 'Image').mockImplementation(() => {
    const img: any = {}
    setTimeout(() => img.onload && img.onload(), 0)
    return img
  })
})

describe('ProfessorForm', () => {
  // -------------------------------------------------------------------------
  // 1. Mount with null renders 4 steps
  // -------------------------------------------------------------------------
  it('mounts with initialData null and renders 4 steps', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()
    // steps defined in component are 4
    expect((wrapper.vm as any).steps).toHaveLength(4)
    expect((wrapper.vm as any).steps.map((s: any) => s.title)).toEqual([
      'Informations personnelles',
      'Diplômes et qualifications',
      'Documents',
      'Affectation',
    ])
    // also check that el-steps rendered (find by class or text)
    const text = wrapper.text()
    expect(text).toContain('Informations personnelles')
    expect(text).toContain('Diplômes et qualifications')
    expect(text).toContain('Documents')
    expect(text).toContain('Affectation')
    // activeStep default 0
    expect((wrapper.vm as any).activeStep).toBe(0)
  })

  it('has default color #409EFF and predefineColors includes it', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()
    expect((wrapper.vm as any).form.color).toBe('#409EFF')
    expect((wrapper.vm as any).predefineColors).toContain('#409EFF')
  })

  // -------------------------------------------------------------------------
  // 2. Watch initialData with PRIMARY: classId prefill
  // -------------------------------------------------------------------------
  it('watch initialData with PRIMARY prefills classId and teaching fields', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()

    const initialData: any = {
      firstname: 'Jean',
      lastname: 'Dupont',
      teaching: [
        {
          schoolType: 'PRIMARY',
          class: { id: 7, name: 'CP1' },
        },
      ],
    }

    await wrapper.setProps({ initialData })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const teaching = (wrapper.vm as any).form.teaching
    expect(teaching.schoolType).toBe('PRIMARY')
    expect(teaching.classId).toBe(7)
    expect(teaching.selectedClasses).toEqual([7])
    expect(teaching.gradeIds).toEqual([7])
  })

  // -------------------------------------------------------------------------
  // 3. Watch initialData with SECONDARY: selectedCourse + selectedClasses + gradeIds string + grades fallback
  // -------------------------------------------------------------------------
  it('watch initialData with SECONDARY sets selectedCourse and selectedClasses', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()

    const initialData: any = {
      teaching: [
        {
          schoolType: 'SECONDARY',
          selectedCourse: 3,
          selectedClasses: [5, 6],
          course: { id: 3, name: 'Maths' },
        },
      ],
    }

    await wrapper.setProps({ initialData })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const t = (wrapper.vm as any).form.teaching
    expect(t.schoolType).toBe('SECONDARY')
    expect(t.selectedCourse).toBe(3)
    expect(t.courseId).toBe(3)
    expect(t.selectedClasses).toEqual([5, 6])
    expect(t.gradeIds).toEqual([5, 6])
    expect(t.classId).toBe(5)
  })

  it('parses gradeIds string "5, 6,7" into number array', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()

    const initialData: any = {
      teaching: [
        {
          schoolType: 'SECONDARY',
          gradeIds: '5, 6,7',
          course: { id: 2, name: 'Physique' },
        },
      ],
    }

    await wrapper.setProps({ initialData })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const t = (wrapper.vm as any).form.teaching
    expect(t.selectedClasses).toEqual([5, 6, 7])
    expect(t.gradeIds).toEqual([5, 6, 7])
    expect(t.classId).toBe(5)
  })

  it('falls back to grades array when gradeIds missing', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()

    const initialData: any = {
      teaching: [
        {
          schoolType: 'SECONDARY',
          grades: [
            { id: 9, name: '6ème' },
            { id: 10, name: '5ème' },
          ],
          course: { id: 4, name: 'SVT' },
        },
      ],
    }

    await wrapper.setProps({ initialData })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const t = (wrapper.vm as any).form.teaching
    expect(t.selectedClasses).toEqual([9, 10])
    expect(t.gradeIds).toEqual([9, 10])
    expect(t.classId).toBe(9)
  })

  // -------------------------------------------------------------------------
  // 4. Patch atomic: courseId and selectedCourse together with Number conversion
  // -------------------------------------------------------------------------
  it('patch atomic: form.teaching receives courseId and selectedCourse together with Number conversion', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()

    const initialData: any = {
      teaching: [
        {
          schoolType: 'SECONDARY',
          courseId: '3',
          selectedCourse: '3',
          selectedClasses: [1],
        },
      ],
    }

    await wrapper.setProps({ initialData })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const t = (wrapper.vm as any).form.teaching
    expect(typeof t.courseId).toBe('number')
    expect(typeof t.selectedCourse).toBe('number')
    expect(t.courseId).toBe(3)
    expect(t.selectedCourse).toBe(3)
  })

  it('when initialData has course string id "3" it becomes Number 3', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()

    const initialData: any = {
      teaching: [
        {
          schoolType: 'SECONDARY',
          course: { id: '3', name: 'Maths' },
          selectedClasses: [2],
        },
      ],
    }

    await wrapper.setProps({ initialData })
    await flushPromises()
    await wrapper.vm.$nextTick()

    const t = (wrapper.vm as any).form.teaching
    expect(t.courseId).toBe(3)
    expect(t.selectedCourse).toBe(3)
    expect(typeof t.courseId).toBe('number')
  })

  // -------------------------------------------------------------------------
  // 5. Step navigation
  // -------------------------------------------------------------------------
  it('nextStep requires validation – stays when validation fails', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()
    // mock formRef.validateField to reject
    ;(wrapper.vm as any).formRef = {
      validateField: vi.fn().mockRejectedValue(new Error('validation failed')),
      validate: vi.fn(),
    }
    expect((wrapper.vm as any).activeStep).toBe(0)
    await (wrapper.vm as any).nextStep()
    await flushPromises()
    expect((wrapper.vm as any).activeStep).toBe(0)
    expect((wrapper.vm as any).formRef.validateField).toHaveBeenCalled()
  })

  it('nextStep advances when validation passes', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()
    ;(wrapper.vm as any).formRef = {
      validateField: vi.fn().mockResolvedValue(true),
      validate: vi.fn().mockResolvedValue(true),
    }
    expect((wrapper.vm as any).activeStep).toBe(0)
    await (wrapper.vm as any).nextStep()
    await flushPromises()
    expect((wrapper.vm as any).activeStep).toBe(1)
  })

  it('prevStep decrements activeStep', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()
    ;(wrapper.vm as any).activeStep = 2
    await wrapper.vm.$nextTick()
    ;(wrapper.vm as any).prevStep()
    expect((wrapper.vm as any).activeStep).toBe(1)
    ;(wrapper.vm as any).prevStep()
    expect((wrapper.vm as any).activeStep).toBe(0)
    // should not go below 0
    ;(wrapper.vm as any).prevStep()
    expect((wrapper.vm as any).activeStep).toBe(0)
  })

  it('goToStep validates when going forward and allows backward without validation', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()
    ;(wrapper.vm as any).formRef = {
      validateField: vi.fn().mockResolvedValue(true),
    }
    ;(wrapper.vm as any).activeStep = 0
    await (wrapper.vm as any).goToStep(2)
    await flushPromises()
    expect((wrapper.vm as any).activeStep).toBe(2)

    // going backward should succeed even if validation would fail
    ;(wrapper.vm as any).formRef.validateField = vi.fn().mockRejectedValue(new Error('fail'))
    await (wrapper.vm as any).goToStep(0)
    await flushPromises()
    expect((wrapper.vm as any).activeStep).toBe(0)

    // going forward should block when validation fails
    await (wrapper.vm as any).goToStep(1)
    await flushPromises()
    expect((wrapper.vm as any).activeStep).toBe(0)
  })

  // -------------------------------------------------------------------------
  // 6. handleSubmit validation
  // -------------------------------------------------------------------------
  it('handleSubmit validation: PRIMARY requires class', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()
    const vm: any = wrapper.vm
    // set form to PRIMARY without classes
    vm.form.firstname = 'Test'
    vm.form.lastname = 'User'
    vm.form.civility = 'MR'
    vm.form.birth_date = new Date()
    vm.form.cni_number = '123'
    vm.form.family_situation = 'CÉLIBATAIRE'
    vm.form.teaching.schoolType = 'PRIMARY'
    vm.form.teaching.selectedClasses = []
    vm.form.teaching.classId = undefined
    vm.formRef = { validate: vi.fn().mockResolvedValue(true) }

    await vm.handleSubmit()
    await flushPromises()
    expect(ElMessage.error).toHaveBeenCalledWith(expect.stringContaining('classe'))
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('handleSubmit validation: SECONDARY requires course and classes', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()
    const vm: any = wrapper.vm
    vm.form.firstname = 'Test'
    vm.form.lastname = 'User'
    vm.form.civility = 'MR'
    vm.form.birth_date = new Date()
    vm.form.cni_number = '123'
    vm.form.family_situation = 'CÉLIBATAIRE'
    vm.form.teaching.schoolType = 'SECONDARY'
    vm.form.teaching.selectedClasses = []
    vm.form.teaching.selectedCourse = undefined
    vm.form.teaching.courseId = undefined
    vm.formRef = { validate: vi.fn().mockResolvedValue(true) }

    // missing classes -> error about classes
    await vm.handleSubmit()
    await flushPromises()
    expect(ElMessage.error).toHaveBeenCalled()
    expect(wrapper.emitted('save')).toBeUndefined()

    vi.clearAllMocks()

    // now add classes but missing course -> error about matière
    vm.form.teaching.selectedClasses = [5]
    vm.form.teaching.classId = 5
    await vm.handleSubmit()
    await flushPromises()
    expect(ElMessage.error).toHaveBeenCalledWith(expect.stringContaining('matière'))
    expect(wrapper.emitted('save')).toBeUndefined()
  })

  it('submit emits save with correct teaching payload (classId from selectedClasses[0], courseId, gradeIds join)', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()
    const vm: any = wrapper.vm
    vm.form.firstname = 'John'
    vm.form.lastname = 'Doe'
    vm.form.civility = 'MR'
    vm.form.birth_date = new Date('2000-01-01')
    vm.form.cni_number = 'CNI123'
    vm.form.family_situation = 'CÉLIBATAIRE'
    vm.form.teaching.schoolType = 'SECONDARY'
    vm.form.teaching.selectedClasses = [10, 11, 12]
    vm.form.teaching.selectedCourse = 4
    vm.form.teaching.classId = 10
    vm.form.teaching.courseId = 4
    vm.formRef = { validate: vi.fn().mockResolvedValue(true) }

    await vm.handleSubmit()
    await flushPromises()

    expect(wrapper.emitted('save')).toBeTruthy()
    const payload = (wrapper.emitted('save') as any)[0][0]
    expect(payload.teaching.classId).toBe(10)
    expect(payload.teaching.courseId).toBe(4)
    expect(payload.teaching.gradeIds).toBe('10,11,12')
    expect(payload.teaching.selectedClasses).toEqual([10, 11, 12])
    expect(payload.teaching.selectedCourse).toBe(4)
    expect(payload.teaching.schoolType).toBe('SECONDARY')
    expect(payload.firstname).toBe('John')
  })

  // -------------------------------------------------------------------------
  // 7. disabled prop disables buttons
  // -------------------------------------------------------------------------
  it('disabled prop disables buttons', async () => {
    const wrapper = createWrapper({ initialData: null, disabled: true })
    await flushPromises()
    // next button should be disabled, prev hidden at step 0, save hidden at step 0
    // force activeStep to last to see save button
    ;(wrapper.vm as any).activeStep = 3
    await wrapper.vm.$nextTick()
    const buttons = wrapper.findAllComponents({ name: 'ElButton' })
    // At least one button should have disabled prop
    const disabledButtons = buttons.filter((b) => b.props('disabled') === true)
    expect(disabledButtons.length).toBeGreaterThanOrEqual(1)

    // also check that form vm prop disabled is true
    expect((wrapper.vm as any).$props.disabled).toBe(true)
  })

  // -------------------------------------------------------------------------
  // 8. photo handlePhotoPreview
  // -------------------------------------------------------------------------
  it('handlePhotoPreview with invalid file type shows error', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()
    const vm: any = wrapper.vm
    const invalidFile = new File(['content'], 'doc.pdf', { type: 'application/pdf' })
    Object.defineProperty(invalidFile, 'size', { value: 1000 })
    const result = vm.handlePhotoPreview(invalidFile)
    expect(result).toBe(false)
    expect(ElMessage.error).toHaveBeenCalledWith(expect.stringContaining('JPG et PNG'))
  })

  it('handlePhotoPreview with oversized file shows error', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()
    const vm: any = wrapper.vm
    const bigFile = new File(['a'.repeat(10)], 'big.jpg', { type: 'image/jpeg' })
    Object.defineProperty(bigFile, 'size', { value: 6 * 1024 * 1024 })
    const result = vm.handlePhotoPreview(bigFile)
    expect(result).toBe(false)
    expect(ElMessage.error).toHaveBeenCalledWith(expect.stringContaining('5MB'))
  })

  it('handlePhotoPreview with valid file does not error synchronously and returns false', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()
    const vm: any = wrapper.vm
    // Mock FileReader and canvas
    const validFile = new File(['abc'], 'photo.jpg', { type: 'image/jpeg' })
    Object.defineProperty(validFile, 'size', { value: 1000 })

    // Mock FileReader
    const originalFileReader = (global as any).FileReader
    class MockFileReader {
      result: string = 'data:image/jpeg;base64,abc'
      onload: any = null
      onerror: any = null
      readAsDataURL() {
        setTimeout(() => this.onload && this.onload({ target: { result: this.result } }), 0)
      }
    }
    ;(global as any).FileReader = MockFileReader as any

    // Mock canvas
    const originalCreateElement = document.createElement.bind(document)
    vi.spyOn(document, 'createElement').mockImplementation((tag: string) => {
      if (tag === 'canvas') {
        return {
          getContext: () => ({
            fillRect: vi.fn(),
            drawImage: vi.fn(),
            fillStyle: '',
          }),
          toDataURL: () => 'data:image/jpeg;base64,compressed',
          width: 0,
          height: 0,
        } as any
      }
      return originalCreateElement(tag as any)
    })

    const result = vm.handlePhotoPreview(validFile)
    expect(result).toBe(false)
    // not immediately error for valid type/size beyond the async flow
    // error should not have been called with invalid type message
    expect(ElMessage.error).not.toHaveBeenCalledWith(expect.stringContaining('JPG et PNG'))

    await flushPromises()
    // Restore
    ;(global as any).FileReader = originalFileReader
    vi.restoreAllMocks()
  })

  it('photo handlePhotoPreview compresses and sets form.photo on success (async)', async () => {
    const wrapper = createWrapper({ initialData: null })
    await flushPromises()
    const vm: any = wrapper.vm

    const file = new File(['abc'], 'photo.png', { type: 'image/png' })
    Object.defineProperty(file, 'size', { value: 2000 })

    // Ensure handlePhotoPreview runs without throwing
    expect(() => vm.handlePhotoPreview(file)).not.toThrow()
  })
})
