import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/e-school-test-year-creation-robust') },
}));

import { YearRepartitionService } from '../yearService';
import { AppDataSource } from '../../../data-source';

/**
 * Robustesse création année scolaire (manuelle uniquement) :
 * - manuelle OK (canon YYYY-YYYY, status active, save x1)
 * - duplicate → DUPLICATE_SCHOOL_YEAR (save jamais appelé)
 * - canon invalide → INVALID_SCHOOL_YEAR (save jamais appelé)
 * - setCurrent OK (bascule isCurrent, une seule courante)
 * - setCurrent closed → YEAR_CLOSED (save jamais appelé)
 * - ensure no-op (MANUAL_ONLY, save jamais appelé, même avec seuil 9 mois)
 */
describe('YearService — création manuelle robuste', () => {
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
      save: vi.fn(async (e: any) => ({ ...e, id: e.id ?? 1 })),
      delete: vi.fn(),
      createQueryBuilder: vi.fn(),
    };
    mockDS = { isInitialized: true, getRepository: vi.fn(() => mockYearRepo) };
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDS as any);
    service = new YearRepartitionService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('manuelle OK : 2025-2026 créée active (save x1)', async () => {
    mockYearRepo.findOne.mockResolvedValue(null);
    mockYearRepo.save.mockImplementation(async (e: any) => ({ ...e, id: 7 }));
    const r = await service.createYearRepartition({
      schoolYear: '2025-2026',
      periodConfigurations: [{ name: 'T1', start: new Date('2025-09-01'), end: new Date('2026-06-30') }],
    } as any);
    expect(r.success).toBe(true);
    expect(r.data?.schoolYear).toBe('2025-2026');
    expect(r.data?.status).toBe('active');
    expect(mockYearRepo.save).toHaveBeenCalledTimes(1);
  });

  it('duplicate → DUPLICATE_SCHOOL_YEAR (save jamais appelé)', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ schoolYear: '2025-2026' }));
    const r = await service.createYearRepartition({ schoolYear: '2025-2026', periodConfigurations: [] } as any);
    expect(r.success).toBe(false);
    expect(r.error).toBe('DUPLICATE_SCHOOL_YEAR');
    expect(mockYearRepo.save).not.toHaveBeenCalled();
  });

  it('canon invalide → INVALID_SCHOOL_YEAR (save jamais appelé)', async () => {
    // '2025' (civile) et '2025/2026' (slash) sont normalisables par design (schoolYear.ts)
    // → seuls les vrais non-canoniques sont rejetés.
    for (const bad of ['2026-2025', '', 'abcd-efgh', '25-26', '2025--2026', '2025-2027']) {
      mockYearRepo.findOne.mockResolvedValue(null);
      const r = await service.createYearRepartition({ schoolYear: bad, periodConfigurations: [] } as any);
      expect(r.success, `rejeté: ${bad}`).toBe(false);
      expect(r.error).toBe('INVALID_SCHOOL_YEAR');
    }
    expect(mockYearRepo.save).not.toHaveBeenCalled();
  });

  it('setCurrent OK : bascule isCurrent via update bulk + save', async () => {
    const target = mkYear({ id: 7, schoolYear: '2025-2026', isCurrent: false });
    mockYearRepo.findOne.mockResolvedValue(target);
    mockYearRepo.createQueryBuilder.mockReturnValue({
      update: () => ({ set: () => ({ execute: vi.fn().mockResolvedValue(undefined) }) }),
    });
    mockYearRepo.find.mockResolvedValue([mkYear({ id: 1, isCurrent: false }), { ...target, isCurrent: true }]);
    const r = await service.setCurrentYearRepartition(7);
    expect(r.success).toBe(true);
    expect(r.data?.id).toBe(7);
  });

  it('setCurrent closed → YEAR_CLOSED (save jamais appelé)', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'closed' }));
    const r = await service.setCurrentYearRepartition(1);
    expect(r.success).toBe(false);
    expect(r.error).toBe('YEAR_CLOSED');
    expect(mockYearRepo.save).not.toHaveBeenCalled();
  });

  it('ensure no-op : MANUAL_ONLY, save jamais appelé (boot + login, même seuil 9 mois)', async () => {
    mockYearRepo.find.mockResolvedValue([]);
    const boot = await service.ensureSchoolYear(new Date('2024-09-01'));
    expect(boot.success).toBe(true);
    expect(boot.data).toBeNull();
    expect(boot.message).toMatch(/MANUAL_ONLY/);

    mockYearRepo.find.mockResolvedValue([mkYear({ isCurrent: true })]);
    const login = await service.ensureSchoolYear(new Date('2025-04-15'));
    expect(login.success).toBe(true);
    expect(login.data).toBeNull();
    expect(login.message).toMatch(/MANUAL_ONLY/);
    expect(mockYearRepo.save).not.toHaveBeenCalled();
  });
});
