import { describe, expect, it } from 'vitest';
import {
  buildCasyMonthlyGrid,
  buildCasyReceiptHtml,
  buildCasyTranchesFallback,
  CASY_MONTHS,
  markTranchesPaid,
  maskRef,
  monthlyHeadingFor,
  resolveImputationOrder,
  type CasyHtmlInput,
  type PaymentImputationOrder,
} from '@/utils/receiptCasy';

const ORDERS: PaymentImputationOrder[] = ['FIRST_FIRST', 'LAST_FIRST', 'LAST2_THEN_FIRST', 'LAST3_THEN_FIRST'];

function baseInput(overrides: Partial<CasyHtmlInput> = {}): CasyHtmlInput {
  const monthly = buildCasyMonthlyGrid(90_000, 20_000);
  const tranches = buildCasyTranchesFallback(90_000, 20_000);
  return {
    schoolName: 'ECOLE TEST',
    schoolTels: '622 00 00 00',
    schoolEmail: 'ecole@test.gn',
    schoolYear: '2025-2026',
    numero: 'R-2026-0001',
    maskedRef: maskRef('OM123456789'),
    dateJJMMAAAA: '25/09/2026',
    dateLettres: 'Vendredi 25 septembre 2026',
    matricule: 'EL-001',
    prenomsNom: 'Aminata Diallo',
    sexe: 'Féminin',
    telephone: '622 11 22 33',
    classe: '6ème A',
    motif: 'Scolarité',
    mode: 'Espèces',
    montantJour: '20 000 GNF',
    montantDigits: '20 000 GNF',
    montantLettres: 'Vingt mille francs guinéens',
    monthly,
    monthlyCells: monthly.map(() => '10 000 GNF'),
    tranches,
    trancheCells: tranches.map(() => '30 000 GNF'),
    annuel: '90 000 GNF',
    prochainPaiement: '30/06/2026',
    totaux: { inscription: '0 GNF', coutAnnuel: '90 000 GNF', rabais: '0 GNF', net: '100 000 GNF', totalPaye: '40 000 GNF', solde: '60 000 GNF' },
    barcodeValue: 'R-2026-0001',
    caissier: 'M. Sylla',
    ...overrides,
  };
}

