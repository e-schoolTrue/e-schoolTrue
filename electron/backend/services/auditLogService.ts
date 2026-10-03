import { Repository } from "typeorm";
import { AuditLogEntity, AuditAction } from "../entities/audit-log";
import { AppDataSource } from "../../data-source";
import { logger } from "../utils/logger";

const AUDIT_RETENTION_DAYS = 365;
const AUDIT_MAX_ROWS = 100_000;

/**
 * Fail-soft restore à froid (fix import sauvegarde) :
 * `LocalBackupService.replaceDbAndUploads()` fait `DataSource.destroy()` puis
 * le wrapper audit IPC (`protectedHandle` dans security.ts) tente un `record()`
 * sur connexion fermée → `TypeError: database connection is not open`
 * (Database.prepare → BetterSqlite3QueryRunner → EntityPersistExecutor).
 * `record()` ne doit JAMAIS throw : pendant `isRestoring` ou DB fermée on
 * met en file mémoire bornée (skip silencieux), flush best-effort au prochain
 * `record()`/`init()` une fois la DB rouverte (post-relaunch).
 */
const AUDIT_PENDING_MAX = 100;
const pendingAudits: AuditRecordInput[] = [];

export function isAuditRestoreInProgress(): boolean {
    try {
        const svc = (globalThis as unknown as { localBackupService?: unknown }).localBackupService as
            | { isRestoreInProgress?: () => unknown; isRestoringActive?: unknown; isRestoring?: unknown }
            | undefined;
        if (!svc) return false;
        if (typeof svc.isRestoreInProgress === 'function') {
            try { return !!svc.isRestoreInProgress(); } catch { return false; }
        }
        if (typeof svc.isRestoringActive === 'boolean') return svc.isRestoringActive;
        if (typeof (svc as { isRestoring?: unknown }).isRestoring === 'boolean') {
            return !!svc.isRestoring;
        }
        return false;
    } catch {
        return false;
    }
}

function isAuditDbOpen(): boolean {
    try {
        const ds = AppDataSource.getInstance() as unknown as { isInitialized?: unknown } | undefined;
        // `isInitialized === false` → destroy() post-restore. `undefined` (mocks
        // unitaires) → considéré ouvert pour ne pas casser les tests existants.
        if (!ds) return false;
        if (ds.isInitialized === false) return false;
        return true;
    } catch {
        return false;
    }
}

function toEntryShape(input: AuditRecordInput) {
    return {
        actorId: input.actor?.id ?? null,
        actorUsername: input.actor?.username ?? 'système',
        actorRole: input.actor?.role ?? null,
        action: input.action,
        targetEntity: input.targetEntity,
        targetId: input.targetId != null ? String(input.targetId) : null,
        summary: input.summary,
        diff: input.diff ?? null,
        metadata: input.metadata ?? null,
    };
}

/** File mémoire (bornée) — exposée pour tests. */
export function getPendingAuditCount(): number {
    return pendingAudits.length;
}

/** Vide la file mémoire — tests uniquement. */
export function clearPendingAuditsForTests(): void {
    pendingAudits.length = 0;
}

interface AuditRecordInput {
    action: AuditAction;
    targetEntity: string;
    targetId?: string | number | null;
    summary: string;
    diff?: { before?: unknown; after?: unknown };
    metadata?: Record<string, unknown>;
    actor?: { id: number; username: string; role: string; displayName?: string | null } | null;
}

interface AuditListParams {
    page?: number;
    pageSize?: number;
    filters?: {
        actorUserId?: number;
        action?: string;
        targetEntity?: string;
        from?: string | Date;
        to?: string | Date;
    };
}

function toSqliteDate(value: string | Date): string {
    if (value instanceof Date) {
        const pad = (n: number) => String(n).padStart(2, '0');
        return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
    }
    return value;
}

export class AuditLogService {
    private repo: Repository<AuditLogEntity> | null;

