/**
 * Référentiel pays → devise, source unique backend.
 * MAR:MAD, SEN:XOF, CAF:XAF, GIN:GNF.
 * Aucun montant en dur, aucune devise en dur hors de ce module.
 */
export type CountryCode = 'MAR' | 'SEN' | 'CAF' | 'GIN';
export type CurrencyCode = 'MAD' | 'XOF' | 'XAF' | 'GNF';

export interface CountryMeta {
  code: CountryCode;
  display: string;
  currency: CurrencyCode;
  /** Code ISO (XOF=BCEAO, XAF=BEAC). */
  iso: CurrencyCode;
  /** Libellé monétaire pour amountInWords. */
  words: { singular: string; plural: string };
  fractionDigits: number;
}

export const COUNTRY_META: Record<CountryCode, CountryMeta> = {
  MAR: { code: 'MAR', display: 'Maroc', currency: 'MAD', iso: 'MAD', words: { singular: 'dirham', plural: 'dirhams' }, fractionDigits: 2 },
  SEN: { code: 'SEN', display: 'Sénégal', currency: 'XOF', iso: 'XOF', words: { singular: 'franc CFA (BCEAO)', plural: 'francs CFA (BCEAO)' }, fractionDigits: 0 },
  CAF: { code: 'CAF', display: 'Centrafrique', currency: 'XAF', iso: 'XAF', words: { singular: 'franc CFA (BEAC)', plural: 'francs CFA (BEAC)' }, fractionDigits: 0 },
  GIN: { code: 'GIN', display: 'Guinée', currency: 'GNF', iso: 'GNF', words: { singular: 'franc guinéen', plural: 'francs guinéens' }, fractionDigits: 0 },
};

export const ALLOWED_COUNTRIES: CountryCode[] = ['MAR', 'SEN', 'CAF', 'GIN'];

export function isCountryCode(v: unknown): v is CountryCode {
  return typeof v === 'string' && (ALLOWED_COUNTRIES as string[]).includes(v);
}

export function currencyForCountry(country: unknown, fallback: CurrencyCode = 'GNF'): CurrencyCode {
  if (isCountryCode(country)) return COUNTRY_META[country].currency;
  return fallback;
}

export function countryMetaFor(country: unknown): CountryMeta {
  if (isCountryCode(country)) return COUNTRY_META[country];
  return COUNTRY_META.GIN;
}

export const FRACTION_DIGITS: Record<CurrencyCode, number> = {
  MAD: 2, XOF: 0, XAF: 0, GNF: 0,
};

export function fractionDigitsFor(currency: unknown): number {
  if (typeof currency === 'string' && currency in FRACTION_DIGITS) {
    return FRACTION_DIGITS[currency as CurrencyCode];
  }
  return 0;
}

/** Arrondi monétaire par devise. Bannit le float : MAD=2 décimales, autres=entier. */
export function roundMoney(value: number, currency: unknown): number {
  const digits = fractionDigitsFor(currency);
  const factor = Math.pow(10, digits);
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error('MONTANT_INVALIDE');
  return Math.round(n * factor) / factor;
}

// --- amountInWords paramétré par devise (0 → 999 999 999) ---
const UNITS = ['zéro','un','deux','trois','quatre','cinq','six','sept','huit','neuf','dix','onze','douze','treize','quatorze','quinze','seize','dix-sept','dix-huit','dix-neuf'];
const TENS = ['','','vingt','trente','quarante','cinquante','soixante','soixante','quatre-vingt','quatre-vingt'];

function convertBelow100(n: number): string {
  if (n < 20) return UNITS[n];
  if (n < 70) {
    const ten = Math.floor(n / 10); const rest = n % 10;
    if (rest === 0) return TENS[ten];
    if (rest === 1 && ten !== 8) return `${TENS[ten]}-et-un`;
    return `${TENS[ten]}-${UNITS[rest]}`;
  }
  if (n < 80) { if (n === 71) return 'soixante-et-onze'; return `soixante-${convertBelow100(n - 60)}`; }
  if (n === 80) return 'quatre-vingts';
  const rest = n - 80;
  if (rest === 1) return 'quatre-vingt-un';
  return `quatre-vingt-${convertBelow100(rest)}`;
}
function convertBelow1000(n: number, devantMille = false): string {
  const hundreds = Math.floor(n / 100); const rest = n % 100;
  let result: string;
  if (hundreds > 0) {
    const head = hundreds === 1 ? 'cent' : `${UNITS[hundreds]} cent${rest === 0 ? 's' : ''}`;
    result = rest === 0 ? head : `${head} ${convertBelow100(rest)}`;
  } else result = convertBelow100(rest);
  if (devantMille) result = result.replace(/cents$/, 'cent').replace(/vingts$/, 'vingt');
  return result;
}
function convertBelowBillion(n: number): string {
  const millions = Math.floor(n / 1_000_000);
  const thousands = Math.floor((n % 1_000_000) / 1000);
  const rest = n % 1000;
  const parts: string[] = [];
  if (millions > 0) parts.push(millions === 1 ? 'un million' : `${convertBelow1000(millions)} millions`);
  if (thousands > 0) parts.push(thousands === 1 ? 'mille' : `${convertBelow1000(thousands, true)} mille`);
  if (rest > 0 || parts.length === 0) parts.push(convertBelow1000(rest));
  return parts.join(' ');
}

function wordsForCurrency(currency: unknown): { singular: string; plural: string } {
  switch (currency) {
    case 'MAD': return COUNTRY_META.MAR.words;
    case 'XOF': return COUNTRY_META.SEN.words;
    case 'XAF': return COUNTRY_META.CAF.words;
    case 'GNF':
    default: return COUNTRY_META.GIN.words;
  }
}

export function amountInWords(value: number, currencyCode: CurrencyCode = 'GNF'): string {
  const digits = fractionDigitsFor(currencyCode);
  const rounded = digits === 2 ? Math.round(Number(value) * 100) / 100 : Math.round(Math.abs(Number(value) ?? 0));
  const w = wordsForCurrency(currencyCode);
  if (!Number.isFinite(rounded)) return `zéro ${w.singular}`;
  if (digits === 2) {
    const intPart = Math.trunc(Math.abs(rounded));
    const cents = Math.round((Math.abs(rounded) - intPart) * 100);
    const intWords = intPart === 0 ? 'zéro' : convertBelowBillion(intPart);
    const suffix = intPart <= 1 && cents === 0 ? w.singular : w.plural;
    if (cents === 0) return `${intWords} ${suffix}`;
    return `${intWords} ${suffix} et ${cents} centimes`;
  }
  const n = Math.round(Math.abs(Number(value) ?? 0));
  if (n > 999_999_999) return 'montant hors limite';
  if (n === 0) return `zéro ${w.singular}`;
  return `${convertBelowBillion(n)} ${n <= 1 ? w.singular : w.plural}`;
}
