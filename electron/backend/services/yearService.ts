import { Repository } from "typeorm";
import { YearRepartitionEntity } from "../entities/yearRepartition";
import { AppDataSource } from "../../data-source";
import { ResultType } from "./paymentService";
import { 
    YearRepartition, 
    YearRepartitionCreateInput, 
    YearRepartitionUpdateInput} from "../types/year";
import { canonicalForDate, isCanonicalSchoolYear, monthsBetween, nextSchoolYear, normalizeSchoolYear } from "../lib/schoolYear";

export class YearRepartitionService {
    private yearRepartitionRepository: Repository<YearRepartitionEntity>;

    constructor() {
        this.yearRepartitionRepository = AppDataSource.getInstance().getRepository(YearRepartitionEntity);
    }

    private convertToEntity(data: YearRepartitionCreateInput | YearRepartitionUpdateInput): Partial<YearRepartitionEntity> {
        return {
            schoolYear: data.schoolYear,
            periodConfigurations: data.periodConfigurations?.map(period => ({
                name: period.name,
                start: period.start instanceof Date ? period.start : new Date(period.start),
                end: period.end instanceof Date ? period.end : new Date(period.end)
            })) || []
        };
    }

    private convertToResponse(entity: YearRepartitionEntity): YearRepartition {
        return {
            id: entity.id!,
            schoolYear: entity.schoolYear,
            periodConfigurations: (entity.periodConfigurations || []).map(period => ({
                name: period.name,
                start: period.start,
                end: period.end
            })),
            isCurrent: entity.isCurrent || false,
            status: (entity.status as any) === "closed" ? "closed" : "active",
            closedAt: entity.closedAt ?? null,
            createdAt: entity.createdAt || new Date(),
            updatedAt: entity.updatedAt || new Date()
        };
    }

    async createYearRepartition(data: YearRepartitionCreateInput): Promise<ResultType<YearRepartition>> {
        try {
            const canon = normalizeSchoolYear(data.schoolYear);
            if (!canon) {
                return { success: false, data: null, error: "INVALID_SCHOOL_YEAR", message: "Année scolaire invalide (attendu YYYY-YYYY)" };
            }
            const existing = await this.yearRepartitionRepository.findOne({ where: { schoolYear: canon } });
            if (existing) {
                return { success: false, data: null, error: "DUPLICATE_SCHOOL_YEAR", message: `L'année ${canon} existe déjà` };
            }
            const newYearRepartition = new YearRepartitionEntity();
            Object.assign(newYearRepartition, this.convertToEntity({ ...data, schoolYear: canon }));
            newYearRepartition.status = "active";
            newYearRepartition.closedAt = null;

            const saved = await this.yearRepartitionRepository.save(newYearRepartition);
            return {
                success: true,
                data: this.convertToResponse(saved),
                error: null,
                message: "Répartition d'année scolaire créée avec succès",
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Échec de la création de la répartition d'année scolaire",
            };
        }
    }

