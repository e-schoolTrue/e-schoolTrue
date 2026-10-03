/**
 * Niveaux scolaires — socle frontend 3 niveaux.
 *
 * - `PRESCOLAIRE` + `PRIMAIRE` : 3 trimestres.
 * - `SECONDAIRE` : 2 semestres.
 *
 * @remarks
 * Compatible backend legacy : `level` est optionnel partout (`null` = année
 * unique historique, affichée dans l'onglet « Tous » + bannière de migration).
 * Le backend ignore les champs inconnus (`convertToEntity` ne retient que
 * `schoolYear`/`periodConfigurations`) : l'envoi de `level` est donc
 * forward-compatible, la persistance serveur arrive avec la migration
 * `YearLevel1780000000000`.
 */
export type SchoolLevel = 'PRESCOLAIRE' | 'PRIMAIRE' | 'SECONDAIRE';

export const SCHOOL_LEVELS: SchoolLevel[] = ['PRESCOLAIRE', 'PRIMAIRE', 'SECONDAIRE'];

export const SCHOOL_LEVEL_LABELS: Record<SchoolLevel, string> = {
  PRESCOLAIRE: 'Préscolaire',
  PRIMAIRE: 'Primaire',
  SECONDAIRE: 'Secondaire',
};

export type PeriodKind = 'trimester' | 'semester';

/** Badge affiché dans les onglets : « Trimestres » vs « Semestres ». */
export function periodBadgeForLevel(level: SchoolLevel): 'Trimestres' | 'Semestres' {
  return level === 'SECONDAIRE' ? 'Semestres' : 'Trimestres';
}

export function periodKindForLevel(level: SchoolLevel): PeriodKind {
  return level === 'SECONDAIRE' ? 'semester' : 'trimester';
}

export function periodCountForLevel(level: SchoolLevel): number {
  return level === 'SECONDAIRE' ? 2 : 3;
}

export function isSchoolLevel(value: unknown): value is SchoolLevel {
  return value === 'PRESCOLAIRE' || value === 'PRIMAIRE' || value === 'SECONDAIRE';
}

/** Normalise un niveau entrant (formulaire, IPC, localStorage) ; `null` = legacy. */
export function normalizeLevel(value: unknown): SchoolLevel | null {
  if (typeof value !== 'string') return null;
  const v = value.trim().toUpperCase();
  if (v === 'PRESCOLAIRE' || v === 'PRESCHOOL' || v === 'PRE-SCOLAIRE' || v === 'MATERNELLE') return 'PRESCOLAIRE';
  if (v === 'PRIMAIRE' || v === 'PRIMARY' || v === 'PRIMARIE') return 'PRIMAIRE';
  if (v === 'SECONDAIRE' || v === 'SECONDARY') return 'SECONDAIRE';
  return null;
}

/** Mapping type de classe (GradeType backend) → niveau 3-voies. */
export function levelForGradeType(gradeType: unknown): SchoolLevel {
  const v = typeof gradeType === 'string' ? gradeType.trim().toUpperCase() : '';
  if (v === 'SECONDARY' || v === 'SECONDAIRE') return 'SECONDAIRE';
  if (v === 'PRESCOLAIRE' || v === 'PRESCHOOL' || v === 'PRE-SCOLAIRE' || v === 'MATERNELLE') return 'PRESCOLAIRE';
  return 'PRIMAIRE';
}

/** Mapping inverse niveau → GradeType backend (varchar, sans contrainte CHECK). */
export function gradeTypeForLevel(level: SchoolLevel): string {
  if (level === 'SECONDAIRE') return 'SECONDARY';
  if (level === 'PRESCOLAIRE') return 'PRESCOLAIRE';
  return 'PRIMARY';
}

export interface PresetPeriod {
  name: string;
  start: string;
  end: string;
}

function schoolYearBounds(schoolYear: string): { startYear: number; endYear: number } | null {
  const m = /^(\d{4})-(\d{4})$/.exec(schoolYear.trim());
  if (!m) return null;
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (b !== a + 1) return null;
  return { startYear: a, endYear: b };
}

