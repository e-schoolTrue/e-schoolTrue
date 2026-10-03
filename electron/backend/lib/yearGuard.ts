import { AppDataSource } from "../../data-source";
import { YearRepartitionEntity } from "../entities/yearRepartition";
import { canonicalForDate, normalizeSchoolYear } from "./schoolYear";
import { normalizeSchoolLevel, type SchoolLevel } from "./schoolLevel";

export class YearClosedError extends Error {
  schoolYear: string;
  constructor(schoolYear: string) {
    super(`YEAR_CLOSED: année scolaire ${schoolYear} clôturée (écriture refusée)`);
    this.name = "YearClosedError";
    this.schoolYear = schoolYear;
  }
}

/** Résout l'année cible : payload.schoolYear/school_year normalisée, sinon année courante, sinon canonique du jour. */
export async function resolveTargetSchoolYear(explicit?: unknown): Promise<string> {
  const norm = normalizeSchoolYear(explicit);
  if (norm) return norm;
  try {
    const ds = AppDataSource.getInstance();
    if (ds.isInitialized) {
      const repo = ds.getRepository(YearRepartitionEntity);
      const cur = await repo.findOne({ where: { isCurrent: true } });
      if (cur?.schoolYear) {
        const n = normalizeSchoolYear(cur.schoolYear);
        if (n) return n;
      }
    }
  } catch { /* fallback date */ }
  return canonicalForDate(new Date());
}

/** lookup YearRepartition par schoolYear (normalisée). Retourne null si absente (= année non gérée => écriture autorisée). */
export async function findYearBySchoolYear(schoolYear: string, level?: unknown): Promise<YearRepartitionEntity | null> {
  try {
    const ds = AppDataSource.getInstance();
    if (!ds.isInitialized) return null;
    const repo = ds.getRepository(YearRepartitionEntity);
    const lv = normalizeSchoolLevel(level);
    if (lv) {
      // Scope niveau d'abord, repli global (level NULL/legacy).
      const scoped = await repo.findOne({ where: { schoolYear, level: lv } as any }).catch(() => null);
      if (scoped) return scoped;
      const rows = await repo.find({ where: { schoolYear } as any }).catch(() => []);
      const global = (rows as any[]).find((r) => normalizeSchoolLevel((r as any).level) == null) ?? null;
      return global;
    }
    return await repo.findOne({ where: { schoolYear } });
  } catch {
    return null;
  }
}

/** Résout le niveau cible : payload.level/niveau/schoolLevel normalisé, sinon null (global). */
export function resolveTargetLevel(explicit?: unknown): SchoolLevel | null {
  return normalizeSchoolLevel(explicit);
}

export interface YearWriteCheck {
  schoolYear?: unknown;
  level?: unknown;
  force?: unknown;
  actorRole?: unknown;
}

/**
 * Vrai s'il existe une année ouverte (isCurrent=true + status active).
 * - sans `level` : verrou global historique (n'importe quelle courante ouverte).
 * - avec `level` : lecture seule PAR NIVEAU — vrai si une courante ouverte
 *   existe pour ce niveau OU une courante globale (level NULL/legacy) ouverte.
 * Faux → mode lecture seule (année clôturée sans successeur,
 * ou aucune année courante). Fail-open si DB indisponible (boot).
 */
export async function hasOpenYear(level?: unknown): Promise<boolean> {
  try {
    const ds = AppDataSource.getInstance();
    if (!ds.isInitialized) return true;
    const repo = ds.getRepository(YearRepartitionEntity);
    const lv = normalizeSchoolLevel(level);
    if (!lv) {
      const cur = await repo.findOne({ where: { isCurrent: true } });
      if (!cur) return false;
      return (cur.status ?? "active") !== "closed";
    }
    const rows: any[] = await repo.find({ where: { isCurrent: true } as any }).catch(() => []);
    const scoped = rows.filter((r) => normalizeSchoolLevel((r as any).level) === lv && (r.status ?? "active") !== "closed");
    if (scoped.length) return true;
    const global = rows.filter((r) => normalizeSchoolLevel((r as any).level) == null && (r.status ?? "active") !== "closed");
    if (global.length) return true;
    return false;
  } catch {
    return true;
  }
}

/**
 * Garde d'écriture par année scolaire.
 * - Si l'année cible est `closed` => throw YEAR_CLOSED, sauf (admin && force=true).
 * - Verrou global : si AUCUNE année ouverte (getCurrent null / closed,
 *   après clôture courante sans N+1) => throw YEAR_CLOSED, même si l'année
 *   cible est absente/active. Seules les voies de sortie restent ouvertes :
 *   les canaux `yearRepartition:*` (create/setCurrent/reopen/clone) ne portent
 *   pas `requireYearWrite` et restent autorisés pour lever le verrou.
 * - Année absente ou active + année ouverte => OK.
 * `_forceYearWrite` n'est honoré que si admin (sinon ignoré, log warn côté appelant).
 */
