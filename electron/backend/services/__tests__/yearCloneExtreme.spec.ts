import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/e-school-test-year-extreme') },
}));

import { YearRepartitionService } from '../yearService';
import { AppDataSource } from '../../../data-source';

/**
 * QA extrême — clone Year configs-only + lifecycle fermée.
 * Couvre la demande : 0 lignes, 100+ lignes, ":" "'" '"' NULL,
 * schoolYear legacy NULL, doublons UNIQUE, source vide, cible existante,
 * close/reopen/setCurrent fermée, ensure no-op, update/delete closed.
 */
describe('YearService — clone extrême + lifecycle fermée', () => {
  let service: YearRepartitionService;
  let mockYearRepo: any;
  let mockDS: any;
  let store: Record<string, any[]>;

  const mkYear = (over: any = {}) => ({
    id: 1,
    schoolYear: '2025-2026',
    periodConfigurations: [{ name: 'T1', start: new Date('2025-09-01'), end: new Date('2026-06-30') }],
    isCurrent: false,
    status: 'active',
    closedAt: null,
    ...over,
  });

  const repoFor = (entity: any) => {
    const name = entity?.name ?? String(entity ?? 'unknown');
    if (name === 'YearRepartitionEntity') return mockYearRepo;
    const rows = store[name] ?? [];
    return {
      find: vi.fn(async (opts: any = {}) => {
        const where = opts?.where;
        if (where?.schoolYear) return rows.filter((r) => r.schoolYear === where.schoolYear);
        return [...rows];
      }),
      count: vi.fn(async (opts: any = {}) => {
        const where = opts?.where;
        if (where?.schoolYear) return rows.filter((r) => r.schoolYear === where.schoolYear).length;
        return rows.length;
      }),
      save: vi.fn(async (e: any) => {
        const saved = { ...e, id: e.id ?? Math.floor(Math.random() * 100000) + 10 };
        rows.push(saved);
        return saved;
      }),
    } as any;
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    store = {
      PaymentConfigEntity: [],
      PaymentAnnualConfigEntity: [],
      TranchConfigEntity: [],
      TrancheEntryEntity: [],
      GradingConfigEntity: [],
      EvaluationCategoryEntity: [],
      FeeItemEntity: [],
      YearRepartitionEntity: [],
    };
    mockYearRepo = {
      findOne: vi.fn(async ({ where }: any) => {
        if (where?.id === 1) return mkYear();
        if (where?.id === 9) return mkYear({ id: 9, schoolYear: '2023-2024', status: 'closed', closedAt: new Date() });
        if (where?.schoolYear === '2026-2027') return null;
        return null;
      }),
      findOneBy: vi.fn(async ({ id }: any) => {
        if (id === 9) return mkYear({ id: 9, schoolYear: '2023-2024', status: 'closed' });
        if (id === 1) return mkYear();
        return null;
      }),
      find: vi.fn(async () => []),
      save: vi.fn(async (e: any) => ({ ...e, id: e.id ?? 2 })),
      delete: vi.fn(async () => ({ affected: 1 })),
      createQueryBuilder: vi.fn(() => ({ update: () => ({ set: () => ({ execute: async () => ({}) }) }) })),
    };
    const manager = { getRepository: vi.fn((e: any) => repoFor(e)) };
    mockDS = {
      getRepository: vi.fn((e: any) => (e?.name === 'YearRepartitionEntity' ? mockYearRepo : repoFor(e))),
      transaction: vi.fn(async (cb: any) => cb(manager)),
    };
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDS as any);
    service = new YearRepartitionService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('clone 0 ligne → EMPTY_SOURCE explicite', async () => {
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(r.success).toBe(true);
    expect(r.error).toBe('EMPTY_SOURCE');
  });

  it('clone 120 lignes grading → succès, 120 cibles', async () => {
    store.GradingConfigEntity = Array.from({ length: 120 }, (_, i) => ({
      id: 1000 + i,
      schoolId: 1,
      classId: i % 10,
      subjectId: i,
      period: `Période ${i}`,
      finalGradeBase: 20,
      calculationStrategy: 'WEIGHTED',
      normalizeScores: true,
      description: `Config ${i}`,
      schoolYear: '2025-2026',
      categories: [{ name: `Cat ${i}`, code: 'DEV', weight: 1, defaultMaxScore: 20, color: '#fff', displayOrder: 0, isExam: false }],
    }));
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(r.success).toBe(true);
    expect(r.data.gradingConfigs).toBe(120);
    expect(store.GradingConfigEntity.filter((g) => g.schoolYear === '2026-2027')).toHaveLength(120);
  }, 15000);

  it('clone valeurs extrêmes : : \' " NULL → succès verbatim', async () => {
    const tricky = [
      'Semestre 1: intro',
      "l'élève",
      'la "moyenne"',
      'Mix: l\'élève "top" 08:00 ratio 2:1',
    ];
    store.GradingConfigEntity = tricky.map((period, i) => ({
      id: 200 + i,
      schoolId: 1,
      classId: i,
      subjectId: i,
      period,
      finalGradeBase: 20,
      calculationStrategy: 'WEIGHTED',
      normalizeScores: true,
      description: i % 2 === 0 ? null : `desc: "${period}"`,
      schoolYear: '2025-2026',
      categories: [{ name: `Cat: '${period}' "x"`, code: 'DEV', weight: 1, defaultMaxScore: 20, color: '#fff', displayOrder: 0, isExam: false }],
    }));
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(r.success).toBe(true);
    expect(r.data.gradingConfigs).toBe(4);
    const targets = store.GradingConfigEntity.filter((g) => g.schoolYear === '2026-2027');
    expect(targets).toHaveLength(4);
    expect(String(targets[0].period)).toContain(':');
    expect(String(targets[1].period)).toContain("'");
    expect(String(targets[2].period)).toContain('"');
  });

  it('clone legacy schoolYear NULL → fallback cloné (pas vide)', async () => {
    store.PaymentConfigEntity = [
      { id: 1, schoolYear: null, classId: '1', annualAmount: 50000 },
      { id: 2, schoolYear: undefined, classId: '2', annualAmount: 60000 },
    ];
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(r.success).toBe(true);
    expect(r.data.paymentConfigs).toBe(2);
  });

  it('clone doublons UNIQUE → rejouable, skipped ≥ N', async () => {
    store.GradingConfigEntity = [{ id: 1, schoolId: 1, classId: 1, subjectId: 1, period: 'P1', schoolYear: '2025-2026', categories: [] }];
    const first = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(first.success).toBe(true);
    const second = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(second.success).toBe(true);
    expect((second.data.skipped?.grading_config ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it('clone cible existante → DUPLICATE_SCHOOL_YEAR, transaction jamais appelée', async () => {
    mockYearRepo.findOne.mockImplementation(async ({ where }: any) => {
      if (where?.id === 1) return mkYear();
      if (where?.schoolYear === '2026-2027') return mkYear({ id: 2, schoolYear: '2026-2027' });
      return null;
    });
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(r.success).toBe(false);
    expect(r.error).toBe('DUPLICATE_SCHOOL_YEAR');
    expect(mockDS.transaction).not.toHaveBeenCalled();
  });

  it('clone payload invalide → INVALID_SCHOOL_YEAR / INVALID_PAYLOAD', async () => {
    const badYear = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2028' } as any);
    expect(badYear.success).toBe(false);
    expect(badYear.error).toBe('INVALID_SCHOOL_YEAR');
    const noId = await service.cloneYearConfigs({ newSchoolYear: '2026-2027' } as any);
    expect(noId.success).toBe(false);
    expect(noId.error).toBe('INVALID_PAYLOAD');
    const unknown = await service.cloneYearConfigs({ fromId: 9999, newSchoolYear: '2026-2027' });
    expect(unknown.success).toBe(false);
    expect(unknown.error).toBe('NOT_FOUND');
  });

  it('close déjà fermée → ALREADY_CLOSED ; reopen active → ALREADY_ACTIVE', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'closed' }));
    const c = await service.closeYear(1);
    expect(c.success).toBe(false);
    expect(c.error).toBe('ALREADY_CLOSED');
    mockYearRepo.findOne.mockResolvedValue(mkYear({ status: 'active' }));
    const ro = await service.reopenYear(1);
    expect(ro.success).toBe(false);
    expect(ro.error).toBe('ALREADY_ACTIVE');
  });

  it('close/reopen/setCurrent sur fermée : setCurrent fermée → YEAR_CLOSED', async () => {
    mockYearRepo.findOne.mockResolvedValue(mkYear({ id: 9, schoolYear: '2023-2024', status: 'closed' }));
    const r = await service.setCurrentYearRepartition(9);
    expect(r.success).toBe(false);
    expect(r.error).toBe('YEAR_CLOSED');
    expect(mockYearRepo.save).not.toHaveBeenCalled();
  });

  it('ensureSchoolYear no-op → MANUAL_ONLY, save jamais appelé', async () => {
    const r = await service.ensureSchoolYear(new Date('2026-09-01'));
    expect(r.success).toBe(true);
    expect(r.data).toBeNull();
    expect(r.message).toMatch(/MANUAL_ONLY/);
    expect(mockYearRepo.save).not.toHaveBeenCalled();
  });

  it('update/delete closed → YEAR_CLOSED, save/delete jamais appelés', async () => {
    mockYearRepo.findOneBy.mockResolvedValue(mkYear({ id: 9, status: 'closed', schoolYear: '2023-2024' }));
    const u = await service.updateYearRepartition(9, { schoolYear: '2023-2024' } as any);
    expect(u.success).toBe(false);
    expect(u.error).toBe('YEAR_CLOSED');
    expect(mockYearRepo.save).not.toHaveBeenCalled();
    mockYearRepo.findOne.mockResolvedValue(mkYear({ id: 9, status: 'closed', schoolYear: '2023-2024' }));
    const d = await service.deleteYearRepartition(9);
    expect(d.success).toBe(false);
    expect(d.error).toBe('YEAR_CLOSED');
    expect(mockYearRepo.delete).not.toHaveBeenCalled();
  });
});
