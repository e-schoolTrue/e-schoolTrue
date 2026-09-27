/** Utilitaires année scolaire canonique YYYY-YYYY (YearRepartition = source). */

const CANON_RE = /^(\d{4})-(\d{4})$/;

export function isCanonicalSchoolYear(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const m = CANON_RE.exec(v.trim());
  if (!m) return false;
  return Number(m[2]) === Number(m[1]) + 1;
}

/** "2025-2026" -> "2026-2027". Retourne null si non parsable. */
export function nextSchoolYear(current: string): string | null {
  const m = CANON_RE.exec(String(current ?? "").trim());
  if (!m) return null;
  const a = Number(m[1]) + 1;
  return `${a}-${a + 1}`;
}

/** Année scolaire canonique contenant `at` (mois>=9 => N-N+1 sinon N-1-N). */
export function canonicalForDate(at: Date = new Date()): string {
  const y = at.getFullYear();
  const mo = at.getMonth(); // 0-11
  return mo >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
}

/**
 * Normalise une valeur d'année vers le canon YYYY-YYYY.
 * - canonique valide => telle quelle (trim).
 * - civile "2026" => scolaire via règle mois>=9 (refDate, défaut now).
 * - "2025/2026", "2025 – 2026" => "2025-2026" si cohérent.
 * - sinon => null.
 */
export function normalizeSchoolYear(raw: unknown, refDate: Date = new Date()): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s) return null;
  if (isCanonicalSchoolYear(s)) return s;
  const civil = /^(\d{4})$/.exec(s);
  if (civil) {
    const y = Number(civil[1]);
    const mo = refDate.getMonth();
    return mo >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  }
  const m = /^(\d{4})\s*[/\-–—]\s*(\d{4}|\d{2})$/.exec(s);
  if (m) {
    const a = Number(m[1]);
    let b = Number(m[2]);
    if (m[2].length === 2) b = Math.floor(a / 100) * 100 + b;
    if (b === a + 1) return `${a}-${b}`;
    return null;
  }
  return null;
}

/** Différence en mois calendaires entre deux dates (fin - début). */
export function monthsBetween(from: Date, to: Date): number {
  return (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
}

/**
 * Extrait l'année civile de début depuis une valeur d'année.
 * - "2026-2027" -> "2026" ; "2026" -> "2026" ; sinon null.
 * Rétro-compat legacy : les lignes historiques stockent parfois '2026' au lieu du canon.
 */
export function civilYearFromSchoolYear(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  if (!s) return null;
  const canon = CANON_RE.exec(s);
  if (canon) return canon[1];
  const civil = /^(\d{4})$/.exec(s);
  if (civil) return civil[1];
  return null;
}

/**
 * Valeurs à matcher pour un filtre année (canon + civil), sans doublon.
 * - filtre '2026' (civil) -> ['<canon-normalisé>', '2026']
 * - filtre '2026-2027' (canon) -> ['2026-2027', '2026']
 * - filtre non normalisable -> ['<raw-trim>']
 * L'ordre préserve canon en premier (index existants sur schoolYear inchangés).
 */
export function schoolYearMatchValues(raw: unknown, refDate: Date = new Date()): string[] {
  const out: string[] = [];
  const push = (v: string | null | undefined) => {
    if (v == null) return;
    const t = String(v).trim();
    if (t && !out.includes(t)) out.push(t);
  };
  const canon = normalizeSchoolYear(raw, refDate);
  if (canon) {
    push(canon);
    push(civilYearFromSchoolYear(canon));
    push(typeof raw === "string" ? raw : null);
  } else if (raw != null) {
    push(String(raw).trim());
  }
  return out;
}

/**
 * Prédicat mémoire rétro-compatible : true si `stored` est vide (legacy sans année)
 * ou égale au canon ou à sa civile.
 * - matchesSchoolYearValue('2026', '2026-2027') -> true
 * - matchesSchoolYearValue('2026-2027', '2026-2027') -> true
 * - matchesSchoolYearValue(undefined, '2026-2027') -> true (conservé : lignes sans année)
 */
export function matchesSchoolYearValue(stored: unknown, canon: string): boolean {
  if (stored == null) return true;
  const s = String(stored).trim();
  if (!s) return true;
  if (s === canon) return true;
  const civil = civilYearFromSchoolYear(canon);
  if (civil && s === civil) return true;
  // Repli : la valeur stockée est elle-même une civile équivalente au canon
  // (ex. stocké '2026-2027' vs canon '2026-2027' déjà couvert ; stocké '2026/2027' rare).
  const normStored = normalizeSchoolYear(s);
  if (normStored && normStored === canon) return true;
  return false;
}
