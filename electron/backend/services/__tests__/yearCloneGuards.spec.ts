import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/e-school-test-uploads') },
}));

import { YearRepartitionService } from '../yearService';
import { AppDataSource } from '../../../data-source';

/**
 * Fix "Échec du clone configs-only" (2025-2026 → 2026-2027) :
 * - preview et clone partagent le contrat plat YearClonePreview ;
 * - payload bilingue fromId/sourceId ;
 * - source vide = succès explicite EMPTY_SOURCE (pas d'échec générique) ;
 * - idempotence : doublons cibles ignorés (UNIQUE grading/annual-grade) ;
 * - erreurs explicites `Échec du clone A → B : <détail>`.
 */
describe('YearService — clone guards (configs-only)', () => {
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

  const repoFor = (entity: any, managerScope: boolean) => {
    const name = entity?.name ?? String(entity ?? 'unknown');
    if (name === 'YearRepartitionEntity') {
      return {
        findOne: vi.fn(async ({ where }: any) => {
          if (where?.id === 1) return mkYear();
          if (where?.schoolYear === '2026-2027') return null;
          return null;
        }),
        find: vi.fn(async () => []),
        save: vi.fn(async (e: any) => ({ ...e, id: e.id ?? 2 })),
      } as any;
    }
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
        // Simule l'UNIQUE frais (grading sans schoolYear, annual OneToOne grade)
        // si le test ne pré-peuple pas la cible : on persiste naïvement.
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
        if (where?.schoolYear === '2026-2027') return null;
        return null;
      }),
      find: vi.fn(async () => []),
      save: vi.fn(async (e: any) => ({ ...e, id: e.id ?? 2 })),
    };
    const manager = { getRepository: vi.fn((e: any) => repoFor(e, true)) };
    mockDS = {
      getRepository: vi.fn((e: any) => repoFor(e, false)),
      transaction: vi.fn(async (cb: any) => cb(manager)),
    };
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDS as any);
    service = new YearRepartitionService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('preview : forme plate YearClonePreview + counts, source non vide', async () => {
    store.PaymentConfigEntity = [{ id: 1, schoolYear: '2025-2026', classId: '1' }];
    store.PaymentAnnualConfigEntity = [{ id: 2, schoolYear: '2025-2026', tranches: [{ id: 3 }] }];
    store.GradingConfigEntity = [{ id: 4, schoolYear: '2025-2026' }];
    store.FeeItemEntity = [{ id: 5, schoolYear: '2025-2026', name: 'Frais' }];
    const r = await service.clonePreview({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(r.success).toBe(true);
    expect(r.data.paymentConfigs).toBe(1);
    expect(r.data.gradingConfigs).toBe(1);
    expect(r.data.feeItems).toBe(1);
    expect(r.data.counts.payment_configs).toBe(1);
    expect(r.data.emptySource).toBe(false);
  });

  it('preview : source vide → zéros explicites + emptySource', async () => {
    const r = await service.clonePreview({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(r.success).toBe(true);
    expect(r.data.paymentConfigs).toBe(0);
    expect(r.data.tranches).toBe(0);
    expect(r.data.gradingConfigs).toBe(0);
    expect(r.data.feeItems).toBe(0);
    expect(r.data.emptySource).toBe(true);
    expect(String(r.message)).toMatch(/vide/);
  });

  it('preview : accepte sourceId (alias V3)', async () => {
    const r = await service.clonePreview({ sourceId: 1, newSchoolYear: '2026-2027' } as any);
    expect(r.success).toBe(true);
    expect(r.data.fromYear).toBe('2025-2026');
  });

  it('clone : accepte sourceId et retourne id + forme plate', async () => {
    store.PaymentConfigEntity = [{ id: 10, schoolYear: '2025-2026', classId: '1', annualAmount: 100 }];
    const r = await service.cloneYearConfigs({ sourceId: 1, newSchoolYear: '2026-2027' } as any);
    expect(r.success).toBe(true);
    expect(r.data.schoolYear).toBe('2026-2027');
    expect(typeof r.data.id).toBe('number');
    expect(r.data.paymentConfigs).toBe(1);
    expect(Array.isArray(r.data.periodConfigurations)).toBe(true);
  });

  it('clone : source vide → succès EMPTY_SOURCE explicite (pas d’échec générique)', async () => {
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(r.success).toBe(true);
    expect(r.error).toBe('EMPTY_SOURCE');
    expect(String(r.message)).toMatch(/Source 2025-2026 vide/);
    expect(String(r.message)).toMatch(/2026-2027/);
  });

  it('clone : grading déjà présent sur cible → ignoré (pas de UNIQUE, succès)', async () => {
    store.GradingConfigEntity = [
      { id: 20, schoolYear: '2025-2026', schoolId: 1, classId: null, subjectId: null, period: null, categories: [] },
      { id: 21, schoolYear: '2026-2027', schoolId: 1, classId: null, subjectId: null, period: null, categories: [] },
    ];
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(r.success).toBe(true);
    expect((r.data.skipped?.grading_config ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it('clone : annual même grade déjà présent sur cible → ignoré (pas de UNIQUE)', async () => {
    store.PaymentAnnualConfigEntity = [
      { id: 30, schoolYear: '2025-2026', grade: { id: 7 }, tranches: [] },
      { id: 31, schoolYear: '2026-2027', grade: { id: 7 }, tranches: [] },
    ];
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027', copyPayment: false, copyGrading: false, copyFeeItems: false });
    expect(r.success).toBe(true);
    expect((r.data.skipped?.payment_annual_config ?? 0)).toBeGreaterThanOrEqual(1);
  });

  it('clone : erreur explicite avec contexte A → B (colonne manquante)', async () => {
    mockDS.transaction.mockRejectedValueOnce(new Error('no such column: schoolYear'));
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(r.success).toBe(false);
    expect(String(r.message)).toMatch(/Échec du clone/);
    expect(String(r.message)).toMatch(/no such column/);
    expect(String(r.message)).toMatch(/migration 177/);
  });

  /**
   * Non-régression "Échec du clone 2025-2026 → 2026-2027 : near ':' syntax error"
   * (aperçu Paiements 0, Tranches 0, Notation 28, Frais 0) : 28 configs notation
   * dont les valeurs contiennent ":" ("Semestre 1: …", créneau "08:00",
   * ratio "2:1", apostrophes) + props parasites (timestamps, colonne d'une
   * dérive de schéma). Le clone doit réussir, persister 28 lignes cible avec
   * valeurs ":" VERBATIM (liées, jamais interpolées/échappées), relinker les
   * catégories sur les nouveaux parents, et ne lier QUE les colonnes connues
   * (aucune prop parasite dans les payloads de save).
   */
  it('clone : 28 configs notation avec ":" → succès, valeurs liées, colonnes explicites', async () => {
    const colonPeriods = [
      'Semestre 1: Devoirs',
      "Trimestre 1: l'évaluation",
      'Composition: 1er semestre',
      'Note: TP: rattrapage',
      "Devoir d'examen: blanc",
      'Période "spéciale": été',
      '08:00-10:00: créneau',
      'Ratio 2:1: pondération',
    ];
    store.GradingConfigEntity = Array.from({ length: 28 }, (_, i) => ({
      id: 100 + i,
      remote_id: `00000000-0000-4000-8000-${String(200000 + i).padStart(12, '0')}`,
      schoolId: 1,
      classId: i,
      subjectId: i * 10,
      period: `${colonPeriods[i % colonPeriods.length]} #${i}`,
      finalGradeBase: 20,
      calculationStrategy: 'WEIGHTED',
      normalizeScores: true,
      description: `Config ${i}: coeff 2:1 — l'élève "moyen"`,
      schoolYear: '2025-2026',
      // Props parasites : ne doivent JAMAIS atteindre le writer (colonnes
      // explicites uniquement) — sinon risque "near ':' syntax error" sur
      // construction textuelle du statement.
      createdAt: new Date('2025-09-01T08:00:00'),
      updatedAt: new Date('2025-09-01T10:30:00'),
      legacyExtra: 'dérive:schéma:1',
      categories: [
        {
          id: 1000 + i,
          remote_id: null,
          name: `Devoir ${i}: TP de l'élève`,
          code: 'DEV',
          weight: 2,
          defaultMaxScore: 20,
          minEntries: null,
          maxEntries: null,
          color: '#3498db',
          displayOrder: i,
          isExam: i % 2 === 0,
        },
      ],
    }));
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(r.success).toBe(true);
    expect(r.data.gradingConfigs).toBe(28);
    expect(r.data.paymentConfigs).toBe(0);
    expect(r.data.tranches).toBe(0);
    expect(r.data.feeItems).toBe(0);

    const targets = store.GradingConfigEntity.filter((g) => g.schoolYear === '2026-2027');
    expect(targets).toHaveLength(28);
    const allowedGrading = new Set(['id', 'schoolId', 'classId', 'subjectId', 'period', 'finalGradeBase', 'calculationStrategy', 'normalizeScores', 'description', 'schoolYear', 'remote_id']);
    for (const t of targets) {
      // ":" preservé verbatim (donnée liée, pas d'échappement destructif).
      expect(String(t.period)).toContain(':');
      expect(String(t.description)).toContain(':');
      // Colonnes explicites uniquement : id source recyclé ? non (nouvel id),
      // remote_id réinitialisé, props parasites absentes.
      expect(t.remote_id).toBeNull();
      expect(t.id).not.toBeNull();
      for (const k of Object.keys(t)) expect(allowedGrading.has(k)).toBe(true);
      expect((t as any).createdAt).toBeUndefined();
      expect((t as any).legacyExtra).toBeUndefined();
      expect((t as any).categories).toBeUndefined();
    }
    // Source intacte (28 lignes 2025-2026 toujours là).
    expect(store.GradingConfigEntity.filter((g) => g.schoolYear === '2025-2026')).toHaveLength(28);

    const cats = store.EvaluationCategoryEntity ?? [];
    expect(cats).toHaveLength(28);
    const allowedCat = new Set(['id', 'name', 'code', 'weight', 'defaultMaxScore', 'minEntries', 'maxEntries', 'color', 'displayOrder', 'isExam', 'remote_id', 'config']);
    for (const cat of cats) {
      expect(String(cat.name)).toContain(':');
      expect(cat.remote_id).toBeNull();
      expect(cat.config?.id).toBeGreaterThan(0);
      // Relink : chaque catégorie pointe un parent cible 2026-2027, jamais source.
      const parent = targets.find((t) => t.id === cat.config.id);
      expect(parent).toBeDefined();
      expect(parent.schoolYear).toBe('2026-2027');
      for (const k of Object.keys(cat)) expect(allowedCat.has(k)).toBe(true);
    }
  });

  it('clone : 28 configs notation avec ":" → rejouable (tout ignoré, succès)', async () => {
    store.GradingConfigEntity = Array.from({ length: 28 }, (_, i) => ({
      id: 100 + i,
      remote_id: null,
      schoolId: 1,
      classId: i,
      subjectId: i * 10,
      period: `Semestre 1: matière #${i}`,
      finalGradeBase: 20,
      calculationStrategy: 'WEIGHTED',
      normalizeScores: true,
      description: `Config ${i}: ratio 2:1`,
      schoolYear: '2025-2026',
      categories: [{ name: `Devoir ${i}: TP`, code: 'DEV', weight: 1, defaultMaxScore: 20, color: '#3498db', displayOrder: 0, isExam: false }],
    }));
    const first = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(first.success).toBe(true);
    expect(first.data.gradingConfigs).toBe(28);
    const second = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027' });
    expect(second.success).toBe(true);
    expect((second.data.skipped?.grading_config ?? 0)).toBe(28);
    expect(store.GradingConfigEntity.filter((g) => g.schoolYear === '2026-2027')).toHaveLength(28);
  });

  /**
   * SEV2 PAR NIVEAU : clone + preview filtrent (année + niveau).
   * Cible mono-niveau PRIMAIRE : PRIMAIRE + legacy (null) copiés,
   * SECONDAIRE jamais copié. EMPTY_SOURCE si rien du niveau.
   */
  it('clone PAR NIVEAU : seul le niveau cible + legacy est copié (payment/grading/fee)', async () => {
    store.PaymentConfigEntity = [
      { id: 1, schoolYear: '2025-2026', level: 'PRIMAIRE', classId: '1', annualAmount: 100, inscriptionFee: 10 },
      { id: 2, schoolYear: '2025-2026', level: 'SECONDAIRE', classId: '2', annualAmount: 200, inscriptionFee: 20 },
      { id: 3, schoolYear: '2025-2026', level: null, classId: '3', annualAmount: 300, inscriptionFee: 30 },
    ];
    store.GradingConfigEntity = [
      { id: 11, schoolYear: '2025-2026', level: 'PRIMAIRE', schoolId: 1, classId: 1, subjectId: 1, period: 'P1', categories: [] },
      { id: 12, schoolYear: '2025-2026', level: 'SECONDAIRE', schoolId: 1, classId: 2, subjectId: 2, period: 'P2', categories: [] },
      { id: 13, schoolYear: '2025-2026', level: null, schoolId: 1, classId: 3, subjectId: 3, period: 'P3', categories: [] },
    ];
    store.FeeItemEntity = [
      { id: 21, schoolYear: '2025-2026', level: 'PRIMAIRE', name: 'Frais P', gradeId: 1 },
      { id: 22, schoolYear: '2025-2026', level: 'SECONDAIRE', name: 'Frais S', gradeId: 2 },
      { id: 23, schoolYear: '2025-2026', name: 'Frais legacy', gradeId: 3 },
    ];
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027', level: 'PRIMAIRE' } as any);
    expect(r.success).toBe(true);
    expect(r.data.paymentConfigs).toBe(2);
    expect(r.data.gradingConfigs).toBe(2);
    expect(r.data.feeItems).toBe(2);
    const payTargets = store.PaymentConfigEntity.filter((x) => x.schoolYear === '2026-2027');
    expect(payTargets).toHaveLength(2);
    expect(payTargets.map((x) => x.classId).sort()).toEqual(['1', '3']);
    const gradTargets = store.GradingConfigEntity.filter((x) => x.schoolYear === '2026-2027');
    expect(gradTargets.map((x) => x.period).sort()).toEqual(['P1', 'P3']);
    const feeTargets = store.FeeItemEntity.filter((x) => x.schoolYear === '2026-2027');
    expect(feeTargets.map((x) => x.name).sort()).toEqual(['Frais P', 'Frais legacy']);
  });

  it('clone PAR NIVEAU : annuals filtrés via grade.level, autres niveaux exclus', async () => {
    store.PaymentAnnualConfigEntity = [
      { id: 31, schoolYear: '2025-2026', grade: { id: 7, level: 'PRIMAIRE' }, tranches: [] },
      { id: 32, schoolYear: '2025-2026', grade: { id: 8, level: 'SECONDAIRE' }, tranches: [] },
      { id: 33, schoolYear: '2025-2026', grade: null, tranches: [] },
    ];
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027', level: 'PRIMAIRE', copyPayment: false, copyGrading: false, copyFeeItems: false } as any);
    expect(r.success).toBe(true);
    expect(r.data.counts.payment_annual_config).toBe(2);
    const targets = store.PaymentAnnualConfigEntity.filter((x) => x.schoolYear === '2026-2027');
    expect(targets).toHaveLength(2);
  });

  it('clone PAR NIVEAU : rien du niveau → EMPTY_SOURCE explicite', async () => {
    store.PaymentConfigEntity = [{ id: 1, schoolYear: '2025-2026', level: 'SECONDAIRE', classId: '9', annualAmount: 1 }];
    store.GradingConfigEntity = [{ id: 2, schoolYear: '2025-2026', level: 'SECONDAIRE', schoolId: 1, categories: [] }];
    const r = await service.cloneYearConfigs({ fromId: 1, newSchoolYear: '2026-2027', level: 'PRIMAIRE' } as any);
    expect(r.success).toBe(true);
    expect(r.error).toBe('EMPTY_SOURCE');
    expect(r.data.paymentConfigs).toBe(0);
    expect(r.data.gradingConfigs).toBe(0);
  });

  it('preview PAR NIVEAU : compte le niveau cible + legacy uniquement', async () => {
    store.PaymentConfigEntity = [
      { id: 1, schoolYear: '2025-2026', level: 'PRIMAIRE', classId: '1' },
      { id: 2, schoolYear: '2025-2026', level: 'SECONDAIRE', classId: '2' },
      { id: 3, schoolYear: null, level: null, classId: '3' },
    ];
    store.GradingConfigEntity = [{ id: 4, schoolYear: '2025-2026', level: 'SECONDAIRE' }];
    const r = await service.clonePreview({ fromId: 1, newSchoolYear: '2026-2027', level: 'PRIMAIRE' } as any);
    expect(r.success).toBe(true);
    // payment: PRIMAIRE + legacy(null schoolYear) = 2 ; grading SECONDAIRE exclu = 0
    expect(r.data.paymentConfigs).toBe(2);
    expect(r.data.gradingConfigs).toBe(0);
    expect(r.data.emptySource).toBe(false);
  });
});
