/**
 * Formattage monétaire multi-devises (codes ISO uniquement).
 * XOF (BCEAO) et XAF (BEAC) sont distincts — jamais de "FCFA" générique.
 */

/** Codes ISO supportés par l'école. */
export type CurrencyCode = 'XOF' | 'XAF' | 'GNF' | 'MAD' | 'EUR' | 'USD';

const ISO_SET: ReadonlySet<string> = new Set(['XOF', 'XAF', 'GNF', 'MAD', 'EUR', 'USD']);

/** Normalise un libellé legacy ("FCFA", "francs", ...) vers un ISO. */
export function normalizeCurrencyCode(input: string | undefined | null): CurrencyCode {
  const v = String(input ?? 'XOF').trim().toUpperCase();
  if (v === 'FCFA' || v === 'F CFA' || v === 'FRANC CFA' || v === 'CFA') return 'XOF';
  if (ISO_SET.has(v)) return v as CurrencyCode;
  return 'XOF';
}

/**
 * Formatte un montant avec Intl.NumberFormat + code ISO.
 *
 * @param value - Montant numérique.
 * @param currency - Code ISO (XOF, XAF, GNF, MAD...). "FCFA" legacy => XOF.
 * @returns Montant formaté fr-FR, ex. "250 000 F CFA".
 */
export function formatCurrency(value: number, currency: string = 'XOF'): string {
  const code = normalizeCurrencyCode(currency);
  if (value == null || Number.isNaN(Number(value))) {
    return `0 ${code}`;
  }
  try {
    return new Intl.NumberFormat('fr-FR', {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value));
  } catch {
    const fallback = new Intl.NumberFormat('fr-FR', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(Number(value));
    return `${fallback} ${code}`;
  }
}

/** Alias sémantique exigé par les vues (snapshot devise au moment de l'export). */
export function formatMoney(value: number, currency: string = 'XOF'): string {
  return formatCurrency(value, currency);
}

/**
 * Formatte un montant avec le symbole FCFA legacy (conservé pour compatibilité).
 * @deprecated Utiliser formatCurrency(value, 'XOF' | 'XAF').
 */
export function formatFCFA(value: number): string {
  return formatCurrency(value, 'XOF');
}

/**
 * Parse un montant formaté pour récupérer la valeur numérique.
 */
export function parseCurrency(formattedValue: string): number {
  const cleaned = String(formattedValue ?? '').replace(/[^\d,.-]/g, '');
  const normalized = cleaned.replace(',', '.');
  return parseFloat(normalized) || 0;
}
