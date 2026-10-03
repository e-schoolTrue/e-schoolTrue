import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/e-school-test-year-closed') },
}));

import { YearRepartitionService } from '../yearService';
import { AppDataSource } from '../../../data-source';

/**
 * QA destructif — year update/delete sur année clôturée.
 *
 * - backend refuse update closed (YEAR_CLOSED, save jamais appelé)
 * - backend refuse delete closed (YEAR_CLOSED, delete jamais appelé)
 * - update/delete active OK (non-régression)
 * - delete inexistant → not found
 */
describe('YearService — update/delete closed refusés (YEAR_CLOSED)', () => {
  let service: YearRepartitionService;
  let mockYearRepo: any;
  let mockDS: any;

  const mkYear = (over: any = {}) => ({
    id: 3,
    schoolYear: '2023-2024',
    periodConfigurations: [{ name: 'T1', start: new Date('2023-09-01'), end: new Date('2024-06-30') }],
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
    };
    mockDS = { getRepository: vi.fn(() => mockYearRepo) };
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDS as any);
    service = new YearRepartitionService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('update closed → YEAR_CLOSED, save jamais appelé', async () => {
    mockYearRepo.findOneBy.mockResolvedValue(mkYear({ status: 'closed' }));
    const r = await service.updateYearRepartition(3, { schoolYear: '2023-2024' } as any);
    expect(r.success).toBe(false);
    expect(r.error).toBe('YEAR_CLOSED');
    expect(r.message).toMatch(/clôturée/);
    expect(mockYearRepo.save).not.toHaveBeenCalled();
  });

  it('update active → OK (non-régression)', async () => {
    mockYearRepo.findOneBy.mockResolvedValue(mkYear({ status: 'active' }));
    mockYearRepo.find.mockResolvedValue([mkYear({ status: 'active' })]);
    const r = await service.updateYearRepartition(3, { schoolYear: '2023-2024' } as any);
    expect(r.success).toBe(true);
    expect(mockYearRepo.save).toHaveBeenCalledTimes(1);
  });

  it('delete closed → YEAR_CLOSED, delete jamais appelé', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'closed', schoolYear: '2023-2024' }));
    const r = await service.deleteYearRepartition(3);
    expect(r.success).toBe(false);
    expect(r.error).toBe('YEAR_CLOSED');
    expect(mockYearRepo.delete).not.toHaveBeenCalled();
  });

  it('delete active → OK (non-régression)', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'active' }));
    mockYearRepo.delete.mockResolvedValue({ affected: 1 });
    const r = await service.deleteYearRepartition(3);
    expect(r.success).toBe(true);
    expect(mockYearRepo.delete).toHaveBeenCalledWith(3);
  });

  it('delete inexistant → not found', async () => {
    mockYearRepo.findOne.mockResolvedValue(null);
    const r = await service.deleteYearRepartition(999);
    expect(r.success).toBe(false);
    expect(r.error).toMatch(/not found/i);
    expect(mockYearRepo.delete).not.toHaveBeenCalled();
  });
});