describe('reçu CASY extrême — 4 ordres × N + montants + XSS + heading', () => {
  it.each(ORDERS)('ordre %s × N=0/1/2/9 : cochés = min(N,9)', (order) => {
    const cases: Array<[number, number]> = [[0, 0], [1, 1], [2, 2], [9, 9]];
    for (const [monthsPaid, expected] of cases) {
      const paid = monthsPaid * 10_000;
      const grid = buildCasyMonthlyGrid(90_000, paid, undefined, order);
      expect(grid).toHaveLength(9);
      expect(grid.filter((r) => r.paye)).toHaveLength(expected);
    }
    // Pureté : entrée non mutée
    const src = [...CASY_MONTHS];
    resolveImputationOrder(src, order);
    expect(src).toEqual([...CASY_MONTHS]);
  });

  it('N=0 → aucun coché ; N=9 (payé=annuel) → tous cochés, 4 ordres', () => {
    for (const order of ORDERS) {
      expect(buildCasyMonthlyGrid(90_000, 0, undefined, order).filter((r) => r.paye)).toHaveLength(0);
      expect(buildCasyMonthlyGrid(90_000, 90_000, undefined, order).filter((r) => r.paye)).toHaveLength(9);
    }
  });

  it('sur-paiement (payé > annuel) → capé à 9', () => {
    for (const order of ORDERS) {
      expect(buildCasyMonthlyGrid(90_000, 999_999, undefined, order).filter((r) => r.paye)).toHaveLength(9);
    }
  });

  it('montants 0/négatifs/énormes/NaN : jamais de crash, jamais de coché fantôme', () => {
    expect(buildCasyMonthlyGrid(0, 0).filter((r) => r.paye)).toHaveLength(0);
    expect(buildCasyMonthlyGrid(0, 0).every((r) => r.montant === 0)).toBe(true);
    expect(buildCasyMonthlyGrid(-5000, -1000).filter((r) => r.paye)).toHaveLength(0);
    const huge = buildCasyMonthlyGrid(9_000_000, 9_000_000);
    expect(huge).toHaveLength(9);
    expect(huge.filter((r) => r.paye)).toHaveLength(9);
    // MAX_SAFE_INTEGER : précision flottante → 8 ou 9 cochés, jamais de crash
    const maxSafe = buildCasyMonthlyGrid(Number.MAX_SAFE_INTEGER, Number.MAX_SAFE_INTEGER);
    expect(maxSafe).toHaveLength(9);
    expect(maxSafe.filter((r) => r.paye).length).toBeGreaterThanOrEqual(8);
    const nan = buildCasyMonthlyGrid(NaN, NaN);
    expect(nan).toHaveLength(9);
    expect(nan.filter((r) => r.paye)).toHaveLength(0);
    const inf = buildCasyMonthlyGrid(Infinity, Infinity);
    expect(inf).toHaveLength(9);
    const tr0 = buildCasyTranchesFallback(0, 0);
    expect(tr0.reduce((a, t) => a + t.montant, 0)).toBe(0);
    const trNeg = buildCasyTranchesFallback(-1000, -500);
    expect(trNeg).toHaveLength(3);
    const marked = markTranchesPaid([{ nom: 'T1', montant: 0 }], 0);
    expect(marked[0].statut).toBe('Payé');
  });

  it('XSS : script/img/event/quote échappés partout', () => {
    const html = buildCasyReceiptHtml(
      baseInput({
        schoolName: '<script>alert(1)</script>',
        prenomsNom: '<img src=x onerror=alert(1)>',
        matricule: '" onmouseover="alert(2)',
        caissier: "<svg onload=alert(3)>",
        numero: '<b>bold</b>',
      }),
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('<img src=x onerror');
    expect(html).not.toContain('<svg onload');
    expect(html).not.toContain('<b>bold</b>');
    expect(html).toContain('&lt;script&gt;');
    expect(html).toContain('&quot;');
  });

  it('heading dynamique : FIRST_FIRST canonique, autres abrégés, vide repli', () => {
    expect(monthlyHeadingFor([...CASY_MONTHS])).toBe('Paiement mensuel — Octobre à Juin');
    expect(monthlyHeadingFor([])).toBe('Paiement mensuel — Octobre à Juin');
    for (const order of ORDERS.slice(1)) {
      const ordered = resolveImputationOrder([...CASY_MONTHS], order);
      const h = monthlyHeadingFor(ordered);
      expect(h).toContain('Paiement mensuel —');
      expect(h).not.toBe('Paiement mensuel — Octobre à Juin');
    }
    const lastFirst = resolveImputationOrder([...CASY_MONTHS], 'LAST_FIRST');
    expect(monthlyHeadingFor(lastFirst)).toContain('Jui');
  });

  it('html reflète ordre LAST_FIRST : Juin coché en premier', () => {
    const monthly = buildCasyMonthlyGrid(90_000, 10_000, undefined, 'LAST_FIRST');
    expect(monthly[0]).toMatchObject({ mois: 'Juin', paye: true });
    const html = buildCasyReceiptHtml(baseInput({ monthly, monthlyCells: monthly.map(() => '10 000 GNF') }));
    expect(html).toContain('Juin');
    expect(html).toContain('is-paid');
  });

  it('maskRef bords : vide → —, court → 2***, XSS masquée', () => {
    expect(maskRef('')).toBe('—');
    expect(maskRef(null)).toBe('—');
    expect(maskRef('AB')).toBe('AB***');
    expect(maskRef('<script>')).not.toContain('<script>');
  });
});
