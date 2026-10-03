import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/e-school-test-year-close-robust') },
}));

import { YearRepartitionService } from '../yearService';
import { AppDataSource } from '../../../data-source';

/**
 * Robustesse clôture année scolaire :
 * - clôture courante sans N+1 (1 findOne + 1 save) → isCurrent=false, status=closed, message lecture seule
 * - après clôture : getCurrent null + hasOpenYear false + écritures refusées YEAR_CLOSED
 * - update closed → YEAR_CLOSED (save jamais appelé)
 * - delete closed → YEAR_CLOSED (delete jamais appelé)
 * - reopen OK (active, closedAt null) + bascule setCurrent sur la rouverte
 * - double clôture → ALREADY_CLOSED
 */
describe('YearService — clôture robuste (lecture seule + reopen + bascule)', () => {
  let service: YearRepartitionService;
  let mockYearRepo: any;
  let mockDS: any;

  const mkYear = (over: any = {}) => ({
    id: 1,
    schoolYear: '2024-2025',
    periodConfigurations: [{ name: 'T1', start: new Date('2024-09-01'), end: new Date('2025-06-30') }],
    isCurrent: false,
    status: 'active',
    closedAt: null,
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mockYearRepo = {
      findOne: vi.fn(),
      findOneBy: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      save: vi.fn(async (e: any) => ({ ...e })),
      delete: vi.fn(async () => ({ affected: 1 })),
      createQueryBuilder: vi.fn(),
    };
    mockDS = { isInitialized: true, getRepository: vi.fn(() => mockYearRepo) };
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDS as any);
    service = new YearRepartitionService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clôture courante sans N+1 → lecture seule (1 findOne + 1 save)', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ isCurrent: true, status: 'active' }));
    const r = await service.closeYear(1);
    expect(r.success).toBe(true);
    expect(r.message).toMatch(/lecture seule/);
    expect(mockYearRepo.findOne).toHaveBeenCalledTimes(1);
    expect(mockYearRepo.save).toHaveBeenCalledTimes(1);
    const saved = mockYearRepo.save.mock.calls[0][0];
    expect(saved.isCurrent).toBe(false);
    expect(saved.status).toBe('closed');
    expect(saved.closedAt).toBeInstanceOf(Date);
  });

  it('après clôture courante → getCurrent null + hasOpenYear false + écriture refusée', async () => {
    const closed = mkYear({ isCurrent: false, status: 'closed' });
    mockYearRepo.find.mockResolvedValue([closed]);
    mockYearRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where?.isCurrent === true) return null;
      if (where?.schoolYear) return closed;
      return closed;
    });
    const cur = await service.getCurrentYearRepartition(new Date());
    expect(cur.success).toBe(true);
    expect(cur.data).toBeNull();

    const { hasOpenYear, requireYearWritable } = await import('../../lib/yearGuard');
    expect(await hasOpenYear()).toBe(false);
    await expect(requireYearWritable({ schoolYear: '2024-2025', actorRole: 'comptable' })).rejects.toThrow(/YEAR_CLOSED/);
    await expect(requireYearWritable({ schoolYear: '2024-2025', actorRole: 'admin' })).rejects.toThrow(/YEAR_CLOSED/);
  });

  it('update closed → YEAR_CLOSED (save jamais appelé)', async () => {
    mockYearRepo.findOneBy.mockResolvedValue(mkYear({ status: 'closed' }));
    const r = await service.updateYearRepartition(1, { schoolYear: '2024-2025' } as any);
    expect(r.success).toBe(false);
    expect(r.error).toBe('YEAR_CLOSED');
    expect(mockYearRepo.save).not.toHaveBeenCalled();
  });

  it('delete closed → YEAR_CLOSED (delete jamais appelé)', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'closed' }));
    const r = await service.deleteYearRepartition(1);
    expect(r.success).toBe(false);
    expect(r.error).toBe('YEAR_CLOSED');
    expect(mockYearRepo.delete).not.toHaveBeenCalled();
  });

  it('reopen + bascule : closed → active puis setCurrent OK', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'closed', closedAt: new Date(), isCurrent: false }));
    const ro = await service.reopenYear(1);
    expect(ro.success).toBe(true);
    const saved = mockYearRepo.save.mock.calls[0][0];
    expect(saved.status).toBe('active');
    expect(saved.closedAt).toBeNull();

    // Bascule : la rouverte redevient courante.
    mockYearRepo.findOne.mockResolvedValue(mkYear({ id: 1, status: 'active', isCurrent: false }));
    mockYearRepo.createQueryBuilder.mockReturnValue({
      update: () => ({ set: () => ({ execute: vi.fn().mockResolvedValue(undefined) }) }),
    });
    mockYearRepo.find.mockResolvedValue([{ ...mkYear(), id: 1, isCurrent: true }]);
    const sw = await service.setCurrentYearRepartition(1);
    expect(sw.success).toBe(true);
    expect(sw.data?.id).toBe(1);
  });

  it('double clôture → ALREADY_CLOSED (save jamais appelé)', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'closed' }));
    const r = await service.closeYear(1);
    expect(r.success).toBe(false);
    expect(r.error).toBe('ALREADY_CLOSED');
    expect(mockYearRepo.save).not.toHaveBeenCalled();
  });
});
