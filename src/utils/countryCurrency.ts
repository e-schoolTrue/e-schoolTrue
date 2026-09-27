/**
 * Miroir frontend du référentiel pays → devise (source backend :
 * electron/backend/utils/countryCurrency.ts — garder synchronisé).
 */
export type CountryCode = 'MAR' | 'SEN' | 'CAF' | 'GIN';
export type CurrencyCode = 'MAD' | 'XOF' | 'XAF' | 'GNF';

export interface CountryMeta {
  code: CountryCode;
  display: string;
  currency: CurrencyCode;
  iso: CurrencyCode;
  words: { singular: string; plural: string };
  fractionDigits: number;
}

export const COUNTRY_META: Record<CountryCode, CountryMeta> = {
  MAR: { code: 'MAR', display: 'Maroc', currency: 'MAD', iso: 'MAD', words: { singular: 'dirham', plural: 'dirhams' }, fractionDigits: 2 },
  SEN: { code: 'SEN', display: 'Sénégal', currency: 'XOF', iso: 'XOF', words: { singular: 'franc CFA (BCEAO)', plural: 'francs CFA (BCEAO)' }, fractionDigits: 0 },
  CAF: { code: 'CAF', display: 'Centrafrique', currency: 'XAF', iso: 'XAF', words: { singular: 'franc CFA (BEAC)', plural: 'francs CFA (BEAC)' }, fractionDigits: 0 },
  GIN: { code: 'GIN', display: 'Guinée', currency: 'GNF', iso: 'GNF', words: { singular: 'franc guinéen', plural: 'francs guinéens' }, fractionDigits: 0 },
};

export const COUNTRIES = Object.values(COUNTRY_META).map((m) => ({
  code: m.code,
  name: m.display,
  currency: m.currency,
}));

export function currencyForCountry(country: unknown, fallback: CurrencyCode = 'GNF'): CurrencyCode {
  if (typeof country === 'string' && country in COUNTRY_META) return COUNTRY_META[country as CountryCode].currency;
  return fallback;
}

export const FRACTION_DIGITS: Record<CurrencyCode, number> = { MAD: 2, XOF: 0, XAF: 0, GNF: 0 };

export function fractionDigitsFor(currency: unknown): number {
  if (typeof currency === 'string' && (currency as string) in FRACTION_DIGITS) {
    return FRACTION_DIGITS[currency as CurrencyCode];
  }
  return 0;
}
