/**
 * schoolLevel — socle "scope par niveau" (préscolaire / primaire / secondaire).
 *
 * - `SchoolLevel` canonique FR : 'PRESCOLAIRE' | 'PRIMAIRE' | 'SECONDAIRE'.
 * - `normalizeSchoolLevel` accepte les alias EN (PRIMARY/SECONDARY/PRESCHOOL),
 *   la casse/accents/espaces et les variantes usuelles (MATERNELLE, COLLÈGE, LYCÉE).
 * - `periodsForLevel` : 2 périodes en secondaire (Semestre 1-2),
 *   3 en primaire/préscolaire (Trimestre 1-3).
 * - `grade.level` (migration 178) fait foi ; `grade.type` (PRIMARY/SECONDARY)
 *   sert de repli legacy.
 */

export type SchoolLevel = 'PRESCOLAIRE' | 'PRIMAIRE' | 'SECONDAIRE';

export const SCHOOL_LEVELS: readonly SchoolLevel[] = ['PRESCOLAIRE', 'PRIMAIRE', 'SECONDAIRE'] as const;

export const PERIODS_SECONDAIRE: readonly string[] = ['Semestre 1', 'Semestre 2'] as const;
export const PERIODS_PRIMAIRE: readonly string[] = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'] as const;
export const PERIODS_PRESCOLAIRE: readonly string[] = ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'] as const;

function stripAccents(s: string): string {
  try {
    return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  } catch {
    return s;
  }
}

/**
 * Normalise un niveau vers le canon FR. Retourne null si non reconnu
 * (null/undefined/'' => null : scope global/legacy, jamais d'exception).
 */
export function normalizeSchoolLevel(raw: unknown): SchoolLevel | null {
  if (raw == null) return null;
  const s = stripAccents(String(raw).trim().toUpperCase()).replace(/[\s_-]+/g, '');
  if (!s) return null;
  if (s === 'PRESCOLAIRE' || s === 'PRESCOL' || s === 'PRESCHOOL' || s === 'MATERNELLE' || s === 'MATERNEL' || s === 'PRE') return 'PRESCOLAIRE';
  if (s === 'PRIMAIRE' || s === 'PRIMARY' || s === 'PRIMAIR' || s === 'PRIM' || s === 'ECOLEPRIMAIRE' || s === 'ELEMENTAIRE') return 'PRIMAIRE';
  if (s === 'SECONDAIRE' || s === 'SECONDARY' || s === 'SECOND' || s === 'SEC' || s === 'COLLEGE' || s === 'LYCEE' || s === 'SECONDAIR') return 'SECONDAIRE';
  return null;
}

/** Égalité de scope : deux niveaux null = même scope global/legacy. */
export function sameLevel(a: unknown, b: unknown): boolean {
  const na = normalizeSchoolLevel(a);
  const nb = normalizeSchoolLevel(b);
  return na === nb;
}

/**
 * Niveau d'une classe/grade : `grade.level` (migration 178) prioritaire,
 * repli legacy sur `grade.type` (PRIMARY/SECONDARY).
 */
export function levelOfGrade(grade: any): SchoolLevel | null {
  if (!grade || typeof grade !== 'object') return null;
  const direct = normalizeSchoolLevel((grade as any).level);
  if (direct) return direct;
  const t = normalizeSchoolLevel((grade as any).type);
  if (t) return t;
  return null;
}

/** Périodes canoniques d'un niveau (2 en secondaire, 3 sinon). */
export function periodsForLevel(level: unknown): string[] {
  const n = normalizeSchoolLevel(level);
  if (n === 'SECONDAIRE') return [...PERIODS_SECONDAIRE];
  if (n === 'PRESCOLAIRE') return [...PERIODS_PRESCOLAIRE];
  // PRIMAIRE + scope global/legacy (null) : 3 trimestres (compat historique).
  return [...PERIODS_PRIMAIRE];
}

export function periodCountForLevel(level: unknown): number {
  return periodsForLevel(level).length;
}

/**
 * Normalise un nom de période : trim + collapse espaces + casse canonique
 * quand elle matche une période connue (insensible casse/accents).
 * Retourne '' pour entrée vide (jamais null — appelants : fallback explicite).
 */
export function normalizePeriodName(raw: unknown): string {
  if (raw == null) return '';
  const s = String(raw).trim().replace(/\s+/g, ' ');
  if (!s) return '';
  const key = stripAccents(s.toUpperCase());
  const all = [...PERIODS_PRIMAIRE, ...PERIODS_SECONDAIRE];
  for (const p of all) {
    if (stripAccents(p.toUpperCase()) === key) return p;
  }
  // Variante "T1/T2/T3 / S1/S2" -> forme canonique.
  const m = /^T\s*([123])$/.exec(key);
  if (m) return `Trimestre ${m[1]}`;
  const ms = /^S\s*([12])$/.exec(key);
  if (ms) return `Semestre ${ms[1]}`;
  return s;
}

/** Vrai si la période appartient au niveau (comparaison normalisée). */
export function isPeriodForLevel(period: unknown, level: unknown): boolean {
  const p = normalizePeriodName(period);
  if (!p) return false;
  return periodsForLevel(level).some((x) => normalizePeriodName(x) === p);
}

/** Heading FR pour reçus/bulletins/centralisés (niveau de l'élève). */
export function levelHeading(level: unknown): string {
  const n = normalizeSchoolLevel(level);
  if (n === 'PRESCOLAIRE') return 'ÉCOLE PRÉSCOLAIRE';
  if (n === 'PRIMAIRE') return 'ÉCOLE PRIMAIRE';
  if (n === 'SECONDAIRE') return 'ENSEIGNEMENT SECONDAIRE';
  return '';
}

/** Libellé court (selecteurs, logs). */
export function levelLabel(level: unknown): string {
  const n = normalizeSchoolLevel(level);
  if (n === 'PRESCOLAIRE') return 'Préscolaire';
  if (n === 'PRIMAIRE') return 'Primaire';
  if (n === 'SECONDAIRE') return 'Secondaire';
  return 'Tous niveaux';
}
