import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { jsPDF } from 'jspdf'
import { amountInWordsFR } from '@/utils/amountInWordsFR'
import { safeInvoke, strictInvoke } from '@/utils/ipc'
import { formatCurrency } from '@/components/util/currencyFormatter'
import { useCurrency } from '@/composables/useCurrency'
import { ensureUnlock, isAccountingLockError } from '@/composables/useAccountingGuard'
import {
  buildCasyMonthlyGrid,
  buildCasyReceiptHtml,
  buildCasyTranchesFallback,
  dateEnLettres,
  DEFAULT_IMPUTATION_ORDER,
  defaultEcheanceISO,
  formatJJMMAAAA as formatJJMMAAAAUtil,
  markTranchesPaid,
  maskRef,
  openCasyPrintWindow,
  type CasyHtmlInput,
  type CasyMonthlyRow,
  type CasyTrancheRow,
  type CasyTotaux,
  type PaymentImputationOrder,
} from '@/utils/receiptCasy'
import { normalizeImputationOrder } from '@/composables/useImputationOrder'

export interface ReceiptMonthlyRow extends CasyMonthlyRow {}
export interface ReceiptTrancheRow extends CasyTrancheRow {}
export interface ReceiptTotaux extends CasyTotaux {}

export interface ReceiptData {
  id: string
  numero: string
  /** Référence transaction OM/MTN — distincte du N° reçu. */
  transactionRef?: string
  reference?: string
  date: string
  eleve: string
  /** Payeur (Reçu de). */
  recuDe?: string
  /** Élève bénéficiaire. */
  pourLeCompteDe?: string
  payeur?: string
  matricule: string
  classe: string
  montant: number
  mode: string
  motif: string
  caissier?: string
  schoolYear?: string
  /** Enrichissement maquette CASY (tous optionnels — repli `—` à l'affichage). */
  studentId?: number
  sexe?: string
  telephone?: string
  photoBase64?: string
  prenoms?: string
  nom?: string
  monthlyGrid?: ReceiptMonthlyRow[]
  tranches?: ReceiptTrancheRow[]
  annuel?: number
  prochainPaiement?: string
  totaux?: ReceiptTotaux
  montantJour?: number
  barcodeValue?: string
  ecoleTels?: string
  ecoleEmail?: string
  cachet?: string
  /** Ordre d'imputation figé au paiement si présent, sinon live (défaut FIRST_FIRST). */
  imputationOrder?: PaymentImputationOrder
}

/** Libellés Guinée partagés écran + PDF. */
export function labelModeGuinee(v: unknown): string {
  const k = String(v ?? '').toLowerCase().trim()
  const map: Record<string, string> = {
    cash: 'Espèces', especes: 'Espèces', espece: 'Espèces',
    orange_money: 'Orange Money', orange: 'Orange Money', 'orange money': 'Orange Money',
    mobile_money: 'Orange Money',
    mtn_money: 'MTN Mobile Money', mtn: 'MTN Mobile Money', 'mtn mobile money': 'MTN Mobile Money',
    transfer: 'Virement', virement: 'Virement',
    check: 'Chèque', cheque: 'Chèque', chèque: 'Chèque',
  }
  return map[k] ?? String(v ?? '—')
}

export function formatJJMMAAAA(d: unknown): string {
  return formatJJMMAAAAUtil(d)
}

function labelSexe(v: unknown): string {
  const k = String(v ?? '').trim().toLowerCase()
  if (!k || k === '—') return '—'
  if (['male', 'm', 'masculin', 'garcon', 'garçon'].includes(k)) return 'Masculin'
  if (['female', 'f', 'feminin', 'féminin', 'fille', 'femme'].includes(k)) return 'Féminin'
  return String(v)
}

function pickPhone(details: Record<string, unknown>): string {
  for (const k of ['telephone', 'phone', 'famillyPhone', 'personalPhone', 'parentPhone', 'tuteurPhone']) {
    const v = String((details as Record<string, unknown>)[k] ?? '').trim()
    if (v) return v
  }
  return ''
}

function unwrapPhotoPayload(res: unknown): string | undefined {
  if (!res || typeof res !== 'object') return undefined
  const r = res as Record<string, unknown>
  const inner = (r.data ?? r) as Record<string, unknown>
  const content = String((inner.content as string) ?? '')
  const type = String((inner.type as string) ?? 'image/jpeg')
  if (!content) return undefined
  return `data:${type};base64,${content}`
}

