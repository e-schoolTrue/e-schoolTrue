import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('electron', () => ({
  app: { getPath: vi.fn(() => '/tmp/e-school-test-payment-edge') },
}));

import { AppDataSource } from '../../../data-source';

/**
 * QA paiements/compta — idempotence, doublons, montants 0, soldes négatifs.
 * - receiptNumber dupliqué → idempotent (même ligne, pas de double)
 * - idempotencyKey rejoué → idempotent
 * - montants 0 / négatifs → refusés ou invalides côté form/service
 * - soldes négatifs : teacherPay net<0 → VALIDATION ; cashAppend/cashOpen gardes
 */
describe('Paiements/compta — idempotence + montants + soldes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => undefined);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  async function loadPaymentService() {
    const { PaymentService } = await import('../paymentService');
    return new PaymentService();
  }

  function mockPaymentDs(opts: { existingByReceipt?: any; existingByKey?: any; student?: any } = {}) {
    const existingByReceipt = opts.existingByReceipt ?? null;
    const existingByKey = opts.existingByKey ?? null;
    const student = opts.student ?? { id: 1, matricule: 'EL-001', grade: { id: 5 } };
    const paymentRepo = {
      findOne: vi.fn(async ({ where }: any) => {
        if (where?.receiptNumber && existingByReceipt && where.receiptNumber === existingByReceipt.receiptNumber) return existingByReceipt;
        if (where?.idempotencyKey && existingByKey && where.idempotencyKey === existingByKey.idempotencyKey) return existingByKey;
        return null;
      }),
      create: vi.fn((x: any) => ({ ...x })),
      save: vi.fn(async (x: any) => ({ ...x, id: x.id ?? 99 })),
    };
    const mockDS: any = {
      isInitialized: true,
      query: vi.fn(async () => []),
      getRepository: vi.fn(() => ({
        findOne: vi.fn(async () => null),
        find: vi.fn(async () => []),
        create: vi.fn((x: any) => ({ ...x })),
        save: vi.fn(async (x: any) => ({ ...x, id: x.id ?? 1 })),
      })),
      transaction: vi.fn(async (cb: any) => cb({
        getRepository: vi.fn(() => ({
          findOne: paymentRepo.findOne,
          create: paymentRepo.create,
          save: paymentRepo.save,
          find: vi.fn(async () => []),
          update: vi.fn(async () => ({})),
          createQueryBuilder: () => ({ where: () => ({ andWhere: () => ({ getMany: async () => [], getOne: async () => null, getRawOne: async () => ({ s: 0 }) }) }) }),
        })),
      })),
    };
    // getRepository hors-tx : payment pré-check + student fallback
    mockDS.getRepository = vi.fn((entity: any) => {
      const n = entity?.name ?? '';
      if (n === 'PaymentEntity') return paymentRepo as any;
      if (n === 'StudentEntity') return { findOne: vi.fn(async () => student) } as any;
      return { findOne: vi.fn(async () => null), find: vi.fn(async () => []), create: vi.fn((x: any) => ({ ...x })), save: vi.fn(async (x: any) => ({ ...x, id: 1 })) } as any;
    });
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDS);
    // initialize(false) ne doit rien faire (déjà initialisé)
    vi.spyOn(AppDataSource, 'initialize').mockResolvedValue(mockDS);
    return { mockDS, paymentRepo };
  }

  it('receiptNumber dupliqué → idempotent (même ligne retournée)', async () => {
    const dupe = { id: 42, receiptNumber: 'R-2025-0007', amount: 20000 };
    mockPaymentDs({ existingByReceipt: dupe });
    const svc = await loadPaymentService();
    const r = await svc.addPayment({ studentId: 1, amount: 20000, paymentType: 'tuition', paymentMethod: 'cash', schoolYear: '2025-2026', receiptNumber: 'R-2025-0007' } as any);
    expect(r.success).toBe(true);
    expect((r.data as any)?.id).toBe(42);
    expect(String(r.message)).toMatch(/idempotent/i);
  });

  it('idempotencyKey rejoué → idempotent', async () => {
    const dupe = { id: 77, idempotencyKey: 'key-abc-123', amount: 15000 };
    mockPaymentDs({ existingByKey: dupe });
    const svc = await loadPaymentService();
    const r = await svc.addPayment({ studentId: 1, amount: 15000, paymentType: 'tuition', paymentMethod: 'cash', schoolYear: '2025-2026', idempotencyKey: 'key-abc-123' } as any);
    expect(r.success).toBe(true);
    expect((r.data as any)?.id).toBe(77);
  });

  it('compta : expenseCreate montant 0/négatif/sans label → VALIDATION', async () => {
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue({ isInitialized: true } as any);
    const { accountingService } = await import('./../accountingService');
    for (const payload of [
      { label: 'X', amount: 0 },
      { label: 'X', amount: -100 },
      { label: '', amount: 1000 },
      { amount: 1000 },
    ]) {
      const r = await accountingService.expenseCreate(payload as any);
      expect(r.success).toBe(false);
      expect(r.error).toBe('VALIDATION');
    }
  });

  it('compta : cashOpen fond négatif → VALIDATION ; cashAppend 0 → VALIDATION', async () => {
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue({ isInitialized: true } as any);
    const { accountingService } = await import('./../accountingService');
    const o = await accountingService.cashOpen({ fond: -50 });
    expect(o.success).toBe(false);
    expect(o.error).toBe('VALIDATION');
    const a0 = await accountingService.cashAppend({ montant: 0, sens: 'entree' });
    expect(a0.success).toBe(false);
    expect(a0.error).toBe('VALIDATION');
    const aBad = await accountingService.cashAppend({ montant: 100, sens: 'nope' });
    expect(aBad.success).toBe(false);
    expect(aBad.error).toBe('VALIDATION');
  });

  it('compta : cashClose solde négatif → VALIDATION', async () => {
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue({ isInitialized: true } as any);
    const { accountingService } = await import('./../accountingService');
    const r = await accountingService.cashClose({ soldeReel: -1 });
    expect(r.success).toBe(false);
    expect(r.error).toBe('VALIDATION');
  });

  it('compta : teacherPay mois invalide → VALIDATION (sans DB)', async () => {
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue({ isInitialized: true } as any);
    const { accountingService } = await import('./../accountingService');
    const r = await accountingService.teacherPay(1, '2026-13-99' as any, {});
    // '2026-13-99' ne matche pas YYYY-MM → VALIDATION
    expect(r.success).toBe(false);
    expect(r.error).toBe('VALIDATION');
  });

  it('compta : teacherPay net négatif → VALIDATION (avance > brut)', async () => {
    const slip = {
      id: 10, professorId: 3, month: '2026-01', hoursTotal: 10, hourlyRate: 1000,
      grossAmount: 10000, netAmount: 10000, currency: 'GNF', status: 'valide',
      deductions: [], additions: [],
    };
    const payRepo = {
      findOne: vi.fn(async () => null),
      create: vi.fn((x: any) => ({ ...x })),
      save: vi.fn(async (x: any) => ({ ...x, id: 5 })),
      createQueryBuilder: () => ({ where: () => ({ andWhere: () => ({ getOne: async () => null }) }) }),
    };
    const slipRepo = {
      findOne: vi.fn(async () => ({ ...slip })),
      create: vi.fn((x: any) => ({ ...x })),
      save: vi.fn(async (x: any) => ({ ...x })),
    };
    const movRepo = { save: vi.fn(async (x: any) => x), create: vi.fn((x: any) => ({ ...x })) };
    const profRepo = { findOne: vi.fn(async () => ({ id: 3 })) };
    const counterRepo = { findOne: vi.fn(async () => null), create: vi.fn((x: any) => ({ ...x })), save: vi.fn(async (x: any) => x) };
    const mockDS: any = {
      isInitialized: true,
      getRepository: vi.fn(() => ({ findOne: vi.fn(async () => null) })),
      transaction: vi.fn(async (cb: any) => cb({
        getRepository: vi.fn((e: any) => {
          const n = e?.name ?? '';
          if (n.includes('SalarySlip')) return slipRepo as any;
          if (n.includes('ProfessorPayment')) return payRepo as any;
          if (n.includes('CashMovement')) return movRepo as any;
          if (n.includes('Professor') && !n.includes('Payment')) return profRepo as any;
          if (n.includes('Counter')) return counterRepo as any;
          return { findOne: vi.fn(async () => null), create: vi.fn((x: any) => ({ ...x })), save: vi.fn(async (x: any) => x) } as any;
        }),
      })),
    };
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDS);
    const { accountingService } = await import('./../accountingService');
    const r = await accountingService.teacherPay(3, '2026-01', { avance: 999999 } as any);
    expect(r.success).toBe(false);
    expect(r.error).toBe('VALIDATION');
    expect(String(r.message)).toMatch(/négatif/i);
  });

  it('compta : teacherPay idempotence scopée même clé/prof/mois → même paiement', async () => {
    const existing = { id: 21, professorId: 3, month: '2026-02', idempotencyKey: 'batch-key-1', netAmount: 5000 };
    const slip = {
      id: 11, professorId: 3, month: '2026-02', hoursTotal: 5, hourlyRate: 1000,
      grossAmount: 5000, netAmount: 5000, currency: 'GNF', status: 'valide', deductions: [], additions: [],
    };
    const payRepo = {
      findOne: vi.fn(async ({ where }: any) => {
        if (where?.idempotencyKey === 'batch-key-1' && where?.professorId === 3 && where?.month === '2026-02') return existing;
        return null;
      }),
      create: vi.fn((x: any) => ({ ...x })),
      save: vi.fn(async (x: any) => ({ ...x, id: 22 })),
      createQueryBuilder: () => ({ where: () => ({ andWhere: () => ({ getOne: async () => null }) }) }),
    };
    const mockDS: any = {
      isInitialized: true,
      getRepository: vi.fn(() => ({ findOne: vi.fn(async () => null) })),
      transaction: vi.fn(async (cb: any) => cb({
        getRepository: vi.fn((e: any) => {
          const n = e?.name ?? '';
          if (n.includes('SalarySlip')) return { findOne: vi.fn(async () => ({ ...slip })), save: vi.fn(async (x: any) => x), create: vi.fn((x: any) => ({ ...x })) } as any;
          if (n.includes('ProfessorPayment')) return payRepo as any;
          if (n.includes('Professor') && !n.includes('Payment')) return { findOne: vi.fn(async () => ({ id: 3 })) } as any;
          return { findOne: vi.fn(async () => null), create: vi.fn((x: any) => ({ ...x })), save: vi.fn(async (x: any) => x) } as any;
        }),
      })),
    };
    vi.spyOn(AppDataSource, 'getInstance').mockReturnValue(mockDS);
    const { accountingService } = await import('./../accountingService');
    const r = await accountingService.teacherPay(3, '2026-02', { idempotencyKey: 'batch-key-1' } as any);
    expect(r.success).toBe(true);
    expect((r.data as any)?.id).toBe(21);
  });
});
