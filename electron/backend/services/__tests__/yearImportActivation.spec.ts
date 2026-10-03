import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/e-school-test-uploads') },
}));

import { YearRepartitionService } from '../yearService';
import { AppDataSource } from '../../../data-source';

/**
 * Fix import backup : la DB importée contient des années mais aucune isCurrent=true
 * (ou plusieurs après merge) → l'app disait « Aucune année ouverte — lecture seule ».
 * - 0 courante + années ouvertes → la plus récente devient courante (activation auto).
 * - >1 courante → résolution vers la plus récente OUVERTE (flags réparés).
 * - Tout clôturé / vide → null (lecture seule correcte, création manuelle requise).
 * - ensureOneCurrentAfterImport() = alias explicite du boot (main.ts [3a/4]).
 * Jamais de création (MANUAL_ONLY : save uniquement pour flag isCurrent).
 */
describe('Import backup — activation auto de la courante', () => {
  let service: YearRepartitionService;
  let mockYearRepo: any;
  let mockDS: any;

  const mkYear = (over: any = {}) => ({
    id: 1,
    schoolYear: '2024-2025',
    periodConfigurations: [
      { name: 'Année', start: new Date('2024-09-01'), end: new Date('2025-06-30') },
    ],
    isCurrent: false,
    status: 'active',
    closedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  });

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mockYearRepo = {
      findOne: vi.fn(),
      find: vi.fn().mockResolvedValue([]),
      save: vi.fn(async (e: any) => ({ ...e })),
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

  it('1. années sans courante → la plus récente OUVERTE devient courante (persistée)', async () => {
    mockYearRepo.find.mockResolvedValue([
      mkYear({ id: 1, schoolYear: '2024-2025', isCurrent: false, status: 'active' }),
      mkYear({ id: 2, schoolYear: '2025-2026', isCurrent: false, status: 'active' }),
    ]);
    const cur = await service.getCurrentYearRepartition(new Date('2025-10-01'));
    expect(cur.success).toBe(true);
    expect(cur.data?.schoolYear).toBe('2025-2026');
    // Activation persistée (isCurrent=true sauvé), aucune année créée (pas de new).
    expect(mockYearRepo.save).toHaveBeenCalled();
    const saved = mockYearRepo.save.mock.calls[0][0];
    expect(saved.isCurrent).toBe(true);
    expect(saved.schoolYear).toBe('2025-2026');
  });

  it('2. ambiguïté >1 isCurrent (merge) → résolue vers la plus récente OUVERTE', async () => {
    const y1 = mkYear({ id: 1, schoolYear: '2024-2025', isCurrent: true, status: 'active' });
    const y2 = mkYear({ id: 2, schoolYear: '2025-2026', isCurrent: true, status: 'active' });
    mockYearRepo.find.mockResolvedValue([y1, y2]);
    const cur = await service.getCurrentYearRepartition(new Date());
    expect(cur.success).toBe(true);
    expect(cur.data?.schoolYear).toBe('2025-2026');
    // L'ancienne courante a été démise.
    const savedFlags = mockYearRepo.save.mock.calls.map((c: any[]) => c[0]);
    expect(savedFlags.some((s: any) => s.id === 1 && s.isCurrent === false)).toBe(true);
    expect(savedFlags.some((s: any) => s.id === 2 && s.isCurrent === true)).toBe(true);
  });

  it('3. tout clôturé → null (lecture seule correcte, pas d’activation forcée)', async () => {
    mockYearRepo.find.mockResolvedValue([
      mkYear({ id: 1, schoolYear: '2024-2025', isCurrent: false, status: 'closed' }),
    ]);
    const cur = await service.getCurrentYearRepartition(new Date());
    expect(cur.success).toBe(true);
    expect(cur.data).toBeNull();
  });

  it('4. DB vide → null (création manuelle requise, aucun save)', async () => {
    mockYearRepo.find.mockResolvedValue([]);
    const cur = await service.getCurrentYearRepartition(new Date());
    expect(cur.success).toBe(true);
    expect(cur.data).toBeNull();
    expect(mockYearRepo.save).not.toHaveBeenCalled();
  });

  it('5. ensureOneCurrentAfterImport() active la plus récente (boot [3a/4])', async () => {
    mockYearRepo.find.mockResolvedValue([
      mkYear({ id: 1, schoolYear: '2023-2024', isCurrent: false, status: 'active' }),
      mkYear({ id: 2, schoolYear: '2024-2025', isCurrent: false, status: 'active' }),
    ]);
    const cur = await service.ensureOneCurrentAfterImport(new Date());
    expect(cur.success).toBe(true);
    expect(cur.data?.schoolYear).toBe('2024-2025');
  });
});
