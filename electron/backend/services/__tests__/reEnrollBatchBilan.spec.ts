import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/e-school-test-uploads') },
}))

import { StudentService } from '../studentService'

/**
 * QA finale B1-B6 — batchReEnroll bilan {ok, failed}.
 * Couvre B4 : continue sur échec + bilan (jamais de return au 1er échec).
 * Ne touche pas aux sources : mocke reEnrollStudent au niveau prototype.
 */
describe('V3 — batchReEnroll bilan {ok, failed} (B4)', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  function makeService(): StudentService {
    // Bypass constructor (pas de DataSource) : seule batchReEnroll est exercée,
    // elle délègue à this.reEnrollStudent mocké.
    return Object.create(StudentService.prototype) as StudentService
  }

  it('tout succès → success=true, ok=N, failed=0, message "réinscription(s) effectuée(s)"', async () => {
    const svc = makeService()
    vi.spyOn(svc, 'reEnrollStudent')
      .mockResolvedValueOnce({ success: true, data: { id: 1 }, message: 'Élève réinscrit en 2025-2026', error: null } as any)
      .mockResolvedValueOnce({ success: true, data: { id: 2 }, message: 'Élève réinscrit en 2025-2026', error: null } as any)
    const r = await svc.batchReEnroll([1, 2], { schoolYear: '2025-2026' })
    expect(r.success).toBe(true)
    expect((r.data as any).ok).toBe(2)
    expect((r.data as any).failed).toBe(0)
    expect((r.data as any).results).toHaveLength(2)
    expect(r.error).toBeNull()
    expect(r.message).toMatch(/réinscription\(s\) effectuée\(s\)/)
  })

  it('partiel 1 ok / 1 ko → success=false, BATCH_PARTIAL, continue après échec', async () => {
    const svc = makeService()
    const spy = vi.spyOn(svc, 'reEnrollStudent')
      .mockResolvedValueOnce({ success: true, data: { id: 1 }, message: 'Élève réinscrit en 2025-2026', error: null } as any)
      .mockResolvedValueOnce({ success: false, data: null, message: 'Année scolaire clôturée', error: 'YEAR_CLOSED' } as any)
    const r = await svc.batchReEnroll([1, 9], { schoolYear: '2024-2025' })
    expect(spy).toHaveBeenCalledTimes(2)
    expect(r.success).toBe(false)
    expect(r.error).toBe('BATCH_PARTIAL')
    expect((r.data as any).ok).toBe(1)
    expect((r.data as any).failed).toBe(1)
    expect(r.message).toMatch(/1 réussite\(s\), 1 échec\(s\) sur 2/)
  })

  it('exception throwée → comptée failed, bilan continue', async () => {
    const svc = makeService()
    vi.spyOn(svc, 'reEnrollStudent')
      .mockRejectedValueOnce(new Error('boom tx'))
      .mockResolvedValueOnce({ success: true, data: { id: 3 }, message: 'Élève réinscrit en 2025-2026', error: null } as any)
    const r = await svc.batchReEnroll([5, 3], { schoolYear: '2025-2026' })
    expect(r.success).toBe(false)
    expect((r.data as any).ok).toBe(1)
    expect((r.data as any).failed).toBe(1)
    expect((r.data as any).results[0].error).toMatch(/boom/)
  })
})
