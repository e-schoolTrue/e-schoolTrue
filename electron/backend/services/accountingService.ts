import { AppDataSource } from "../../data-source";
import { PaymentEntity } from "../entities/payment";
import { ProfessorPaymentEntity } from "../entities/professorPayment";
import { PaymentConfigEntity } from "../entities/paymentConfig";
import { PaymentAnnualConfigEntity } from "../entities/paymentConfig";
import { StudentEntity } from "../entities/students";
import { ProfessorEntity } from "../entities/professor";
import { SchoolEntity } from "../entities/school";
import {
  ExpenseEntity, CashRegisterEntity, CashMovementEntity, CashClosureEntity,
  BankAccountEntity, BankTransactionEntity, TeacherHourLogEntity, SalarySlipEntity,
  ReceiptCounterEntity, ProfessorPaymentCounterEntity,
} from "../entities/accounting";
import { currencyForCountry, roundMoney, amountInWords, CurrencyCode } from "../utils/countryCurrency";

type Envelope<T> = { success: boolean; data: T | null; message: string; error: string | null };
const ok = <T>(data: T, message = "OK"): Envelope<T> => ({ success: true, data, message, error: null });
const fail = (message: string, error: string): Envelope<null> => ({ success: false, data: null, message, error });
const empty = (message: string): Envelope<null> => ({ success: true, data: null, message, error: null });