    constructor() {
        // Fail-soft : construit même quand la DB est fermée (post-destroy du
        // restore à froid) — `record()` résout le repo paresseusement.
        try {
            this.repo = AppDataSource.getInstance().getRepository(AuditLogEntity);
        } catch {
            this.repo = null;
        }
    }

    async record(input: AuditRecordInput): Promise<void> {
        // Fail-soft absolu : jamais de throw (le wrapper IPC loggait
        // "[Audit] Échec backup:confirmImport : TypeError database connection
        // is not open"). Pendant isRestoring / DB fermée → file mémoire.
        try {
            if (isAuditRestoreInProgress() || !isAuditDbOpen()) {
                if (pendingAudits.length < AUDIT_PENDING_MAX) pendingAudits.push({ ...input });
                return;
            }
            let repo = this.repo;
            try {
                repo = AppDataSource.getInstance().getRepository(AuditLogEntity);
            } catch {
                repo = this.repo;
            }
            if (!repo) {
                if (pendingAudits.length < AUDIT_PENDING_MAX) pendingAudits.push({ ...input });
                return;
            }
            const entry = repo.create(toEntryShape(input));
            await repo.save(entry);
            // Flush best-effort de la file (post-relaunch) — drop silencieux en échec.
            if (pendingAudits.length > 0 && !isAuditRestoreInProgress() && isAuditDbOpen()) {
                const batch = pendingAudits.splice(0, pendingAudits.length);
                for (const queued of batch) {
                    try {
                        const q = repo.create(toEntryShape(queued));
                        await repo.save(q);
                    } catch { /* drop : l'audit ne doit jamais casser le flux */ }
                }
            }
        } catch {
            try {
                if (pendingAudits.length < AUDIT_PENDING_MAX) pendingAudits.push({ ...input });
            } catch { /* OOM extrême : abandon silencieux */ }
            return;
        }
    }

    async list(params: AuditListParams): Promise<{ items: AuditLogEntity[]; total: number }> {
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 20;
        const filters = params.filters ?? {};

        const repo = this.repo ?? AppDataSource.getInstance().getRepository(AuditLogEntity);
        const qb = repo.createQueryBuilder('audit_log');
        if (filters.actorUserId != null) {
            qb.andWhere('audit_log.actorId = :actorId', { actorId: filters.actorUserId });
        }
        if (filters.action) {
            qb.andWhere('audit_log.action = :action', { action: filters.action });
        }
        if (filters.targetEntity) {
            qb.andWhere('audit_log.targetEntity = :targetEntity', { targetEntity: filters.targetEntity });
        }
        if (filters.from) {
            qb.andWhere('audit_log.createdAt >= :from', { from: toSqliteDate(filters.from) });
        }
        if (filters.to) {
            qb.andWhere('audit_log.createdAt <= :to', { to: toSqliteDate(filters.to) });
        }
        qb.orderBy('audit_log.createdAt', 'DESC').addOrderBy('audit_log.id', 'DESC');
        qb.skip((page - 1) * pageSize).take(pageSize);

        const [items, total] = await qb.getManyAndCount();
        return { items, total };
    }

    async init(): Promise<void> {
        try {
            const repo = this.repo ?? AppDataSource.getInstance().getRepository(AuditLogEntity);
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - AUDIT_RETENTION_DAYS);
            await repo.createQueryBuilder()
                .delete()
                .where('createdAt < :cutoff', { cutoff: toSqliteDate(cutoff) })
                .execute();

            const total = await repo.count();
            if (total > AUDIT_MAX_ROWS) {
                const excess = total - AUDIT_MAX_ROWS;
                const oldest = await repo.createQueryBuilder()
                    .orderBy('id', 'ASC')
                    .limit(excess)
                    .getMany();
                if (oldest.length > 0) {
                    await repo.remove(oldest);
                }
            }

            logger.info(`[AuditLogService] Nettoyage effectué (rétention ${AUDIT_RETENTION_DAYS}j, max ${AUDIT_MAX_ROWS} lignes).`);
        } catch (error) {
            logger.error('[AuditLogService] Erreur lors du nettoyage des journaux d\'audit:', error);
        }
    }
}