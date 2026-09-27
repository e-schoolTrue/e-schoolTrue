import * as bcrypt from "bcryptjs";
import { AppDataSource } from "../../data-source";
import { UserEntity } from "../entities/user";

/**
 * Vérification comptable adossée UNIQUEMENT au MOT DE PASSE DE CONNEXION
 * de l'utilisateur courant — plus de mot de passe comptable séparé, plus de vault.
 *
 * - `verify(password)` compare via `bcrypt.compare(password, currentUser.password)`
 *   lu depuis `UserEntity` (colonne `password`). Tout utilisateur actif possède
 *   déjà un mot de passe : le cas `NO_SECRET_SET` n'existe plus en pratique
 *   (conservé uniquement comme garde-fou si le compte n'a aucun hash).
 * - STRICT : CHAQUE écriture comptable exige une preuve < 60 s.
 *   Plus de réutilisation d'unlock 8 min : TTL aligné sur la fenêtre
 *   fraîche (60 s) + consommation single-use après chaque requireUnlock.
 * - Throttling par utilisateur : 5 tentatives max, verrou 5 min + backoff
 *   exponentiel + jitter (mémoire volatile, par session — aucun secret persisté ici).
 * - Le secret en clair n'est JAMAIS loggé ni persisté ; audit sans secret.
 * - `setInitial` / `change` / `resetByAdmin` sont devenus inutiles :
 *   ils échouent avec `NON_REQUIS` (la rotation se fait via le compte utilisateur).
 * - Lectures (dashboard/repartition/impayes/list/day/movements/hours)
 *   restent sans mot de passe.
 */

export const ACCOUNTING_VAULT_ID = 1; // Conservé pour compatibilité (audit historique). Plus aucune table lue/écrite.
export const ACCOUNTING_UNLOCK_TTL_MS = 60 * 1000; // 60 s — aligné sur la fenêtre fraîche, plus de unlock 8 min réutilisé
export const ACCOUNTING_FRESH_MS = 60 * 1000; // 60 s
export const ACCOUNTING_MAX_ATTEMPTS = 5;
export const ACCOUNTING_LOCK_BASE_MS = 5 * 60 * 1000; // 5 min

interface UnlockEntry {
    expiresAt: number;
    lastVerifyAt: number;
}

interface ThrottleEntry {
    failedAttempts: number;
    lockedUntil: number;
}

interface ActorSnapshot {
    id?: number | null;
    username?: string | null;
    role?: string | null;
    displayName?: string | null;
}

const ok = (data: unknown = null, message = "OK") => ({ success: true as const, data, message, error: null as string | null });
const fail = (error: string, message: string, data: unknown = null) => ({ success: false as const, data, message, error });

const NON_REQUIS_MESSAGE =
    "Non requis : la comptabilité utilise le mot de passe de connexion de l'utilisateur courant. Aucun mot de passe comptable séparé à définir.";

export class AccountingAuthService {
    /** Mémoire volatile : aucun unlock ne survit à un redémarrage. Clé = id utilisateur. */
    private unlocks = new Map<number, UnlockEntry>();
    /** Throttling volatile par utilisateur (5 tentatives + verrou 5 min). */
    private throttle = new Map<number, ThrottleEntry>();

    private actor(): ActorSnapshot | null {
        try {
            const u = (global as any).authService?.getCurrentUser?.();
            if (u && typeof u.then === "function") return null;
            return u ? { id: u.id ?? null, username: u.username ?? null, role: u.role ?? null, displayName: u.displayName ?? null } : null;
        } catch {
            return null;
        }
    }

    private async currentActor(): Promise<ActorSnapshot | null> {
        try {
            const u = await (global as any).authService?.getCurrentUser?.();
            return u ? { id: u.id ?? null, username: u.username ?? null, role: u.role ?? null, displayName: u.displayName ?? null } : null;
        } catch {
            return null;
        }
    }

    private async currentUserRow(userId: number): Promise<UserEntity | null> {
        try {
            return await AppDataSource.getInstance().getRepository(UserEntity).findOne({ where: { id: userId } });
        } catch {
            return null;
        }
    }

    private audit(action: "accounting_unlock" | "accounting_lock", summary: string, metadata?: Record<string, unknown>, actor?: ActorSnapshot | null): void {
        try {
            void (global as any).auditLogService?.record({
                action,
                targetEntity: "AccountingVault",
                targetId: ACCOUNTING_VAULT_ID,
                summary,
                metadata,
                // Ne JAMAIS logger le secret : résumé + métadonnées techniques uniquement.
                actor: actor ?? null
            });
        } catch (e) {
            console.warn("[AccountingAuth] Échec audit:", e);
        }
    }

    private throttleOf(userId: number): ThrottleEntry {
        let entry = this.throttle.get(userId);
        if (!entry) {
            entry = { failedAttempts: 0, lockedUntil: 0 };
            this.throttle.set(userId, entry);
        }
        return entry;
    }