function toNum(v: unknown): number { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function isoDay(d: Date): string { return d.toISOString().slice(0, 10); }
function monthKey(d = new Date()): string { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }

async function schoolCurrency(): Promise<CurrencyCode> {
  try {
    const repo = AppDataSource.getInstance().getRepository(SchoolEntity);
    const s = await repo.findOne({ where: {} });
    return currencyForCountry((s as any)?.country, "GNF");
  } catch { return "GNF"; }
}

async function nextReceiptNumber(manager: any, currency: string): Promise<string> {
  // B3: compteur calé sur l'année canonique (pas l'année civile brute).
  let year = new Date().getFullYear();
  try {
    const { resolveTargetSchoolYear } = await import("../lib/yearGuard");
    year = Number((await resolveTargetSchoolYear()).slice(0, 4)) || year;
  } catch { /* fallback civil */ }
  const counterRepo = manager.getRepository(ReceiptCounterEntity);
  let counter = await counterRepo.findOne({ where: { year }, lock: { mode: "pessimistic_write" } });
  if (!counter) counter = counterRepo.create({ year, lastNumber: 0 });
  counter.lastNumber = toNum(counter.lastNumber) + 1;
  await counterRepo.save(counter);
  return `R-${year}-${String(counter.lastNumber).padStart(4, "0")}`;
}

async function nextProfessorRef(manager: any): Promise<string> {
  // B3: compteur calé sur l'année canonique.
  let year = new Date().getFullYear();
  try {
    const { resolveTargetSchoolYear } = await import("../lib/yearGuard");
    year = Number((await resolveTargetSchoolYear()).slice(0, 4)) || year;
  } catch { /* fallback civil */ }
  const repo = manager.getRepository(ProfessorPaymentCounterEntity);
  let c = await repo.findOne({ where: { year }, lock: { mode: "pessimistic_write" } });
  if (!c) c = repo.create({ year, lastNumber: 0 });
  c.lastNumber = toNum(c.lastNumber) + 1;
  await repo.save(c);
  return `PAY-ENS-${year}-${String(c.lastNumber).padStart(4, "0")}`;
}

export class AccountingService {
  /** B3: année canonique par défaut (année courante YearRepartition > canon du jour). */
  private async currentSY(explicit?: unknown): Promise<string> {
    const { resolveTargetSchoolYear } = await import("../lib/yearGuard");
    return resolveTargetSchoolYear(explicit);
  }

  /** B3: dashboard scopé par schoolYear canonique (défaut année courante). */
  async dashboard(schoolYear?: string | { schoolYear?: string }): Promise<Envelope<any>> {
    try {
      const explicit = typeof schoolYear === "string" ? schoolYear : (schoolYear as any)?.schoolYear;
      const sy = await this.currentSY(explicit);
      // Rétro-compat legacy civile ('2026' vs '2026-2027').
      const { schoolYearMatchValues: matchVals, matchesSchoolYearValue: matchesSY } = await import("../lib/schoolYear");
      const sys = matchVals(sy);
      const ds = AppDataSource.getInstance();
      const currency = await schoolCurrency();
      const now = new Date();
      const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
      const payRepo = ds.getRepository(PaymentEntity);
      const expRepo = ds.getRepository(ExpenseEntity);
      const movRepo = ds.getRepository(CashMovementEntity);
      const regRepo = ds.getRepository(CashRegisterEntity);
      const studRepo = ds.getRepository(StudentEntity);
      const profPayRepo = ds.getRepository(ProfessorPaymentEntity);

      const paymentsMonth: any[] = await payRepo.createQueryBuilder("p")
        .where("p.created_at >= :from", { from: firstOfMonth }).andWhere("p.deleted_at IS NULL")
        .andWhere("(p.schoolYear IS NULL OR p.schoolYear IN (:...sys))", { sys }).getMany();
      const encaisseMois = paymentsMonth.reduce((s, p) => s + toNum(p.amount), 0);

      const expensesMonth: any[] = await expRepo.createQueryBuilder("e")
        .where("e.created_at >= :from", { from: firstOfMonth })
        .andWhere("e.deleted_at IS NULL").andWhere("e.status != :c", { c: "cancelled" })
        .andWhere("(e.schoolYear IS NULL OR e.schoolYear IN (:...sys))", { sys }).getMany();
      const depensesMois = expensesMonth.reduce((s, e) => s + toNum(e.amount), 0);

      const impayes = await this.computeArrearsBase(sy);
      const impayesTotal = impayes.reduce((s, r: any) => s + toNum(r.reste), 0);
      const elevesEnRetard = impayes.length;
      // B3: effectif de l'année (lignes legacy sans schoolYear conservées).
      // SEV3: année à 0 élève => 0 (jamais de fallback `|| count` global toutes années).
      const allStudents: any[] = await studRepo.find({} as any).catch(() => []);
      const scopedStudents = allStudents.filter((s: any) => matchesSY((s as any)?.schoolYear, sy));
      const totalEleves = scopedStudents.length;
      const elevesAJour = Math.max(0, totalEleves - elevesEnRetard);

      const regs = await regRepo.find({ order: { registerDate: "DESC" } as any });
      let soldeCaisse = 0;
      if (regs.length) {
        const last = regs[0] as any;
        const movs: any[] = await movRepo.find({ where: { registerId: last.id } as any });
        const ins = movs.filter((m) => m.direction === "IN").reduce((s, m) => s + toNum(m.amount), 0);
        const outs = movs.filter((m) => m.direction === "OUT").reduce((s, m) => s + toNum(m.amount), 0);
        soldeCaisse = toNum(last.openingBalance) + ins - outs;
      }

      const profMonth: any[] = await profPayRepo.createQueryBuilder("p")
        .where("p.month = :m", { m: monthKey(now) }).andWhere("p.deleted_at IS NULL").getMany().catch(() => []);
      const salairesMois = profMonth.reduce((s, p) => s + toNum(p.netAmount ?? p.amount), 0);
      const paiementsMois = paymentsMonth.length;

      const curve: Array<{ date: string; entrees: number; sorties: number }> = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(); d.setDate(d.getDate() - i);
        const dayStart = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
        const ins: any = await payRepo.createQueryBuilder("p")
          .select("COALESCE(SUM(p.amount),0)", "s")
          .where("p.created_at BETWEEN :a AND :b", { a: dayStart, b: dayEnd })
          .andWhere("p.deleted_at IS NULL").andWhere("(p.schoolYear IS NULL OR p.schoolYear IN (:...sys))", { sys }).getRawOne().catch(() => ({ s: 0 }));
        const outs: any = await expRepo.createQueryBuilder("e")
          .select("COALESCE(SUM(e.amount),0)", "s")
          .where("e.created_at BETWEEN :a AND :b", { a: dayStart, b: dayEnd })
          .andWhere("e.deleted_at IS NULL").andWhere("e.status != :c", { c: "cancelled" }).andWhere("(e.schoolYear IS NULL OR e.schoolYear IN (:...sys))", { sys }).getRawOne().catch(() => ({ s: 0 }));
        curve.push({ date: d.toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" }), entrees: toNum(ins?.s), sorties: toNum(outs?.s) });
      }

      return ok({ currency, schoolYear: sy, encaisseMois, impayesTotal, depensesMois, soldeCaisse, elevesAJour, elevesEnRetard, totalEleves, salairesMois, paiementsMois, curve }, "Tableau de bord comptable");
    } catch (e) {
      return fail("Erreur tableau de bord", e instanceof Error ? e.message : String(e));
    }
  }

  /** B3: répartition scopée par schoolYear canonique (défaut année courante). */
  async repartition(schoolYear?: string | { schoolYear?: string }): Promise<Envelope<any>> {
    try {
      const explicit = typeof schoolYear === "string" ? schoolYear : (schoolYear as any)?.schoolYear;
      const sy = await this.currentSY(explicit);
      const { schoolYearMatchValues: matchValsRep } = await import("../lib/schoolYear");
      const sys = matchValsRep(sy);
      const ds = AppDataSource.getInstance();
      const payRepo = ds.getRepository(PaymentEntity);
      const byType: any[] = await payRepo.createQueryBuilder("p")
        .select("p.paymentType", "label").addSelect("SUM(p.amount)", "total")
        .where("p.deleted_at IS NULL").andWhere("(p.schoolYear IS NULL OR p.schoolYear IN (:...sys))", { sys }).groupBy("p.paymentType").getRawMany().catch(() => []);
      const byMode: any[] = await payRepo.createQueryBuilder("p")
        .select("p.paymentMethod", "label").addSelect("SUM(p.amount)", "total")
        .where("p.deleted_at IS NULL").andWhere("(p.schoolYear IS NULL OR p.schoolYear IN (:...sys))", { sys }).groupBy("p.paymentMethod").getRawMany().catch(() => []);
      const types = { labels: byType.map((r) => String(r.label ?? "Autres")), values: byType.map((r) => toNum(r.total)) };
      const modes = { labels: byMode.map((r) => String(r.label ?? "Espèces")), values: byMode.map((r) => toNum(r.total)) };
      if (!types.labels.length) return ok({ schoolYear: sy, types: { labels: [], values: [] }, modes: { labels: [], values: [] }, empty: true }, "Aucune répartition : aucun encaissement enregistré");
      return ok({ schoolYear: sy, types, modes }, "Répartition calculée");
    } catch (e) {
      return fail("Erreur répartition", e instanceof Error ? e.message : String(e));
    }
  }

  private pickStudentPhone(s: any): string {
    const candidates = [s?.famillyPhone, s?.personalPhone];
    for (const c of candidates) {
      const v = String(c ?? "").trim();
      if (v) return v;
    }
    return "";
  }

  private async resolveEcheanceISO(gradeId: number | undefined): Promise<string> {
    try {
      const ds = AppDataSource.getInstance();
      if (gradeId == null) return "";
      const annualRepo = ds.getRepository(PaymentAnnualConfigEntity);
      const annual: any = await annualRepo
        .findOne({ where: { grade: { id: Number(gradeId) } } as any, relations: ["tranches", "tranches.entries"] })
        .catch(() => null);
      const dates: number[] = [];
      const tranches: any[] = Array.isArray(annual?.tranches) ? annual.tranches : [];
      for (const t of tranches) {
        const entries: any[] = Array.isArray(t?.entries) ? t.entries : [];
        if (!entries.length && t?.endDate) dates.push(new Date(t.endDate).getTime());
        for (const e of entries) {
          const d = e?.endDate ? new Date(e.endDate).getTime() : NaN;
          if (Number.isFinite(d)) dates.push(d);
        }
        // Tranche sans entrée datée : repli sur compteur mensuel si présent
        if (!entries.length && Number.isFinite(Number(t?.tranchMonthCount))) {
          const year = new Date().getFullYear();
          const m = Math.min(12, Math.max(1, Number(t.tranchMonthCount)));
          dates.push(new Date(year, m, 0).getTime());
        }
      }
      if (dates.length) {
        const max = Math.max(...dates.filter((d) => Number.isFinite(d)));
        if (Number.isFinite(max)) return new Date(max).toISOString().slice(0, 10);
      }
    } catch { /* repli ci-dessous */ }
    // Repli config : fin d'année scolaire (30/06) — format JJ/MM/AAAA côté front
    const now = new Date();
    const juneYear = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    return `${juneYear}-06-30`;
  }

  /** B3: base impayés scopée par schoolYear canonique (défaut année courante). */
  private async computeArrearsBase(schoolYear?: string): Promise<any[]> {
    const sy = await this.currentSY(schoolYear);
    const { matchesSchoolYearValue: matchesArrearsSY } = await import("../lib/schoolYear");
    const ds = AppDataSource.getInstance();
    const studRepo = ds.getRepository(StudentEntity);
    const payRepo = ds.getRepository(PaymentEntity);
    const cfgRepo = ds.getRepository(PaymentConfigEntity);
    const students: any[] = await studRepo.find({ relations: ["grade"] as any }).catch(() => []);
    const out: any[] = [];
    for (const s of students) {
      // B3: fuite inter-années — ignorer les élèves d'une autre année
      // (lignes legacy sans schoolYear conservées + civile '2026' ≈ canon '2026-2027').
      if (!matchesArrearsSY(s?.schoolYear, sy)) continue;
      // Config canonique d'abord, fallback legacy tracé (B6).
      let cfg: any = s?.grade ? await cfgRepo.findOne({ where: { classId: String(s.grade.id), schoolYear: sy } as any }).catch(() => null) : null;
      if (!cfg && s?.grade) {
        const legacy = await cfgRepo.findOne({ where: { classId: String(s.grade.id) } }).catch(() => null);
        if (legacy) console.warn(`[arrears] fallback config legacy (classId=${s.grade.id}) → année ${sy}.`);
        cfg = legacy;
      }
      const inscriptionDue = s?.isNew === false ? toNum(cfg?.reInscriptionFee) : toNum(cfg?.inscriptionFee);
      const tuitionDue = toNum(cfg?.annualAmount);
      const totalDu = inscriptionDue + tuitionDue;
      if (totalDu <= 0) continue;
      const allPays: any[] = await payRepo.find({ where: { student: { id: s.id } } as any }).catch(() => []);
      const pays = allPays.filter((p: any) => matchesArrearsSY((p as any)?.schoolYear, sy));
      const totalPaye = pays.reduce((sum, p) => sum + toNum(p.amount), 0);
      const reste = Math.max(0, roundMoney(totalDu - totalPaye, "GNF"));
      if (reste <= 0) continue;
      const syStartYear = Number(sy.slice(0, 4));
      const yearStart = new Date(Number.isFinite(syStartYear) ? syStartYear : new Date().getFullYear(), 8, 1);
      const joursRetard = Math.max(0, Math.floor((Date.now() - yearStart.getTime()) / 86400000));
      const phone = this.pickStudentPhone(s);
      const echeance = await this.resolveEcheanceISO(s?.grade?.id);
      out.push({
        id: s.id, firstname: s.firstname ?? "", lastname: s.lastname ?? "", matricule: s.matricule ?? "",
        classe: s?.grade?.name ?? "", phone, schoolYear: sy,
        famillyPhone: String(s?.famillyPhone ?? "").trim(),
        personalPhone: String(s?.personalPhone ?? "").trim(),
        echeance,
        totalDu, totalPaye, reste, joursRetard, statut: totalPaye > 0 ? "partiel" : "impaye",
      });
    }
    return out;
  }

  async impayes(params: any = {}): Promise<Envelope<any>> {
    try {
      const { classe = "", statut = "", retardMin = null, montantMin = null, recherche = "", page = 1, pageSize = 20, schoolYear } = params ?? {};
      const sy = await this.currentSY(schoolYear);
      let rows = await this.computeArrearsBase(sy);
      if (classe) rows = rows.filter((r) => r.classe === classe);
      if (statut) rows = rows.filter((r) => r.statut === statut);
      if (retardMin != null && retardMin !== "") rows = rows.filter((r) => r.joursRetard >= Number(retardMin));
      if (montantMin != null && montantMin !== "") rows = rows.filter((r) => r.reste >= Number(montantMin));
      if (recherche) { const q = String(recherche).toLowerCase().trim(); rows = rows.filter((r) => `${r.firstname} ${r.lastname} ${r.matricule}`.toLowerCase().includes(q)); }
      rows.sort((a, b) => b.joursRetard - a.joursRetard);
      const total = rows.length;
      const p = Math.max(1, Number(page) || 1); const ps = Math.min(200, Math.max(1, Number(pageSize) || 20));
      const items = rows.slice((p - 1) * ps, (p - 1) * ps + ps);
      if (!total) return ok({ items: [], total: 0, page: p, pageSize: ps, schoolYear: sy, empty: true }, "Aucun impayé : tous les élèves sont à jour");
      return ok({ items, total, page: p, pageSize: ps, schoolYear: sy }, `${total} impayé(s)`);
    } catch (e) {
      return fail("Erreur impayés", e instanceof Error ? e.message : String(e));
    }
  }

  async receiptGet(idOrNumber: any): Promise<Envelope<any>> {
    try {
      const ds = AppDataSource.getInstance();
      const currency = await schoolCurrency();
      const payRepo = ds.getRepository(PaymentEntity);
      let p: any = null;
      if (typeof idOrNumber === "number" || /^\d+$/.test(String(idOrNumber))) {
        p = await payRepo.findOne({ where: { id: Number(idOrNumber) }, relations: ["student", "student.grade"] as any });
      }
      if (!p) p = await payRepo.findOne({ where: { receiptNumber: String(idOrNumber) } as any, relations: ["student", "student.grade"] as any });
      if (!p) return fail("Reçu introuvable", "RECEIPT_NOT_FOUND");
      const montant = toNum(p.amount);
      return ok({
        id: String(p.id), numero: p.receiptNumber ?? `R-${p.id}`, date: new Date(p.created_at).toLocaleDateString("fr-FR"),
        eleve: `${p?.student?.firstname ?? ""} ${p?.student?.lastname ?? ""}`.trim(),
        matricule: p?.student?.matricule ?? "", classe: p?.student?.grade?.name ?? "",
        montant, mode: p.paymentMethod ?? "cash", motif: p.paymentType ?? "scolarité",
        currency: p.currency ?? currency, montantLettres: amountInWords(montant, (p.currency ?? currency) as any),
      }, "Reçu chargé");
    } catch (e) {
      return fail("Erreur reçu", e instanceof Error ? e.message : String(e));
    }
  }

  async receiptSend(id: any): Promise<Envelope<any>> {
    try {
      const r = await this.receiptGet(id);
      if (!r.success || !r.data) return r as any;
      return ok({ ok: true, numero: (r.data as any).numero }, `Reçu ${(r.data as any).numero} marqué comme envoyé`);
    } catch (e) {
      return fail("Erreur envoi reçu", e instanceof Error ? e.message : String(e));
    }
  }

  async expenseList(params: any = {}): Promise<Envelope<any>> {
    try {
      const ds = AppDataSource.getInstance();
      const repo = ds.getRepository(ExpenseEntity);
      const { status = "", page = 1, pageSize = 50 } = params ?? {};
      const qb = repo.createQueryBuilder("e").where("e.deleted_at IS NULL").orderBy("e.created_at", "DESC");
      if (status) qb.andWhere("e.status = :s", { s: status });
      const p = Math.max(1, Number(page) || 1); const ps = Math.min(200, Math.max(1, Number(pageSize) || 50));
      qb.skip((p - 1) * ps).take(ps);
      const [items, total] = await qb.getManyAndCount();
      const rows = items.map((e: any) => ({ id: e.id, date: e.expenseDate ? isoDay(new Date(e.expenseDate)) : isoDay(new Date(e.created_at)), categorie: e.category ?? "", libelle: e.label, montant: toNum(e.amount), mode: e.paymentMethod, justificatif: e.receiptNumber ?? "", acteur: "", status: e.status, currency: e.currency }));
      if (!total) return ok({ items: [], total: 0, page: p, pageSize: ps, empty: true }, "Aucune dépense enregistrée");
      return ok({ items: rows, total, page: p, pageSize: ps }, `${total} dépense(s)`);
    } catch (e) {
      return fail("Erreur liste dépenses", e instanceof Error ? e.message : String(e));
    }
  }

  async expenseCreate(payload: any): Promise<Envelope<any>> {
    try {
      if (!payload?.label || toNum(payload?.amount) <= 0) return fail("Libellé et montant>0 requis", "VALIDATION");
      const ds = AppDataSource.getInstance();
      const currency = await schoolCurrency();
      // B3: année canonique stockée (jamais civile brute).
      const syExp = await this.currentSY(payload?.schoolYear);
      // NOTE better-sqlite3 : pas d'isolation SERIALIZABLE (incompatible) — transaction
      // standard suffit (1 writer SQLite sérialisé). Verrou pessimistic_write conservé
      // avec fallback si le driver le refuse.
      return await ds.transaction(async (m) => {
        const expRepo = m.getRepository(ExpenseEntity);
        const movRepo = m.getRepository(CashMovementEntity);
        if (payload.idempotencyKey) {
          const ex = await expRepo.findOne({ where: { idempotencyKey: payload.idempotencyKey } as any });
          if (ex) return ok(ex, "Dépense déjà enregistrée (idempotent)");
        }
        const amount = roundMoney(toNum(payload.amount), currency);
        const e = expRepo.create({ label: payload.label, category: payload.categorie ?? payload.category ?? null, amount, currency, expenseDate: payload.date ? new Date(payload.date) : new Date(), paymentMethod: payload.mode ?? payload.paymentMethod ?? "cash", status: "pending", schoolYear: syExp, comment: payload.comment ?? null, idempotencyKey: payload.idempotencyKey ?? null } as any);
        const saved: any = await expRepo.save(e as any);
        await movRepo.save(movRepo.create({ direction: "OUT", amount, currency, motive: `Dépense: ${saved.label}`, reference: `D-${syExp.slice(0, 4)}-${String(saved.id).padStart(4, "0")}`, expenseId: saved.id, movementDate: new Date(), schoolYear: syExp, idempotencyKey: payload.idempotencyKey ? `exp-${payload.idempotencyKey}` : undefined } as any));
        return ok(saved, "Dépense créée (en attente de validation)");
      });
    } catch (e) {
      return fail("Erreur création dépense", e instanceof Error ? e.message : String(e));
    }
  }

  async expenseApprove(id: number): Promise<Envelope<any>> {
    try {
      const ds = AppDataSource.getInstance();
      const repo = ds.getRepository(ExpenseEntity);
      const e: any = await repo.findOne({ where: { id } });
      if (!e || e.deleted_at) return fail("Dépense introuvable", "NOT_FOUND");
      if (e.status === "cancelled") return fail("Dépense annulée : approbation refusée", "CANCELLED");
      e.status = "approved";
      await repo.save(e);
      return ok(e, "Dépense approuvée");
    } catch (e) {
      return fail("Erreur approbation", e instanceof Error ? e.message : String(e));
    }
  }

  async expenseReject(id: number): Promise<Envelope<any>> {
    try {
      const ds = AppDataSource.getInstance();
      // NOTE better-sqlite3 : pas d'isolation SERIALIZABLE (incompatible) — transaction
      // standard suffit (1 writer SQLite sérialisé). Verrou pessimistic_write conservé
      // avec fallback si le driver le refuse.
      // B3: contre-écriture hérite de l'année de la dépense, sinon courante.
      const e0: any = await ds.getRepository(ExpenseEntity).findOne({ where: { id } }).catch(() => null);
      const syCancel = await this.currentSY((e0 as any)?.schoolYear);
      return await ds.transaction(async (m) => {
        const expRepo = m.getRepository(ExpenseEntity);
        const movRepo = m.getRepository(CashMovementEntity);
        const e: any = await expRepo.findOne({ where: { id } });
        if (!e || e.deleted_at) return fail("Dépense introuvable", "NOT_FOUND");
        e.status = "cancelled";
        await expRepo.save(e);
        await movRepo.save(movRepo.create({ direction: "IN", amount: toNum(e.amount), currency: e.currency, motive: `Contre-écriture annulation dépense #${e.id}`, reference: `ANN-D-${e.id}`, expenseId: e.id, movementDate: new Date(), schoolYear: (e as any)?.schoolYear ?? syCancel } as any));
        return ok(e, "Dépense annulée avec contre-écriture");
      });
    } catch (e) {
      return fail("Erreur annulation", e instanceof Error ? e.message : String(e));
    }
  }

  private registerName(payload: any): string { return payload?.name ?? payload?.registre ?? "caisse principale"; }

  async cashDay(dateISO?: string): Promise<Envelope<any>> {
    try {
      const ds = AppDataSource.getInstance();
      const regRepo = ds.getRepository(CashRegisterEntity);
      const movRepo = ds.getRepository(CashMovementEntity);
      const day = dateISO ?? isoDay(new Date());
      const reg: any = await regRepo.findOne({ where: { registerDate: new Date(day) } as any, order: { id: "DESC" } as any }).catch(async () => {
        return await regRepo.createQueryBuilder("r").where("date(r.registerDate) = date(:d)", { d: day }).orderBy("r.id", "DESC").getOne();
      });
      if (!reg) return ok({ date: day, ouvert: false, fondOuverture: 0, totalEntrees: 0, totalSorties: 0, soldeTheorique: 0, cloture: false, empty: true }, "Caisse non ouverte pour ce jour");
      const movs: any[] = await movRepo.find({ where: { registerId: reg.id } as any });
      const totalEntrees = movs.filter((m) => m.direction === "IN").reduce((s, m) => s + toNum(m.amount), 0);
      const totalSorties = movs.filter((m) => m.direction === "OUT").reduce((s, m) => s + toNum(m.amount), 0);
      const soldeTheorique = roundMoney(toNum(reg.openingBalance) + totalEntrees - totalSorties, reg.currency ?? "GNF");
      const closure: any = await ds.getRepository(CashClosureEntity).findOne({ where: { registerId: reg.id } as any, order: { id: "DESC" } as any }).catch(() => null);
      return ok({ date: day, ouvert: reg.status === "open", fondOuverture: toNum(reg.openingBalance), totalEntrees, totalSorties, soldeTheorique, soldeReel: closure ? toNum(closure.countedAmount) : undefined, ecart: closure ? toNum(closure.gap) : undefined, cloture: reg.status === "closed", currency: reg.currency }, "Journée de caisse");
    } catch (e) {
      return fail("Erreur journée caisse", e instanceof Error ? e.message : String(e));
    }
  }

  async cashMovements(dateISO?: string): Promise<Envelope<any>> {
    try {
      const ds = AppDataSource.getInstance();
      const day = dateISO ?? isoDay(new Date());
      const reg: any = await ds.getRepository(CashRegisterEntity).createQueryBuilder("r").where("date(r.registerDate) = date(:d)", { d: day }).orderBy("r.id", "DESC").getOne();
      if (!reg) return ok({ items: [], empty: true }, "Aucun mouvement : caisse non ouverte");
      const movs: any[] = await ds.getRepository(CashMovementEntity).find({ where: { registerId: reg.id } as any, order: { created_at: "DESC" } as any });
      const rows = movs.map((m: any) => ({ id: m.id, heure: new Date(m.created_at).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }), sens: m.direction === "IN" ? "entree" : "sortie", motif: m.motive ?? "", montant: toNum(m.amount), mode: "Espèces", reference: m.reference ?? "", currency: m.currency }));
      return ok(rows.length ? rows : { items: [], empty: true } as any, rows.length ? `${rows.length} mouvement(s)` : "Aucun mouvement pour ce jour");
    } catch (e) {
      return fail("Erreur mouvements", e instanceof Error ? e.message : String(e));
    }
  }

  async cashOpen(payload: any): Promise<Envelope<any>> {
    try {
      const fond = toNum(payload?.fond ?? payload?.openingBalance);
      if (!(fond >= 0)) return fail("Fond d'ouverture invalide", "VALIDATION");
      const ds = AppDataSource.getInstance();
      const currency = await schoolCurrency();
      // NOTE better-sqlite3 : pas d'isolation SERIALIZABLE (incompatible) — transaction
      // standard suffit (1 writer SQLite sérialisé). Verrou pessimistic_write conservé
      // avec fallback si le driver le refuse.
      return await ds.transaction(async (m) => {
        const regRepo = m.getRepository(CashRegisterEntity);
        const today = isoDay(new Date());
        const name = this.registerName(payload);
        const existing: any = await regRepo.createQueryBuilder("r").where("r.name = :n AND date(r.registerDate) = date(:d)", { n: name, d: today }).getOne();
        if (existing) return fail(`Registre déjà ouvert pour ${today} (${name})`, "ALREADY_OPEN");
        const reg = regRepo.create({ name, registerDate: new Date(today), openingBalance: roundMoney(fond, currency), closingBalance: 0, currency, status: "open" } as any);
        const saved: any = await regRepo.save(reg as any);
        return ok(saved, `Caisse ouverte (${today}) avec fond ${fond} ${currency}`);
      });
    } catch (e: any) {
      if (String(e?.message ?? e).includes("UNIQUE") || String(e?.message ?? e).includes("UQ_cash")) return fail("Registre déjà ouvert pour ce jour (UQ 1 registre/jour)", "ALREADY_OPEN");
      return fail("Erreur ouverture caisse", e instanceof Error ? e.message : String(e));
    }
  }

  async cashClose(payload: any): Promise<Envelope<any>> {
    try {
      const soldeReel = toNum(payload?.soldeReel ?? payload?.countedAmount);
      if (!(soldeReel >= 0)) return fail("Solde réel invalide", "VALIDATION");
      const ds = AppDataSource.getInstance();
      // NOTE better-sqlite3 : pas d'isolation SERIALIZABLE (incompatible) — transaction
      // standard suffit (1 writer SQLite sérialisé). Verrou pessimistic_write conservé
      // avec fallback si le driver le refuse.
      return await ds.transaction(async (m) => {
        const regRepo = m.getRepository(CashRegisterEntity);
        const movRepo = m.getRepository(CashMovementEntity);
        const cloRepo = m.getRepository(CashClosureEntity);
        const today = isoDay(new Date());
        const reg: any = await regRepo.createQueryBuilder("r").where("date(r.registerDate) = date(:d)", { d: payload?.date ?? today }).orderBy("r.id", "DESC").getOne();
        if (!reg) return fail("Aucun registre ouvert pour ce jour", "NOT_OPEN");
        if (reg.status === "closed") return fail("Registre déjà clôturé : écritures refusées", "ALREADY_CLOSED");
        const movs: any[] = await movRepo.find({ where: { registerId: reg.id } as any });
        const ins = movs.filter((x) => x.direction === "IN").reduce((s, x) => s + toNum(x.amount), 0);
        const outs = movs.filter((x) => x.direction === "OUT").reduce((s, x) => s + toNum(x.amount), 0);
        const theo = roundMoney(toNum(reg.openingBalance) + ins - outs, reg.currency ?? "GNF");
        const ecart = roundMoney(soldeReel - theo, reg.currency ?? "GNF");
        reg.status = "closed"; reg.closingBalance = soldeReel;
        await regRepo.save(reg);
        const closure = await cloRepo.save(cloRepo.create({ registerId: reg.id, closureDate: new Date(payload?.date ?? today), expectedAmount: theo, countedAmount: soldeReel, gap: ecart, currency: reg.currency, validatedBy: payload?.validatedBy ?? null, comment: payload?.comment ?? null } as any) as any);
        return ok({ closure, soldeTheorique: theo, soldeReel, ecart }, `Clôture : théorique ${theo}, réel ${soldeReel}, écart ${ecart}`);
      });
    } catch (e) {
      return fail("Erreur clôture", e instanceof Error ? e.message : String(e));
    }
  }

  async cashAppend(payload: any): Promise<Envelope<any>> {
    try {
      const amount = toNum(payload?.montant ?? payload?.amount);
      const sens = payload?.sens === "entree" ? "IN" : payload?.sens === "sortie" ? "OUT" : payload?.direction;
      if (!(amount > 0) || (sens !== "IN" && sens !== "OUT")) return fail("Montant>0 et sens entree/sortie requis", "VALIDATION");
      const ds = AppDataSource.getInstance();
      // NOTE better-sqlite3 : pas d'isolation SERIALIZABLE (incompatible) — transaction
      // standard suffit (1 writer SQLite sérialisé). Verrou pessimistic_write conservé
      // avec fallback si le driver le refuse.
      return await ds.transaction(async (m) => {
        const regRepo = m.getRepository(CashRegisterEntity);
        const movRepo = m.getRepository(CashMovementEntity);
        if (payload?.idempotencyKey) {
          const ex = await movRepo.findOne({ where: { idempotencyKey: payload.idempotencyKey } as any });
          if (ex) return ok(ex, "Mouvement déjà enregistré (idempotent)");
        }
        const today = isoDay(new Date());
        let reg: any = await regRepo.createQueryBuilder("r").where("date(r.registerDate) = date(:d)", { d: today }).orderBy("r.id", "DESC").getOne();
        if (!reg) {
          const currency = await schoolCurrency();
          reg = await regRepo.save(regRepo.create({ name: "caisse principale", registerDate: new Date(today), openingBalance: 0, closingBalance: 0, currency, status: "open" } as any) as any) as any;
        }
        if (reg.status === "closed") return fail("Registre clôturé : mouvement refusé (append-only)", "REGISTER_CLOSED");
        const currency = reg.currency ?? await schoolCurrency();
        const syMov = await this.currentSY(payload?.schoolYear);
        const mv = movRepo.create({ registerId: reg.id, direction: sens, amount: roundMoney(amount, currency), currency, motive: payload?.motif ?? payload?.motive ?? "", reference: payload?.reference ?? null, movementDate: new Date(), schoolYear: syMov, idempotencyKey: payload?.idempotencyKey ?? null } as any);
        const saved: any = await movRepo.save(mv as any);
        return ok(saved, "Mouvement enregistré (append-only)");
      });
    } catch (e) {
      return fail("Erreur mouvement", e instanceof Error ? e.message : String(e));
    }
  }

  async teacherHours(params: any = {}): Promise<Envelope<any>> {
    try {
      const month = params?.month ?? monthKey();
      if (!/^\d{4}-\d{2}$/.test(month)) return fail("Mois invalide (YYYY-MM)", "VALIDATION");
      const ds = AppDataSource.getInstance();
      const logRepo = ds.getRepository(TeacherHourLogEntity);
      const profRepo = ds.getRepository(ProfessorEntity);
      const slipRepo = ds.getRepository(SalarySlipEntity);
      const payRepo = ds.getRepository(ProfessorPaymentEntity);
      const logs: any[] = await logRepo.find({ where: { month } as any });
      if (!logs.length) return ok({ items: [], empty: true }, `Aucune heure pour ${month}`);
      const byProf = new Map<number, any[]>();
      for (const l of logs) { const a = byProf.get(l.professorId) ?? []; a.push(l); byProf.set(l.professorId, a); }
      const rows: any[] = [];
      for (const [pid, arr] of byProf) {
        const prof: any = await profRepo.findOne({ where: { id: pid } }).catch(() => null);
        const heures = arr.reduce((s, x) => s + toNum(x.hours), 0);
        const tarif = toNum(arr[0]?.hourlyRate ?? prof?.hourlyRate ?? 0);
        const currency = (prof as any)?.currency ?? "GNF";
        const brut = roundMoney(heures * tarif, currency as any);
        // Enrichissement paie : sémantique LEFT JOIN SalarySlip + ProfessorPayment
        // (1 ligne / prof même sans bulletin ni paiement ; jamais de filtre inner).
        const slip: any = await slipRepo.findOne({ where: { professorId: pid, month } as any }).catch(() => null);
        let pay: any = null;
        try {
          pay = await payRepo.createQueryBuilder("p")
            .where("p.professorId = :pid AND p.month = :month", { pid, month })
            .andWhere("p.deleted_at IS NULL")
            .orderBy("p.id", "DESC").getOne();
        } catch { pay = null; }
        if (!pay && slip?.paymentId) {
          pay = await payRepo.findOne({ where: { id: slip.paymentId } }).catch(() => null);
        }
        const netAPayer = toNum(pay?.netAmount ?? slip?.netAmount ?? brut);
        rows.push({
          id: pid, firstname: prof?.firstname ?? "", lastname: prof?.lastname ?? "",
          matiere: arr[0]?.subject ?? "", heures, tarifHoraire: tarif, surcharge: 0, brut,
          statut: slip?.status === "paye" ? "paye" : slip?.status === "valide" ? "valide" : arr.every((x) => x.validated) ? "valide" : "brouillon",
          // Champs fusion paie → payment profs (nullables, lecture seule) :
          reference: pay?.reference ?? null,
          paymentId: pay?.id ?? slip?.paymentId ?? null,
          netAPayer,
          mode: pay?.paymentMethod ?? (prof as any)?.paymentMode ?? "cash",
          telephone: (prof as any)?.phone ?? (prof as any)?.telephone ?? (prof as any)?.contact ?? (prof as any)?.personalPhone ?? "",
          currency: pay?.currency ?? slip?.currency ?? currency,
          month, slipId: slip?.id ?? null,
        });
      }
      return ok(rows, `${rows.length} ligne(s) pour ${month}`);
    } catch (e) {
      return fail("Erreur heures enseignants", e instanceof Error ? e.message : String(e));
    }
  }

  async teacherValidate(id: number, month?: string): Promise<Envelope<any>> {
    try {
      const ds = AppDataSource.getInstance();
      const m = month ?? monthKey();
      // NOTE better-sqlite3 : pas d'isolation SERIALIZABLE (incompatible) — transaction
      // standard suffit (1 writer SQLite sérialisé). Verrou pessimistic_write conservé
      // avec fallback si le driver le refuse.
      return await ds.transaction(async (man) => {
        const logRepo = man.getRepository(TeacherHourLogEntity);
        const slipRepo = man.getRepository(SalarySlipEntity);
        const logs: any[] = await logRepo.find({ where: { professorId: id, month: m } as any });
        if (!logs.length) return fail(`Aucune heure pour prof ${id} en ${m}`, "NOT_FOUND");
        for (const l of logs) { l.validated = true; await logRepo.save(l); }
        const heures = logs.reduce((s, x) => s + toNum(x.hours), 0);
        const tarif = toNum(logs[0]?.hourlyRate ?? 0);
        const currency = await schoolCurrency();
        const brut = roundMoney(heures * tarif, currency);
        let slip: any = await slipRepo.findOne({ where: { professorId: id, month: m } as any });
        if (!slip) slip = slipRepo.create({ professorId: id, month: m, hoursTotal: heures, hourlyRate: tarif, grossAmount: brut, netAmount: brut, currency, status: "valide" } as any);
        else { slip.hoursTotal = heures; slip.hourlyRate = tarif; slip.grossAmount = brut; if (slip.status === "brouillon") { slip.netAmount = brut; slip.status = "valide"; } }
        const saved = await slipRepo.save(slip as any);
        return ok(saved, "Ligne validée (brouillon → valide)");
      });
    } catch (e) {
      return fail("Erreur validation", e instanceof Error ? e.message : String(e));
    }
  }

  async teacherPay(id: number, month?: string, extra: any = {}): Promise<Envelope<any>> {
    try {
      const ds = AppDataSource.getInstance();
      const m = month ?? monthKey();
      if (!/^\d{4}-\d{2}$/.test(m)) return fail("Mois invalide (YYYY-MM)", "VALIDATION");
      // NOTE better-sqlite3 : pas d'isolation SERIALIZABLE (incompatible) — transaction
      // standard suffit (1 writer SQLite sérialisé). Verrou pessimistic_write conservé
      // avec fallback si le driver le refuse.
      return await ds.transaction(async (man) => {
        const slipRepo = man.getRepository(SalarySlipEntity);
        const payRepo = man.getRepository(ProfessorPaymentEntity);
        const movRepo = man.getRepository(CashMovementEntity);
        const profRepo = man.getRepository(ProfessorEntity);
        let slip: any = await slipRepo.findOne({ where: { professorId: id, month: m } as any });
        // Fusion paie → payment direct (formulaire ProfessorPaymentDialog sans heures) :
        // auto-crée le bulletin en "valide" à partir de hoursTotal/hourlyRate fournis,
        // au lieu de refuser NOT_FOUND. Ne casse pas le flux heures → validation → paie.
        if (!slip) {
          const prof: any = await profRepo.findOne({ where: { id } }).catch(() => null);
          if (!prof) return fail(`Professeur #${id} introuvable`, "NOT_FOUND");
          const h = toNum(extra?.hoursTotal ?? 0);
          const t = toNum(extra?.hourlyRate ?? (prof as any)?.hourlyRate ?? 0);
          const currency0 = await schoolCurrency();
          slip = slipRepo.create({
            professorId: id, month: m, hoursTotal: h, hourlyRate: t,
            grossAmount: roundMoney(h * t, currency0), netAmount: roundMoney(h * t, currency0),
            currency: currency0, status: "valide",
            deductions: Array.isArray(extra?.deductions) ? extra.deductions : [],
            additions: Array.isArray(extra?.additions) ? extra.additions : [],
          } as any);
          slip = await slipRepo.save(slip as any);
        }
        if (slip.status === "paye") {
          const existing = slip.paymentId ? await payRepo.findOne({ where: { id: slip.paymentId } }) : null;
          return ok(existing ?? slip, "Déjà payé (idempotent)");
        }
        // UQ prof+month (logique, sans migration cassante) : un seul paiement / prof / mois.
        try {
          const already: any = await payRepo.createQueryBuilder("p")
            .where("p.professorId = :pid AND p.month = :month", { pid: id, month: m })
            .andWhere("p.deleted_at IS NULL").getOne();
          if (already) {
            slip.status = "paye"; slip.paymentId = already.id;
            await slipRepo.save(slip);
            return ok(already, "Déjà payé (UQ prof+mois, idempotent)");
          }
        } catch { /* best-effort UQ */ }
        if (slip.status !== "valide") return fail("Transition refusée : brouillon → valide requis avant paie", "INVALID_TRANSITION");
        if (extra?.idempotencyKey) {
          // P1 fix : garde scopée (idempotencyKey, professorId, month).
          // L'ancienne recherche globale retournait le paiement #1 pour #2 en lot.
          // Sans casser l'idempotence unitaire (même prof + même mois + même clé → rejeu OK).
          const scoped = await payRepo.findOne({ where: { idempotencyKey: extra.idempotencyKey, professorId: id, month: m } as any });
          if (scoped) return ok(scoped, "Paiement déjà enregistré (idempotent)");
          // Fail-closed : clé déjà utilisée pour un autre enseignant/mois = lot partagé
          // corrompu. Ne jamais retourner ce paiement ; refuser explicitement sans logger la clé.
          const collision = await payRepo.findOne({ where: { idempotencyKey: extra.idempotencyKey } as any });
          if (collision) return fail("Clé d'idempotence déjà utilisée pour un autre paiement", "DUPLICATE_IDEMPOTENCY_KEY");
        }
        const currency = slip.currency ?? await schoolCurrency();
        // Recalcul net fusionné : base heures*tarif + prime + transport + additions
        //                        - avance - retenue - deductions → Cash OUT sur le net.
        const prime = toNum(extra?.prime ?? extra?.bonus ?? 0);
        const transport = toNum(extra?.transport ?? extra?.transportAllowance ?? 0);
        const avance = toNum(extra?.avance ?? extra?.advance ?? extra?.avanceSalaire ?? 0);
        const retenue = toNum(extra?.retenue ?? extra?.holdback ?? 0);
        const arrDedExtra: any[] = Array.isArray(extra?.deductions) ? extra.deductions : [];
        const arrAddExtra: any[] = Array.isArray(extra?.additions) ? extra.additions : [];
        const arrDedSlip: any[] = Array.isArray(slip.deductions) ? slip.deductions : [];
        const arrAddSlip: any[] = Array.isArray(slip.additions) ? slip.additions : [];
        const sumDed = [...arrDedSlip, ...arrDedExtra].reduce((s: number, a: any) => s + toNum(a?.amount), 0);
        const sumAdd = [...arrAddSlip, ...arrAddExtra].reduce((s: number, a: any) => s + toNum(a?.amount), 0);
        const base = toNum(slip.hoursTotal) * toNum(slip.hourlyRate);
        const brut = roundMoney(base + sumAdd - sumDed, currency);
        const net = roundMoney(base + prime + transport + sumAdd - avance - retenue - sumDed, currency);
        if (!(net >= 0)) return fail("Net à payer négatif : vérifiez prime/transport/avance/retenue/déductions", "VALIDATION");
        // Référence canonique PAY-ENS-YYYY-XXXX. Une référence externe (n° chèque/virement
        // du formulaire) ne remplace jamais la référence comptable : elle est archivée
        // dans le commentaire pour traçabilité.
        const incomingRef = typeof extra?.reference === "string" ? extra.reference.trim() : "";
        const isCanon = /^PAY-ENS-\d{4}-\d{4}$/.test(incomingRef);
        const reference = isCanon ? incomingRef : await nextProfessorRef(man);
        if (!isCanon) {
          const dup = await payRepo.findOne({ where: { reference } as any }).catch(() => null);
          if (dup) return ok(dup, "Paiement déjà enregistré (idempotent)");
        } else {
          const dup = await payRepo.findOne({ where: { reference } as any }).catch(() => null);
          if (dup) return ok(dup, "Paiement déjà enregistré (référence existante)");
        }
        const externalProof = !isCanon && incomingRef ? ` [preuve: ${incomingRef}]` : "";
        const comment = `${extra?.comment ?? ""}${externalProof}`.trim() || null;
        const mergedDeductions = [...arrDedSlip, ...arrDedExtra,
          ...(avance > 0 ? [{ name: "Avance", amount: avance }] : []),
          ...(retenue > 0 ? [{ name: "Retenue", amount: retenue }] : []),
        ];
        const mergedAdditions = [...arrAddSlip, ...arrAddExtra,
          ...(prime > 0 ? [{ name: "Prime", amount: prime }] : []),
          ...(transport > 0 ? [{ name: "Transport", amount: transport }] : []),
        ];
        const pay = payRepo.create({
          professorId: id, amount: net, currency,
          type: extra?.type ?? "salaire",
          paymentMethod: extra?.paymentMethod ?? "cash", month: m, reference, comment,
          isPaid: true, grossAmount: brut, netAmount: net,
          hoursTotal: slip.hoursTotal, hourlyRate: slip.hourlyRate,
          deductions: mergedDeductions, additions: mergedAdditions,
          idempotencyKey: extra?.idempotencyKey ?? null,
        } as any);
        const savedPay: any = await payRepo.save(pay as any);
        slip.status = "paye"; slip.paymentId = savedPay.id; slip.grossAmount = brut; slip.netAmount = net;
        slip.deductions = mergedDeductions; slip.additions = mergedAdditions;
        await slipRepo.save(slip);
        savedPay.salarySlipId = slip.id;
        await payRepo.save(savedPay);
        // B3: mouvement de paie calé sur l'année du mois (09→N-N+1), pas l'année civile.
        let syPay = "";
        try {
          const mm = /^(\d{4})-(\d{2})$/.exec(String(m));
          if (mm) { const yy = Number(mm[1]); const mo = Number(mm[2]); syPay = mo >= 9 ? `${yy}-${yy + 1}` : `${yy - 1}-${yy}`; }
          else syPay = await this.currentSY((extra as any)?.schoolYear);
        } catch { syPay = await this.currentSY((extra as any)?.schoolYear); }
        await movRepo.save(movRepo.create({ direction: "OUT", amount: net, currency, motive: `Paie enseignant #${id} ${m}`, reference, movementDate: new Date(), schoolYear: syPay } as any));
        return ok(savedPay, `Enseignant payé ${net} ${currency} (${reference})`);
      });
    } catch (e) {
      return fail("Erreur paie enseignant", e instanceof Error ? e.message : String(e));
    }
  }

  /** Lecture seule : liste des paiements profs (façade pour paymentService/events). */
  async professorPaymentsList(filters: any = {}): Promise<Envelope<any>> {
    try {
      const ds = AppDataSource.getInstance();
      const repo = ds.getRepository(ProfessorPaymentEntity);
      const where: any = {};
      if (filters?.month && /^\d{4}-\d{2}$/.test(String(filters.month))) where.month = filters.month;
      if (filters?.professorId) where.professorId = Number(filters.professorId);
      if (filters?.status) where.isPaid = filters.status === "paid";
      if (typeof filters?.isPaid === "boolean") where.isPaid = filters.isPaid;
      const items: any[] = await repo.find({ where, relations: ["professor"] as any, order: { month: "DESC", id: "DESC" } as any }).catch(() => []);
      return ok(items, `${items.length} paiement(s) professeur`);
    } catch (e) {
      return fail("Erreur liste paiements profs", e instanceof Error ? e.message : String(e));
    }
  }

  /** B3: stats paiements profs scopées par schoolYear (mois 09→08, défaut année courante). */
  async professorPaymentsStats(filters: any = {}): Promise<Envelope<any>> {
    try {
      const sy = await this.currentSY((filters as any)?.schoolYear);
      const ds = AppDataSource.getInstance();
      const repo = ds.getRepository(ProfessorPaymentEntity);
      // Fenêtre scolaire 09/N → 08/N+1 (month YYYY-MM). Sans schoolYear explicite
      // on scope sur l'année courante ; les lignes sans month sont conservées.
      const startY = Number(String(sy).slice(0, 4));
      const months: string[] = Number.isFinite(startY)
        ? [`${startY}-09`, `${startY}-10`, `${startY}-11`, `${startY}-12`,
           `${startY + 1}-01`, `${startY + 1}-02`, `${startY + 1}-03`, `${startY + 1}-04`,
           `${startY + 1}-05`, `${startY + 1}-06`, `${startY + 1}-07`, `${startY + 1}-08`]
        : [];
      const scope = (qb: any) => {
        if (months.length) qb.andWhere("(p.month IS NULL OR p.month IN (:...months))", { months });
        return qb;
      };
      const paid: any = await scope(repo.createQueryBuilder("p")
        .select("COALESCE(SUM(p.netAmount),0)", "s")
        .where("p.isPaid = :v", { v: true }).andWhere("p.deleted_at IS NULL")).getRawOne().catch(() => ({ s: 0 }));
      const pending: any = await scope(repo.createQueryBuilder("p")
        .select("COALESCE(SUM(p.netAmount),0)", "s")
        .where("p.isPaid = :v", { v: false }).andWhere("p.deleted_at IS NULL")).getRawOne().catch(() => ({ s: 0 }));
      return ok({ schoolYear: sy, totalPaid: toNum(paid?.s), totalPending: toNum(pending?.s) }, "Statistiques paiements profs");
    } catch (e) {
      return fail("Erreur stats paiements profs", e instanceof Error ? e.message : String(e));
    }
  }

  /** Mise à jour limitée (whitelist) : ne touche jamais montant/net/référence/caisse. */
  async professorPaymentUpdate(id: number, patch: any = {}): Promise<Envelope<any>> {
    try {
      const ds = AppDataSource.getInstance();
      const repo = ds.getRepository(ProfessorPaymentEntity);
      const pay: any = await repo.findOne({ where: { id } });
      if (!pay || pay.deleted_at) return fail("Paiement professeur introuvable", "NOT_FOUND");
      const allowed: any = {};
      if (typeof patch?.comment === "string") allowed.comment = patch.comment;
      if (typeof patch?.paymentMethod === "string") allowed.paymentMethod = patch.paymentMethod;
      if (typeof patch?.type === "string") allowed.type = patch.type;
      if (typeof patch?.isPaid === "boolean") allowed.isPaid = patch.isPaid;
      if (!Object.keys(allowed).length) return fail("Aucun champ modifiable (comment/type/paymentMethod/isPaid)", "VALIDATION");
      Object.assign(pay, allowed);
      const saved = await repo.save(pay);
      return ok(saved, "Paiement professeur mis à jour");
    } catch (e) {
      return fail("Erreur mise à jour paiement prof", e instanceof Error ? e.message : String(e));
    }
  }

  /** Backfill : normalise les anciennes références non PAY-ENS-YYYY-XXXX. */
  async backfillProfessorReferences(): Promise<Envelope<any>> {
    try {
      const ds = AppDataSource.getInstance();
      // NOTE better-sqlite3 : pas d'isolation SERIALIZABLE (incompatible) — transaction
      // standard suffit (1 writer SQLite sérialisé). Verrou pessimistic_write conservé
      // avec fallback si le driver le refuse.
      return await ds.transaction(async (man) => {
        const payRepo = man.getRepository(ProfessorPaymentEntity);
        const olds: any[] = await payRepo.createQueryBuilder("p")
          .where("p.reference IS NULL OR p.reference = '' OR p.reference NOT LIKE 'PAY-ENS-%'")
          .orderBy("p.id", "ASC").getMany();
        let fixed = 0;
        for (const p of olds) {
          const ref = await nextProfessorRef(man);
          const preuve = p.reference ? ` [ancienne réf: ${p.reference}]` : "";
          p.reference = ref;
          p.comment = `${p.comment ?? ""}${preuve}`.trim() || null;
          await payRepo.save(p);
          fixed++;
        }
        return ok({ fixed, total: olds.length }, fixed ? `${fixed} référence(s) normalisée(s) en PAY-ENS` : "Aucune référence à normaliser");
      });
    } catch (e) {
      return fail("Erreur backfill références", e instanceof Error ? e.message : String(e));
    }
  }

  async bankList(): Promise<Envelope<any>> {
    try {
      const ds = AppDataSource.getInstance();
      const repo = ds.getRepository(BankAccountEntity);
      const items: any[] = await repo.find({ where: {} as any }).catch(() => []);
      if (!items.length) return ok({ items: [], empty: true }, "Aucun compte bancaire enregistré");
      return ok(items.map((a: any) => ({ id: a.id, bankName: a.bankName, accountNumber: a.accountNumber, iban: a.iban ?? "", balance: toNum(a.balance), currency: a.currency })), `${items.length} compte(s)`);
    } catch (e) {
      return fail("Erreur comptes bancaires", e instanceof Error ? e.message : String(e));
    }
  }

  async bankCreate(payload: any): Promise<Envelope<any>> {
    try {
      if (!payload?.bankName || !payload?.accountNumber) return fail("Banque et numéro de compte requis", "VALIDATION");
      const ds = AppDataSource.getInstance();
      const repo = ds.getRepository(BankAccountEntity);
      const currency = payload?.currency ?? await schoolCurrency();
      const acc = repo.create({ bankName: payload.bankName, accountNumber: payload.accountNumber, iban: payload.iban ?? null, balance: roundMoney(toNum(payload.balance ?? 0), currency), currency } as any);
      const saved = await repo.save(acc as any);
      return ok(saved, "Compte bancaire créé");
    } catch (e: any) {
      if (String(e?.message ?? e).includes("UNIQUE")) return fail("Numéro de compte déjà existant", "DUPLICATE");
      return fail("Erreur création compte", e instanceof Error ? e.message : String(e));
    }
  }

  async bankTransactions(accountId?: number): Promise<Envelope<any>> {
    try {
      const ds = AppDataSource.getInstance();
      const repo = ds.getRepository(BankTransactionEntity);
      const where: any = {};
      if (accountId) where.accountId = accountId;
      const items: any[] = await repo.find({ where, order: { created_at: "DESC" } as any, take: 200 }).catch(() => []);
      if (!items.length) return ok({ items: [], empty: true }, "Aucune transaction bancaire");
      return ok(items.map((t: any) => ({ id: t.id, accountId: t.accountId, direction: t.direction, amount: toNum(t.amount), currency: t.currency, date: t.transactionDate ? isoDay(new Date(t.transactionDate)) : isoDay(new Date(t.created_at)), reference: t.reference ?? "", label: t.label ?? "" })), `${items.length} transaction(s)`);
    } catch (e) {
      return fail("Erreur transactions", e instanceof Error ? e.message : String(e));
    }
  }

  async bankTransactionCreate(payload: any): Promise<Envelope<any>> {
    try {
      const amount = toNum(payload?.amount);
      if (!payload?.accountId || !(amount > 0) || (payload?.direction !== "IN" && payload?.direction !== "OUT")) return fail("Compte, montant>0 et direction IN/OUT requis", "VALIDATION");
      const ds = AppDataSource.getInstance();
      const syBank = await this.currentSY(payload?.schoolYear);
      // NOTE better-sqlite3 : pas d'isolation SERIALIZABLE (incompatible) — transaction
      // standard suffit (1 writer SQLite sérialisé). Verrou pessimistic_write conservé
      // avec fallback si le driver le refuse.
      return await ds.transaction(async (m) => {
        const accRepo = m.getRepository(BankAccountEntity);
        const txRepo = m.getRepository(BankTransactionEntity);
        if (payload?.idempotencyKey) {
          const ex = await txRepo.findOne({ where: { idempotencyKey: payload.idempotencyKey } as any });
          if (ex) return ok(ex, "Transaction déjà enregistrée (idempotent)");
        }
        const acc: any = await accRepo.findOne({ where: { id: payload.accountId } });
        if (!acc) return fail("Compte bancaire introuvable", "NOT_FOUND");
        const currency = acc.currency ?? await schoolCurrency();
        const rounded = roundMoney(amount, currency);
        const tx = txRepo.create({ accountId: acc.id, direction: payload.direction, amount: rounded, currency, transactionDate: payload.date ? new Date(payload.date) : new Date(), reference: payload.reference ?? null, label: payload.label ?? null, schoolYear: syBank, idempotencyKey: payload.idempotencyKey ?? null } as any);
        const saved: any = await txRepo.save(tx as any);
        acc.balance = roundMoney(toNum(acc.balance) + (payload.direction === "IN" ? rounded : -rounded), currency);
        await accRepo.save(acc);
        return ok(saved, "Transaction bancaire enregistrée");
      });
    } catch (e) {
      return fail("Erreur transaction bancaire", e instanceof Error ? e.message : String(e));
    }
  }
}

export const accountingService = new AccountingService();
