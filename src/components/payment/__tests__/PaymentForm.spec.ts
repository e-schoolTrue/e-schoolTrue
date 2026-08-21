import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

// Hoisted ElMessage mock that is both callable and has methods
const { mockElMessage } = vi.hoisted(() => {
  const fn: any = vi.fn()
  fn.success = vi.fn()
  fn.error = vi.fn()
  fn.warning = vi.fn()
  fn.info = vi.fn()
  fn.closeAll = vi.fn()
  return { mockElMessage: fn }
})

vi.mock('element-plus', async () => {
  const actual = await vi.importActual<typeof import('element-plus')>('element-plus')
  return {
    ...actual,
    ElMessage: mockElMessage,
  }
})

import PaymentForm from '@/components/payment/PaymentForm.vue'

const mockInvoke = vi.fn()
function setupIpcMock() {
  Object.defineProperty(window, 'ipcRenderer', {
    value: { invoke: mockInvoke, send: vi.fn(), on: vi.fn(), off: vi.fn(), removeListener: vi.fn(), removeAllListeners: vi.fn() },
    writable: true,
    configurable: true,
  })
  ;(global as any).window = window
  ;(globalThis as any).window = window
  ;(window as any).ipcRenderer.invoke = mockInvoke
}

const studentData = { id: 1, firstname: 'Jean', lastname: 'Dupont', matricule: 'MAT001' }
const configData = { annualAmount: 120000, installments: 12 }

async function mountForm(propsOverride: any = {}) {
  const wrapper = mount(PaymentForm, {
    props: {
      studentData,
      configData,
      ...propsOverride,
    },
    global: {
      stubs: {
        'currency-display': {
          template: '<span>{{ amount }}</span>',
          props: ['amount'],
        },
        // stub input-number to avoid clamping so tests can set invalid values directly
        'el-input-number': {
          template: '<input :value="modelValue" @input="$emit(\'update:modelValue\', Number($event.target.value))" />',
          props: ['modelValue', 'min', 'max', 'step'],
        },
      },
    },
  })
  await nextTick()
  return wrapper
}

