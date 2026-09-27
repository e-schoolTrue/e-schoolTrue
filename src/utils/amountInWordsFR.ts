import { normalizeCurrencyCode } from '@/components/util/currencyFormatter';

/**
 * Conversion d'un montant en lettres françaises (0 → 999 999 999).
 * Affichage sans décimales : la valeur est arrondie à l'entier.
 *
 * @param value - Montant numérique (décimales ignorées via arrondi).
 * @param currencyCode - Code ISO (XOF, XAF, GNF, MAD...). Défaut XOF.
 * @returns Montant en toutes lettres, ex. "deux cent cinquante mille francs CFA".
 *
 * @example
 * amountInWordsFR(0) // => "zéro franc CFA"
 * amountInWordsFR(250000, 'GNF') // => "deux cent cinquante mille francs guinéens"
 * amountInWordsFR(1000, 'MAD') // => "mille dirhams"
 */
export function amountInWordsFR(value: number, currencyCode: string = 'XOF'): string {
  const code = normalizeCurrencyCode(currencyCode);
  const n = Math.round(Math.abs(value ?? 0));
  const [singular, plural] = labelFor(code);
  if (!Number.isFinite(n)) return `zéro ${singular}`;
  if (n === 0) return `zéro ${singular}`;
  if (n > 999_999_999) return 'montant hors limite';
  const words = convertBelowBillion(n);
  const suffix = n <= 1 ? singular : plural;
  return `${words} ${suffix}`;
}

function labelFor(code: string): [string, string] {
  switch (code) {
    case 'GNF':
      return ['franc guinéen', 'francs guinéens'];
    case 'MAD':
      return ['dirham', 'dirhams'];
    case 'XOF':
    case 'XAF':
      return ['franc CFA', 'francs CFA'];
    case 'EUR':
      return ['euro', 'euros'];
    case 'USD':
      return ['dollar', 'dollars'];
    default:
      return ['franc CFA', 'francs CFA'];
  }
}

/**
 * Formate un montant arrondi + sa version en lettres.
 */
export function formatAmountWithWords(value: number, currencyCode: string = 'XOF'): { digits: string; letters: string } {
  const rounded = Math.round(value ?? 0);
  const digits = new Intl.NumberFormat('fr-FR', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(rounded);
  return { digits, letters: amountInWordsFR(rounded, currencyCode) };
}

const UNITS = [
  'zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept',
  'huit', 'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze',
  'quinze', 'seize', 'dix-sept', 'dix-huit', 'dix-neuf',
];

const TENS = [
  '', '', 'vingt', 'trente', 'quarante', 'cinquante', 'soixante',
  'soixante', 'quatre-vingt', 'quatre-vingt',
];

function convertBelow100(n: number): string {
  if (n < 20) return UNITS[n];
  if (n < 70) {
    const ten = Math.floor(n / 10);
    const rest = n % 10;
    if (rest === 0) return TENS[ten];
    if (rest === 1 && ten !== 8) return `${TENS[ten]}-et-un`;
    return `${TENS[ten]}-${UNITS[rest]}`;
  }
  if (n < 80) {
    // 70 → 79 : soixante-dix, soixante-et-onze, ...
    const rest = n - 60;
    if (n === 71) return 'soixante-et-onze';
    return `soixante-${convertBelow100(rest)}`;
  }
  if (n < 100) {
    // 80 → 99
    const rest = n - 80;
    if (n === 80) return 'quatre-vingts';
    if (rest === 1) return 'quatre-vingt-un';
    return `quatre-vingt-${convertBelow100(rest)}`;
  }
  return '';
}

function convertBelow1000(n: number, devantMille = false): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let head = '';
  let result: string;
  if (hundreds > 0) {
    if (hundreds === 1) head = 'cent';
    else head = `${UNITS[hundreds]} cent${rest === 0 ? 's' : ''}`;
    if (rest === 0) result = head;
    else result = `${head} ${convertBelow100(rest)}`;
  } else {
    result = convertBelow100(rest);
  }
  // Règle FR : « cent » et « vingt » invariables devant « mille »
  // (mais variables devant « million » : « deux cents millions »).
  // Ex. : 300 000 → « trois cent mille », 80 000 → « quatre-vingt mille »,
  // 280 000 → « deux cent quatre-vingt mille ».
  if (devantMille) {
    result = result.replace(/cents$/, 'cent').replace(/vingts$/, 'vingt');
  }
  return result;
}

function convertBelowBillion(n: number): string {
  const millions = Math.floor(n / 1_000_000);
  const afterMillions = n % 1_000_000;
  const thousands = Math.floor(afterMillions / 1000);
  const rest = afterMillions % 1000;
  const parts: string[] = [];
  if (millions > 0) {
    parts.push(millions === 1 ? 'un million' : `${convertBelow1000(millions)} millions`);
  }
  if (thousands > 0) {
    parts.push(thousands === 1 ? 'mille' : `${convertBelow1000(thousands, true)} mille`);
  }
  if (rest > 0 || parts.length === 0) {
    parts.push(convertBelow1000(rest));
  }
  return parts.join(' ');
}
