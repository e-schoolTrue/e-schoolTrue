import { Repository } from "typeorm";
import { AuditLogEntity, AuditAction } from "../entities/audit-log";
import { AppDataSource } from "../../data-source";
import { logger } from "../utils/logger";

const AUDIT_RETENTION_DAYS = 365;
const AUDIT_MAX_ROWS = 100_000;

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
    private repo: Repository<AuditLogEntity>;

    constructor() {
        this.repo = AppDataSource.getInstance().getRepository(AuditLogEntity);
    }

    async record(input: AuditRecordInput): Promise<void> {
        const entry = this.repo.create({
            actorId: input.actor?.id ?? null,
            actorUsername: input.actor?.username ?? 'système',
            actorRole: input.actor?.role ?? null,
            action: input.action,
            targetEntity: input.targetEntity,
            targetId: input.targetId != null ? String(input.targetId) : null,
            summary: input.summary,
            diff: input.diff ?? null,
            metadata: input.metadata ?? null
        });
        await this.repo.save(entry);
    }

    async list(params: AuditListParams): Promise<{ items: AuditLogEntity[]; total: number }> {
        const page = params.page ?? 1;
        const pageSize = params.pageSize ?? 20;
        const filters = params.filters ?? {};

        const qb = this.repo.createQueryBuilder('audit_log');
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
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - AUDIT_RETENTION_DAYS);
            await this.repo.createQueryBuilder()
                .delete()
                .where('createdAt < :cutoff', { cutoff: toSqliteDate(cutoff) })
                .execute();

            const total = await this.repo.count();
            if (total > AUDIT_MAX_ROWS) {
                const excess = total - AUDIT_MAX_ROWS;
                const oldest = await this.repo.createQueryBuilder()
                    .orderBy('id', 'ASC')
                    .limit(excess)
                    .getMany();
                if (oldest.length > 0) {
                    await this.repo.remove(oldest);
                }
            }

            logger.info(`[AuditLogService] Nettoyage effectué (rétention ${AUDIT_RETENTION_DAYS}j, max ${AUDIT_MAX_ROWS} lignes).`);
        } catch (error) {
            logger.error('[AuditLogService] Erreur lors du nettoyage des journaux d\'audit:', error);
        }
    }
}