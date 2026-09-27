import { ipcMain } from 'electron';
import { ROLE } from '#electron/command';
import { AuditAction } from './entities/audit-log';

export type Role = keyof typeof ROLE;

export const ADMIN_ONLY: string[] = [
    "users:",
    "audit:",
    "school:",
    "payment:",
    "grade:",
    "classRoom:",
    "branch:",
    "course:",
    "yearRepartition:",
    "preference:",
    "schedule-config:",
    "gradeConfig:",
    "grade-config:",
    "document-content:"
];

export const PROFESSOR_WRITE: string[] = [
    "absence:",
    "homework:",
    "vacation:",
    "grades:",
    "gradeEntry:",
    "schedule:"
];

export const PROFESSOR_WRITE_EXACT: string[] = [
    "save-student",
    "update-student",
    "delete-student",
    "professor:create",
    "professor:update",
    "professor:delete",
    "professor:payment:create",
    "professor:payment:update"
];

// B1: canaux accessibles au rôle comptable (admin inclus).
// B2: vérification comptable adossée au mot de passe de connexion
//     (verify/lock/status accessibles admin+comptable, jamais de
//     secret ni de hash exposé via ces canaux — statut booléen uniquement).
export const COMPTABLE_ALLOW: string[] = ["payment:", "expense:", "cash:", "comptabilite:", "bank:", "teacher:", "receipt:"];
export const COMPTABLE_AUTH_ALLOW: string[] = ["comptabilite:verifyPassword", "comptabilite:lock", "comptabilite:status"];

export const rolesForChannel = (channel: string): Role[] => {
    // Paiements professeurs (salaires — données sensibles) : allow-list exacte
    // ["admin", "professor", "comptable"] AVANT le match PROFESSOR_WRITE.
    // - Ne pas ajouter "professor:payment:" à COMPTABLE_ALLOW (inopérant car
    //   PROFESSOR_WRITE_EXACT est évalué en premier).
    // - Ne pas restreindre à ["admin","comptable"] seul (casserait le droit
    //   existant de professor en écriture + lecture UI ProfessorPaymentView).
    // - Ne pas élargir à tout "professor:*" (create/update/delete restent admin+professor).
    // - Lectures professor:payments:list / stats alignées sur create/update (deny-by-default).
    if (
        channel === "professor:payment:create" ||
        channel === "professor:payment:update" ||
        channel === "professor:payments:list" ||
        channel === "professor:payments:stats"
    ) {
        return ["admin", "professor", "comptable"];
    }
    if (PROFESSOR_WRITE.some(prefix => channel.startsWith(prefix)) || PROFESSOR_WRITE_EXACT.includes(channel)) {
        return ["admin", "professor"];
    }
    // COMPTABLE_ALLOW AVANT ADMIN_ONLY : "payment:" est dans les deux listes,
    // cet ordre garantit ["admin","comptable"] pour les canaux compta. Ne pas inverser.
    if (COMPTABLE_ALLOW.some(prefix => channel.startsWith(prefix))) {
        return ["admin", "comptable"];
    }
    if (ADMIN_ONLY.some(prefix => channel.startsWith(prefix))) {
        return ["admin"];
    }
    return ["admin"];
};

interface AuditSummarizeResult {
    targetId?: string | number | null;
    summary: string;
    diff?: { before?: unknown; after?: unknown };
    metadata?: Record<string, unknown>;
}