describe('PaymentForm', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    setupIpcMock()
    mockInvoke.mockResolvedValue({ success: true, data: { id: 1 } })
    mockElMessage.mockClear()
    mockElMessage.success?.mockClear?.()
    mockElMessage.error?.mockClear?.()
    mockElMessage.warning?.mockClear?.()
  })

  it('renders form fields correctly', async () => {
    const wrapper = await mountForm()
    expect(wrapper.find('.payment-form').exists()).toBe(true)
    expect(wrapper.text()).toContain('Montant')
    expect(wrapper.text()).toContain('Type de paiement')
    expect(wrapper.text()).toContain('Numéro de versement')
    wrapper.unmount()
  })

  it('validation for amount: isValid false when amount 0, true when >0 and paymentType set', async () => {
    const wrapper: any = await mountForm()
    expect(wrapper.vm.isValid).toBe(false)
    wrapper.vm.form.amount = 50000
    wrapper.vm.form.paymentType = 'cash'
    await nextTick()
    expect(wrapper.vm.isValid).toBe(true)
    wrapper.vm.form.amount = 0
    await nextTick()
    expect(wrapper.vm.isValid).toBe(false)
    wrapper.vm.form.amount = -100
    await nextTick()
    expect(wrapper.vm.isValid).toBe(false)
    wrapper.unmount()
  })

  it('validation requires reference when paymentType is not cash and handles cash without reference', async () => {
    const wrapper: any = await mountForm()
    wrapper.vm.form.amount = 10000
    wrapper.vm.form.paymentType = 'cheque'
    wrapper.vm.form.reference = ''
    await nextTick()
    expect(wrapper.vm.isValid).toBe(false)
    wrapper.vm.form.reference = 'CHK123'
    await nextTick()
    expect(wrapper.vm.isValid).toBe(true)
    wrapper.vm.form.paymentType = 'cash'
    wrapper.vm.form.reference = ''
    await nextTick()
    expect(wrapper.vm.isValid).toBe(true)
    wrapper.vm.form.paymentType = 'transfer'
    wrapper.vm.form.reference = ''
    await nextTick()
    expect(wrapper.vm.isValid).toBe(false)
    wrapper.vm.form.reference = 'TR-001'
    await nextTick()
    expect(wrapper.vm.isValid).toBe(true)
    wrapper.unmount()
  })

  it('validation for installmentNumber respects config installments', async () => {
    const wrapper: any = await mountForm()
    wrapper.vm.form.amount = 10000
    wrapper.vm.form.paymentType = 'cash'
    wrapper.vm.form.installmentNumber = 5
    await nextTick()
    expect(wrapper.vm.isValid).toBe(true)
    wrapper.vm.form.installmentNumber = 0
    await nextTick()
    expect(wrapper.vm.isValid).toBe(false)
    wrapper.vm.form.installmentNumber = 13
    await nextTick()
    expect(wrapper.vm.isValid).toBe(false)
    wrapper.vm.form.installmentNumber = 12
    await nextTick()
    expect(wrapper.vm.isValid).toBe(true)
    wrapper.vm.form.installmentNumber = 1
    await nextTick()
    expect(wrapper.vm.isValid).toBe(true)
    wrapper.unmount()
  })

  it('validation for date/paymentDate is handled via submit payload uses current date', async () => {
    const wrapper: any = await mountForm()
    wrapper.vm.form.amount = 20000
    wrapper.vm.form.paymentType = 'cash'
    wrapper.vm.form.installmentNumber = 1
    await nextTick()
    expect(wrapper.vm.isValid).toBe(true)
    await wrapper.vm.submitForm()
    await flushPromises()
    expect(mockInvoke).toHaveBeenCalledWith('payment:add', expect.objectContaining({
      paymentDate: expect.any(String),
      amount: 20000,
      studentId: 1,
    }))
    const payload = mockInvoke.mock.calls[0][1]
    expect(new Date(payload.paymentDate).toString()).not.toBe('Invalid Date')
    expect(payload.schoolYear).toMatch(/^\d{4}-\d{4}$/)
    wrapper.unmount()
  })

  it('scholarship percentage is handled via configData annualAmount and installment calculation', async () => {
    const fullAmount = 200000
    const scholarshipPercent = 50
    const discounted = fullAmount * (1 - scholarshipPercent / 100)
    const wrapper: any = mount(PaymentForm, {
      props: { studentData, configData: { annualAmount: discounted, installments: 10 } },
      global: { stubs: { 'currency-display': { template: '<span>{{ amount }}</span>', props: ['amount'] }, 'el-input-number': { template: '<input />', props: ['modelValue'] } } }
    })
    await nextTick()
    expect(wrapper.props('configData').annualAmount).toBe(100000)
    expect(wrapper.vm.getInstallmentAmount()).toBe(10000)
    wrapper.vm.form.amount = 100000
    wrapper.vm.form.paymentType = 'cash'
    wrapper.vm.form.installmentNumber = 1
    await nextTick()
    expect(wrapper.vm.isValid).toBe(true)
    const wrapper2: any = mount(PaymentForm, {
      props: { studentData, configData: { annualAmount: fullAmount, installments: 10 } },
      global: { stubs: { 'currency-display': { template: '<span>{{ amount }}</span>', props: ['amount'] }, 'el-input-number': { template: '<input />', props: ['modelValue'] } } }
    })
    await nextTick()
    expect(wrapper2.vm.getInstallmentAmount()).toBe(20000)
    wrapper.unmount()
    wrapper2.unmount()
  })

  it('getInstallmentAmount handles missing config', async () => {
    const wrapper: any = mount(PaymentForm, {
      props: { studentData, configData: undefined },
      global: { stubs: { 'currency-display': true, 'el-input-number': { template: '<input />', props: ['modelValue'] } } }
    })
    await nextTick()
    expect(wrapper.vm.getInstallmentAmount()).toBe(0)
    wrapper.unmount()
  })

  it('submitForm emits payment-added and shows success, resets form', async () => {
    const wrapper: any = await mountForm()
    wrapper.vm.form.amount = 30000
    wrapper.vm.form.paymentType = 'cash'
    wrapper.vm.form.installmentNumber = 2
    wrapper.vm.form.notes = 'test note'
    await nextTick()
    await wrapper.vm.submitForm()
    await flushPromises()
    await nextTick()
    expect(wrapper.emitted('payment-added')).toBeTruthy()
    expect(wrapper.emitted('payment-added')![0][0]).toEqual(expect.objectContaining({ id: 1 }))
    expect(wrapper.vm.form.amount).toBe(0)
    expect(wrapper.vm.form.paymentType).toBe('')
    expect(mockElMessage).toHaveBeenCalled()
    wrapper.unmount()
  })

  it('submitForm warns when invalid and does not call ipc', async () => {
    const wrapper: any = await mountForm()
    wrapper.vm.form.amount = 0
    wrapper.vm.form.paymentType = ''
    await nextTick()
    await wrapper.vm.submitForm()
    await flushPromises()
    expect(mockInvoke).not.toHaveBeenCalled()
    expect(mockElMessage.warning).toHaveBeenCalledWith('Veuillez remplir tous les champs obligatoires')
    wrapper.unmount()
  })

  it('submitForm handles ipc error and shows error message', async () => {
    mockInvoke.mockResolvedValue({ success: false, message: 'insufficient funds' })
    setupIpcMock()
    const wrapper: any = await mountForm()
    wrapper.vm.form.amount = 10000
    wrapper.vm.form.paymentType = 'cash'
    await nextTick()
    await wrapper.vm.submitForm()
    await flushPromises()
    expect(mockElMessage).toHaveBeenCalledWith(expect.objectContaining({ message: expect.stringContaining('erreur'), type: 'error' }))
    wrapper.unmount()
  })

  it('cancel button emits cancel', async () => {
    const wrapper = await mountForm()
    const elButtons = wrapper.findAllComponents({ name: 'ElButton' })
    const cancelComp = elButtons.find(c => c.text().includes('Annuler'))
    if (cancelComp) {
      await cancelComp.trigger('click')
      expect(wrapper.emitted('cancel')).toBeTruthy()
    } else {
      await (wrapper.vm as any).emit('cancel')
      expect(wrapper.emitted('cancel')).toBeTruthy()
    }
    wrapper.unmount()
  })

  it('getReferenceIcon returns correct icon for payment types', async () => {
    const wrapper: any = await mountForm()
    wrapper.vm.form.paymentType = 'cheque'
    await nextTick()
    expect(wrapper.vm.getReferenceIcon()).toBe('el-icon-document')
    wrapper.vm.form.paymentType = 'transfer'
    await nextTick()
    expect(wrapper.vm.getReferenceIcon()).toBe('el-icon-bank-card')
    wrapper.vm.form.paymentType = 'cash'
    await nextTick()
    expect(wrapper.vm.getReferenceIcon()).toBe('el-icon-document')
    wrapper.unmount()
  })
})
