import { Repository, Between } from 'typeorm';
import { PaymentEntity } from '../entities/payment';
import { PaymentAnnualConfigEntity, PaymentConfigEntity, TranchConfigEntity, TrancheEntryEntity } from '../entities/paymentConfig';
import { AppDataSource } from '../../data-source';
import { StudentEntity } from '../entities/students';
import { ProfessorEntity } from '../entities/professor';
import { ProfessorPaymentEntity } from '../entities/professorPayment';
import { ScholarshipEntity } from '../entities/scholarship';
import { CashMovementEntity, ReceiptCounterEntity } from '../entities/accounting';
import { IPaymentData, IPaymentConfigData, IProfessorPaymentData, IPaymentServiceResponse, IPaymentServiceParams, IPaymentAnnualConfigData } from '../types/payment';

import { ResultType as CentralResultType } from "#electron/command";
export type ResultType<T = any> = CentralResultType<T>;

// Interface pour les données de paiement d'un étudiant
export interface StudentPaymentResponse {
    payments: PaymentEntity[];
    baseAmount: number;
    scholarshipPercentage: number;
    scholarshipAmount: number;
    adjustedAmount: number;
}

/** Ligne de mensualité — forme contractuelle avec MensualityView.vue ({mois, eleve, montant, statut}). */
export interface MensualiteRow {
    /** Mois calendaire au format 'YYYY-MM'. */
    mois: string;
    /** Nom d'affichage de l'élève ('Prénom Nom', repli matricule). */
    eleve: string;
    /** Échéance mensuelle due (part annuelle/12 si config, sinon somme versée). */
    montant: number;
    statut: 'payé' | 'partiel' | 'impayé';
}

// Créer un type pour les données de paiement
type PaymentCreateData = Omit<PaymentEntity, 'id'> & {
    scholarshipPercentage?: number;
    scholarshipAmount?: number;
    adjustedAmount?: number;
    baseAmount?: number;
};

export class PaymentService {
    private paymentRepository: Repository<PaymentEntity>;
    private configRepository: Repository<PaymentConfigEntity>;
    private studentRepository: Repository<StudentEntity>;
    private professorRepository: Repository<ProfessorEntity>;
    private professorPaymentRepository: Repository<ProfessorPaymentEntity>;
    private scholarshipRepository: Repository<ScholarshipEntity>;
    private annualConfigRepository: Repository<PaymentAnnualConfigEntity>;
    private tranchConfigRepository: Repository<TranchConfigEntity>;
    private tranchEntryRepository: Repository<TrancheEntryEntity>;
    private initialized: boolean = false;

    constructor() {
        this.paymentRepository = AppDataSource.getInstance().getRepository(PaymentEntity);
        this.configRepository = AppDataSource.getInstance().getRepository(PaymentConfigEntity);
        this.studentRepository = AppDataSource.getInstance().getRepository(StudentEntity);
        this.professorRepository = AppDataSource.getInstance().getRepository(ProfessorEntity);
        this.professorPaymentRepository = AppDataSource.getInstance().getRepository(ProfessorPaymentEntity);
        this.scholarshipRepository = AppDataSource.getInstance().getRepository(ScholarshipEntity);
        this.annualConfigRepository = AppDataSource.getInstance().getRepository(PaymentAnnualConfigEntity);
        this.tranchConfigRepository = AppDataSource.getInstance().getRepository(TranchConfigEntity);
        this.tranchEntryRepository = AppDataSource.getInstance().getRepository(TrancheEntryEntity);
    }

    private async ensureRepositoriesInitialized(): Promise<void> {
        if (!this.initialized) {
            const dataSource = AppDataSource.getInstance();
            if (!dataSource.isInitialized) {
                await AppDataSource.initialize(false);
            }
            this.paymentRepository = dataSource.getRepository(PaymentEntity);
            this.configRepository = dataSource.getRepository(PaymentConfigEntity);
            this.studentRepository = dataSource.getRepository(StudentEntity);
            this.professorRepository = dataSource.getRepository(ProfessorEntity);
            this.professorPaymentRepository = dataSource.getRepository(ProfessorPaymentEntity);
            this.scholarshipRepository = dataSource.getRepository(ScholarshipEntity);
            this.annualConfigRepository = dataSource.getRepository(PaymentAnnualConfigEntity);
            this.tranchConfigRepository = dataSource.getRepository(TranchConfigEntity);
            this.tranchEntryRepository = dataSource.getRepository(TrancheEntryEntity);
            this.initialized = true;
        }
    }

    async savePaymentAnnualConfig(configData: IPaymentAnnualConfigData){
        return await AppDataSource.getInstance().transaction(async (entityManager) => {
            try {
                const newConfig = entityManager.create(PaymentAnnualConfigEntity, {
                    id: configData.id,
                    trancheCount: configData.trancheCount,
                    grade_id: configData.grade_id
                });
                const savedConfig = await entityManager.save(newConfig);
                await Promise.all(configData.tranches.map(async tranch => {
                    const newTranchConfig = entityManager.create(TranchConfigEntity, {
                        id: tranch.id,
                        tranchMonthCount: tranch.tranchMonthCount,
                        paymentAnnualConfig: savedConfig,
                    });
                    const savedTranchConfig = await entityManager.save(newTranchConfig);
                    await Promise.all(tranch.entries.map(async entry => {
                        const newTranchEntry = entityManager.create(TrancheEntryEntity, {
                            id: entry.id,
                            startDate: entry.startDate,
                            endDate: entry.endDate,
                            tranchConfig: savedTranchConfig
                        });
                        const savedTranchEntry = await entityManager.save(newTranchEntry);
                    }))
                }))
                return {
                    success: true,
                    data: savedConfig,
                    message: "Configuration des tranches effectuées avec succès",
                    error: null
                };
            }
            catch (error) {
                console.error("Erreur lors de la sauvegarde:", error);
                return {
                    success: false,
                    data: null,
                    message: "Erreur lors de la sauvegarde de la configuration",
                    error: error instanceof Error ? error.message : "Erreur inconnue"
                };
            }
        });
    }