export async function requireYearWritable(check: YearWriteCheck): Promise<{ schoolYear: string; forced: boolean; level?: SchoolLevel | null }> {
  const schoolYear = await resolveTargetSchoolYear(check.schoolYear);
  const level = resolveTargetLevel(check.level);
  const year = await findYearBySchoolYear(schoolYear, level);
  // Fermeture PAR NIVEAU : la ligne du niveau fait foi ; à défaut, la ligne
  // globale (level NULL) ; le verrou global (aucune année ouverte) s'ajoute.
  let scopeClosedYear: YearRepartitionEntity | null = year;
  try {
    const ds = AppDataSource.getInstance();
    if (level && ds.isInitialized) {
      const repo = ds.getRepository(YearRepartitionEntity);
      const scopedRows: any[] = await repo.find({ where: { schoolYear } as any }).catch(() => []);
      const scoped = scopedRows.find((r) => normalizeSchoolLevel((r as any).level) === level) ?? null;
      if (scoped) scopeClosedYear = scoped;
    }
  } catch { /* ignore */ }
  const isClosed = (scopeClosedYear?.status ?? "active") === "closed";
  if (!isClosed) {
    // Verrou lecture seule : aucune année ouverte (globale, ou du niveau si
    // `level` fourni) → toute écriture métier refusée. Message préfixé
    // YEAR_CLOSED pour rester compatible `isYearClosedError` frontend.
    if (!(await hasOpenYear(level ?? undefined))) {
      const isAdmin = check.actorRole === "admin";
      const forceAsked = check.force === true || check.force === "true" || check.force === 1;
      if (isAdmin && forceAsked) {
        try {
          await (global as any).auditLogService?.record({
            action: "update",
            targetEntity: "YearRepartition",
            targetId: (year as any)?.id != null ? String((year as any).id) : null,
            summary: `Écriture forcée sans année ouverte (${schoolYear}${level ? ` / ${level}` : ""})`,
            metadata: { forced: true, schoolYear, level, noOpenYear: true },
            actor: await (global as any).authService?.getCurrentUser?.().then((u: any) =>
              u ? { id: u.id, username: u.username, role: u.role, displayName: u.displayName ?? null } : null).catch(() => null),
          });
        } catch { /* audit best-effort */ }
        return { schoolYear, forced: true, ...(level ? { level } : {}) };
      }
      throw new YearClosedError(`${schoolYear}${level ? ` / ${level}` : ""} (aucune année ouverte — lecture seule)`);
    }
    return { schoolYear, forced: false, ...(level ? { level } : {}) };
  }
  const isAdmin = check.actorRole === "admin";
  const forceAsked = check.force === true || check.force === "true" || check.force === 1;
  if (isAdmin && forceAsked) {
    try {
      await (global as any).auditLogService?.record({
        action: "update",
        targetEntity: "YearRepartition",
        targetId: (year as any)?.id != null ? String((year as any).id) : null,
        summary: `Écriture forcée sur année clôturée ${schoolYear}${level ? ` / ${level}` : ""}`,
        metadata: { forced: true, schoolYear, level },
        actor: await (global as any).authService?.getCurrentUser?.().then((u: any) =>
          u ? { id: u.id, username: u.username, role: u.role, displayName: u.displayName ?? null } : null).catch(() => null),
      });
    } catch { /* audit best-effort */ }
    return { schoolYear, forced: true, ...(level ? { level } : {}) };
  }
  throw new YearClosedError(level ? `${schoolYear} / ${level}` : schoolYear);
}

/** Extrait schoolYear + niveau + flag force d'un payload IPC arbitraire. */
export function extractYearFromPayload(payload: any): { schoolYear?: unknown; level?: unknown; force?: unknown } {
  if (!payload || typeof payload !== "object") return {};
  return {
    schoolYear: payload.schoolYear ?? payload.school_year ?? payload.schoolYearTarget ?? undefined,
    level: payload.level ?? payload.niveau ?? payload.schoolLevel ?? undefined,
    force: payload._forceYearWrite ?? payload.__forceYearWrite ?? undefined,
  };
}

/** Extrait le niveau d'un payload IPC arbitraire (alias lisible). */
export function extractLevelFromPayload(payload: any): unknown {
  if (!payload || typeof payload !== "object") return undefined;
  return (payload as any).level ?? (payload as any).niveau ?? (payload as any).schoolLevel ?? undefined;
}
