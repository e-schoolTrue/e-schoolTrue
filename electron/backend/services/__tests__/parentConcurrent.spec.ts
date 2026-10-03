import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/e-school-test-uploads') },
}));

import { StudentService } from '../studentService';
import { AppDataSource } from '../../../data-source';

/**
 * Option B T_parent — concurrence findOrCreateParent.
 *
 * - Promise.all x20 même tél (formats variés) → 1 seul parent (retry UNIQUE).
 * - P1 tél partagé → 1 parent ; P2 quadruplet → 1 ; P3 no-key → 1/élève.
 */
describe('Parent concurrent + partition P1/P2/P3', () => {
  let service: StudentService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let store: Map<string, any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let allParents: any[];
  let nextId: number;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    store = new Map();
    allParents = [];
    nextId = 1;

    const parentRepo = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      findOne: vi.fn(async (opts: any) => {
        const w = opts?.where ?? {};
        if (w.normalizedPhone != null) return store.get(String(w.normalizedPhone)) ?? null;
        if (typeof w.id === 'number') return allParents.find((p) => p.id === w.id) ?? null;
        return null;
      }),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      create: vi.fn((dto: any) => ({ ...dto })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      save: vi.fn(async (e: any) => {
        const np = e.normalizedPhone ?? null;
        if (np != null && store.has(String(np))) {
          throw new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: T_parent.normalizedPhone');
        }
        const saved = { ...e, id: nextId++ };
        allParents.push(saved);
        if (np != null) store.set(String(np), saved);
        return saved;
      }),
      createQueryBuilder: vi.fn(() => {
        const qb: Record<string, unknown> = {
          where: vi.fn().mockReturnThis(),
          andWhere: vi.fn().mockReturnThis(),
          getMany: vi.fn(async () => allParents.filter((p) => p.normalizedPhone == null && p.suspect !== 'no-key')),
        };
        return qb;
      }),
    };

    const mockDs = {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getRepository: vi.fn((entity: any) => {
        if (String(entity?.name ?? '') === 'ParentEntity') return parentRepo;
        return { findOne: vi.fn().mockResolvedValue(null), save: vi.fn(), create: vi.fn((x: unknown) => x) };
      }),
      createQueryRunner: vi.fn(() => ({
        hasTable: vi.fn(async () => true),
        release: vi.fn(async () => {}),
      })),
    };
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDs as never);
    service = new StudentService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Promise.all x20 même tél → 1 seul parent (retry UNIQUE)', async () => {
    const variants = ['76123456', '76 12 34 56', '+22376123456', '0022376123456', '22376123456'];
    const results = await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        service.findOrCreateParent({
          fatherFirstname: `Papa${i}`,
          fatherLastname: 'Diallo',
          motherFirstname: 'Aminata',
          motherLastname: 'Bah',
          famillyPhone: variants[i % variants.length],
          address: 'Bamako',
        }),
      ),
    );
    const ids = new Set(results.map((r) => Number(r?.id)));
    expect(ids.size).toBe(1);
    expect(allParents.length).toBe(1);
    expect(allParents[0].normalizedPhone).toBe('+22376123456');
  });

  it('P1 tél partagé → 1 parent (séquentiel)', async () => {
    const a = await service.findOrCreateParent({ fatherFirstname: 'Moussa', famillyPhone: '76123456' });
    const b = await service.findOrCreateParent({ fatherFirstname: 'Autre', famillyPhone: '+22376123456' });
    expect(Number(a?.id)).toBe(Number(b?.id));
    expect(allParents.length).toBe(1);
  });

  it('P2 quadruplet exact (casse/accents) → 1 parent ; recomposé → distinct', async () => {
    const a = await service.findOrCreateParent({
      fatherFirstname: 'Jean', fatherLastname: 'Koné', motherFirstname: 'Marie', motherLastname: 'Traoré',
    });
    const b = await service.findOrCreateParent({
      fatherFirstname: 'JEAN', fatherLastname: 'KONE', motherFirstname: 'marie', motherLastname: 'traore',
    });
    expect(Number(a?.id)).toBe(Number(b?.id));
    const c = await service.findOrCreateParent({
      fatherFirstname: 'Jean', fatherLastname: 'Koné', motherFirstname: 'Fatoumata', motherLastname: 'Cissé',
    });
    expect(Number(c?.id)).not.toBe(Number(a?.id));
  });

  it('P3 no-key → 1 foyer PAR appel (jamais fusionné)', async () => {
    const a = await service.findOrCreateParent({ address: 'Bamako' });
    const b = await service.findOrCreateParent({ address: 'Bamako' });
    expect(a?.suspect).toBe('no-key');
    expect(b?.suspect).toBe('no-key');
    expect(Number(a?.id)).not.toBe(Number(b?.id));
  });

  it('payload vide → null (aucun foyer créé)', async () => {
    const r = await service.findOrCreateParent({});
    expect(r).toBeNull();
    expect(allParents.length).toBe(0);
  });
});