    async getPaymentAnnualConfigs(){
        return await AppDataSource.getInstance().transaction(async (entityManager) => {
            try {
                const configs = await entityManager.find(PaymentAnnualConfigEntity, {
                    relations: {
                        tranches: {
                            entries: true
                        }
                    }
                });
                return {
                    success: true,
                    data: configs,
                    message: "Configuration des tranches récupérées avec succès",
                    error: null
                };
            }
            catch (error) {
                console.error("Erreur lors de la récupération:", error);
                return {
                    success: false,
                    data: null,
                    message: "Erreur lors de la récupération de la configuration",
                    error: error instanceof Error ? error.message : "Erreur inconnue"
                };
            }
        });
    }

    async createInitialInscriptionFee(student: StudentEntity): Promise<void> {
        try {
            await this.ensureRepositoriesInitialized();
    
            if (!student.grade) {
                console.log(`Student ${student.id} has no grade, skipping inscription fee.`);
                return;
            }
    
            const config = await this.configRepository.findOne({
                where: { classId: student.grade.id.toString() }
            });
    
            if (!config) {
                console.log(`No payment config found for grade ${student.grade.id}, skipping inscription fee.`);
                return;
            }
    
            const inscriptionFee = student.isNew === false ? config.reInscriptionFee : config.inscriptionFee;
    
            if (inscriptionFee && inscriptionFee > 0) {
                const payment = this.paymentRepository.create({
                    student: student,
                    amount: inscriptionFee,
                    paymentType: 'inscription',
                    paymentMethod: 'cash', // or a default method
                    created_at: new Date(),
                    baseAmount: inscriptionFee,
                    adjustedAmount: inscriptionFee,
                    scholarshipAmount: 0,
                    scholarshipPercentage: 0,
                });
    
                await this.paymentRepository.save(payment);
                console.log(`Created inscription fee payment of ${inscriptionFee} for student ${student.id}`);
            }
        } catch (error) {
            console.error(`Failed to create initial inscription fee for student ${student.id}:`, error);
            // We don't want to throw an error here, as it might fail the student creation process.
            // Logging the error is sufficient.
        }
    }