interface ProtectedHandleOptions {
    roles: Role[];
    auth?: 'required' | 'optional';
    /**
     * Garde année scolaire : refuse l'écriture si l'année cible est `closed`
     * (sauf admin + `_forceYearWrite: true`, audité). `true` = extraction
     * générique (payload.schoolYear/school_year, sinon année courante).
     * Fonction = extracteur custom (args applicatifs) -> schoolYear brute.
     * Évaluée AVANT requireAccountingUnlock (fail-closed d'abord l'année).
     */
    requireYearWrite?: boolean | ((args: any[]) => unknown);
    /**
     * Exige la vérification du mot de passe de connexion (utilisateur courant).
     * STRICT : TOUTES les écritures compta exigent une preuve < 60 s
     * single-use. `true` et `{ fresh: true }` sont équivalents (frais
     * obligatoire). Lectures : ne pas renseigner ce champ.
     * Contrôle fail-closed : throw ACCOUNTING_LOCKED /
     * ACCOUNTING_FRESH_REQUIRED.
     */
    requireAccountingUnlock?: boolean | { fresh: boolean };
    audit?: {
        action: AuditAction;
        entity: string;
        before?: (args: any[]) => Promise<unknown> | unknown;
        summarize: (args: any[], result: any, ctx: { actor: any; before: unknown }) => AuditSummarizeResult;
    };
}

/** Résout l'année d'une référence (approve/reject par id) pour la garde année. */
async function resolveYearFromRef(channel: string, payload: any): Promise<string | undefined> {
    try {
        const ds: any = (await import("../data-source")).AppDataSource.getInstance();
        if (!ds?.isInitialized) return undefined;
        const id = Number(payload?.id ?? payload);
        if (channel.startsWith("expense:") && Number.isFinite(id)) {
            const { ExpenseEntity } = await import("./entities/accounting");
            const e: any = await ds.getRepository(ExpenseEntity).findOne({ where: { id } });
            return e?.schoolYear ?? undefined;
        }
        if (channel === "teacher:validate" && Number.isFinite(id)) {
            const { SalarySlipEntity } = await import("./entities/accounting");
            const s: any = await ds.getRepository(SalarySlipEntity).findOne({ where: { id } });
            // month YYYY-MM -> année scolaire approximative (mois>=9 => N-N+1)
            const m: string | undefined = s?.month;
            const mm = /^(\d{4})-(\d{2})$/.exec(String(m ?? ""));
            if (mm) {
                const y = Number(mm[1]); const mo = Number(mm[2]);
                return mo >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
            }
            return undefined;
        }
    } catch { /* best-effort */ }
    return undefined;
}

