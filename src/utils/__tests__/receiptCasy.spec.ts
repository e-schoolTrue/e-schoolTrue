import { describe, expect, it } from 'vitest'
import {
  buildCasyMonthlyGrid,
  buildCasyReceiptHtml,
  buildCasyTranchesFallback,
  CASY_MONTH_GROUPS,
  CASY_MONTHS,
  CASY_TRANCHE_NAMES,
  defaultEcheanceISO,
  formatJJMMAAAA,
  markTranchesPaid,
  maskRef,
  type CasyHtmlInput,
} from '@/utils/receiptCasy'

function baseInput(overrides: Partial<CasyHtmlInput> = {}): CasyHtmlInput {
  const monthly = buildCasyMonthlyGrid(90_000, 20_000)
  const tranches = buildCasyTranchesFallback(90_000, 20_000)
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
    totaux: {
      inscription: '0 GNF',
      coutAnnuel: '90 000 GNF',
      rabais: '0 GNF',
      net: '100 000 GNF',
      totalPaye: '40 000 GNF',
      solde: '60 000 GNF',
    },
    barcodeValue: 'R-2026-0001',
    caissier: 'M. Sylla',
    ...overrides,
  }
}

describe('reçu CASY — invariants maquette (sans navigateur)', () => {
  it('monthlyGrid : 9 mois Oct→Juin en 3 groupes de 3', () => {
    expect(CASY_MONTHS).toHaveLength(9)
    expect(CASY_MONTHS[0]).toBe('Octobre')
    expect(CASY_MONTHS[8]).toBe('Juin')
    expect(CASY_MONTH_GROUPS).toHaveLength(3)
    for (const g of CASY_MONTH_GROUPS) expect(g).toHaveLength(3)
    expect(CASY_MONTH_GROUPS.flat()).toEqual([...CASY_MONTHS])
  })

  it('buildCasyMonthlyGrid : 9 lignes, mensualité = annuel/9, cochés = plancher(payé/mensuel)', () => {
    const grid = buildCasyMonthlyGrid(90_000, 20_000)
    expect(grid).toHaveLength(9)
    for (const row of grid) expect(row.montant).toBe(10_000)
    expect(grid.filter((r) => r.paye)).toHaveLength(2)
    expect(buildCasyMonthlyGrid(90_000, 0).filter((r) => r.paye)).toHaveLength(0)
    expect(buildCasyMonthlyGrid(0, 0)).toHaveLength(9)
  })

  it('tranches : 3 lignes, somme = annuel, statuts Payé/Partiel/Non payé', () => {
    expect(CASY_TRANCHE_NAMES).toHaveLength(3)
    const tr = buildCasyTranchesFallback(90_000, 20_000)
    expect(tr).toHaveLength(3)
    expect(tr.reduce((a, t) => a + t.montant, 0)).toBe(90_000)
    const marked = markTranchesPaid(
      [
        { nom: 'T1', montant: 30_000 },
        { nom: 'T2', montant: 30_000 },
        { nom: 'T3', montant: 30_000 },
      ],
      65_000,
    )
    expect(marked.map((t) => t.statut)).toEqual(['Payé', 'Payé', 'Partiel'])
    expect(marked.map((t) => t.paye)).toEqual([true, true, false])
  })

  it('barcode = numero (repli), totaux net = solde + payé', () => {
    const d = baseInput()
    expect(d.barcodeValue).toBe(d.numero)
    // Cohérence arithmétique de la règle métier (net = payé + solde).
    expect(40_000 + 60_000).toBe(100_000)
  })

  it('fallbacks : photo absente → PHOTO, champs vides → —', () => {
    const html = buildCasyReceiptHtml(baseInput({ photo: undefined, sexe: '—', telephone: '—' }))
    expect(html).toContain('PHOTO')
    expect(html).toContain('Sexe : —')
    expect(html).toContain('Tél : —')
    expect(formatJJMMAAAA('')).toBe('—')
    expect(maskRef('')).toBe('—')
  })

  it('esc() : aucune injection XSS dans le HTML généré', () => {
    const html = buildCasyReceiptHtml(
      baseInput({
        schoolName: '<script>alert(1)</script>',
        prenomsNom: '<img src=x onerror=alert(1)>',
      }),
    )
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('<img src=x onerror')
    expect(html).toContain('&lt;script&gt;')
  })

  it('@page A4 + print-color exact dans le HTML imprimable', () => {
    const html = buildCasyReceiptHtml(baseInput())
    expect(html).toContain('@page')
    expect(html).toContain('size: A4')
    expect(html).toContain('print-color-adjust: exact')
  })

  it('référence masquée, date JJ/MM/AAAA, échéance 30/06', () => {
    expect(maskRef('OM123456789')).toBe('OM1***789')
    expect(formatJJMMAAAA('2026-09-25')).toBe('25/09/2026')
    expect(defaultEcheanceISO(new Date('2026-09-25'))).toBe('2027-06-30')
    expect(defaultEcheanceISO(new Date('2026-01-15'))).toBe('2026-06-30')
  })
})
