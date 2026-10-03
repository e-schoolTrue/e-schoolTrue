import { Repository } from "typeorm";
import { YearRepartitionEntity } from "../entities/yearRepartition";
import { AppDataSource } from "../../data-source";
import { ResultType } from "./paymentService";
import { 
    YearRepartition, 
    YearRepartitionCreateInput, 
    YearRepartitionUpdateInput} from "../types/year";
import { normalizeSchoolYear } from "../lib/schoolYear";

export class YearRepartitionService {
    /**
     * Repository résolu à chaque accès (jamais capturé au constructeur).
     * Après un remplacement à froid (restore/import : destroy + nouveau fichier
     * + reinitialize), l'instance DataSource est remplacée ; un repository
     * capturé au boot pointerait vers la connexion détruite (ancienne DB vide)
     * → getAll vide / getCurrent null malgré le fichier importé sur disque.
     */
    private get yearRepartitionRepository(): Repository<YearRepartitionEntity> {
        return AppDataSource.getInstance().getRepository(YearRepartitionEntity);
    }

    constructor() {}

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
            // Garde destructif : année clôturée = lecture seule, update refusé (YEAR_CLOSED).
            if ((yearRepartition.status ?? "active") === "closed") {
                return {
                    success: false,
                    data: null,
                    error: "YEAR_CLOSED",
                    message: `L'année ${yearRepartition.schoolYear} est clôturée : modification refusée (lecture seule)`,
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
            // Garde destructif : lecture préalable pour refuser la suppression d'une année clôturée.
            const existing = await this.yearRepartitionRepository.findOne({ where: { id } });
            if (!existing) {
                return {
                    success: false,
                    data: null,
                    error: "YearRepartition not found",
                    message: "Répartition d'année scolaire non trouvée",
                };
            }
            if ((existing.status ?? "active") === "closed") {
                return {
                    success: false,
                    data: null,
                    error: "YEAR_CLOSED",
                    message: `L'année ${existing.schoolYear} est clôturée : suppression refusée (lecture seule)`,
                };
            }
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

    /**
     * Année courante — contrat `year:getCurrent` (yearStore.ts:174-180).
     * - >1 `isCurrent` (base importée/merge) : auto-résolution → la plus récente
     *   OUVERTE devient l'unique courante (autres remises à false, persisté).
     *   Toutes clôturées → `data: null` (lecture seule, correct).
     * - 0 `isCurrent` (import sans courante, ex. backup) : auto-backfill (année
     *   couvrant today sinon plus récente OUVERTE), persisté + loggé.
     *   C'est une ACTIVATION d'années existantes, jamais une création
     *   (MANUAL_ONLY préservé : aucune année créée ici). Jamais de toast UI.
     */
    async getCurrentYearRepartition(now: Date = new Date()): Promise<ResultType<YearRepartition | null>> {
        try {
            const allRepartitions = await this.yearRepartitionRepository.find();

            const flagged = allRepartitions.filter(repartition => repartition.isCurrent === true);
            if (flagged.length > 1) {
                // Fix import backup : base fusionnée avec plusieurs isCurrent=true
                // (ex. merge/sync) → au lieu de null bloquant (« Aucune année ouverte »),
                // on résout vers la plus récente OUVERTE et on répare les flags.
                const openFlagged = flagged
                    .filter(r => (r.status ?? "active") !== "closed")
                    .sort((a, b) => String(b.schoolYear).localeCompare(String(a.schoolYear)));
                const winner = openFlagged[0] ?? null;
                if (!winner) {
                    console.warn(`[yearService] ${flagged.length} années isCurrent mais toutes clôturées — lecture seule (data:null).`);
                    return {
                        success: true,
                        data: null,
                        error: null,
                        message: "Aucune année en cours"
                    };
                }
                try {
                    for (const r of allRepartitions) {
                        if (r.id !== (winner as any).id && r.isCurrent === true) {
                            r.isCurrent = false;
                            await this.yearRepartitionRepository.save(r);
                        }
                    }
                    (winner as any).isCurrent = true;
                    const saved = await this.yearRepartitionRepository.save(winner as any);
                    console.log(`[yearService] ambiguïté ${flagged.length} isCurrent résolue → ${(saved as any).schoolYear} (import/merge).`);
                    return {
                        success: true,
                        data: this.convertToResponse(saved as any),
                        error: null,
                        message: `Année scolaire courante auto-résolue : ${(saved as any).schoolYear}`
                    };
                } catch (e) {
                    console.warn("[yearService] résolution ambiguïté isCurrent a échoué (lecture seule) :", (e as Error)?.message ?? e);
                    return {
                        success: true,
                        data: this.convertToResponse(winner as any),
                        error: null,
                        message: `Année scolaire courante auto-résolue : ${(winner as any).schoolYear}`
                    };
                }
            }
            if (flagged.length === 1) {
                // Clôture courante → isCurrent=false persisté par closeYear, mais
                // garde-fou : une année flaggée clôturée ne fait jamais foi
                // (lecture seule globale, getCurrent null).
                if ((flagged[0].status ?? "active") === "closed") {
                    return {
                        success: true,
                        data: null,
                        error: null,
                        message: "Aucune année en cours"
                    };
                }
                return {
                    success: true,
                    data: this.convertToResponse(flagged[0]),
                    error: null,
                    message: "Année scolaire courante trouvée (définie manuellement)"
                };
            }

            // 0 isCurrent → auto-backfill : année couvrant today, sinon plus récente.
            if (!allRepartitions.length) {
                return {
                    success: true,
                    data: null,
                    error: null,
                    message: "Aucune année en cours"
                };
            }
            const covering = allRepartitions.find(repartition => {
                const periods = repartition.periodConfigurations;
                // Hardening : garde périodes vides/malformées (jamais d'index [0] aveugle).
                if (!Array.isArray(periods) || periods.length === 0) return false;
                const first = periods[0] as { start?: unknown } | undefined;
                const last = periods[periods.length - 1] as { end?: unknown } | undefined;
                if (!first || !last) return false;
                const startDate = new Date(first.start as string | Date);
                const endDate = new Date(last.end as string | Date);
                if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return false;

                return now >= startDate && now <= endDate;
            });
            const target = covering
                ?? [...allRepartitions].sort((a, b) => String(b.schoolYear).localeCompare(String(a.schoolYear)))[0];
            const active = target ? [...allRepartitions].filter(r => (r.status ?? "active") === "active" && r.schoolYear === target.schoolYear)[0] ?? target : null;
            if (active && (active.status ?? "active") !== "closed") {
                try {
                    active.isCurrent = true;
                    const saved = await this.yearRepartitionRepository.save(active);
                    console.log(`[yearService] auto-backfill isCurrent → ${saved.schoolYear} (couvrant today: ${covering ? "oui" : "non, plus récente"}).`);
                    return {
                        success: true,
                        data: this.convertToResponse(saved),
                        error: null,
                        message: `Année scolaire courante auto-détectée : ${saved.schoolYear}`
                    };
                } catch (e) {
                    console.warn("[yearService] auto-backfill isCurrent a échoué (lecture seule) :", (e as Error)?.message ?? e);
                }
            }

            if (target && (target.status ?? "active") === "closed") {
                return { success: true, data: null, error: null, message: "Aucune année en cours" };
            }
            return {
                success: true,
                data: target ? this.convertToResponse(target) : null,
                error: null,
                message: target ? "Année scolaire courante trouvée (basée sur la date)" : "Aucune année en cours"
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

    /**
     * Post-import/restore/boot : garantit une année courante quand des années
     * OUVERTE existent sans courante (backup importé sans isCurrent=true).
     * Délègue à `getCurrentYearRepartition` (backfill + résolution d'ambiguïté) :
     * la plus récente ouverte devient courante. Aucune création (MANUAL_ONLY).
     * Appelé au boot (main.ts) après un remplacement à froid + utilisable en tests.
     */
    async ensureOneCurrentAfterImport(now: Date = new Date()): Promise<ResultType<YearRepartition | null>> {
        return this.getCurrentYearRepartition(now);
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
            // Nouveau comportement : clôture autorisée même sur l'année courante
            // (plus de garde CLOSE_CURRENT_FORBIDDEN). La clôture fait sortir
            // l'année du circuit courant → isCurrent=false, status=closed,
            // closedAt=now. L'app bascule alors en lecture seule globale
            // (yearGuard.hasOpenYear()=false → toute écriture refuse YEAR_CLOSED,
            // yearStore.isReadOnly=true → banner + boutons désactivés).
            // La levée du verrou est automatique à la création + setCurrent
            // d'une nouvelle année. Confirm UI côté YearRepartitionView (warning
            // "sans nouvelle année → lecture seule").
            const wasCurrent = year.isCurrent === true;
            year.status = "closed";
            year.closedAt = new Date();
            year.isCurrent = false;
            const saved = await this.yearRepartitionRepository.save(year);
            if (wasCurrent) {
                console.log(`[yearService] clôture année courante ${year.schoolYear} → sortie du courant, mode lecture seule.`);
            }
            return { success: true, data: this.convertToResponse(saved), error: null, message: "Année clôturée, mode lecture seule" };
        } catch (error) {
            const detail = error instanceof Error ? error.message : "Erreur inconnue";
            return { success: false, data: null, error: detail, message: `Échec de la clôture : ${detail}` };
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
     * @deprecated Demande 1 — année scolaire uniquement manuelle.
     * Auto-création DÉSACTIVÉE : cette méthode est neutralisée (no-op) et ne
     * crée JAMAIS d'année. Elle retourne toujours `data: null` avec le message
     * MANUAL_ONLY. Création exclusive via `createYearRepartition` (YearRepartitionView
     * / YearRepartionForm → IPC `yearRepartition:create`) + `setCurrentYearRepartition`.
     * Conservée pour compatibilité (boot/login ne l'appellent plus, IPC `ensure` neutralisé).
     */
    async ensureSchoolYear(_now: Date = new Date()): Promise<ResultType<YearRepartition | null>> {
        console.warn("[yearService] ensureSchoolYear DEPRECATED (demande 1) — no-op, création manuelle requise.");
        return { success: true, data: null, error: null, message: "MANUAL_ONLY : auto-création désactivée — création manuelle requise" };
    }

    /**
     * Clone configs-only, transactionnel : payment_configs, payment_annual_config(+tranches+entries),
     * grading_config(+categories), fee_items. Deep-clone (reset id/remote_id, relink grade).
     * Ne clone JAMAIS payments/scholarships/expenses/movements/notes/absences/paie. Exclut school/settings.
     *
     * Garanties (fix "Échec du clone configs-only" 2025-2026 → 2026-2027) :
     * - payload bilingue `fromId`/`sourceId` (alias V3) ;
     * - aperçu et clone partagent la même définition des compteurs (forme plate frontend) ;
     * - idempotent : les lignes déjà présentes sur la cible (même clé métier + schoolYear
     *   canonique) sont ignorées au lieu de lever UNIQUE (grading sans schoolYear dans
     *   l'unicité, annual OneToOne sur grade) ;
     * - source vide : succès explicite EMPTY_SOURCE (année créée, 0 ligne) au lieu d'un
     *   échec générique ;
     * - erreurs explicites `Échec du clone A → B : <détail>` (UNIQUE/colonne/table).
     */
    async cloneYearConfigs(opts: { fromId?: number; sourceId?: number; newSchoolYear: string; copyPayment?: boolean; copyTranches?: boolean; copyGrading?: boolean; copyFeeItems?: boolean }): Promise<ResultType<any>> {
        const ds = AppDataSource.getInstance();
        try {
            const canon = normalizeSchoolYear(opts.newSchoolYear);
            if (!canon) return { success: false, data: null, error: "INVALID_SCHOOL_YEAR", message: "newSchoolYear invalide (attendu YYYY-YYYY)" };
            const fromId = Number((opts as any).fromId ?? (opts as any).sourceId);
            if (!Number.isFinite(fromId)) return { success: false, data: null, error: "INVALID_PAYLOAD", message: "Clone : fromId/sourceId manquant (année source introuvable)" };
            const from = await this.yearRepartitionRepository.findOne({ where: { id: fromId } });
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
            const skipped: Record<string, number> = {};
            const noteSkipped = (table: string, n = 1) => { skipped[table] = (skipped[table] ?? 0) + n; };
            const isUniqueViolation = (e: unknown) => /UNIQUE|unique|SQLITE_CONSTRAINT/i.test(String((e as any)?.message ?? e ?? ""));
            let targetId: number | null = null;
            let targetPeriods: Array<{ name: string; start: Date; end: Date }> = [];
            await ds.transaction(async (m) => {
                const { PaymentConfigEntity, PaymentAnnualConfigEntity, TranchConfigEntity, TrancheEntryEntity } = await import("../entities/paymentConfig");
                const { GradingConfigEntity, EvaluationCategoryEntity } = await import("../entities/configNote");
                const { FeeItemEntity } = await import("../entities/accounting");
                // Année cible — périodes N-1 décalées d'un an ; lignes invalides écartées
                // explicitement (jamais de `new Date(invalide)` persisté).
                const yearRepo = m.getRepository(YearRepartitionEntity);
                const shifted = (from.periodConfigurations || []).map((p: any) => {
                    const s = new Date(p.start); s.setFullYear(s.getFullYear() + 1);
                    const e = new Date(p.end); e.setFullYear(e.getFullYear() + 1);
                    return { name: p.name, start: s, end: e };
                }).filter((p: any) => p.name && !Number.isNaN(p.start.getTime()) && !Number.isNaN(p.end.getTime()));
                const target = new YearRepartitionEntity();
                target.schoolYear = canon;
                target.periodConfigurations = shifted as any;
                target.isCurrent = false;
                target.status = "active";
                target.closedAt = null;
                const savedYear: any = await yearRepo.save(target);
                targetId = savedYear?.id ?? null;
                targetPeriods = shifted;

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
                    const existing: any[] = await m.getRepository(PaymentConfigEntity as any).find({ where: { schoolYear: canon } as any }).catch(() => []);
                    const existingKeys = new Set(existing.filter((r) => normalizeSchoolYear(r.schoolYear) === canon).map((r) => `${r.classId ?? ""}|${r.annualAmount ?? ""}|${r.inscriptionFee ?? ""}`));
                    for (const r of effective) {
                        if (r.schoolYear && normalizeSchoolYear(r.schoolYear) !== fromYear) continue;
                        const key = `${r.classId ?? ""}|${r.annualAmount ?? ""}|${r.inscriptionFee ?? ""}`;
                        if (existingKeys.has(key)) { noteSkipped("payment_configs"); continue; }
                        const { id, remote_id, ...rest } = r;
                        try {
                            await m.getRepository(PaymentConfigEntity as any).save({ ...rest, schoolYear: canon, remote_id: null } as any);
                            existingKeys.add(key);
                        } catch (e) {
                            if (isUniqueViolation(e)) { noteSkipped("payment_configs"); continue; }
                            throw e;
                        }
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
                    // Idempotence : grade OneToOne — une cible avec le même grade existe déjà → skip.
                    const existingAnnuals: any[] = await m.getRepository(PaymentAnnualConfigEntity as any).find({ relations: { grade: true } }).catch(() => []);
                    const usedGradeIds = new Set(existingAnnuals.filter((a) => normalizeSchoolYear(a.schoolYear) === canon).map((a) => a.grade?.id ?? a.gradeId).filter((v: any) => v != null));
                    let tranchCount = 0;
                    for (const a of effective) {
                        if (a.schoolYear && normalizeSchoolYear(a.schoolYear) !== fromYear) continue;
                        const gradeId = (a as any).grade?.id ?? (a as any).gradeId ?? null;
                        if (gradeId != null && usedGradeIds.has(gradeId)) { noteSkipped("payment_annual_config"); continue; }
                        const { id, remote_id, tranches, grade, ...rest } = a;
                        try {
                            const savedAnnual: any = await m.getRepository(PaymentAnnualConfigEntity as any).save({ ...rest, schoolYear: canon, remote_id: null, grade: grade ?? undefined } as any);
                            if (gradeId != null) usedGradeIds.add(gradeId);
                            for (const t of tranches ?? []) {
                                const { id: tid, remote_id: tr, entries, paymentAnnualConfig, schoolYear: _ts, ...trest } = t;
                                const savedTranch: any = await m.getRepository(TranchConfigEntity as any).save({ ...trest, remote_id: null, paymentAnnualConfig: savedAnnual } as any);
                                tranchCount++;
                                for (const e of entries ?? []) {
                                    const { id: eid, remote_id: er, tranchConfig, ...erest } = e;
                                    await m.getRepository(TrancheEntryEntity as any).save({ ...erest, remote_id: null, tranchConfig: savedTranch } as any);
                                }
                            }
                        } catch (e) {
                            if (isUniqueViolation(e)) { noteSkipped("payment_annual_config"); continue; }
                            throw e;
                        }
                    }
                    counts.tranches = tranchCount;
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
                    // Idempotence : unicité (schoolId, classId, subjectId, period) sans schoolYear
                    // sur schéma frais → une cible identique existe déjà → skip.
                    //
                    // Hardening "near ':' syntax error" (clone 2025-2026 → 2026-2027,
                    // 28 lignes notation) : les valeurs métier contiennent couramment
                    // ":" ("Semestre 1: …", créneau "08:00", ratio "2:1"). On ne propage
                    // JAMAIS l'entité chargée en spread (`...rest` / `...crest`) vers le
                    // writer : toute propriété parasite (clé ou valeur avec ":", fonction
                    // inlinée en SQL brut par le driver, colonne d'une dérive de schéma)
                    // finirait dans la construction du statement, là où la substitution
                    // textuelle `:param` du driver better-sqlite3 est fragile. Seules les
                    // colonnes connues sont liées (binding positionnel `?` côté driver :
                    // ":" reste une donnée liée, jamais un fragment SQL).
                    const GRADING_COPY_COLS = ["schoolId", "classId", "subjectId", "period", "finalGradeBase", "calculationStrategy", "normalizeScores", "description"] as const;
                    const CATEGORY_COPY_COLS = ["name", "code", "weight", "defaultMaxScore", "minEntries", "maxEntries", "color", "displayOrder", "isExam"] as const;
                    const pickCopyCols = (src: any, cols: readonly string[]) => {
                        const o: Record<string, unknown> = {};
                        for (const k of cols) {
                            const v = src?.[k];
                            if (v !== undefined) o[k] = v;
                        }
                        return o;
                    };
                    const existingConfigs: any[] = await m.getRepository(GradingConfigEntity as any).find().catch(() => []);
                    const existingKeys = new Set(existingConfigs.filter((c) => normalizeSchoolYear(c.schoolYear) === canon).map((c) => `${c.schoolId ?? ""}|${c.classId ?? ""}|${c.subjectId ?? ""}|${c.period ?? ""}`));
                    for (const c of effective) {
                        if (c.schoolYear && normalizeSchoolYear(c.schoolYear) !== fromYear) continue;
                        const key = `${c.schoolId ?? ""}|${c.classId ?? ""}|${c.subjectId ?? ""}|${c.period ?? ""}`;
                        if (existingKeys.has(key)) { noteSkipped("grading_config"); continue; }
                        try {
                            const saved: any = await m.getRepository(GradingConfigEntity as any).save({ ...pickCopyCols(c, GRADING_COPY_COLS), schoolYear: canon, remote_id: null } as any);
                            existingKeys.add(key);
                            for (const cat of c.categories ?? []) {
                                if (!cat) continue;
                                await m.getRepository(EvaluationCategoryEntity as any).save({ ...pickCopyCols(cat, CATEGORY_COPY_COLS), remote_id: null, config: saved } as any);
                            }
                        } catch (e) {
                            if (isUniqueViolation(e)) { noteSkipped("grading_config"); continue; }
                            throw e;
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
                    const existingItems: any[] = await m.getRepository(FeeItemEntity as any).find({ where: { schoolYear: canon } as any }).catch(() => []);
                    const existingKeys = new Set(existingItems.filter((it) => normalizeSchoolYear(it.schoolYear) === canon).map((it) => `${it.name ?? ""}|${it.gradeId ?? ""}`));
                    for (const it of effective) {
                        if (it.schoolYear && normalizeSchoolYear(it.schoolYear) !== fromYear) continue;
                        const key = `${it.name ?? ""}|${it.gradeId ?? ""}`;
                        if (existingKeys.has(key)) { noteSkipped("fee_items"); continue; }
                        const { id, remote_id, ...rest } = it;
                        try {
                            await m.getRepository(FeeItemEntity as any).save({ ...rest, schoolYear: canon, remote_id: null } as any);
                            existingKeys.add(key);
                        } catch (e) {
                            if (isUniqueViolation(e)) { noteSkipped("fee_items"); continue; }
                            throw e;
                        }
                    }
                }
            });
            const hasFallback = Object.keys(fallbackUsage).length > 0;
            const enabledCounts = [
                copyPayment ? (counts.payment_configs ?? 0) : -1,
                copyTranches ? (counts.payment_annual_config ?? 0) : -1,
                copyGrading ? (counts.grading_config ?? 0) : -1,
                copyFeeItems ? (counts.fee_items ?? 0) : -1,
            ].filter((v) => v >= 0);
            const emptySource = enabledCounts.length > 0 && enabledCounts.every((v) => v === 0);
            try {
                await (global as any).auditLogService?.record({
                    action: "create",
                    targetEntity: "YearRepartition",
                    targetId: targetId,
                    summary: `Clone configs-only ${fromYear} → ${canon}${emptySource ? " (source vide)" : ""}${hasFallback ? " (fallback legacy)" : ""}`,
                    metadata: { fromYear, schoolYear: canon, counts, skipped, fallbackUsage, emptySource },
                    actor: await (global as any).authService?.getCurrentUser?.().then((u: any) => u ? { id: u.id, username: u.username, role: u.role, displayName: u.displayName ?? null } : null).catch(() => null),
                });
            } catch { /* audit best-effort */ }
            // Forme plate (contrat frontend YearClonePreview) + détail snake (compat).
            const flat = {
                paymentConfigs: counts.payment_configs ?? 0,
                tranches: counts.tranches ?? counts.payment_annual_config ?? 0,
                gradingConfigs: counts.grading_config ?? 0,
                feeItems: counts.fee_items ?? 0,
            };
            if (emptySource) {
                return { success: true, data: { id: targetId, schoolYear: canon, periodConfigurations: targetPeriods, counts, skipped, fallbackUsage, emptySource: true, ...flat } as any, error: "EMPTY_SOURCE", message: `Source ${fromYear} vide : année ${canon} créée sans configurations (paiements 0, tranches 0, notation 0, frais 0)` };
            }
            const skippedTotal = Object.values(skipped).reduce((a, b) => a + (b as number), 0);
            return { success: true, data: { id: targetId, schoolYear: canon, periodConfigurations: targetPeriods, counts, skipped, fallbackUsage, emptySource: false, ...flat } as any, error: null, message: `Configurations clonées vers ${canon} (paiements ${flat.paymentConfigs}, tranches ${flat.tranches}, notation ${flat.gradingConfigs}, frais ${flat.feeItems}${skippedTotal ? `, ${skippedTotal} ignorée(s) déjà présente(s)` : ""})` };
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error ?? "Erreur inconnue");
            let hint = "";
            if (/no such column/i.test(detail)) hint = " — schéma incomplet (colonne manquante) : vérifiez que la migration 177 est appliquée";
            else if (/no such table/i.test(detail)) hint = " — table cible absente : base corrompue ou migration non appliquée";
            else if (/UNIQUE|SQLITE_CONSTRAINT/i.test(detail)) hint = " — doublon (contrainte d'unicité) : relancez, les lignes déjà clonées sont désormais ignorées";
            else if (/DUPLICATE/i.test(detail)) hint = "";
            const fromLabel = (() => { try { return ""; } catch { return ""; } })();
            return { success: false, data: null, error: detail, message: `Échec du clone configs-only${hint} : ${detail}${fromLabel}` };
        }
    }

    /**
     * B2: aperçu dry-run du clone (year:clone-preview) — compte sans écrire.
     * Retourne la forme plate du contrat frontend `YearClonePreview`
     * ({ paymentConfigs, tranches, gradingConfigs, feeItems }) + `counts`
     * snake_case détaillé et `emptySource`. Tolérant legacy (lignes sans
     * schoolYear) et schéma partiel (colonne manquante → 0, jamais de throw).
     */
    async clonePreview(opts: { fromId?: number; sourceId?: number; newSchoolYear: string }): Promise<ResultType<any>> {
        try {
            const canon = normalizeSchoolYear(opts.newSchoolYear);
            if (!canon) return { success: false, data: null, error: "INVALID_SCHOOL_YEAR", message: "newSchoolYear invalide (attendu YYYY-YYYY)" } as any;
            const fromId = Number((opts as any).fromId ?? (opts as any).sourceId);
            if (!Number.isFinite(fromId)) return { success: false, data: null, error: "INVALID_PAYLOAD", message: "Aperçu : fromId/sourceId manquant" } as any;
            const from = await this.yearRepartitionRepository.findOne({ where: { id: fromId } });
            if (!from) return { success: false, data: null, error: "NOT_FOUND", message: "Année source non trouvée" } as any;
            const fromYear = normalizeSchoolYear(from.schoolYear) ?? from.schoolYear;
            const ds = AppDataSource.getInstance();
            const { PaymentConfigEntity, PaymentAnnualConfigEntity, TranchConfigEntity } = await import("../entities/paymentConfig");
            const { GradingConfigEntity } = await import("../entities/configNote");
            const { FeeItemEntity } = await import("../entities/accounting");
            const tolerantCount = async (entity: any): Promise<number> => {
                try {
                    const n = await ds.getRepository(entity as any).count({ where: { schoolYear: fromYear } as any });
                    if (n > 0) return n;
                } catch { /* colonne absente sur schéma partiel → fallback */ }
                try {
                    const rows: any[] = await ds.getRepository(entity as any).find();
                    return rows.filter((r) => !r.schoolYear || normalizeSchoolYear(r.schoolYear) === fromYear).length;
                } catch { return 0; }
            };
            const paymentConfigs = await tolerantCount(PaymentConfigEntity);
            const annuals = await tolerantCount(PaymentAnnualConfigEntity);
            const gradingConfigs = await tolerantCount(GradingConfigEntity);
            const feeItems = await tolerantCount(FeeItemEntity);
            // Tranches : lignes tranch_config rattachées aux annuals source (direct schoolYear
            // quand présent, sinon somme des relations) — même définition que le clone.
            let tranches = 0;
            try {
                const direct: any[] = await ds.getRepository(TranchConfigEntity as any).find();
                const withYear = direct.filter((t) => t.schoolYear && normalizeSchoolYear(t.schoolYear) === fromYear);
                if (withYear.length) tranches = withYear.length;
                else {
                    const allAnnuals: any[] = await ds.getRepository(PaymentAnnualConfigEntity as any).find({ relations: { tranches: true } }).catch(() => []);
                    const src = allAnnuals.filter((a) => !a.schoolYear || normalizeSchoolYear(a.schoolYear) === fromYear);
                    tranches = src.reduce((acc, a) => acc + ((a.tranches ?? []).length || 0), 0);
                    if (!tranches) tranches = annuals;
                }
            } catch { tranches = annuals; }
            const counts = {
                payment_configs: paymentConfigs,
                payment_annual_config: annuals,
                tranches,
                grading_config: gradingConfigs,
                fee_items: feeItems,
            };
            const emptySource = paymentConfigs === 0 && annuals === 0 && gradingConfigs === 0 && feeItems === 0;
            return { success: true, data: { fromYear, newSchoolYear: canon, paymentConfigs, tranches, gradingConfigs, feeItems, counts, emptySource }, error: null, message: emptySource ? `Aperçu clone ${fromYear} → ${canon} : source vide (rien à copier)` : `Aperçu clone ${fromYear} → ${canon}` } as any;
        } catch (error) {
            const detail = error instanceof Error ? error.message : String(error ?? "Erreur inconnue");
            return { success: false, data: null, error: detail, message: `Échec aperçu clone : ${detail}` } as any;
        }
    }
}
