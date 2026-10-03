import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import fs from 'node:fs'
import path from 'node:path'
import { useYearStore } from '@/stores/yearStore'

vi.mock('element-plus', () => ({
  ElMessage: { error: vi.fn(), success: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

const yearOld = { id: 1, schoolYear: '2024-2025', periodConfigurations: [], isCurrent: false, status: 'active' as const }
const yearNew = { id: 2, schoolYear: '2025-2026', periodConfigurations: [], isCurrent: false, status: 'active' as const }
const yearCurrent = { id: 3, schoolYear: '2026-2027', periodConfigurations: [], isCurrent: true, status: 'active' as const }

/**
 * Fix login : (a) liste des années en lecture publique pré-login (fetchList OK
 * sans session, plus de UNAUTHENTICATED silencieux → liste vide) ; (b) texte
 * auto-création supprimé du LoginView (MANUAL_ONLY) ; (c) import sans courante →
 * liste sélectionnable au login (défaut = dernière année) au lieu de lecture
 * seule bloquante.
 */
describe('year login manuel — pré-login + import sans courante', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
    vi.clearAllMocks()
    delete (window as any).ipcRenderer
  })

  afterEach(() => {
    delete (window as any).ipcRenderer
  })

  it('1. fetchList pré-login OK sans auth (canal public, pas de UNAUTHENTICATED)', async () => {
    // Simule le backend patché : lecture publique, actor null accepté.
    ;(window as any).ipcRenderer = {
      invoke: vi.fn(async (channel: string) => {
        if (channel === 'yearRepartition:getAll') return { success: true, data: [{ ...yearOld }, { ...yearNew }] }
        return { success: false, error: 'UNKNOWN', message: 'ko' }
      }),
    }
    const store = useYearStore()
    const list = await store.fetchList()
    expect(list).toHaveLength(2)
    expect(store.list.map((y) => y.schoolYear)).toEqual(['2024-2025', '2025-2026'])
  })

  it('2. texte auto-création supprimé du LoginView (MANUAL_ONLY)', () => {
    const src = fs.readFileSync(path.join(process.cwd(), 'src', 'views', 'auth', 'LoginView.vue'), 'utf8')
    expect(src).not.toMatch(/sera créée automatiquement/)
    expect(src).not.toMatch(/nextYearLabel/)
    expect(src).toMatch(/Aucune année ouverte — créez-la manuellement/)
  })

  it('3. import sans courante → liste sélectionnable au login (défaut = dernière)', async () => {
    // Backup importé : 2 années, aucune isCurrent, getCurrent null (avant boot [3a/4]).
    ;(window as any).ipcRenderer = {
      invoke: vi.fn(async (channel: string) => {
        if (channel === 'yearRepartition:getAll' || channel === 'year:list' || channel === 'year:getAll') {
          return { success: true, data: [{ ...yearOld }, { ...yearNew }] }
        }
        if (channel === 'year:getCurrent' || channel === 'yearRepartition:getCurrent') {
          return { success: true, data: null }
        }
        return { success: false, error: 'UNKNOWN', message: 'ko' }
      }),
    }
    const store = useYearStore()
    const years = await store.fetchList()
    expect(years).toHaveLength(2)
    // Même logique que LoginView.loadYears : isCurrent ?? dernière.
    const current = years.find((y) => y.isCurrent) ?? years[years.length - 1]
    expect(current?.schoolYear).toBe('2025-2026')
    // Le login peut donc proposer/choisir une année au lieu de rester bloqué :
    // après boot [3a/4], getCurrent réactivera la plus récente.
    ;(window as any).ipcRenderer = {
      invoke: vi.fn(async (channel: string) => {
        if (channel === 'yearRepartition:getAll') return { success: true, data: [{ ...yearOld }, { ...yearNew }, { ...yearCurrent }] }
        if (channel === 'year:getCurrent' || channel === 'yearRepartition:getCurrent') {
          return { success: true, data: { ...yearCurrent } }
        }
        return { success: false, error: 'UNKNOWN', message: 'ko' }
      }),
    }
    await store.init(null)
    expect(store.activeYear?.schoolYear).toBe('2026-2027')
    expect(store.isReadOnly).toBe(false)
  })
});