    async updateYearRepartition(id: number, data: YearRepartitionUpdateInput): Promise<ResultType<YearRepartition>> {
        try {
            console.log(`Mise à jour de la répartition ${id} avec:`, data);
            
            // Trouver la répartition existante avec toutes ses relations
            const yearRepartition = await this.yearRepartitionRepository.findOneBy({ id });

            if (!yearRepartition) {
                return {
                    success: false,
                    data: null,
                    error: "YearRepartition not found",
                    message: "Répartition d'année scolaire non trouvée",
                };
            }
            
            // Conserver l'état actuel pour le débogage
            console.log('État avant modification:', JSON.stringify(yearRepartition));
            
            // Mettre à jour seulement les champs fournis dans data
            if (data.schoolYear) {
                const canon = normalizeSchoolYear(data.schoolYear);
                if (!canon) {
                    return { success: false, data: null, error: "INVALID_SCHOOL_YEAR", message: "Année scolaire invalide (attendu YYYY-YYYY)" };
                }
                yearRepartition.schoolYear = canon;
            }
            
            // Gérer les périodes séparément pour éviter la création de doublons
            if (data.periodConfigurations && data.periodConfigurations.length > 0) {
                // Remplacer complètement les périodes existantes
                yearRepartition.periodConfigurations = data.periodConfigurations.map(period => ({
                    name: period.name,
                    start: period.start instanceof Date ? period.start : new Date(period.start),
                    end: period.end instanceof Date ? period.end : new Date(period.end)
                }));
            }
            
            console.log('État après modification, avant sauvegarde:', JSON.stringify(yearRepartition));
            
            // Sauvegarder les modifications
            const saved = await this.yearRepartitionRepository.save(yearRepartition);
            console.log('Répartition sauvegardée:', JSON.stringify(saved));
            
            // Vérification après sauvegarde
            const allRepartitions = await this.yearRepartitionRepository.find();
            console.log(`Nombre total de répartitions après mise à jour: ${allRepartitions.length}`);
            
            return {
                success: true,
                data: this.convertToResponse(saved),
                error: null,
                message: "Répartition d'année scolaire mise à jour avec succès",
            };
        } catch (error) {
            console.error("Erreur lors de la mise à jour:", error);
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Échec de la mise à jour de la répartition d'année scolaire",
            };
        }
    }

    async getAllYearRepartitions(): Promise<ResultType<YearRepartition[]>> {
        try {
            const yearRepartitions = await this.yearRepartitionRepository.find();
            
            // Convertir chaque entité en utilisant la méthode convertToResponse
            const convertedRepartitions = yearRepartitions.map(entity => 
                this.convertToResponse(entity)
            );
            
            return {
                success: true,
                data: convertedRepartitions,
                error: null,
                message: "Répartitions récupérées avec succès",
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Échec de la récupération des répartitions d'années scolaires",
            };
        }
    }

    async deleteYearRepartition(id: number): Promise<ResultType<void>> {
        try {
            const result = await this.yearRepartitionRepository.delete(id);

            if (result.affected === 0) {
                return {
                    success: false,
                    data: null,
                    error: "YearRepartition not found",
                    message: "Répartition d'année scolaire non trouvée",
                };
            }

            return {
                success: true,
                data: null,
                error: null,
                message: "Répartition d'année scolaire supprimée avec succès",
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Échec de la suppression de la répartition d'année scolaire",
            };
        }
    }

    async getCurrentYearRepartition(): Promise<ResultType<YearRepartition | null>> {
        try {
            const allRepartitions = await this.yearRepartitionRepository.find();
            
            // Chercher d'abord une répartition marquée comme courante manuellement
            const manuallySetCurrent = allRepartitions.find(repartition => repartition.isCurrent === true);
            if (manuallySetCurrent) {
                return {
                    success: true,
                    data: this.convertToResponse(manuallySetCurrent),
                    error: null,
                    message: "Année scolaire courante trouvée (définie manuellement)"
                };
            }
            
            // Sinon, chercher une répartition basée sur la date actuelle
            const currentDate = new Date();
            const currentRepartition = allRepartitions.find(repartition => {
                const periods = repartition.periodConfigurations;
                if (!periods || periods.length === 0) return false;
                
                const startDate = new Date(periods[0].start);
                const endDate = new Date(periods[periods.length - 1].end);
                
                return currentDate >= startDate && currentDate <= endDate;
            });

            return {
                success: true,
                data: currentRepartition ? this.convertToResponse(currentRepartition) : null,
                error: null,
                message: currentRepartition ? "Année scolaire courante trouvée (basée sur la date)" : "Aucune année scolaire active trouvée"
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Erreur lors de la récupération de l'année scolaire courante"
            };
        }
    }

    async setCurrentYearRepartition(id: number): Promise<ResultType<YearRepartition>> {
        try {
            console.log(`=== setCurrentYearRepartition - Début - ID: ${id} ===`);
            
            // Vérifier si la répartition existe
            const yearRepartition = await this.yearRepartitionRepository.findOne({
                where: { id }
            });

            if (!yearRepartition) {
                console.log(`=== setCurrentYearRepartition - Répartition non trouvée - ID: ${id} ===`);
                return {
                    success: false,
                    data: null,
                    error: "YearRepartition not found",
                    message: "Répartition d'année scolaire non trouvée"
                };
            }

            if ((yearRepartition.status ?? "active") === "closed") {
                return {
                    success: false,
                    data: null,
                    error: "YEAR_CLOSED",
                    message: `L'année ${yearRepartition.schoolYear} est clôturée : activation refusée`
                };
            }
            
            console.log(`=== setCurrentYearRepartition - Répartition trouvée: ${yearRepartition.schoolYear} ===`);

            // Mettre à jour toutes les répartitions pour désactiver l'année courante
            console.log(`=== setCurrentYearRepartition - Désactivation de toutes les répartitions ===`);
            try {
                await this.yearRepartitionRepository
                    .createQueryBuilder()
                    .update()
                    .set({ isCurrent: false })
                    .execute();
                    
                console.log(`=== setCurrentYearRepartition - Toutes les répartitions désactivées ===`);
            } catch (updateError) {
                console.error('Erreur lors de la désactivation des répartitions:', updateError);
                throw updateError;
            }
            
            // Mettre à jour seulement la répartition spécifiée
            console.log(`=== setCurrentYearRepartition - Activation de la répartition ${id} ===`);
            yearRepartition.isCurrent = true;
            
            try {
                const saved = await this.yearRepartitionRepository.save(yearRepartition);
                console.log(`=== setCurrentYearRepartition - Répartition sauvegardée: ${saved.id} ===`);
                
                // Rafraîchir la liste des répartitions pour s'assurer qu'une seule est marquée comme courante
                const allRepartitions = await this.yearRepartitionRepository.find();
                console.log(`=== setCurrentYearRepartition - Nombre total de répartitions: ${allRepartitions.length} ===`);
                
                const currentCount = allRepartitions.filter(rep => rep.isCurrent).length;
                console.log(`=== setCurrentYearRepartition - Nombre de répartitions courantes: ${currentCount} ===`);
                
                if (currentCount > 1) {
                    console.warn(`Multiple current year repartitions found (${currentCount}). Fixing...`);
                    // S'il y a plus d'une répartition marquée comme courante, garder uniquement la dernière
                    for (const rep of allRepartitions) {
                        if (rep.isCurrent && rep.id !== yearRepartition.id) {
                            console.log(`=== setCurrentYearRepartition - Désactivation de la répartition ${rep.id} ===`);
                            rep.isCurrent = false;
                            await this.yearRepartitionRepository.save(rep);
                        }
                    }
                }

                console.log(`=== setCurrentYearRepartition - Succès ===`);
                return {
                    success: true,
                    data: this.convertToResponse(saved),
                    message: "Année scolaire courante définie avec succès",
                    error: null
                };
            } catch (saveError) {
                console.error('Erreur lors de la sauvegarde de la répartition:', saveError);
                throw saveError;
            }
        } catch (error) {
            console.error("=== setCurrentYearRepartition - Erreur globale ===", error);
            return {
                success: false,
                data: null,
                error: error instanceof Error ? error.message : "Erreur inconnue",
                message: "Erreur lors de la définition de l'année scolaire courante"
            };
        }
    }

    async closeYear(id: number): Promise<ResultType<YearRepartition>> {
        try {
            const year = await this.yearRepartitionRepository.findOne({ where: { id } });
            if (!year) return { success: false, data: null, error: "NOT_FOUND", message: "Année scolaire non trouvée" };
            if ((year.status ?? "active") === "closed") {
                return { success: false, data: null, error: "ALREADY_CLOSED", message: `L'année ${year.schoolYear} est déjà clôturée` };
            }
            year.status = "closed";
            year.closedAt = new Date();
            if (year.isCurrent) year.isCurrent = false; // auto-désactive le flag courant
            const saved = await this.yearRepartitionRepository.save(year);
            return { success: true, data: this.convertToResponse(saved), error: null, message: `Année ${year.schoolYear} clôturée` };
        } catch (error) {
            return { success: false, data: null, error: error instanceof Error ? error.message : "Erreur inconnue", message: "Échec de la clôture" };
        }
    }

    async reopenYear(id: number): Promise<ResultType<YearRepartition>> {
        try {
            const year = await this.yearRepartitionRepository.findOne({ where: { id } });
            if (!year) return { success: false, data: null, error: "NOT_FOUND", message: "Année scolaire non trouvée" };
            if ((year.status ?? "active") === "active") {
                return { success: false, data: null, error: "ALREADY_ACTIVE", message: `L'année ${year.schoolYear} est déjà active` };
            }
            year.status = "active";
            year.closedAt = null;
            const saved = await this.yearRepartitionRepository.save(year);
            return { success: true, data: this.convertToResponse(saved), error: null, message: `Année ${year.schoolYear} rouverte` };
        } catch (error) {
            return { success: false, data: null, error: error instanceof Error ? error.message : "Erreur inconnue", message: "Échec de la réouverture" };
        }
    }

    /**
     * Auto-création idempotente : si la fin max des périodes de l'année courante
     * (ou de la plus récente) remonte à >= 9 mois et que N+1 est absent, crée N+1
     * avec les périodes décalées d'1 an (noms conservés). Ne définit jamais isCurrent.
     */
    async ensureSchoolYear(now: Date = new Date()): Promise<ResultType<YearRepartition | null>> {
        try {
            const all = await this.yearRepartitionRepository.find();
            if (!all.length) return { success: true, data: null, error: null, message: "Aucune année existante : création manuelle requise" };
            const current = all.find(r => r.isCurrent) ?? [...all].sort((a, b) => String(b.schoolYear).localeCompare(String(a.schoolYear)))[0];
            const canonCurrent = normalizeSchoolYear(current.schoolYear) ?? current.schoolYear;
            const next = isCanonicalSchoolYear(canonCurrent) ? nextSchoolYear(canonCurrent) : null;
            const fallbackNext = (() => {
                const c = canonicalForDate(now);
                return c === canonCurrent ? nextSchoolYear(c) : c > canonCurrent ? c : nextSchoolYear(canonCurrent);
            })();
            const target = next ?? fallbackNext;
            if (!target) return { success: true, data: null, error: null, message: "Année suivante indéterminée" };
            if (all.some(r => normalizeSchoolYear(r.schoolYear) === target)) {
                return { success: true, data: null, error: null, message: `Année ${target} déjà présente` };
            }
            // Fin max des périodes
            let end: Date | null = null;
            for (const p of current.periodConfigurations || []) {
                const e = new Date((p as any).end);
                if (!Number.isNaN(e.getTime()) && (!end || e > end)) end = e;
            }
            if (!end) return { success: true, data: null, error: null, message: "Périodes sans fin exploitable : auto-création différée" };
            if (monthsBetween(end, now) < 9) {
                return { success: true, data: null, error: null, message: "Seuil 9 mois non atteint" };
            }
            const periods = (current.periodConfigurations || []).map(p => {
                const s = new Date((p as any).start); s.setFullYear(s.getFullYear() + 1);
                const e = new Date((p as any).end); e.setFullYear(e.getFullYear() + 1);
                return { name: (p as any).name, start: s, end: e };
            });
            const entity = new YearRepartitionEntity();
            entity.schoolYear = target;
            entity.periodConfigurations = periods as any;
            entity.isCurrent = false;
            entity.status = "active";
            entity.closedAt = null;
            const saved = await this.yearRepartitionRepository.save(entity);
            return { success: true, data: this.convertToResponse(saved), error: null, message: `Année ${target} auto-créée` };
        } catch (error) {
            return { success: false, data: null, error: error instanceof Error ? error.message : "Erreur inconnue", message: "Échec auto-création année" };
        }
    }

    /**
     * Clone configs-only, transactionnel : payment_configs, payment_annual_config(+tranches+entries),
     * grading_config(+categories), fee_items. Deep-clone (reset id/remote_id, relink grade).
     * Ne clone JAMAIS payments/scholarships/expenses/movements/notes/absences/paie. Exclut school/settings.
     */
    async cloneYearConfigs(opts: { fromId: number; newSchoolYear: string; copyPayment?: boolean; copyTranches?: boolean; copyGrading?: boolean; copyFeeItems?: boolean }): Promise<ResultType<{ schoolYear: string }>> {
        const ds = AppDataSource.getInstance();
        try {
            const canon = normalizeSchoolYear(opts.newSchoolYear);
            if (!canon) return { success: false, data: null, error: "INVALID_SCHOOL_YEAR", message: "newSchoolYear invalide (attendu YYYY-YYYY)" };
            const from = await this.yearRepartitionRepository.findOne({ where: { id: opts.fromId } });
            if (!from) return { success: false, data: null, error: "NOT_FOUND", message: "Année source non trouvée" };
            const fromYear = normalizeSchoolYear(from.schoolYear) ?? from.schoolYear;
            const exists = await this.yearRepartitionRepository.findOne({ where: { schoolYear: canon } });
            if (exists) return { success: false, data: null, error: "DUPLICATE_SCHOOL_YEAR", message: `L'année ${canon} existe déjà` };
            const copyPayment = opts.copyPayment !== false;
            const copyTranches = opts.copyTranches !== false;
            const copyGrading = opts.copyGrading !== false;
            const copyFeeItems = opts.copyFeeItems !== false;

            // B6: traçabilité des fallbacks legacy (findOne SANS schoolYear interdit
            // sauf fallback explicite warn + metadata). Compteurs pour l'audit.
            const fallbackUsage: Record<string, number> = {};
            const noteFallback = (table: string, n: number) => {
                if (n > 0) {
                    fallbackUsage[table] = (fallbackUsage[table] ?? 0) + n;
                    console.warn(`[cloneYearConfigs] fallback legacy ${table}: ${n} ligne(s) sans schoolYear clonée(s) ${fromYear} → ${canon}. Migrer ${table}.schoolYear.`);
                }
            };
            const counts: Record<string, number> = {};
            await ds.transaction(async (m) => {
                const { PaymentConfigEntity, PaymentAnnualConfigEntity, TranchConfigEntity, TrancheEntryEntity } = await import("../entities/paymentConfig");
                const { GradingConfigEntity, EvaluationCategoryEntity } = await import("../entities/configNote");
                const { FeeItemEntity } = await import("../entities/accounting");
                // Année cible
                const yearRepo = m.getRepository(YearRepartitionEntity);
                const target = new YearRepartitionEntity();
                target.schoolYear = canon;
                target.periodConfigurations = (from.periodConfigurations || []).map((p: any) => {
                    const s = new Date(p.start); s.setFullYear(s.getFullYear() + 1);
                    const e = new Date(p.end); e.setFullYear(e.getFullYear() + 1);
                    return { name: p.name, start: s, end: e };
                }) as any;
                target.isCurrent = false;
                target.status = "active";
                target.closedAt = null;
                await yearRepo.save(target);

                if (copyPayment) {
                    // B6: requête canonique stricte ; fallback legacy EXPLICITE.
                    const rows: any[] = await m.getRepository(PaymentConfigEntity as any).find({ where: { schoolYear: fromYear } as any });
                    let effective = rows.filter((r) => !r.schoolYear || normalizeSchoolYear(r.schoolYear) === fromYear);
                    if (!effective.length) {
                        const legacy: any[] = await m.getRepository(PaymentConfigEntity as any).find();
                        const legacyOnly = legacy.filter((r) => !r.schoolYear || normalizeSchoolYear(r.schoolYear) === fromYear);
                        noteFallback("payment_configs", legacyOnly.filter((r) => !r.schoolYear).length);
                        effective = legacyOnly;
                    }
                    counts.payment_configs = effective.length;
                    for (const r of effective) {
                        if (r.schoolYear && normalizeSchoolYear(r.schoolYear) !== fromYear) continue;
                        const { id, remote_id, ...rest } = r;
                        await m.getRepository(PaymentConfigEntity as any).save({ ...rest, schoolYear: canon, remote_id: null } as any);
                    }
                }
                if (copyTranches) {
                    const annuals: any[] = await m.getRepository(PaymentAnnualConfigEntity as any).find({ relations: { tranches: { entries: true } }, where: { schoolYear: fromYear } as any });
                    let effective = annuals.filter((a) => !a.schoolYear || normalizeSchoolYear(a.schoolYear) === fromYear);
                    if (!effective.length) {
                        const all: any[] = await m.getRepository(PaymentAnnualConfigEntity as any).find({ relations: { tranches: { entries: true } } });
                        effective = all.filter((a) => !a.schoolYear || normalizeSchoolYear(a.schoolYear) === fromYear);
                        noteFallback("payment_annual_config", effective.filter((a) => !a.schoolYear).length);
                    }
                    counts.payment_annual_config = effective.length;
                    for (const a of effective) {
                        if (a.schoolYear && normalizeSchoolYear(a.schoolYear) !== fromYear) continue;
                        const { id, remote_id, tranches, grade, ...rest } = a;
                        const savedAnnual: any = await m.getRepository(PaymentAnnualConfigEntity as any).save({ ...rest, schoolYear: canon, remote_id: null, grade: grade ?? undefined } as any);
                        for (const t of tranches ?? []) {
                            const { id: tid, remote_id: tr, entries, paymentAnnualConfig, ...trest } = t;
                            const savedTranch: any = await m.getRepository(TranchConfigEntity as any).save({ ...trest, remote_id: null, paymentAnnualConfig: savedAnnual } as any);
                            for (const e of entries ?? []) {
                                const { id: eid, remote_id: er, tranchConfig, ...erest } = e;
                                await m.getRepository(TrancheEntryEntity as any).save({ ...erest, remote_id: null, tranchConfig: savedTranch } as any);
                            }
                        }
                    }
                }
                if (copyGrading) {
                    const configs: any[] = await m.getRepository(GradingConfigEntity as any).find({ relations: { categories: true }, where: { schoolYear: fromYear } as any });
                    let effective = configs.filter((c) => !c.schoolYear || normalizeSchoolYear(c.schoolYear) === fromYear);
                    if (!effective.length) {
                        const all: any[] = await m.getRepository(GradingConfigEntity as any).find({ relations: { categories: true } });
                        effective = all.filter((c) => !c.schoolYear || normalizeSchoolYear(c.schoolYear) === fromYear);
                        noteFallback("grading_config", effective.filter((c) => !c.schoolYear).length);
                    }
                    counts.grading_config = effective.length;
                    for (const c of effective) {
                        if (c.schoolYear && normalizeSchoolYear(c.schoolYear) !== fromYear) continue;
                        const { id, remote_id, categories, ...rest } = c;
                        const saved: any = await m.getRepository(GradingConfigEntity as any).save({ ...rest, schoolYear: canon, remote_id: null } as any);
                        for (const cat of categories ?? []) {
                            const { id: cid, remote_id: cr, config, ...crest } = cat;
                            await m.getRepository(EvaluationCategoryEntity as any).save({ ...crest, remote_id: null, config: saved } as any);
                        }
                    }
                }
                if (copyFeeItems) {
                    const items: any[] = await m.getRepository(FeeItemEntity as any).find({ where: { schoolYear: fromYear } as any });
                    let effective = items.filter((it) => !it.schoolYear || normalizeSchoolYear(it.schoolYear) === fromYear);
                    if (!effective.length) {
                        const all: any[] = await m.getRepository(FeeItemEntity as any).find();
                        effective = all.filter((it) => !it.schoolYear || normalizeSchoolYear(it.schoolYear) === fromYear);
                        noteFallback("fee_items", effective.filter((it) => !it.schoolYear).length);
                    }
                    counts.fee_items = effective.length;
                    for (const it of effective) {
                        if (it.schoolYear && normalizeSchoolYear(it.schoolYear) !== fromYear) continue;
                        const { id, remote_id, ...rest } = it;
                        await m.getRepository(FeeItemEntity as any).save({ ...rest, schoolYear: canon, remote_id: null } as any);
                    }
                }
            });
            const hasFallback = Object.keys(fallbackUsage).length > 0;
            try {
                await (global as any).auditLogService?.record({
                    action: "create",
                    targetEntity: "YearRepartition",
                    targetId: null,
                    summary: `Clone configs-only ${fromYear} → ${canon}${hasFallback ? " (fallback legacy)" : ""}`,
                    metadata: { fromYear, schoolYear: canon, counts, fallbackUsage },
                    actor: await (global as any).authService?.getCurrentUser?.().then((u: any) => u ? { id: u.id, username: u.username, role: u.role, displayName: u.displayName ?? null } : null).catch(() => null),
                });
            } catch { /* audit best-effort */ }
            return { success: true, data: { schoolYear: canon, counts, fallbackUsage } as any, error: null, message: `Configurations clonées vers ${canon}` };
        } catch (error) {
            return { success: false, data: null, error: error instanceof Error ? error.message : "Erreur inconnue", message: "Échec du clone configs-only" };
        }
    }

    /**
     * B2: aperçu dry-run du clone (year:clone-preview) — compte sans écrire.
     * Retourne { fromYear, newSchoolYear, counts } pour la modale frontend.
     */
    async clonePreview(opts: { fromId: number; newSchoolYear: string }): Promise<ResultType<any>> {
        try {
            const canon = normalizeSchoolYear(opts.newSchoolYear);
            if (!canon) return { success: false, data: null, error: "INVALID_SCHOOL_YEAR", message: "newSchoolYear invalide (attendu YYYY-YYYY)" } as any;
            const from = await this.yearRepartitionRepository.findOne({ where: { id: opts.fromId } });
            if (!from) return { success: false, data: null, error: "NOT_FOUND", message: "Année source non trouvée" } as any;
            const fromYear = normalizeSchoolYear(from.schoolYear) ?? from.schoolYear;
            const ds = AppDataSource.getInstance();
            const { PaymentConfigEntity, PaymentAnnualConfigEntity } = await import("../entities/paymentConfig");
            const { GradingConfigEntity } = await import("../entities/configNote");
            const { FeeItemEntity } = await import("../entities/accounting");
            const countWhere = async (entity: any, extra?: any): Promise<number> => {
                try { return await ds.getRepository(entity as any).count({ where: { schoolYear: fromYear, ...(extra ?? {}) } as any }); }
                catch { return 0; }
            };
            const counts = {
                payment_configs: await countWhere(PaymentConfigEntity),
                payment_annual_config: await countWhere(PaymentAnnualConfigEntity),
                grading_config: await countWhere(GradingConfigEntity),
                fee_items: await countWhere(FeeItemEntity),
            };
            return { success: true, data: { fromYear, newSchoolYear: canon, counts }, error: null, message: `Aperçu clone ${fromYear} → ${canon}` } as any;
        } catch (error) {
            return { success: false, data: null, error: error instanceof Error ? error.message : "Erreur inconnue", message: "Échec aperçu clone" } as any;
        }
    }
}