    private computeLockMs(failedAttempts: number): number {
        // Backoff exponentiel à partir de la base 5 min + jitter ±10 %.
        const exp = Math.max(0, failedAttempts - ACCOUNTING_MAX_ATTEMPTS);
        const jitter = 0.9 + Math.random() * 0.2;
        return Math.round(ACCOUNTING_LOCK_BASE_MS * Math.pow(2, exp) * jitter);
    }

    private recordFailure(userId: number, actor: ActorSnapshot | null): { locked: boolean; retryAfterMs: number } {
        const entry = this.throttleOf(userId);
        entry.failedAttempts += 1;
        let retryAfterMs = 0;
        let locked = false;
        if (entry.failedAttempts >= ACCOUNTING_MAX_ATTEMPTS) {
            const lockMs = this.computeLockMs(entry.failedAttempts);
            entry.lockedUntil = Date.now() + lockMs;
            retryAfterMs = lockMs;
            locked = true;
        }
        this.audit("accounting_lock", locked
            ? `Comptabilité : ${entry.failedAttempts} échecs — vérification verrouillée pour ${actor?.username ?? "utilisateur"}`
            : `Comptabilité : tentative échouée (${entry.failedAttempts}/${ACCOUNTING_MAX_ATTEMPTS}) pour ${actor?.username ?? "utilisateur"}`,
            { failedAttempts: entry.failedAttempts, locked }, actor);
        return { locked, retryAfterMs };
    }

    private recordSuccess(userId: number): void {
        const entry = this.throttleOf(userId);
        entry.failedAttempts = 0;
        entry.lockedUntil = 0;
    }

    private grantUnlock(userId: number, actor: ActorSnapshot | null): void {
        const now = Date.now();
        this.unlocks.set(userId, { expiresAt: now + ACCOUNTING_UNLOCK_TTL_MS, lastVerifyAt: now });
        this.audit("accounting_unlock", `Comptabilité déverrouillée pour 60 s (preuve single-use) par ${actor?.username ?? "utilisateur"}`, { ttlMs: ACCOUNTING_UNLOCK_TTL_MS }, actor);
    }

    /**
     * Vérifie le MOT DE PASSE DE CONNEXION de l'utilisateur courant
     * (`bcrypt.compare(password, UserEntity.password)`) ; en cas de succès,
     * (ré)arme une preuve 60 s single-use.
     */
    async verify(secret: string): Promise<{ success: boolean; data: unknown; message: string; error: string | null }> {
        const actor = await this.currentActor();
        const userId = actor?.id ?? null;
        if (userId == null) return fail("UNAUTHENTICATED", "Session requise. Veuillez vous reconnecter.");
        if (!secret || typeof secret !== "string") return fail("INVALID_SECRET", "Mot de passe de connexion requis.");
        const th = this.throttleOf(userId);
        if (th.lockedUntil > Date.now()) {
            return fail("ACCOUNTING_LOCKED", "Trop de tentatives. Veuillez réessayer plus tard.", { retryAfterMs: th.lockedUntil - Date.now() });
        }
        const user = await this.currentUserRow(userId);
        if (!user) return fail("UNAUTHENTICATED", "Session requise. Veuillez vous reconnecter.");
        if (user.isActive === false) return fail("ACCOUNT_DISABLED", "Compte désactivé. Contactez l'administrateur.");
        // Garde-fou quasi impossible : tout utilisateur actif possède un mot de passe.
        if (!user.password) return fail("NO_SECRET_SET", "Ce compte n'a pas de mot de passe de connexion. Contactez un administrateur.", { setupRequired: true });
        let match = false;
        try {
            match = await bcrypt.compare(secret, user.password);
        } catch {
            match = false;
        }
        if (!match) {
            const { locked, retryAfterMs } = this.recordFailure(userId, actor);
            return locked
                ? fail("ACCOUNTING_LOCKED", "Trop de tentatives. Vérification temporairement verrouillée.", { retryAfterMs })
                : fail("INVALID_SECRET", "Mot de passe de connexion incorrect.", { attemptsLeft: Math.max(0, ACCOUNTING_MAX_ATTEMPTS - th.failedAttempts) });
        }
        this.recordSuccess(userId);
        this.grantUnlock(userId, actor);
        return ok({ unlocked: true, expiresInMs: ACCOUNTING_UNLOCK_TTL_MS }, "Comptabilité déverrouillée.");
    }

    /** Devenu inutile : aucun secret séparé à définir. Échoue avec NON_REQUIS. */
    async setInitial(_secret: string, _actorId?: number | null): Promise<{ success: boolean; data: unknown; message: string; error: string | null }> {
        return fail("NON_REQUIS", NON_REQUIS_MESSAGE);
    }

    /** Devenu inutile : la rotation se fait via le mot de passe du compte. Échoue avec NON_REQUIS. */
    async change(_oldSecret: string, _newSecret: string): Promise<{ success: boolean; data: unknown; message: string; error: string | null }> {
        return fail("NON_REQUIS", NON_REQUIS_MESSAGE);
    }