/**
 * Logique reçu : chargement école + reçu, enrichissement CASY, impression, PDF, envoi.
 * 100% dynamique, zéro mock : `strictInvoke` pour école + reçu, `safeInvoke`
 * (repli silencieux) pour tout l'enrichissement optionnel (photo, sexe, tél,
 * mensuel, tranches, totaux — jamais bloquant).
 * Impression : `window.electronAPI.print` si dispo, sinon `window.print()`.
 * Devise via `useCurrency` (GNF école guinéenne) — aucun montant en dur.
 */
export function useReceipt(receiptId: string | number) {
  const loading = ref(false)
  const error = ref<string | null>(null)
  const { currencyCode } = useCurrency()
  const school = ref<{ name: string; address: string; phone: string; email: string; logo?: string; schoolYear?: string }>({
    name: '',
    address: '',
    phone: '',
    email: '',
    schoolYear: '',
  })
  const receipt = ref<ReceiptData | null>(null)

  const montantLettres = ref('')

  async function load(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const schoolData = await strictInvoke<Record<string, unknown>>('school:get', {})
      const s = (schoolData ?? {}) as Record<string, unknown>
      let year = String((s.schoolYear as string) ?? '')
      try {
        const yr = await strictInvoke<{ schoolYear?: string }>('year:getCurrent', {}, { silent: true }).catch(() => null)
        if ((yr as { schoolYear?: string } | null)?.schoolYear) year = String((yr as { schoolYear?: string }).schoolYear)
      } catch { /* année optionnelle */ }
      school.value = {
        name: String((s.name as string) ?? ''),
        address: String((s.address as string) ?? ''),
        phone: String((s.phone as string) ?? ''),
        email: String((s.email as string) ?? ''),
        schoolYear: year,
      }
      const logoId = (s as unknown as { logo?: { id?: number } }).logo?.id
      if (logoId) {
        try {
          const logoRes = await strictInvoke<{ type: string; content: string } | null>('school:getLogo', logoId)
          if (logoRes?.content) school.value.logo = `data:${logoRes.type};base64,${logoRes.content}`
        } catch {
          /* logo optionnel — n'invalide pas le reçu */
        }
      }
      const r = await strictInvoke<Partial<ReceiptData>>('comptabilite:receipt:get', receiptId)
      if (!r || !Object.keys(r).length) throw new Error(`Reçu ${String(receiptId)} introuvable (réponse vide — aucun mock)`)
      const txn = (r.transactionRef ?? r.reference ?? '') as string
      const frozen = normalizeImputationOrder(
        (r as Record<string, unknown>).imputationOrder
          ?? (r as Record<string, unknown>).paymentImputationOrder,
      )
      const hasFrozen = (r as Record<string, unknown>).imputationOrder != null
        || (r as Record<string, unknown>).paymentImputationOrder != null
      const base: ReceiptData = {
        ...(r as ReceiptData),
        transactionRef: txn || undefined,
        recuDe: (r.recuDe ?? r.payeur ?? r.eleve ?? '') as string,
        pourLeCompteDe: (r.pourLeCompteDe ?? r.eleve ?? '') as string,
        schoolYear: (r.schoolYear ?? year ?? '') as string,
        imputationOrder: hasFrozen ? frozen : await resolveLiveImputationOrder(),
      }
      base.montantJour = Number(base.montant ?? 0)
      base.barcodeValue = String(base.numero ?? base.id ?? '')
      base.ecoleTels = school.value.phone || '—'
      base.ecoleEmail = school.value.email || '—'
      receipt.value = base
      // Enrichissement CASY — best effort, jamais bloquant.
      await enrichCasy(base).catch(() => undefined)
      receipt.value = { ...base }
      montantLettres.value = amountInWordsFR(receipt.value.montant, currencyCode.value)
    } catch (err) {
      receipt.value = null
      const msg = err instanceof Error ? err.message : 'Chargement du reçu impossible (aucun mock)'
      error.value = msg
      ElMessage.error(msg)
      throw err
    } finally {
      loading.value = false
    }
  }

  /**
   * Ordre live depuis les configs (défaut FIRST_FIRST). Best effort.
   * Le snapshot figé au paiement reste prioritaire (voir `load`).
   */
  async function resolveLiveImputationOrder(gradeId?: unknown): Promise<PaymentImputationOrder> {
    try {
      const all = await safeInvoke<Array<{
        gradeId?: unknown; isDefault?: boolean
        monthlyConfig?: { paymentImputationOrder?: unknown }
      }>>('payment:getCustomConfigs', [], {})
      const list = Array.isArray(all) ? all : []
      const mine = gradeId != null
        ? list.find((c) => Number(c?.gradeId) === Number(gradeId))
        : undefined
      const picked = mine ?? list.find((c) => c?.isDefault) ?? list[0]
      return normalizeImputationOrder(picked?.monthlyConfig?.paymentImputationOrder)
    } catch {
      return DEFAULT_IMPUTATION_ORDER
    }
  }

  /**
   * Enrichit un reçu avec la fiche élève + situation financière.
   * Exporte pour réutilisation (`PaymentManagementView`, `StudentPaymentView`).
   */
  async function enrichCasy(base: ReceiptData): Promise<void> {
    // 1. Retrouver l'élève (studentId direct, sinon recherche par matricule).
    let studentId: number | null = null
    const rawId = (base as unknown as { studentId?: unknown; student?: { id?: unknown } }).studentId
      ?? (base as unknown as { student?: { id?: unknown } }).student?.id
    if (rawId != null && Number.isFinite(Number(rawId))) studentId = Number(rawId)
    let row: Record<string, unknown> | null = null
    if (studentId == null && base.matricule) {
      try {
        const found = await safeInvoke<{ students?: Array<Record<string, unknown>> } | Array<Record<string, unknown>>>(
          'student:all',
          { students: [] },
          { page: 1, pageSize: 5, filters: { studentFullName: String(base.matricule) } },
        )
        const list = Array.isArray(found) ? found : Array.isArray(found?.students) ? found.students : []
        row = list.find((x) => String((x as Record<string, unknown>).matricule ?? '') === String(base.matricule))
          ?? list[0] ?? null
        const rid = row ? Number((row as Record<string, unknown>).id) : NaN
        if (Number.isFinite(rid)) studentId = rid
      } catch { /* recherche optionnelle */ }
    }
    // 2. Détails élève (sexe, tél, photo, prénoms/nom, classe).
    let details: Record<string, unknown> | null = row
    if (studentId != null) {
      base.studentId = studentId
      try {
        const d = await safeInvoke<Record<string, unknown> | null>('student:getDetails', null, Number(studentId))
        if (d && typeof d === 'object') details = { ...(row ?? {}), ...d }
      } catch { /* détails optionnels */ }
    }
    if (details) {
      const firstname = String((details.firstname as string) ?? (details.prenoms as string) ?? '')
      const lastname = String((details.lastname as string) ?? (details.nom as string) ?? '')
      if (firstname) base.prenoms = firstname.trim()
      if (lastname) base.nom = lastname.trim()
      const sexeRaw = (details.sex ?? details.sexe ?? details.gender ?? '') as unknown
      const sexeLabel = labelSexe(sexeRaw)
      if (sexeLabel !== '—') base.sexe = sexeLabel
      const tel = pickPhone(details)
      if (tel) base.telephone = tel
      const gradeName = (details.grade as { name?: string } | string | undefined)
      if (typeof gradeName === 'string' && gradeName && !base.classe) base.classe = gradeName
      else if (gradeName && typeof gradeName === 'object' && gradeName.name && !base.classe) base.classe = gradeName.name
      const photo = details.photo as { id?: number; url?: string; path?: string } | undefined
      if (photo?.url && String(photo.url).startsWith('data:')) base.photoBase64 = String(photo.url)
      else if (photo?.id != null) {
        try {
          const pres = await safeInvoke<unknown>('getStudentPhoto', null, Number(photo.id))
          const dataUrl = unwrapPhotoPayload(pres)
          if (dataUrl) base.photoBase64 = dataUrl
        } catch { /* photo optionnelle */ }
      }
    }
    // 3. Situation financière (mensuel, tranches, totaux, annuel, prochain paiement).
    if (studentId != null) {
      try {
        const data = await safeInvoke<{
          inscriptionFeeDue?: number; tuitionFeeDue?: number; adjustedTuitionFee?: number
          scholarshipAmount?: number; totalDue?: number; totalPaid?: number; totalRemaining?: number
          paidTuition?: number; paidInscriptionFee?: number
        } | null>('payment:getByStudent', null, Number(studentId))
        if (data) {
          const inscription = Number(data.inscriptionFeeDue ?? 0)
          const coutAnnuel = Number(data.tuitionFeeDue ?? 0)
          const rabais = Number(data.scholarshipAmount ?? 0)
          const net = Number(data.totalDue ?? (inscription + Number(data.adjustedTuitionFee ?? (coutAnnuel - rabais))))
          const totalPaye = Number(data.totalPaid ?? 0)
          const solde = Number(data.totalRemaining ?? Math.max(0, net - totalPaye))
          const paidTuition = Number(data.paidTuition ?? Math.max(0, totalPaye - Number(data.paidInscriptionFee ?? 0)))
          base.annuel = coutAnnuel
          base.totaux = { inscription, coutAnnuel, rabais, net, totalPaye, solde }
          // Ordre live si aucun snapshot figé (grade élève → défaut).
          if (!base.imputationOrder || base.imputationOrder === DEFAULT_IMPUTATION_ORDER) {
            const gid = (details?.grade as { id?: number } | undefined)?.id
              ?? (details as Record<string, unknown> | null)?.gradeId
            const live = await resolveLiveImputationOrder(gid)
            if (live !== DEFAULT_IMPUTATION_ORDER || !base.imputationOrder) base.imputationOrder = live
          }
          const order = normalizeImputationOrder(base.imputationOrder)
          base.imputationOrder = order
          base.monthlyGrid = buildCasyMonthlyGrid(coutAnnuel, paidTuition, undefined, order)
          // Tranches configurées si dispo, sinon 3 parts égales.
          let tranches: ReceiptTrancheRow[] | null = null
          try {
            const all = await safeInvoke<Array<{ grade?: { id?: number }; tranches?: Array<{ name?: string; tranchName?: string; amount?: number }> }>>(
              'tranche-config:all', [], {},
            )
            const list = Array.isArray(all) ? all : []
            const mine = list.find((c) => Number(c?.grade?.id) === Number((details?.grade as { id?: number } | undefined)?.id))
            const raw = mine?.tranches
            if (Array.isArray(raw) && raw.length) {
              tranches = markTranchesPaid(
                raw.map((t, i) => ({
                  nom: String(t?.name ?? t?.tranchName ?? `Tranche ${i + 1}`),
                  montant: Number(t?.amount ?? 0),
                })),
                paidTuition,
              )
            }
          } catch { /* config optionnelle */ }
          base.tranches = tranches ?? buildCasyTranchesFallback(coutAnnuel, paidTuition)
          base.prochainPaiement = solde <= 0 ? 'Soldé' : formatJJMMAAAAUtil(defaultEcheanceISO())
        }
      } catch { /* situation optionnelle */ }
    }
    // 4. Replis garantis (jamais de rendu cassé).
    const fallbackOrder = normalizeImputationOrder(base.imputationOrder)
    base.imputationOrder = fallbackOrder
    if (!base.monthlyGrid?.length) base.monthlyGrid = buildCasyMonthlyGrid(Number(base.annuel ?? 0), 0, undefined, fallbackOrder)
    if (!base.tranches?.length) base.tranches = buildCasyTranchesFallback(Number(base.annuel ?? 0), 0)
    if (base.annuel == null) base.annuel = Number(base.totaux?.coutAnnuel ?? 0)
    if (!base.prochainPaiement) base.prochainPaiement = base.totaux && base.totaux.solde > 0 ? formatJJMMAAAAUtil(defaultEcheanceISO()) : 'Soldé'
    if (!base.totaux) {
      const m = Number(base.montant ?? 0)
      base.totaux = { inscription: 0, coutAnnuel: 0, rabais: 0, net: m, totalPaye: m, solde: 0 }
      if (!base.annuel) base.annuel = 0
    }
  }

  const casyInput = computed<CasyHtmlInput | null>(() => {
    if (!receipt.value) return null
    return toCasyHtmlInput(receipt.value, {
      schoolName: school.value.name,
      schoolTels: school.value.phone,
      schoolEmail: school.value.email,
      schoolYear: receipt.value.schoolYear || school.value.schoolYear || '',
      logo: school.value.logo,
    })
  })

  function toCasyHtmlInput(
    r: ReceiptData,
    s: { schoolName: string; schoolTels: string; schoolEmail: string; schoolYear: string; logo?: string },
  ): CasyHtmlInput {
    const fmt = (n: unknown): string => {
      try {
        return formatCurrency(Number(n ?? 0), currencyCode.value)
      } catch {
        return `${Number(n ?? 0)} ${currencyCode.value}`
      }
    }
    const prenomsNom = `${r.prenoms ?? ''} ${r.nom ?? ''}`.trim() || r.pourLeCompteDe || r.eleve || '—'
    const order = normalizeImputationOrder((r as ReceiptData).imputationOrder)
    const monthly = r.monthlyGrid?.length ? r.monthlyGrid : buildCasyMonthlyGrid(Number(r.annuel ?? 0), 0, undefined, order)
    const tranches = r.tranches?.length ? r.tranches : buildCasyTranchesFallback(Number(r.annuel ?? 0), 0)
    const totaux = r.totaux ?? { inscription: 0, coutAnnuel: 0, rabais: 0, net: Number(r.montant ?? 0), totalPaye: Number(r.montant ?? 0), solde: 0 }
    return {
      schoolName: s.schoolName || 'COMPLEXE SCOLAIRE',
      schoolTels: s.schoolTels || '—',
      schoolEmail: s.schoolEmail || '—',
      schoolYear: s.schoolYear || '—',
      logo: s.logo,
      numero: String(r.numero ?? '—'),
      maskedRef: maskRef(r.transactionRef ?? r.reference ?? ''),
      dateJJMMAAAA: formatJJMMAAAAUtil(r.date),
      dateLettres: dateEnLettres(r.date),
      matricule: String(r.matricule || '—'),
      prenomsNom,
      sexe: r.sexe || '—',
      telephone: r.telephone || '—',
      classe: String(r.classe || '—'),
      motif: String(r.motif || '—'),
      mode: labelModeGuinee(r.mode),
      montantJour: fmt(r.montantJour ?? r.montant),
      montantDigits: fmt(r.montant),
      montantLettres: montantLettres.value || amountInWordsFR(Number(r.montant ?? 0), currencyCode.value),
      monthly,
      monthlyCells: monthly.map((m) => fmt(m.montant)),
      tranches,
      trancheCells: tranches.map((t) => fmt(t.montant)),
      annuel: fmt(r.annuel ?? totaux.coutAnnuel),
      prochainPaiement: String(r.prochainPaiement || '—'),
      totaux: {
        inscription: fmt(totaux.inscription),
        coutAnnuel: fmt(totaux.coutAnnuel),
        rabais: fmt(totaux.rabais),
        net: fmt(totaux.net),
        totalPaye: fmt(totaux.totalPaye),
        solde: fmt(totaux.solde),
      },
      barcodeValue: String(r.barcodeValue || r.numero || '—'),
      caissier: String(r.caissier || '—'),
      photo: r.photoBase64,
      cachet: r.cachet,
    }
  }

  function printReceipt(): void {
    if (!receipt.value) {
      ElMessage.warning('Aucun reçu chargé — impression impossible')
      return
    }
    try {
      const w = window as unknown as { electronAPI?: { print?: (o: unknown) => Promise<unknown> } }
      if (w.electronAPI?.print) {
        void w.electronAPI.print({ title: `Reçu ${receipt.value.numero}` }).catch(() => window.print())
      } else {
        window.print()
      }
    } catch {
      window.print()
    }
  }

  /** Impression CASY via fenêtre dédiée (même HTML que le template, 2 colonnes). */
  function printCasyWindow(): boolean {
    if (!receipt.value || !casyInput.value) {
      ElMessage.warning('Aucun reçu chargé — impression impossible')
      return false
    }
    const html = buildCasyReceiptHtml(casyInput.value, { title: `Reçu ${receipt.value.numero}` })
    const opened = openCasyPrintWindow(html, `recu_${String(receipt.value.numero || receipt.value.id).replace(/[^A-Za-z0-9-]+/g, '-')}.html`)
    if (!opened) ElMessage.warning('Pop-up bloquée — reçu téléchargé en HTML.')
    else ElMessage.success("Fenêtre d'impression ouverte")
    return opened
  }

  /**
   * PDF cohérent avec la maquette CASY : en-tête Guinée, Reçu N° + barcode,
   * élève (matricule, sexe, tél, classe), mensuel + tranches résumés,
   * annuel + prochain paiement, totaux, signatures + mention E-School.
   * Format condensé demi-page A4 (~135mm de contenu, 1 seule page).
   */
  function exportPdf(): void {
    if (!receipt.value || !casyInput.value) {
      ElMessage.warning('Aucun reçu chargé — export impossible')
      return
    }
    const r = receipt.value
    const c = casyInput.value
    const doc = new jsPDF({ unit: 'mm', format: 'a4' })
    const W = doc.internal.pageSize.getWidth()
    let y = 10
    const line = (t: string, opts?: { bold?: boolean; size?: number; center?: boolean; maxWidth?: number }): void => {
      doc.setFont('helvetica', opts?.bold ? 'bold' : 'normal')
      doc.setFontSize(opts?.size ?? 8.5)
      if (opts?.center) doc.text(t, W / 2, y, { align: 'center', maxWidth: opts.maxWidth ?? 180 })
      else doc.text(t, 12, y, { maxWidth: opts?.maxWidth ?? 186 })
      y += opts?.size && opts.size >= 11 ? 5 : 4
    }
    line('RÉPUBLIQUE DE GUINÉE', { bold: true, center: true, size: 9 })
    line(String(school.value.name || 'COMPLEXE SCOLAIRE'), { bold: true, center: true, size: 11 })
    line('Travail — Justice — Solidarité', { center: true, size: 7.5 })
    line(`Année scolaire : ${c.schoolYear} — Tél : ${c.schoolTels} — Email : ${c.schoolEmail}`, { center: true, size: 7.5 })
    line(`Reçu N° ${c.numero} (ORIGINAL) — Réf. ${c.maskedRef} — Date : ${c.dateJJMMAAAA}`, { bold: true, size: 8.5 })
    line(`Matricule : ${c.matricule} — ${c.prenomsNom} — Sexe : ${c.sexe} — Tél : ${c.telephone} — Classe : ${c.classe}`, { size: 8 })
    line(`Motif : ${c.motif} — Mode : ${c.mode} — Montant (${currencyCode.value}) : ${c.montantDigits}`, { bold: true, size: 9 })
    line(`En lettres : ${c.montantLettres}`, { size: 8, maxWidth: 186 })
    const orderLabel = c.monthly.map((m) => m.mois.slice(0, 3)).join('/')
    const imputationTag = normalizeImputationOrder(r.imputationOrder) === 'FIRST_FIRST'
      ? 'Paiement mensuel (Oct→Juin) :'
      : `Paiement mensuel (${orderLabel}) :`
    line(imputationTag, { bold: true, size: 8.5 })
    for (let i = 0; i < c.monthly.length; i += 3) {
      const chunk = c.monthly.slice(i, i + 3)
      line(chunk.map((m, k) => `[${m.paye ? 'X' : ' '}] ${m.mois} (${c.monthlyCells[i + k] ?? ''})`).join('   '), { size: 7.5 })
    }
    line('Paiement par tranche :', { bold: true, size: 8.5 })
    for (let i = 0; i < c.tranches.length; i += 2) {
      const chunk = c.tranches.slice(i, i + 2)
      line(chunk.map((t, k) => `[${t.paye ? 'X' : ' '}] ${t.nom} (${c.trancheCells[i + k] ?? ''})${t.statut ? ` — ${t.statut}` : ''}`).join('   '), { size: 7.5 })
    }
    line(`Annuel : ${c.annuel} — Prochain paiement : ${c.prochainPaiement}`, { bold: true, size: 8.5 })
    line(`Inscription/Préalable : ${c.totaux.inscription} — Coût annuel : ${c.totaux.coutAnnuel} — Rabais : ${c.totaux.rabais}`, { size: 8 })
    line(`Net à payer : ${c.totaux.net} — Total payé : ${c.totaux.totalPaye} — Solde : ${c.totaux.solde}`, { bold: true, size: 8.5 })
    line(`Barcode : ${c.barcodeValue} — Caissier : ${c.caissier} — Signatures : Caissier / Cachet / Payeur`, { size: 8 })
    y += 1
    line(`Via application E-School — Reçu original du ${c.dateJJMMAAAA}.`, { center: true, size: 7.5 })
    const safe = String(r.numero || r.id).replace(/[^A-Za-z0-9-]+/g, '-')
    doc.save(`recu_${safe}.pdf`)
    ElMessage.success('Reçu exporté en PDF')
  }

  async function sendReceipt(): Promise<void> {
    if (!receipt.value) {
      ElMessage.warning('Aucun reçu chargé — envoi impossible')
      return
    }
    // STRICT : mot de passe exigé à chaque envoi (modale systématique).
    await ensureUnlock({ force: true, fresh: true })
    try {
      await strictInvoke('comptabilite:receipt:send', receipt.value.id)
    } catch (err) {
      if (!isAccountingLockError(err)) throw err
      await ensureUnlock({ force: true, fresh: true })
      await strictInvoke('comptabilite:receipt:send', receipt.value.id)
    }
    ElMessage.success('Reçu envoyé avec succès')
  }

  return { loading, error, school, receipt, montantLettres, load, printReceipt, printCasyWindow, casyInput, toCasyHtmlInput, exportPdf, sendReceipt }
}