export function protectedHandle(
    channel: string,
    opts: ProtectedHandleOptions,
    handler: (...args: any[]) => Promise<any> | any
): void {
    ipcMain.handle(channel, async (...args: any[]) => {
        const actor = await global.authService?.getCurrentUser();

        const actorSnapshot = actor
            ? { id: actor.id, username: actor.username, role: actor.role, displayName: actor.displayName ?? null }
            : null;

        // B1 RBAC enforcement: deny by default unless auth is optional.
        const authMode = opts.auth ?? 'required';
        if (authMode !== 'optional') {
            if (!actorSnapshot) {
                throw new Error('UNAUTHENTICATED');
            }
            if (!opts.roles.includes(actorSnapshot.role as Role)) {
                throw new Error(`FORBIDDEN: role ${actorSnapshot.role} not allowed for ${channel}`);
            }
        }

        // B3: garde année scolaire — AVANT le contrôle comptable (fail-closed année d'abord).
        if (opts.requireYearWrite) {
            try {
                const { requireYearWritable, extractYearFromPayload } = await import("./lib/yearGuard");
                const appArgs: any[] = args.slice(1);
                let explicit: unknown;
                let force: unknown;
                if (typeof opts.requireYearWrite === "function") {
                    explicit = (opts.requireYearWrite as (a: any[]) => unknown)(appArgs);
                    const p = appArgs.find((a) => a && typeof a === "object");
                    force = (p as any)?._forceYearWrite;
                } else {
                    // Extraction générique : 1er objet avec schoolYear/school_year,
                    // sinon payload.id (approve/reject -> lookup service), sinon année courante.
                    const obj = appArgs.find((a) => a && typeof a === "object");
                    const ex = extractYearFromPayload(obj);
                    explicit = ex.schoolYear;
                    force = ex.force;
                    if (explicit == null && obj != null) {
                        explicit = await resolveYearFromRef(channel, obj).catch(() => undefined);
                    }
                }
                await requireYearWritable({ schoolYear: explicit, force, actorRole: actorSnapshot?.role });
            } catch (e: any) {
                const raw = String(e?.message ?? "");
                if (/YEAR_CLOSED/.test(raw)) throw e;
                console.error(`[security] yearGuard inattendu sur ${channel}:`, e);
                throw e;
            }
        }

        // B2: garde mot de passe de connexion — APRÈS le contrôle des rôles (fail-closed).
        // Le service vit sur global (initialisé dans main.initializeServices).
        if (opts.requireAccountingUnlock) {
            // STRICT : fraîcheur < 60 s obligatoire sur toutes les écritures,
            // même si l'appelant passe `true` sans `{ fresh: true }`.
            try {
                const svc = (global as any).accountingAuthService;
                // Fail-closed si le service est indisponible : refuser l'écriture.
                if (!svc || typeof svc.requireUnlock !== 'function') {
                    throw new Error('ACCOUNTING_LOCKED');
                }
                await svc.requireUnlock({ fresh: true });
            } catch (e: any) {
                // Fail-closed si le service est indisponible : refuser l'écriture.
                // NOTE : les codes circulent préfixés de détails ("CODE: message") —
                // matcher en includes (pas en égalité stricte) pour ne pas transformer
                // un NO_SECRET_SET / FRESH_REQUIRED en toast générique ACCOUNTING_LOCKED.
                const raw = String(e?.message ?? "");
                if (/ACCOUNTING_LOCKED|ACCOUNTING_FRESH_REQUIRED|FRESH_REQUIRED|NO_SECRET_SET|INVALID_SECRET/.test(raw)) {
                    throw e;
                }
                // Erreur inattendue du garde : log détaillé + refus fail-closed SANS
                // écraser le diagnostic (code conservé en suffixe pour le support).
                console.error(`[security] requireUnlock inattendu sur ${channel}:`, e);
                // NO_SECRET_SET ne survit que comme garde-fou "compte sans mot
                // de passe" (quasi impossible : tout utilisateur actif en a un).
                throw new Error(`ACCOUNTING_LOCKED: ${raw || "vérification comptable indisponible"}`);
            }
        }

        try {
            let before: unknown;
            if (opts.audit?.before) {
                before = await opts.audit.before(args.slice(1));
            }
            const result = await handler(...args);
            if (opts.audit) {
                const ctx = { actor: actorSnapshot, before };
                const isEnvelopeFailure =
                    result &&
                    typeof result === 'object' &&
                    (result as any).success === false;
                try {
                    const info = isEnvelopeFailure
                        ? { targetId: null, summary: `Échec : ${(result as any).error ?? (result as any).message ?? 'Opération refusée'}`, metadata: { status: 'error' } }
                        : opts.audit.summarize(args.slice(1), result, ctx);
                    await global.auditLogService?.record({
                        action: opts.audit.action,
                        targetEntity: opts.audit.entity,
                        targetId: info.targetId ?? null,
                        summary: info.summary,
                        diff: info.diff,
                        metadata: info.metadata,
                        actor: actorSnapshot
                    });
                } catch (auditError) {
                    console.warn(`[Audit] Échec de l'enregistrement pour ${channel}:`, auditError);
                }
            }
            return result;
        } catch (error: any) {
            if (opts.audit) {
                try {
                    await global.auditLogService?.record({
                        action: opts.audit.action,
                        targetEntity: opts.audit.entity,
                        summary: `Échec : ${error?.message ?? String(error)}`,
                        metadata: { status: 'error' },
                        actor: actorSnapshot
                    });
                } catch (auditError) {
                    console.warn(`[Audit] Échec de l'enregistrement de l'erreur pour ${channel}:`, auditError);
                }
            }
            throw error;
        }
    });
}