    /** Devenu inutile : la réinitialisation se fait via l'administration des comptes. Échoue avec NON_REQUIS. */
    async resetByAdmin(_newSecret: string, _adminId?: number | null): Promise<{ success: boolean; data: unknown; message: string; error: string | null }> {
        return fail("NON_REQUIS", NON_REQUIS_MESSAGE);
    }

    /** Verrouillage manuel (purge la preuve mémoire de l'utilisateur courant). */
    lock(): { success: boolean; data: unknown; message: string; error: string | null } {
        const a = this.actor();
        let had = false;
        if (a?.id != null) {
            had = this.unlocks.delete(a.id);
        } else {
            had = this.unlocks.size > 0;
            this.unlocks.clear();
        }
        this.audit("accounting_lock", "Comptabilité verrouillée manuellement", { hadUnlock: had }, a);
        return ok(null, "Comptabilité verrouillée.");
    }

    /** Purge les preuves (appelée au logout — ne touche ni aux comptes ni au throttling). */
    clearUnlock(): void {
        this.unlocks.clear();
    }

    /**
     * STRICT : true uniquement si une preuve < 60 s existe en mémoire
     * pour l'utilisateur courant. Plus de unlock 8 min réutilisé — isUnlocked === isFresh.
     */
    isUnlocked(): boolean {
        return this.isFresh();
    }

    /** True si la dernière vérification de l'utilisateur courant date de moins de 60 s. */
    isFresh(): boolean {
        const id = this.actor()?.id ?? null;
        if (id == null) return false;
        const entry = this.unlocks.get(id);
        if (!entry || entry.expiresAt <= Date.now()) return false;
        return (Date.now() - entry.lastVerifyAt) <= ACCOUNTING_FRESH_MS;
    }

    /**
     * Garde fail-closed appelée par security.protectedHandle.
     * STRICT : TOUTES les écritures compta exigent une preuve < 60 s
     * single-use (purge après chaque usage) du MOT DE PASSE DE CONNEXION
     * de l'utilisateur courant. Throw ACCOUNTING_LOCKED /
     * ACCOUNTING_FRESH_REQUIRED. Lectures non concernées
     * (elles n'appellent pas cette garde).
     */
    async requireUnlock(_opts?: { fresh?: boolean }): Promise<void> {
        const actor = await this.currentActor();
        const userId = actor?.id ?? null;
        // Fail-closed : sans session, aucune écriture.
        if (userId == null) {
            throw new Error("ACCOUNTING_LOCKED");
        }
        const user = await this.currentUserRow(userId);
        if (!user || user.isActive === false) {
            this.unlocks.delete(userId);
            throw new Error("ACCOUNTING_LOCKED");
        }
        // Garde-fou quasi impossible : tout utilisateur actif possède un mot de passe.
        if (!user.password) {
            throw new Error("NO_SECRET_SET");
        }
        const th = this.throttle.get(userId);
        if (th && th.lockedUntil > Date.now()) {
            throw new Error("ACCOUNTING_LOCKED");
        }
        const entry = this.unlocks.get(userId);
        const now = Date.now();
        if (!entry || entry.expiresAt <= now) {
            if (entry) this.unlocks.delete(userId);
            throw new Error("ACCOUNTING_LOCKED");
        }
        // Fraîcheur obligatoire, même si l'appelant ne passe pas { fresh: true }.
        if ((now - entry.lastVerifyAt) > ACCOUNTING_FRESH_MS) {
            throw new Error("ACCOUNTING_FRESH_REQUIRED");
        }
        // Single-use : purge après chaque écriture autorisée — la prochaine
        // saisie devra re-vérifier le mot de passe.
        this.unlocks.delete(userId);
    }

    /** Statut sûr pour l'UI : jamais de hash, jamais de secret. */
    async getStatus(): Promise<{ isSet: boolean; unlocked: boolean; fresh: boolean; locked: boolean; retryAfterMs: number; failedAttempts: number }> {
        const actor = await this.currentActor().catch(() => null);
        const userId = actor?.id ?? null;
        const now = Date.now();
        const entry = userId != null ? this.unlocks.get(userId) : undefined;
        const unlocked = !!entry && entry.expiresAt > now;
        const th = userId != null ? this.throttle.get(userId) : undefined;
        const lockedUntil = th?.lockedUntil ?? 0;
        let isSet = true;
        if (userId != null) {
            const user = await this.currentUserRow(userId).catch(() => null);
            // Tout utilisateur actif possède un mot de passe ; isSet ne sert
            // qu'au garde-fou "compte sans mot de passe" (quasi impossible).
            isSet = user ? !!user.password : true;
        }
        return {
            isSet,
            unlocked,
            fresh: !!entry && entry.expiresAt > now && (now - entry.lastVerifyAt) <= ACCOUNTING_FRESH_MS,
            locked: lockedUntil > now,
            retryAfterMs: lockedUntil > now ? lockedUntil - now : 0,
            failedAttempts: th?.failedAttempts ?? 0
        };
    }
}

export const accountingAuthService = new AccountingAuthService();
