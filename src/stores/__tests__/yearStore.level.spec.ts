import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useYearStore } from '@/stores/yearStore'

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const yPrim = {
  id: 10, schoolYear: '2025-2026', level: 'PRIMAIRE', isCurrent: true, status: 'active' as const,
  periodConfigurations: [], created_at: '', updated_at: '',
}
const ySec = {
  id: 11, schoolYear: '2025-2026', level: 'SECONDAIRE', isCurrent: false, status: 'active' as const,
  periodConfigurations: [], created_at: '', updated_at: '',
}
const yLegacy = {
  id: 2, schoolYear: '2023-2024',
  periodConfigurations: [], isCurrent: false, status: 'closed' as const,
  created_at: '', updated_at: '',
}

/**
 * yearStore 3 niveaux — `getCurrent(level)` / `isReadOnlyFor(level)`.
 * - Courante du niveau prioritaire, repli legacy ouvert.
 * - Verrou par niveau indépendant du verrou global.
 */
describe('yearStore 3 niveaux', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    delete (window as any).ipcRenderer
  })

  afterEach(() => {
    delete (window as any).ipcRenderer
  })

  it('getCurrent(level) retourne la courante du niveau', () => {
    const store = useYearStore()
    store.list = [{ ...yPrim }, { ...ySec }] as any
    expect(store.getCurrent('PRIMAIRE')?.id).toBe(10)
    expect(store.getCurrent('SECONDAIRE')).toBeNull()
    expect(store.isReadOnlyFor('PRIMAIRE')).toBe(false)
    expect(store.isReadOnlyFor('SECONDAIRE')).toBe(true)
  })

  it('repli legacy : année globale ouverte visible de tous les niveaux', () => {
    const store = useYearStore()
    const openLegacy = { ...yLegacy, status: 'active' as const, isCurrent: true }
    store.list = [openLegacy] as any
    expect(store.getCurrent('PRIMAIRE')?.id).toBe(2)
    expect(store.getCurrent('SECONDAIRE')?.id).toBe(2)
    expect(store.hasLegacyYears).toBe(true)
  })

  it('yearsByLevel regroupe + isole LEGACY', () => {
    const store = useYearStore()
    store.list = [{ ...yPrim }, { ...ySec }, { ...yLegacy }] as any
    expect(store.yearsByLevel.PRIMAIRE).toHaveLength(1)
    expect(store.yearsByLevel.SECONDAIRE).toHaveLength(1)
    expect(store.yearsByLevel.PRESCOLAIRE).toHaveLength(0)
    expect(store.yearsByLevel.LEGACY).toHaveLength(1)
  })

  it('fetchCurrent(level) transmet le niveau au backend', async () => {
    const invoke = vi.fn(async (channel: string, level?: unknown) => {
      if (channel === 'yearRepartition:getCurrent') {
        expect(level).toBe('SECONDAIRE')
        return { success: true, data: { ...ySec, isCurrent: true } }
      }
      return { success: false, error: 'X', message: 'ko' }
    })
    ;(window as any).ipcRenderer = { invoke }
    const store = useYearStore()
    const cur = await store.fetchCurrent('SECONDAIRE')
    expect(cur?.level).toBe('SECONDAIRE')
    expect(invoke).toHaveBeenCalledWith('yearRepartition:getCurrent', 'SECONDAIRE')
  })
})
