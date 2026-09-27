import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useYearStore, YEAR_STORAGE_KEY } from '@/stores/yearStore'
import { YEAR_CLOSED_CODE } from '@/types/year'

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

import { ElMessage } from 'element-plus'

const yearA = { id: 1, schoolYear: '2024-2025', periodConfigurations: [], isCurrent: true, status: 'active' as const }
const yearClosed = { id: 2, schoolYear: '2023-2024', periodConfigurations: [], isCurrent: false, status: 'closed' as const }

function mockIpc(impl: (channel: string, ...args: unknown[]) => Promise<unknown>) {
  ;(window as any).ipcRenderer = { invoke: vi.fn(impl) }
}

/**
 * QA V3 frontend — yearStore + badge année readonly/bannière (état).
 *
 * Règle produit : année choisie au login, pas de switch en cours de session.
 * `setActiveYear` reste réservé au login + gouvernance admin.
 *
 * Couvre :
 * - isClosed / currentSchoolYear / nextSchoolYearLabel
 * - setActiveYear refuse YEAR_CLOSED (toast + throw, état inchangé)
 * - setActiveYear succès persiste localStorage
 * - init(defaultYear) + fetchList tolérant aux alias de canaux
 */
describe('yearStore V3', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    delete (window as any).ipcRenderer
  })

  afterEach(() => {
    delete (window as any).ipcRenderer
  })

  it('1. isClosed/currentSchoolYear reflètent l’année active', () => {
    const store = useYearStore()
    store.activeYear = { ...yearClosed } as any
    expect(store.isClosed).toBe(true)
    expect(store.currentSchoolYear).toBe('2023-2024')
    store.activeYear = { ...yearA } as any
    expect(store.isClosed).toBe(false)
  })

  it('2. nextSchoolYearLabel calcule N+1, null si incalculable', () => {
    const store = useYearStore()
    expect(store.nextSchoolYearLabel('2024-2025')).toBe('2025-2026')
    expect(store.nextSchoolYearLabel('oops')).toBeNull()
  })

  it('3. setActiveYear refuse YEAR_CLOSED : toast + throw + état inchangé', async () => {
    mockIpc(async (channel: string) => {
      if (channel === 'year:switch' || channel === 'yearRepartition:setCurrent') {
        return { success: false, error: YEAR_CLOSED_CODE, code: YEAR_CLOSED_CODE, message: 'YEAR_CLOSED refusée' }
      }
      return { success: false, error: 'UNKNOWN', message: 'ko' }
    })
    const store = useYearStore()
    store.activeYear = { ...yearA } as any
    await expect(store.setActiveYear(2)).rejects.toThrow(/YEAR_CLOSED/)
    expect(ElMessage.error).toHaveBeenCalled()
    // État inchangé (pas de bascule vers l’année clôturée)
    expect(store.activeYear?.id).toBe(1)
  })

  it('4. setActiveYear succès via year:switch persiste activeYear (localStorage)', async () => {
    mockIpc(async (channel: string) => {
      if (channel === 'year:switch') return { success: true, data: { ...yearA, id: 5 } }
      return { success: false, error: 'UNKNOWN', message: 'ko' }
    })
    const store = useYearStore()
    const res = await store.setActiveYear(5)
    expect(res.id).toBe(5)
    expect(store.activeYear?.id).toBe(5)
    expect(JSON.parse(localStorage.getItem(YEAR_STORAGE_KEY)!).id).toBe(5)
  })

  it('5. fetchList accepte yearRepartition:getAll même vide, ignore les échecs V3', async () => {
    const invoke = vi.fn(async (channel: string) => {
      if (channel === 'year:list') return { success: false, error: 'UNKNOWN', message: 'ko' }
      if (channel === 'year:getAll') return { success: false, error: 'UNKNOWN', message: 'ko' }
      return { success: true, data: [{ ...yearA }] }
    })
    ;(window as any).ipcRenderer = { invoke }
    const store = useYearStore()
    const list = await store.fetchList()
    expect(list).toHaveLength(1)
    expect(store.list).toHaveLength(1)
  })

  it('6. init(defaultYear) priorise le choix login puis réconcilie isCurrent serveur', async () => {
    ;(window as any).ipcRenderer = {
      invoke: vi.fn(async (channel: string) => {
        if (channel === 'year:list' || channel === 'year:getAll') return { success: false, error: 'X', message: 'ko' }
        if (channel === 'yearRepartition:getAll') return { success: true, data: [{ ...yearA }, { ...yearClosed }] }
        if (channel === 'year:getCurrent' || channel === 'yearRepartition:getCurrent') {
          return { success: true, data: { ...yearA } }
        }
        return { success: false, error: 'X', message: 'ko' }
      }),
    }
    const store = useYearStore()
    await store.init({ ...yearClosed } as any)
    // Choix explicite login conservé (déjà validé via setActiveYear par l’appelant)
    expect(store.activeYear?.id).toBe(2)
    expect(store.initialized).toBe(true)
  })

  it('7. bannière YearClosedBanner : visible = isClosed (état store)', async () => {
    const store = useYearStore()
    store.activeYear = { ...yearClosed } as any
    expect(store.isClosed).toBe(true)
    store.clear()
    expect(store.activeYear).toBeNull()
    expect(store.isClosed).toBe(false)
  })
})
