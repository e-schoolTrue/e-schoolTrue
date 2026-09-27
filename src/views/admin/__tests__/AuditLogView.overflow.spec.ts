import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import ElementPlus from 'element-plus'
import AuditLogView from '@/views/admin/AuditLogView.vue'

/**
 * Régression anti-dépassement Journal d'activité (AuditLogView).
 * Contrat @frontend-engineer : seul .audit-table-wrapper scrolle en X/Y,
 * la page ne crée jamais de scroll horizontal.
 */
const sfc = readFileSync(resolve(__dirname, '../AuditLogView.vue'), 'utf-8')
const style = sfc.split('<style')[1] ?? ''

const mockInvoke = vi.fn()

beforeEach(() => {
  vi.clearAllMocks()
  Object.defineProperty(window, 'ipcRenderer', {
    value: { invoke: mockInvoke, send: vi.fn(), on: vi.fn(), off: vi.fn() },
    writable: true,
    configurable: true,
  })
  mockInvoke.mockImplementation(async (channel: string) => {
    if (channel === 'audit:list') return { success: true, data: { items: [], total: 0 } }
    if (channel === 'users:list') return { success: true, data: { items: [], total: 0 } }
    return { success: true, data: null }
  })
})

async function mountView() {
  const wrapper = mount(AuditLogView, {
    global: { plugins: [ElementPlus], stubs: { Icon: true } },
  })
  await flushPromises()
  await nextTick()
  return wrapper
}

describe('AuditLogView overflow regression', () => {
  it('page clippée, scroll confiné au wrapper', () => {
    expect(style).toMatch(/overflow-x:\s*clip/)
    expect(style).toMatch(/\.audit-table-wrapper[\s\S]*?overflow-x:\s*auto/)
    expect(style).toMatch(/\.audit-table-wrapper[\s\S]*?overflow-y:\s*auto/)
    expect(style).toMatch(/max-height:\s*min\(60vh,\s*640px\)/)
    expect(style).toMatch(/overscroll-behavior-x:\s*contain/)
  })

  it('filtres fluides : wrap + flex-basis, aucune width fixe', () => {
    expect(style).toMatch(/\.filters-bar[\s\S]*?flex-wrap:\s*wrap/)
    expect(style).toContain('flex: 1 1 200px')
    expect(style).toContain('flex: 1 1 260px')
    const blocks = style.match(/\.(?:filter-field|filter-control|filters-bar)[^{]*\{[^}]*\}/g) ?? []
    for (const b of blocks) {
      expect(b).not.toMatch(/(?<!min-|max-)width:\s*\d+px/)
    }
  })

  it('sticky header + détail clamp 2 lignes + tooltip', () => {
    expect(style).toMatch(/\.el-table__header-wrapper[\s\S]*?position:\s*sticky/)
    expect(style).toMatch(/-webkit-line-clamp:\s*2/)
    expect(sfc).toContain('show-overflow-tooltip')
    expect(sfc).toContain('detail-clamp')
  })

  it('pagination wrappée + expand details-json borné à 320px', () => {
    expect(style).toMatch(/\.pagination-row[\s\S]*?flex-wrap:\s*wrap/)
    expect(style).toMatch(/\.details-json[\s\S]*?max-height:\s*320px/)
    expect(style).toMatch(/\.details-json[\s\S]*?overflow:\s*auto/)
    expect(style).toMatch(/\.details-json[\s\S]*?max-width:\s*100%/)
  })

  it('DOM monté : wrapper, filtres, pagination et contrôles clavier-focusables', async () => {
    const wrapper = await mountView()
    expect(wrapper.find('.admin-view').exists()).toBe(true)
    expect(wrapper.find('.audit-table-wrapper').exists()).toBe(true)
    expect(wrapper.find('.filters-bar').exists()).toBe(true)
    expect(wrapper.find('.pagination-row').exists()).toBe(true)
    // Contrôles natifs focusables (navigation clavier) : selects, date-picker, boutons
    expect(wrapper.find('.filters-bar').findAllComponents({ name: 'ElSelect' }).length).toBe(3)
    expect(wrapper.findComponent({ name: 'ElDatePicker' }).exists()).toBe(true)
    const buttons = wrapper.findAll('button')
    expect(buttons.some((b) => b.text().trim() === 'Filtrer')).toBe(true)
    expect(buttons.some((b) => b.text().trim() === 'Réinitialiser')).toBe(true)
    // Aucun style inline à largeur fixe sur les champs de filtre
    for (const el of wrapper.findAll('.filter-field, .filter-control')) {
      expect(el.attributes('style') ?? '').not.toMatch(/width:\s*\d+px/)
    }
    wrapper.unmount()
  })
})
