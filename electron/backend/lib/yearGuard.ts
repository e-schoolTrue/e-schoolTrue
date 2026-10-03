import { AppDataSource } from "../../data-source";
import { YearRepartitionEntity } from "../entities/yearRepartition";
import { canonicalForDate, normalizeSchoolYear } from "./schoolYear";

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
export async function findYearBySchoolYear(schoolYear: string): Promise<YearRepartitionEntity | null> {
  try {
    const ds = AppDataSource.getInstance();
    if (!ds.isInitialized) return null;
    const repo = ds.getRepository(YearRepartitionEntity);
    return await repo.findOne({ where: { schoolYear } });
  } catch {
    return null;
  }
}

export interface YearWriteCheck {
  schoolYear?: unknown;
  force?: unknown;
  actorRole?: unknown;
}

/**
 * Vrai s'il existe une année ouverte (isCurrent=true + status active).
 * Faux → mode lecture seule globale (année clôturée sans successeur,
 * ou aucune année courante). Fail-open si DB indisponible (boot).
 */
export async function hasOpenYear(): Promise<boolean> {
  try {
    const ds = AppDataSource.getInstance();
    if (!ds.isInitialized) return true;
    const repo = ds.getRepository(YearRepartitionEntity);
    const cur = await repo.findOne({ where: { isCurrent: true } });
    if (!cur) return false;
    return (cur.status ?? "active") !== "closed";
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
export async function requireYearWritable(check: YearWriteCheck): Promise<{ schoolYear: string; forced: boolean }> {
  const schoolYear = await resolveTargetSchoolYear(check.schoolYear);
  const year = await findYearBySchoolYear(schoolYear);
  const isClosed = (year?.status ?? "active") === "closed";
  if (!isClosed) {
    // Verrou global lecture seule : aucune année ouverte → toute écriture
    // métier refusée (élèves, paiements, comptabilité...). Message préfixé
    // YEAR_CLOSED pour rester compatible `isYearClosedError` frontend.
    if (!(await hasOpenYear())) {
      const isAdmin = check.actorRole === "admin";
      const forceAsked = check.force === true || check.force === "true" || check.force === 1;
      if (isAdmin && forceAsked) {
        try {
          await (global as any).auditLogService?.record({
            action: "update",
            targetEntity: "YearRepartition",
            targetId: (year as any)?.id != null ? String((year as any).id) : null,
            summary: `Écriture forcée sans année ouverte (${schoolYear})`,
            metadata: { forced: true, schoolYear, noOpenYear: true },
            actor: await (global as any).authService?.getCurrentUser?.().then((u: any) =>
              u ? { id: u.id, username: u.username, role: u.role, displayName: u.displayName ?? null } : null).catch(() => null),
          });
        } catch { /* audit best-effort */ }
        return { schoolYear, forced: true };
      }
      throw new YearClosedError(`${schoolYear} (aucune année ouverte — lecture seule)`);
    }
    return { schoolYear, forced: false };
  }
  const isAdmin = check.actorRole === "admin";
  const forceAsked = check.force === true || check.force === "true" || check.force === 1;
  if (isAdmin && forceAsked) {
    try {
      await (global as any).auditLogService?.record({
        action: "update",
        targetEntity: "YearRepartition",
        targetId: (year as any)?.id != null ? String((year as any).id) : null,
        summary: `Écriture forcée sur année clôturée ${schoolYear}`,
        metadata: { forced: true, schoolYear },
        actor: await (global as any).authService?.getCurrentUser?.().then((u: any) =>
          u ? { id: u.id, username: u.username, role: u.role, displayName: u.displayName ?? null } : null).catch(() => null),
      });
    } catch { /* audit best-effort */ }
    return { schoolYear, forced: true };
  }
  throw new YearClosedError(schoolYear);
}

/** Extrait schoolYear + flag force d'un payload IPC arbitraire. */
export function extractYearFromPayload(payload: any): { schoolYear?: unknown; force?: unknown } {
  if (!payload || typeof payload !== "object") return {};
  return {
    schoolYear: payload.schoolYear ?? payload.school_year ?? payload.schoolYearTarget ?? undefined,
    force: payload._forceYearWrite ?? payload.__forceYearWrite ?? undefined,
  };
}