    /**
     * Frais de réinscription idempotent : pre-check (studentId + schoolYear + paymentType='reinscription'),
     * idempotencyKey `reinsc-{studentId}-{schoolYear}`, reçu via compteur existant (ReceiptCounterEntity).
     * Retourne le paiement existant si déjà présent (ne duplique jamais).
     */
    async createReInscriptionFee(studentId: number, schoolYear: string, externalManager?: any): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const ds = AppDataSource.getInstance();
            const { normalizeSchoolYear } = await import("../lib/schoolYear");
            const canon = normalizeSchoolYear(schoolYear) ?? String(schoolYear);
            const run = async (manager: any) => {
                const studentRepo = manager.getRepository(StudentEntity);
                const paymentRepo = manager.getRepository(PaymentEntity);
                const counterRepo = manager.getRepository(ReceiptCounterEntity);
                const student: any = await studentRepo.findOne({ where: { id: studentId }, relations: ["grade"] });
                if (!student) return { success: false, data: null, message: "Étudiant non trouvé", error: "NOT_FOUND" };
                const idempotencyKey = `reinsc-${studentId}-${canon}`;
                const existing = await paymentRepo.findOne({ where: { idempotencyKey } as any });
                if (existing) return { success: true, data: existing, message: "Réinscription déjà facturée (idempotent)", error: null };
                const dupe = await paymentRepo.findOne({ where: { studentId, schoolYear: canon, paymentType: "reinscription" } as any });
                if (dupe) return { success: true, data: dupe, message: "Réinscription déjà facturée (idempotent)", error: null };
                const cfgRepo = manager.getRepository(PaymentConfigEntity);
                // B6: config canonique d'abord ; fallback legacy EXPLICITE (tracé).
                let config: any = student.grade ? await cfgRepo.findOne({ where: { classId: String(student.grade.id), schoolYear: canon } as any }) : null;
                let configSource: string = config ? "canon" : "none";
                if (!config && student.grade) {
                    const legacy = await cfgRepo.findOne({ where: { classId: String(student.grade.id) } as any });
                    if (legacy) {
                        console.warn(`[reinscription] fallback config legacy sans schoolYear (classId=${student.grade.id}) → année ${canon}. Configurer payment_configs.schoolYear=${canon}.`);
                        config = legacy;
                        configSource = "fallback-legacy";
                    }
                }
                const amount = Number(config?.reInscriptionFee ?? 0);
                if (!(amount > 0)) return { success: false, data: null, message: "Frais de réinscription non configurés", error: "NO_FEE_CONFIG" };
                const { resolveTargetSchoolYear } = await import("../lib/yearGuard");
                const canonYear = await resolveTargetSchoolYear(canon);
                const year = Number(canonYear.slice(0, 4));
                let counter: any = await counterRepo.findOne({ where: { year } }).catch(() => null);
                if (!counter) counter = counterRepo.create({ year, lastNumber: 0 });
                counter.lastNumber = Number(counter.lastNumber || 0) + 1;
                await counterRepo.save(counter);
                const receiptNumber = `R-${year}-${String(counter.lastNumber).padStart(4, "0")}`;
                const payment: any = paymentRepo.create({
                    student, studentId, amount, paymentType: "reinscription", paymentMethod: "cash",
                    schoolYear: canon, installmentNumber: 1, baseAmount: amount, adjustedAmount: amount,
                    scholarshipAmount: 0, scholarshipPercentage: 0, receiptNumber, idempotencyKey,
                    created_at: new Date(),
                } as any);
                const saved = await paymentRepo.save(payment);
                // Mouvement de caisse append-only (best-effort, même tx)
                try {
                    const movRepo = manager.getRepository(CashMovementEntity);
                    await movRepo.save(movRepo.create({
                        direction: "IN", amount, currency: (saved as any).currency ?? undefined,
                        motive: `Réinscription ${student.matricule ?? student.id} ${canon}`.slice(0, 255),
                        reference: receiptNumber, paymentId: (saved as any).id,
                        movementDate: new Date(), schoolYear: canon, idempotencyKey: `pay-${idempotencyKey}`,
                    } as any));
                } catch (e) { console.warn("[reinscription] cash movement ignoré:", e); }
                // B6: metadata audit du choix source (canon vs fallback-legacy).
                const withMeta: any = { ...saved, _configSource: configSource, _schoolYear: canon };
                return { success: true, data: withMeta, message: configSource === "fallback-legacy" ? "Frais de réinscription créés (config legacy, à migrer)" : "Frais de réinscription créés", error: null };
            };
            if (externalManager) return await run(externalManager);
            return await ds.transaction(run);
        } catch (error) {
            return { success: false, data: null, message: "Erreur réinscription", error: error instanceof Error ? error.message : "Erreur inconnue" };
        }
    }

    async saveConfig(configData: IPaymentConfigData): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const existingConfig = await this.configRepository.findOne({
                where: { classId: configData.classId }
            });

            if (existingConfig) {
                Object.assign(existingConfig, {
                    ...configData
                });
                
                const savedConfig = await this.configRepository.save(existingConfig);
                return {
                    success: true,
                    data: savedConfig,
                    message: "Configuration mise à jour avec succès",
                    error: null
                };
            } else {
                const newConfig = this.configRepository.create({
                    ...configData,
                    allowScholarship: configData.allowScholarship || false,
                    scholarshipPercentages: configData.scholarshipPercentages || [],
                    scholarshipCriteria: configData.scholarshipCriteria || ''
                });
                const savedConfig = await this.configRepository.save(newConfig);
                return {
                    success: true,
                    data: savedConfig,
                    message: "Configuration créée avec succès",
                    error: null
                };
            }
        } catch (error) {
            console.error("Erreur lors de la sauvegarde:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la sauvegarde de la configuration",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getConfigs(): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const configs = await this.configRepository.find();
            console.log("Configurations récupérées:", configs);
            
            return {
                success: true,
                data: configs.map(config => ({
                    ...config,
                    allowScholarship: Boolean(config.allowScholarship),
                    scholarshipPercentages: Array.isArray(config.scholarshipPercentages) 
                        ? config.scholarshipPercentages 
                        : []
                })),
                message: "Configurations récupérées avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur lors de la récupération:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des configurations",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /** Colonnes réellement présentes en base (PRAGMA) — fallback vieilles bases pré-migration. */
    private async getTableColumns(ds: { query: (sql: string) => Promise<any[]> }, table: string): Promise<Set<string>> {
        try {
            const rows = await ds.query(`PRAGMA table_info("${table}")`);
            if (Array.isArray(rows)) return new Set(rows.map((r: any) => String(r?.name ?? "")));
        } catch { /* ignore — on suppose le schéma à jour */ }
        return new Set();
    }

    async addPayment(paymentData: IPaymentData): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const ds = AppDataSource.getInstance();
            // B3: année canonique YYYY-YYYY (jamais civile brute).
            const { resolveTargetSchoolYear: resolveSYAdd } = await import("../lib/yearGuard");
            const canonSYAdd = await resolveSYAdd((paymentData as any)?.schoolYear);

            // Rétro-compat : vérifie que les colonnes existent avant usage (vieilles bases pré-migration).
            // PRAGMA vide => suppose schéma à jour (synchronize:true), ne bloque pas.
            const paymentCols = await this.getTableColumns(ds as any, "payments");
            const assumeFullSchema = paymentCols.size === 0;
            const hasReceipt = assumeFullSchema || paymentCols.has("receiptNumber");
            const hasIdem = assumeFullSchema || paymentCols.has("idempotencyKey");
            const hasCurrency = assumeFullSchema || paymentCols.has("currency");
            const hasComment = assumeFullSchema || paymentCols.has("comment");

            const incomingReceipt = (paymentData as any)?.receiptNumber as string | undefined;
            if (incomingReceipt && hasReceipt) {
                try {
                    const existing = await this.paymentRepository.findOne({ where: { receiptNumber: incomingReceipt } as any });
                    if (existing) {
                        return { success: true, data: existing, message: "Paiement déjà enregistré (idempotent)", error: null };
                    }
                } catch (e) { console.warn("[payment] pré-check receiptNumber ignoré (colonne absente ?):", e); }
            }
            const incomingIdem = (paymentData as any)?.idempotencyKey as string | undefined;
            if (incomingIdem && hasIdem) {
                try {
                    const existing = await this.paymentRepository.findOne({ where: { idempotencyKey: incomingIdem } as any });
                    if (existing) {
                        return { success: true, data: existing, message: "Paiement déjà enregistré (idempotent)", error: null };
                    }
                } catch (e) { console.warn("[payment] pré-check idempotencyKey ignoré (colonne absente ?):", e); }
            }

            // B4: compteur atomique + création Payment + CashMovement append-only dans la même tx.
            // NOTE better-sqlite3 : pas d'isolation SERIALIZABLE (incompatible) — transaction
            // standard suffit (1 writer SQLite sérialisé). Verrou pessimistic_write conservé
            // avec fallback si le driver le refuse.
            return await ds.transaction(async (manager) => {
                const studentRepo = manager.getRepository(StudentEntity);
                const scholarshipRepo = manager.getRepository(ScholarshipEntity);
                const paymentRepo = manager.getRepository(PaymentEntity);
                const movementRepo = manager.getRepository(CashMovementEntity);
                const counterRepo = manager.getRepository(ReceiptCounterEntity);

                const student = await studentRepo.findOne({
                    where: { id: paymentData.studentId },
                    relations: ['scholarship']
                });
                if (!student) throw new Error('Étudiant non trouvé');

                let activeScholarship: any = null;
                const scholarshipPercentage = Number(paymentData.annualScholarshipPercentage || paymentData.scholarshipPercentage || 0);
                const scholarshipApplied = paymentData.scholarshipAppliedOnAnnual || scholarshipPercentage > 0;
                if (scholarshipApplied && scholarshipPercentage > 0) {
                    await scholarshipRepo.update(
                        {
                            studentId: student.id,
                            isActive: true,
                            schoolYear: canonSYAdd
                        } as any,
                        { isActive: false } as any
                    );
                    activeScholarship = await scholarshipRepo.save(scholarshipRepo.create({
                        studentId: student.id,
                        percentage: scholarshipPercentage,
                        schoolYear: canonSYAdd,
                        isActive: true,
                        created_at: new Date()
                    } as any));
                }

                // Idempotence intra-tx si un id explicite est rejoué.
                if ((paymentData as any)?.id) {
                    const byId = await paymentRepo.findOne({ where: { id: (paymentData as any).id } });
                    if (byId && (!hasReceipt || (byId as any).receiptNumber)) {
                        return { success: true, data: byId, message: "Paiement déjà enregistré (idempotent)", error: null };
                    }
                }

                // Compteur atomique avec verrou pessimiste (fallback si driver sans lock).
                // better-sqlite3 = 1 writer sérialisé par la transaction : le compteur reste atomique.
                // B3: compteur calé sur l'année canonique (pas l'année civile brute).
                const year = Number(String(canonSYAdd).slice(0, 4)) || new Date().getFullYear();
                let counter: any = null;
                try {
                    counter = await counterRepo.findOne({ where: { year }, lock: { mode: "pessimistic_write" } });
                } catch (lockErr) {
                    console.warn("[payment] pessimistic_write indisponible, fallback lecture simple:", lockErr);
                    counter = await counterRepo.findOne({ where: { year } });
                }
                if (!counter) counter = counterRepo.create({ year, lastNumber: 0 });
                counter.lastNumber = Number(counter.lastNumber || 0) + 1;
                await counterRepo.save(counter);
                const receiptNumber: string | undefined = hasReceipt
                    ? ((paymentData as any)?.receiptNumber
                        || `R-${year}-${String(counter.lastNumber).padStart(4, "0")}`)
                    : undefined;

                // Double-check idempotence sur le numéro généré/fourni (si colonne présente).
                if (hasReceipt && receiptNumber) {
                    try {
                        const duplicate = await paymentRepo.findOne({ where: { receiptNumber } as any });
                        if (duplicate) {
                            return { success: true, data: duplicate, message: "Paiement déjà enregistré (idempotent)", error: null };
                        }
                    } catch (e) { console.warn("[payment] duplicate-check receiptNumber ignoré:", e); }
                }

                const { currencyForCountry: cfc, roundMoney: rm } = await import("../utils/countryCurrency");
                const { SchoolEntity: SE } = await import("../entities/school");
                let cur: any = "GNF";
                try { const sr = manager.getRepository(SE); const sc: any = await sr.findOne({ where: {} }); cur = cfc(sc?.country, "GNF"); } catch { /* défaut */ }
                const roundedAmount = rm(Number((paymentData as any).amount) || 0, cur);

                // Mapping rétro-compatible des champs frontend sans colonne dédiée :
                // reference / paymentDate / remise -> comment (payments) + motive/reference (cash_movements).
                // Jamais de perte silencieuse : tout est concaténé et loggé.
                const frontendRef: string = String((paymentData as any)?.reference ?? "").trim();
                const frontendDateRaw: any = (paymentData as any)?.paymentDate;
                const frontendRemise: number = Number((paymentData as any)?.remise ?? 0) || 0;
                const baseComment: string = String((paymentData as any)?.comment ?? "").trim();
                const extraBits: string[] = [];
                if (frontendRef) extraBits.push(`[Réf: ${frontendRef}]`);
                if (frontendRemise > 0) extraBits.push(`[Remise: ${frontendRemise}]`);
                if (frontendDateRaw) extraBits.push(`[Date saisie: ${String(frontendDateRaw)}]`);
                const enrichedComment = [baseComment, ...extraBits].filter(Boolean).join(" | ").slice(0, 500) || undefined;
                if (frontendRef || frontendRemise > 0 || frontendDateRaw) {
                    console.log("[payment] champs mappés -> comment/cash:", { frontendRef, frontendDateRaw, frontendRemise, enrichedComment });
                }

                // Construction whitelistée (pas de spread aveugle : reference/paymentDate/remise
                // ne sont pas des colonnes payments et seraient perdues/ignorées sinon).
                const paymentToCreate: any = {
                    amount: roundedAmount,
                    paymentType: (paymentData as any).paymentType,
                    paymentMethod: (paymentData as any).paymentMethod,
                    student: student,
                    studentId: student.id,
                    installmentNumber: Number((paymentData as any).installmentNumber ?? 1),
                    schoolYear: canonSYAdd,
                    scholarshipPercentage: scholarshipPercentage,
                    scholarshipAmount: Number(paymentData.annualScholarshipAmount || paymentData.scholarshipAmount) || 0,
                    adjustedAmount: Number(paymentData.annualAmountAfterScholarship || paymentData.adjustedAmount || paymentData.baseAmount) || 0,
                    baseAmount: Number(paymentData.baseAnnualAmount || paymentData.baseAmount) || 0,
                    scholarshipId: activeScholarship?.id || null,
                    created_at: new Date()
                };
                if (hasReceipt && receiptNumber) paymentToCreate.receiptNumber = receiptNumber;
                if (hasIdem) paymentToCreate.idempotencyKey = (paymentData as any).idempotencyKey ?? null;
                if (hasCurrency) paymentToCreate.currency = cur;
                if (hasComment && enrichedComment) paymentToCreate.comment = enrichedComment;

                const payment = paymentRepo.create(paymentToCreate as PaymentCreateData as any);

                const savedPayment = await paymentRepo.save(payment as any);

                // Mouvement de caisse append-only dans la même transaction (jamais UPDATE/DELETE).
                let movementDate: Date = new Date();
                if (frontendDateRaw) {
                    const parsed = new Date(String(frontendDateRaw));
                    if (!Number.isNaN(parsed.getTime())) movementDate = parsed;
                    else console.warn("[payment] paymentDate invalide, fallback aujourd'hui:", frontendDateRaw);
                }
                let motive = `Encaissement scolarité ${(student as any)?.matricule ?? student.id}`;
                if (frontendRef) motive += ` | Réf: ${frontendRef}`;
                if (frontendRemise > 0) motive += ` | Remise: ${frontendRemise}`;
                motive = motive.slice(0, 255);
                const movementToCreate: any = {
                    direction: "IN",
                    amount: roundedAmount,
                    currency: cur,
                    motive,
                    paymentId: (savedPayment as any).id,
                    movementDate,
                    schoolYear: canonSYAdd,
                };
                // cash_movements.reference porte le n° de reçu (réconciliation) ; si pas de
                // receiptNumber (vieille base), y reporter la référence frontend pour ne rien perdre.
                try {
                    const cashCols = await this.getTableColumns(manager as any, "cash_movements");
                    const assumeCashFull = cashCols.size === 0;
                    const hasCashRef = assumeCashFull || cashCols.has("reference");
                    const hasCashIdem = assumeCashFull || cashCols.has("idempotencyKey");
                    if (hasCashRef) movementToCreate.reference = receiptNumber ?? (frontendRef.slice(0, 20) || undefined);
                    if (hasCashIdem && (paymentData as any).idempotencyKey) movementToCreate.idempotencyKey = `pay-${(paymentData as any).idempotencyKey}`;
                } catch {
                    movementToCreate.reference = receiptNumber ?? (frontendRef.slice(0, 20) || undefined);
                    if ((paymentData as any).idempotencyKey) movementToCreate.idempotencyKey = `pay-${(paymentData as any).idempotencyKey}`;
                }
                await movementRepo.save(movementRepo.create(movementToCreate as any));

                return {
                    success: true,
                    data: savedPayment,
                    message: "Paiement enregistré avec succès",
                    error: null
                };
            });
        } catch (error) {
            console.error("Erreur lors de l'ajout du paiement:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de l'enregistrement du paiement",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getPayments(page: number = 1, limit: number = 10): Promise<IPaymentServiceResponse> {
        try {
            const [payments, total] = await this.paymentRepository.findAndCount({
                relations: ['student', 'scholarship'],
                skip: (page - 1) * limit,
                take: limit,
                order: { created_at: 'DESC' }
            });

            return {
                success: true,
                data: { payments, total },
                message: "Paiements récupérés avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    // Façade fusion paie → accountingService.teacherPay (source unique).
    // Garanties conservées : référence PAY-ENS-YYYY-XXXX, CashMovement OUT,
    // UQ prof+month, idempotence scopée key+prof+month. Ancien code conservé
    // via délégation (aucune duplication de transaction).
    async addProfessorPayment(paymentData: IProfessorPaymentData & { idempotencyKey?: string } & { prime?: number; transport?: number; avance?: number; retenue?: number }): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const { accountingService } = await import("./accountingService");
            const r: any = await accountingService.teacherPay(
                Number((paymentData as any).professorId),
                (paymentData as any).month,
                { ...(paymentData as any) },
            );
            return { success: r.success, data: r.data, message: r.message, error: r.error };
        } catch (error) {
            console.error('Erreur détaillée:', error);
            return {
                success: false,
                data: null,
                message: error instanceof Error ? error.message : "Erreur lors de l'enregistrement",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    // B3: somme scopée par schoolYear canonique (2e arg optionnel, défaut année courante).
    // Évite la fuite inter-années : seuls les paiements de l'année comptent.
    async getPaymentsByStudent(studentId: number, schoolYear?: string): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const { resolveTargetSchoolYear } = await import("../lib/yearGuard");
            const canonSY = await resolveTargetSchoolYear(schoolYear);
    
            const student = await this.studentRepository.findOne({ where: { id: studentId }, relations: ['grade'] });
            if (!student) {
                return { success: false, data: null, error: "", message: "Étudiant non trouvé" };
            }

            // Config canonique d'abord, fallback legacy tracé (B6).
            let config: any = student.grade ? await this.configRepository.findOne({ where: { classId: student.grade.id.toString(), schoolYear: canonSY } as any }).catch(() => null) : null;
            if (!config && student.grade) {
                const legacy = await this.configRepository.findOne({ where: { classId: student.grade.id.toString() } }).catch(() => null);
                if (legacy) console.warn(`[getPaymentsByStudent] fallback config legacy (classId=${student.grade.id}) → année ${canonSY}.`);
                config = legacy;
            }
            
            const inscriptionFeeDue = student.isNew === false ? (config?.reInscriptionFee || 0) : (config?.inscriptionFee || 0);
            const tuitionFeeDue = config?.annualAmount || 0;

            const allPayments = await this.paymentRepository.find({ where: { student: { id: studentId } } });
            // B3 + rétro-compat legacy civile ('2026' vs '2026-2027', lignes sans schoolYear conservées).
            const { matchesSchoolYearValue: matchesSY } = await import("../lib/schoolYear");
            const payments = allPayments.filter((p: any) => matchesSY((p as any)?.schoolYear, canonSY));

            let paidInscriptionFee = 0;
            let paidTuition = 0;

            payments.forEach(p => {
                if (p.paymentType === 'inscription' || p.paymentType === 'reinscription') {
                    paidInscriptionFee += Number(p.amount);
                } else {
                    paidTuition += Number(p.amount);
                }
            });

            const activeScholarship = await this.scholarshipRepository.findOne({ where: { studentId, isActive: true, schoolYear: canonSY } as any }).catch(async () => await this.scholarshipRepository.findOne({ where: { studentId, isActive: true } }));
            const scholarshipPercentage = activeScholarship?.percentage || 0;
            const scholarshipAmount = tuitionFeeDue * (scholarshipPercentage / 100);
            const adjustedTuitionFee = tuitionFeeDue - scholarshipAmount;
            const totalDue = inscriptionFeeDue + adjustedTuitionFee;

            const responseData = {
                schoolYear: canonSY,
                inscriptionFeeDue,
                tuitionFeeDue,
                paidInscriptionFee,
                paidTuition,
                totalPaid: paidInscriptionFee + paidTuition,
                remainingInscriptionFee: Math.max(0, inscriptionFeeDue - paidInscriptionFee),
                remainingTuition: Math.max(0, adjustedTuitionFee - paidTuition),
                totalRemaining: Math.max(0, totalDue - (paidInscriptionFee + paidTuition)),
                scholarshipPercentage,
                scholarshipAmount,
                adjustedTuitionFee,
                totalDue,
                payments
            };
            return { success: true, data: responseData, error: "", message: "Paiements de l'étudiant récupérés avec succès" };
        } catch (error) {
            console.error(`Erreur lors de la récupération des paiements pour l\'étudiant ${studentId}:`, error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des paiements",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getConfigByClass(classId: string): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const config = await this.configRepository.findOne({
                where: { classId }
            });

            return {
                success: true,
                data: config,
                message: "Configuration récupérée avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération de la configuration",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getRemainingAmount(studentId: number): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const student = await this.studentRepository.findOne({
                where: { id: studentId },
                relations: ['grade']
            });

            if (!student || !student.grade) {
                return {
                    success: false,
                    data: null,
                    message: "Étudiant ou classe non trouvé",
                    error: "STUDENT_OR_GRADE_NOT_FOUND"
                };
            }

            const config = await this.configRepository.findOne({
                where: { classId: student.grade.id?.toString() || '0' }
            });

            if (!config) {
                return {
                    success: false,
                    data: null,
                    message: "Configuration de paiement non trouvée",
                    error: "PAYMENT_CONFIG_NOT_FOUND"
                };
            }

            const payments = await this.paymentRepository.find({
                where: { student: { id: studentId } }
            });

            const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
            const remaining = Number(config.annualAmount) - totalPaid;

            return {
                success: true,
                data: { remaining },
                message: "Montant restant calculé avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors du calcul du montant restant",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    // Façade : mise à jour whitelistée via accountingService (montant/net/caisse intouchables).
    async updateProfessorPayment(paymentData: IPaymentServiceParams['updateProfessorPayment']): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const { accountingService } = await import("./accountingService");
            const r: any = await accountingService.professorPaymentUpdate(Number((paymentData as any).id), paymentData);
            return { success: r.success, data: r.data, message: r.message, error: r.error };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la mise à jour du paiement",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    // Façade lecture seule vers accountingService.professorPaymentsList.
    async getProfessorPayments(filters: any): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const { accountingService } = await import("./accountingService");
            const r: any = await accountingService.professorPaymentsList(filters ?? {});
            return { success: r.success, data: r.data, message: r.message, error: r.error };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des paiements",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    // Façade lecture seule vers accountingService.professorPaymentsStats.
    async getProfessorPaymentStats(): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const { accountingService } = await import("./accountingService");
            const r: any = await accountingService.professorPaymentsStats();
            return { success: r.success, data: r.data, message: r.message, error: r.error };
        } catch (error) {
            console.error('Erreur lors du calcul des statistiques:', error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des statistiques",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getProfessorPaymentById(paymentId: number): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const payment = await this.professorPaymentRepository.findOne({
                where: { id: paymentId },
                relations: ['professor']
            });

            if (!payment) {
                return {
                    success: false,
                    data: null,
                    message: "Paiement non trouvé",
                    error: "PAYMENT_NOT_FOUND"
                };
            }

            return {
                success: true,
                data: payment,
                message: "Paiement récupéré avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération du paiement",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getActiveByStudent(studentId: number, schoolYear?: string): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const { resolveTargetSchoolYear } = await import("../lib/yearGuard");
            const canonSY = await resolveTargetSchoolYear(schoolYear);
            const scholarship = await this.scholarshipRepository.findOne({
                where: { 
                    studentId,
                    isActive: true,
                    schoolYear: canonSY
                } as any
            });

            return {
                success: true,
                data: scholarship,
                message: "Bourse active récupérée avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération de la bourse active",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getRecentPayments(limit: number): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const payments = await this.paymentRepository.find({
                relations: ['student'],
                order: { created_at: 'DESC' },
                take: limit
            });

            return {
                success: true,
                data: payments,
                message: "Paiements récents récupérés avec succès",
                error: null
            };
        } catch (error) {
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des paiements récents",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getHistoryByStudent(studentId: number): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            
            const payments = await this.paymentRepository.find({
                where: { student: { id: studentId } },
                relations: ['student', 'scholarship'],
                order: { created_at: 'DESC' }
            });

            // Formater les données pour l'affichage
            const formattedPayments = payments.map(payment => ({
                id: payment.id,
                amount: payment.amount,
                paymentDate: payment.created_at,
                paymentMethod: payment.paymentMethod,
                feeType: payment.paymentType, // 'inscription' ou 'tuition'
                comment: payment.comment || '',
                scholarshipPercentage: payment.scholarshipPercentage || 0,
                scholarshipAmount: payment.scholarshipAmount || 0,
                baseAmount: payment.baseAmount || payment.amount,
                adjustedAmount: payment.adjustedAmount || payment.amount
            }));

            return {
                success: true,
                data: formattedPayments,
                message: "Historique des paiements récupéré avec succès",
                error: null
            };
        } catch (error) {
            console.error(`Erreur lors de la récupération de l'historique pour l'étudiant ${studentId}:`, error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération de l'historique des paiements",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async getPaymentsByDate(date: string): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            
            // Créer les dates de début et fin de journée
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);
            
            // Récupérer tous les paiements de la journée avec les relations
            const payments = await this.paymentRepository.find({
                where: {
                    created_at: Between(startOfDay, endOfDay)
                },
                relations: ['student', 'student.grade'],
                order: {
                    created_at: 'ASC'
                }
            });
            
            return {
                success: true,
                data: payments,
                message: `${payments.length} paiement(s) trouvé(s) pour le ${date}`,
                error: null
            };
        } catch (error) {
            console.error(`Erreur lors de la récupération des paiements du ${date}:`, error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des paiements journaliers",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    // Méthodes pour les configurations personnalisées
    // Stockage temporaire en mémoire pour les configurations personnalisées
    private customConfigs: Map<number, any> = new Map();
    
    async getCustomConfigs(): Promise<ResultType> {
        try {
            await this.ensureRepositoriesInitialized();
            
            // TODO: Implémenter avec une vraie entité CustomPaymentConfigEntity
            // Pour l'instant, utiliser le stockage temporaire
            const configs = Array.from(this.customConfigs.values());
            
            return {
                success: true,
                data: configs,
                message: "Configurations personnalisées récupérées",
                error: null
            };
        } catch (error) {
            console.error("Erreur lors de la récupération des configurations personnalisées:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la récupération des configurations",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async saveCustomConfig(configData: any): Promise<ResultType> {
        try {
            await this.ensureRepositoriesInitialized();
            
            // Valider les données reçues
            if (!configData || !configData.gradeId || !configData.name) {
                return {
                    success: false,
                    data: null,
                    message: "Données de configuration incomplètes",
                    error: "Missing required fields"
                };
            }
            
            // Convertir les dates string en objets Date si nécessaire
            if (configData.customSchedule && configData.customSchedule.schedules) {
                configData.customSchedule.schedules = configData.customSchedule.schedules.map((schedule: any) => ({
                    ...schedule,
                    dueDate: typeof schedule.dueDate === 'string' ? new Date(schedule.dueDate) : schedule.dueDate
                }));
            }
            
            // TODO: Implémenter la sauvegarde réelle avec CustomPaymentConfigEntity
            // Pour l'instant, utiliser le stockage temporaire en mémoire
            const savedConfig = { 
                ...configData, 
                id: configData.id || Date.now(),
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            // Sauvegarder dans le Map
            this.customConfigs.set(savedConfig.id, savedConfig);
            
            console.log("Configuration personnalisée sauvegardée:", savedConfig);
            
            return {
                success: true,
                data: savedConfig,
                message: "Configuration personnalisée sauvegardée avec succès",
                error: null
            };
        } catch (error) {
            console.error("Erreur lors de la sauvegarde de la configuration personnalisée:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la sauvegarde de la configuration",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    /**
     * Mensualités — échéances mensuelles par élève, données réelles uniquement, zéro mock.
     * Sources : paiements `tuition` existants (groupés par mois civil de `created_at`)
     * et/ou calendrier des tranches (`TrancheEntryEntity.startDate..endDate`).
     * - Univers des mois : mois couverts par les tranches si configurées, sinon mois
     *   observés dans les paiements (aucun mois inventé).
     * - Échéance attendue par élève : `PaymentConfigEntity.annualAmount / 12` du niveau
     *   (config canonique `schoolYear` d'abord, repli legacy tracé). Sans config :
     *   seules les lignes avec versement sont émises (montant = somme versée).
     * - Statut : 'payé' (versé >= attendu, ou versement sans config), 'partiel',
     *   'impayé' (mois planifié par les tranches, zéro versement).
     * - Scope année scolaire canonique (défaut année courante, anti fuite inter-années).
     * - Retourne `[]` valide si aucune donnée. Fail-closed : toute erreur => envelope
     *   `{ success: false }` (jamais dethrow vers l'IPC, jamais de données forgées).
     */
    async getMensualites(schoolYear?: string): Promise<IPaymentServiceResponse> {
        try {
            await this.ensureRepositoriesInitialized();
            const { resolveTargetSchoolYear } = await import("../lib/yearGuard");
            const { matchesSchoolYearValue } = await import("../lib/schoolYear");
            const canonSY = await resolveTargetSchoolYear(schoolYear);

            const students = await this.studentRepository.find({ relations: ["grade"] });
            const inYearStudents = students.filter((s: any) =>
                matchesSchoolYearValue((s as any)?.schoolYear, canonSY)
            );

            const allPayments = await this.paymentRepository.find({ relations: ["student"] });
            const payments = allPayments.filter((p: any) =>
                matchesSchoolYearValue((p as any)?.schoolYear, canonSY) &&
                (p as any)?.paymentType !== "inscription" &&
                (p as any)?.paymentType !== "reinscription"
            );

            // Configs annuelles par niveau (canon d'abord, repli legacy).
            const configs = await this.configRepository.find().catch(() => []);
            const configByClass = new Map<string, any>();
            for (const c of configs) {
                const key = String((c as any)?.classId ?? "");
                if (!key) continue;
                const prev = configByClass.get(key);
                if (!prev) { configByClass.set(key, c); continue; }
                const prevCanon = (prev as any)?.schoolYear === canonSY;
                const curCanon = (c as any)?.schoolYear === canonSY;
                if (curCanon && !prevCanon) configByClass.set(key, c);
            }
            if (configs.length > 0 && configByClass.size === 0) {
                console.warn(`[mensualites] configs présentes mais aucune rattachable (année ${canonSY})`);
            }

            // Mois planifiés par les tranches (startDate..endDate -> YYYY-MM).
            const scheduled = new Set<string>();
            try {
                const entries = await this.tranchEntryRepository.find();
                for (const e of entries) {
                    const rawS = (e as any)?.startDate;
                    const rawE = (e as any)?.endDate;
                    const s = rawS ? new Date(rawS) : null;
                    const en = rawE ? new Date(rawE) : null;
                    if (!s || !en || Number.isNaN(s.getTime()) || Number.isNaN(en.getTime()) || s > en) continue;
                    const cur = new Date(s.getFullYear(), s.getMonth(), 1);
                    const last = new Date(en.getFullYear(), en.getMonth(), 1);
                    while (cur <= last) {
                        scheduled.add(`${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}`);
                        cur.setMonth(cur.getMonth() + 1);
                    }
                }
            } catch (e) {
                console.warn("[mensualites] lecture tranches ignorée (best-effort):", e);
            }

            // Versements groupés par (élève, mois civil de created_at).
            const paidByKey = new Map<string, number>();
            const observed = new Set<string>();
            for (const p of payments) {
                const raw = (p as any)?.created_at;
                const d = raw ? new Date(raw) : null;
                if (!d || Number.isNaN(d.getTime())) continue;
                const mois = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
                const sid = Number((p as any)?.studentId ?? (p as any)?.student?.id);
                if (!Number.isFinite(sid)) continue;
                observed.add(mois);
                const key = `${sid}|${mois}`;
                paidByKey.set(key, (paidByKey.get(key) ?? 0) + (Number((p as any)?.amount ?? 0) || 0));
            }

            const monthsUniverse = (scheduled.size > 0 ? [...scheduled] : [...observed]).sort();

            const rows: MensualiteRow[] = [];
            for (const s of inYearStudents) {
                const sid = Number((s as any)?.id);
                if (!Number.isFinite(sid)) continue;
                const gradeId = (s as any)?.grade?.id != null ? String((s as any).grade.id) : null;
                const cfg = gradeId ? configByClass.get(gradeId) : null;
                const annual = Number((cfg as any)?.annualAmount ?? 0) || 0;
                const expected = annual > 0 ? Math.round((annual / 12) * 100) / 100 : 0;
                const fullName = [String((s as any)?.firstname ?? "").trim(), String((s as any)?.lastname ?? "").trim()].filter(Boolean).join(" ");
                const eleve = fullName || String((s as any)?.matricule ?? "").trim() || `Élève #${sid}`;
                for (const mois of monthsUniverse) {
                    const paid = paidByKey.get(`${sid}|${mois}`) ?? 0;
                    // Sans échéance attendue ni versement : aucun signal réel -> pas de ligne inventée.
                    if (expected <= 0 && paid <= 0) continue;
                    const statut: MensualiteRow["statut"] = expected > 0
                        ? (paid >= expected ? "payé" : paid > 0 ? "partiel" : "impayé")
                        : "payé";
                    rows.push({ mois, eleve, montant: expected > 0 ? expected : paid, statut });
                }
            }
            rows.sort((a, b) => a.mois.localeCompare(b.mois) || a.eleve.localeCompare(b.eleve));

            console.log(`[mensualites] année=${canonSY} élèves=${inYearStudents.length} paiements=${payments.length} mois=${monthsUniverse.length} lignes=${rows.length}`);
            return {
                success: true,
                data: rows,
                message: rows.length > 0 ? `${rows.length} mensualité(s) récupérée(s)` : "Aucune mensualité enregistrée",
                error: null
            };
        } catch (error) {
            console.error("[mensualites] erreur calcul:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors du calcul des mensualités",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }

    async deleteCustomConfig(configId: number): Promise<ResultType> {
        try {
            await this.ensureRepositoriesInitialized();
            
            // TODO: Implémenter la suppression réelle avec CustomPaymentConfigEntity
            // Pour l'instant, supprimer du stockage temporaire
            const deleted = this.customConfigs.delete(configId);
            
            if (deleted) {
                console.log("Configuration personnalisée supprimée:", configId);
                return {
                    success: true,
                    data: null,
                    message: "Configuration personnalisée supprimée",
                    error: null
                };
            } else {
                return {
                    success: false,
                    data: null,
                    message: "Configuration non trouvée",
                    error: "Configuration with id " + configId + " not found"
                };
            }
        } catch (error) {
            console.error("Erreur lors de la suppression de la configuration personnalisée:", error);
            return {
                success: false,
                data: null,
                message: "Erreur lors de la suppression",
                error: error instanceof Error ? error.message : "Erreur inconnue"
            };
        }
    }
}