/**
 * Presets de dates par niveau pour un libellé `AAAA-AAAA`.
 *
 * Calendrier scolaire type (septembre → juin) :
 * - Trimestres : T1 02/09/A → 20/12/A · T2 06/01/B → 28/03/B · T3 31/03/B → 30/06/B.
 * - Semestres : S1 02/09/A → 31/01/B · S2 03/02/B → 30/06/B.
 *
 * @param level - Niveau cible (détermine 2 vs 3 périodes).
 * @param schoolYear - Libellé `AAAA-AAAA`. Si incalculable, dates génériques
 *   relatives (placeholders à ajuster dans le formulaire).
 */
export function buildPresetPeriods(level: SchoolLevel, schoolYear: string): PresetPeriod[] {
  const bounds = schoolYearBounds(schoolYear);
  if (periodKindForLevel(level) === 'semester') {
    if (!bounds) {
      return [
        { name: 'Semestre 1', start: '', end: '' },
        { name: 'Semestre 2', start: '', end: '' },
      ];
    }
    const { startYear: a, endYear: b } = bounds;
    return [
      { name: 'Semestre 1', start: `${a}-09-02`, end: `${b}-01-31` },
      { name: 'Semestre 2', start: `${b}-02-03`, end: `${b}-06-30` },
    ];
  }
  if (!bounds) {
    return [
      { name: 'Trimestre 1', start: '', end: '' },
      { name: 'Trimestre 2', start: '', end: '' },
      { name: 'Trimestre 3', start: '', end: '' },
    ];
  }
  const { startYear: a, endYear: b } = bounds;
  return [
    { name: 'Trimestre 1', start: `${a}-09-02`, end: `${a}-12-20` },
    { name: 'Trimestre 2', start: `${b}-01-06`, end: `${b}-03-28` },
    { name: 'Trimestre 3', start: `${b}-03-31`, end: `${b}-06-30` },
  ];
}

/**
 * Adapte les périodes d'une année source (legacy à ventiler) au nombre de
 * périodes du niveau cible, en conservant les dates existantes quand possible.
 *
 * - Même cardinalité : copie + renommage (Trimestre/Semestre N).
 * - Source plus longue : tronque aux N premières (chronologiques).
 * - Source plus courte : complète avec les presets calculés.
 *
 * @example
 * adaptReferencePeriods([{…T1},{…T2},{…T3}], 'SECONDAIRE', '2024-2025')
 * // => 2 semestres calés sur T1→S1, T2+T3 fusionnés→S2 (début T2, fin T3).
 */
export function adaptReferencePeriods(
  source: Array<{ name: string; start: string | Date | null; end: string | Date | null }>,
  level: SchoolLevel,
  schoolYear: string,
): PresetPeriod[] {
  const toISODate = (v: string | Date | null): string => {
    if (!v) return '';
    const d = v instanceof Date ? v : new Date(v);
    if (Number.isNaN(d.getTime())) return typeof v === 'string' ? v.slice(0, 10) : '';
    return d.toISOString().slice(0, 10);
  };
  const sorted = [...source]
    .map((p) => ({ name: p.name, start: toISODate(p.start), end: toISODate(p.end) }))
    .sort((x, y) => x.start.localeCompare(y.start));
  const kind = periodKindForLevel(level);
  const want = periodCountForLevel(level);
  const label = (i: number) => (kind === 'semester' ? `Semestre ${i + 1}` : `Trimestre ${i + 1}`);
  const presets = buildPresetPeriods(level, schoolYear);

  if (sorted.length === want) {
    return sorted.map((p, i) => ({ name: label(i), start: p.start || presets[i].start, end: p.end || presets[i].end }));
  }
  if (sorted.length > want && want === 2 && sorted.length >= 2) {
    // Fusionne tout sauf la 1re période dans le 2e semestre (cas 3T → 2S).
    const tail = sorted.slice(1);
    return [
      { name: label(0), start: sorted[0].start || presets[0].start, end: sorted[0].end || presets[0].end },
      {
        name: label(1),
        start: tail[0].start || presets[1].start,
        end: tail[tail.length - 1].end || presets[1].end,
      },
    ];
  }
  if (sorted.length > want) {
    return sorted.slice(0, want).map((p, i) => ({ name: label(i), start: p.start || presets[i].start, end: p.end || presets[i].end }));
  }
  // Source plus courte : complète avec les presets.
  return Array.from({ length: want }, (_, i) => ({
    name: label(i),
    start: sorted[i]?.start || presets[i].start,
    end: sorted[i]?.end || presets[i].end,
  }));
}
