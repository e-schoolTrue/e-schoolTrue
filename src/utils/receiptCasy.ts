/**
 * Maquette CASY — reçu comptabilité : types partagés + génération HTML print.
 *
 * Factorise le rendu entre :
 * - `ReceiptTemplate.vue` (écran + `window.print`)
 * - `PaymentManagementView.printReceipt` (`window.open` + print)
 * - `StudentPaymentView.printLastReceipt` (`window.open` + print)
 *
 * Zéro mock : toutes les données viennent des IPC (`school:get`,
 * `comptabilite:receipt:get`, `payment:getByStudent`, ...). Chaque champ
 * optionnel a un repli d'affichage (`—`, case décochée, bloc masqué).
 */

export interface CasyMonthlyRow {
  mois: string
  montant: number
  paye: boolean
}

export interface CasyTrancheRow {
  nom: string
  montant: number
  /** Coché quand la tranche est couverte par le cumul payé. */
  paye?: boolean
  statut?: string
}

export interface CasyTotaux {
  inscription: number
  coutAnnuel: number
  rabais: number
  net: number
  totalPaye: number
  solde: number
}

/** 9 mois scolaires Octobre → Juin (maquette CASY : 3 + 3 + 3). */
export const CASY_MONTHS: readonly string[] = [
  'Octobre',
  'Novembre',
  'Décembre',
  'Janvier',
  'Février',
  'Mars',
  'Avril',
  'Mai',
  'Juin',
] as const

export const CASY_MONTH_GROUPS: readonly (readonly string[])[] = [
  ['Octobre', 'Novembre', 'Décembre'],
  ['Janvier', 'Février', 'Mars'],
  ['Avril', 'Mai', 'Juin'],
] as const

export const CASY_TRANCHE_NAMES: readonly string[] = [
  'Première Tranche',
  'Deuxième Tranche',
  'Troisième Tranche',
] as const

/** Ordre d'imputation des paiements mensuels (configurable, défaut = actuel). */
export type PaymentImputationOrder =
  | 'FIRST_FIRST'
  | 'LAST_FIRST'
  | 'LAST2_THEN_FIRST'
  | 'LAST3_THEN_FIRST'

export const DEFAULT_IMPUTATION_ORDER: PaymentImputationOrder = 'FIRST_FIRST'

/**
 * Ordre pur d'imputation : réordonne `months` selon `order` sans les muter.
 *
 * - FIRST_FIRST : Oct→Juin (actuel, identité).
 * - LAST_FIRST : Juin→Oct (miroir complet).
 * - LAST2_THEN_FIRST : Juin, Mai puis Oct… (les 2 derniers en premier, inversés).
 * - LAST3_THEN_FIRST : Juin, Mai, Avr puis Oct… (les 3 derniers en premier, inversés).
 * @param months - liste chronologique (ex. CASY_MONTHS).
 * @param order - ordre demandé, défaut FIRST_FIRST.
 * @returns nouvelle liste triée selon l'ordre d'imputation.
 */
export function resolveImputationOrder(
  months: readonly string[],
  order: PaymentImputationOrder | unknown = DEFAULT_IMPUTATION_ORDER,
): string[] {
  const list = [...(months ?? [])]
  if (order === 'LAST_FIRST') return list.reverse()
  if (order === 'LAST2_THEN_FIRST') {
    if (list.length <= 2) return list.reverse()
    return [...list.slice(-2).reverse(), ...list.slice(0, -2)]
  }
  if (order === 'LAST3_THEN_FIRST') {
    if (list.length <= 3) return list.reverse()
    return [...list.slice(-3).reverse(), ...list.slice(0, -3)]
  }
  return list
}

/** Construit la grille mensuelle : les `monthsPaid` premiers **selon `order`** sont cochés. */
export function buildCasyMonthlyGrid(
  annuel: number,
  paidTuition: number,
  monthlyAmountHint?: number,
  order: PaymentImputationOrder | unknown = DEFAULT_IMPUTATION_ORDER,
): CasyMonthlyRow[] {
  const safeAnnual = Number.isFinite(Number(annuel)) ? Number(annuel) : 0
  const hint = Number(monthlyAmountHint ?? 0)
  const monthly = hint > 0 ? hint : safeAnnual > 0 ? Math.round(safeAnnual / 9) : 0
  const paid = Number.isFinite(Number(paidTuition)) ? Number(paidTuition) : 0
  const monthsPaid = monthly > 0 ? Math.min(9, Math.max(0, Math.floor(paid / monthly))) : 0
  const ordered = resolveImputationOrder([...CASY_MONTHS], order)
  const paidSet = new Set(ordered.slice(0, monthsPaid))
  return ordered.map((mois) => ({ mois, montant: monthly, paye: paidSet.has(mois) }))
}

/** Répartit l'annuel en 3 tranches égales (repli quand aucune config). */
export function buildCasyTranchesFallback(annuel: number, paidTuition = 0): CasyTrancheRow[] {
  const safe = Number.isFinite(Number(annuel)) ? Number(annuel) : 0
  const base = Math.floor(safe / 3)
  const amounts = [base, base, safe - base * 2]
  let cumul = 0
  return CASY_TRANCHE_NAMES.map((nom, i) => {
    cumul += amounts[i]
    const paye = paidTuition >= cumul
    const statut = paye ? 'Payé' : paidTuition > cumul - amounts[i] ? 'Partiel' : 'Non payé'
    return { nom, montant: amounts[i], paye, statut }
  })
}

/** Marque les tranches configurées comme payées selon le cumul scolarité. */
export function markTranchesPaid(
  tranches: Array<{ nom: string; montant: number }>,
  paidTuition: number,
): CasyTrancheRow[] {
  const paid = Number.isFinite(Number(paidTuition)) ? Number(paidTuition) : 0
  let cumul = 0
  return tranches.map((t) => {
    cumul += Number(t.montant ?? 0)
    const paye = paid >= cumul
    const statut = paye ? 'Payé' : paid > cumul - Number(t.montant ?? 0) ? 'Partiel' : 'Non payé'
    return { nom: t.nom, montant: Number(t.montant ?? 0), paye, statut }
  })
}

/** Masque une référence transaction (ne jamais imprimer l'ID brut en clair). */
export function maskRef(ref: unknown): string {
  const s = String(ref ?? '').trim()
  if (!s) return '—'
  if (s.length <= 6) return `${s.slice(0, 2)}***`
  return `${s.slice(0, 3)}***${s.slice(-3)}`
}

/** JJ/MM/AAAA tolérant (accepte ISO, JJ/MM/AAAA, Date). */
export function formatJJMMAAAA(d: unknown): string {
  if (!d) return '—'
  try {
    const s = String(d)
    if (/^\d{2}\/\d{2}\/\d{4}/.test(s)) return s.slice(0, 10)
    const dt = new Date(s)
    if (Number.isNaN(dt.getTime())) return s
    return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return String(d)
  }
}

/** Date en lettres : « vendredi 25 septembre 2026 ». */
export function dateEnLettres(d: unknown): string {
  try {
    const dt = d ? new Date(String(d)) : new Date()
    if (Number.isNaN(dt.getTime())) return formatJJMMAAAA(d)
    const s = dt.toLocaleDateString('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
    return s.charAt(0).toUpperCase() + s.slice(1)
  } catch {
    return formatJJMMAAAA(d)
  }
}

/** Échéance de repli : 30/06 (même règle que le backend). */
export function defaultEcheanceISO(now = new Date()): string {
  const juneYear = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear()
  return `${juneYear}-06-30`
}

function esc(v: unknown): string {
  return String(v ?? '—')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface CasyHtmlInput {
  schoolName: string
  schoolTels: string
  schoolEmail: string
  schoolYear: string
  logo?: string
  numero: string
  maskedRef: string
  dateJJMMAAAA: string
  dateLettres: string
  matricule: string
  prenomsNom: string
  sexe: string
  telephone: string
  classe: string
  motif: string
  mode: string
  montantJour: string
  montantDigits: string
  montantLettres: string
  monthly: CasyMonthlyRow[]
  monthlyCells: string[]
  tranches: CasyTrancheRow[]
  trancheCells: string[]
  annuel: string
  prochainPaiement: string
  totaux: { inscription: string; coutAnnuel: string; rabais: string; net: string; totalPaye: string; solde: string }
  barcodeValue: string
  caissier: string
  photo?: string
  cachet?: string
}

function monthCell(m: CasyMonthlyRow, amount: string): string {
  return `<div class="casy-month${m.paye ? ' is-paid' : ''}"><span class="casy-check">${m.paye ? '✓' : ''}</span><span class="casy-mname">${esc(m.mois)}</span><span class="casy-mamount">${esc(amount)}</span></div>`
}

function trancheCell(t: CasyTrancheRow, amount: string): string {
  const cls = t.paye ? ' is-paid' : t.statut === 'Partiel' ? ' is-partial' : ''
  return `<div class="casy-tranche${cls}"><span class="casy-check">${t.paye ? '✓' : ''}</span><span class="casy-tname">${esc(t.nom)}</span><span class="casy-tamount">${esc(amount)}</span></div>`
}

/**
 * Titre colonne mensuelle reflétant l'ordre d'imputation.
 * FIRST_FIRST → « Octobre à Juin », sinon suite ordonnée (Juin / Mai / …).
 */
export function monthlyHeadingFor(months: readonly string[]): string {
  const list = [...(months ?? [])]
  if (!list.length) return 'Paiement mensuel — Octobre à Juin'
  if (list[0] === 'Octobre' && list[list.length - 1] === 'Juin') return 'Paiement mensuel — Octobre à Juin'
  return `Paiement mensuel — ${list.map((m) => String(m).slice(0, 3)).join(' / ')}`
}

/**
 * Génère le document HTML A4 complet du reçu CASY (print + fallback download).
 * Miroir de `ReceiptTemplate.vue` : mêmes bandeaux, mêmes colonnes, mêmes totaux.
 */
export function buildCasyReceiptHtml(
  d: CasyHtmlInput,
  opts: { title?: string } = {},
): string {
  const monthlyHtml = d.monthly.map((m, i) => monthCell(m, d.monthlyCells[i] ?? '')).join('')
  const tranchesHtml = d.tranches.map((t, i) => trancheCell(t, d.trancheCells[i] ?? '')).join('')
  const title = opts.title ?? `Reçu ${d.numero}`
  const monthlyHeading = monthlyHeadingFor(d.monthly.map((m) => m.mois))
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8" />
<title>${esc(title)}</title>
<style>
@page { size: A4; margin: 8mm; }
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 10px; line-height: 1.25; color: #1f2937; background: #fff; padding: 6px; }
.casy { max-width: 780px; margin: 0 auto; border: 1.5px solid #111; border-radius: 5px; page-break-inside: avoid; break-inside: avoid; }
.casy-head { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-bottom: 1.5px solid #111; }
.casy-logo { width: 40px; height: 40px; object-fit: contain; border: 1px solid #ddd; border-radius: 5px; padding: 2px; background: #fff; }
.casy-logo-ph { width: 40px; height: 40px; border: 1px dashed #999; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 16px; color: #999; }
.casy-school { flex: 1; text-align: center; }
.casy-rep { font-size: 9px; font-weight: 700; letter-spacing: .4px; margin: 0; }
.casy-name { font-size: 13px; font-weight: 800; margin: 0; text-transform: uppercase; }
.casy-dev { font-size: 8.5px; font-style: italic; color: #444; margin: 0; }
.casy-photo { width: 48px; height: 56px; border: 1.5px solid #111; border-radius: 4px; object-fit: cover; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 9px; color: #6b7280; overflow: hidden; }
.casy-photo img { width: 100%; height: 100%; object-fit: cover; }
.casy-band { display: flex; justify-content: space-between; align-items: center; gap: 6px; background: #c00000; color: #fff; padding: 3px 8px; font-size: 9px; font-weight: 600; }
.casy-band .right { background: #fff; color: #c00000; border-radius: 4px; padding: 1px 8px; font-weight: 800; }
.casy-line { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; padding: 3px 8px; border-bottom: 1px solid #111; font-size: 10px; }
.casy-num { color: #c00000; font-weight: 800; font-size: 12px; }
.casy-badge { background: #111; color: #fff; font-size: 8.5px; font-weight: 800; border-radius: 3px; padding: 1px 6px; letter-spacing: .5px; }
.casy-mat { color: #c00000; font-weight: 800; }
.casy-cols { display: grid; grid-template-columns: 1fr 1fr; gap: 0; border-bottom: 1.5px solid #111; }
.casy-col { padding: 4px 6px; }
.casy-col + .casy-col { border-left: 1.5px solid #111; }
.casy-col h4 { margin: 0 0 3px; font-size: 10px; text-align: center; text-transform: uppercase; border-bottom: 1px solid #111; padding-bottom: 2px; }
.casy-group-label { font-size: 8.5px; font-weight: 700; color: #555; margin: 2px 0; }
.casy-month, .casy-tranche { display: flex; align-items: center; gap: 4px; border: 1px solid #9ca3af; border-radius: 3px; padding: 1px 4px; margin-bottom: 2px; font-size: 9.5px; background: #fff; }
.casy-month.is-paid, .casy-tranche.is-paid { background: #e8f5e9; border-color: #16a34a; }
.casy-tranche.is-partial { background: #fff8e1; border-color: #d97706; }
.casy-check { width: 12px; height: 12px; border: 1.5px solid #111; border-radius: 2px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: #16a34a; flex: none; }
.casy-mname, .casy-tname { flex: 1; font-weight: 600; }
.casy-mamount, .casy-tamount { color: #111; font-variant-numeric: tabular-nums; }
.casy-foot-grid { display: grid; grid-template-columns: 1fr 200px; gap: 0; }
.casy-left { padding: 4px 8px; font-size: 10px; }
.casy-totals { border-left: 1.5px solid #111; padding: 4px 6px; font-size: 10px; }
.casy-totals .row { display: flex; justify-content: space-between; padding: 1px 0; }
.casy-totals .pre { color: #1a56db; font-weight: 700; }
.casy-totals .net, .casy-totals .solde { font-weight: 800; border-top: 1px solid #111; margin-top: 1px; padding-top: 2px; }
.casy-barcode { margin: 2px 0 3px; border: 1px solid #111; display: inline-block; padding: 2px 6px; text-align: center; }
.casy-barcode .val { font-family: monospace; font-weight: 700; letter-spacing: 1px; font-size: 10px; }
.casy-barcode .note { font-size: 7.5px; color: #555; }
.casy-sign { display: flex; justify-content: space-between; gap: 8px; margin-top: 4px; }
.casy-sign .box { flex: 1; text-align: center; font-size: 9.5px; }
.casy-sign .line { border-top: 1px solid #111; margin-top: 22px; padding-top: 2px; }
.casy-stamp { border: 1.5px dashed #6b7280; border-radius: 6px; min-height: 36px; display: flex; align-items: center; justify-content: center; color: #6b7280; font-size: 9.5px; margin-top: 4px; overflow: hidden; }
.casy-stamp img { max-width: 100%; max-height: 40px; object-fit: contain; }
.casy-emo { text-align: center; font-size: 8px; color: #444; border-top: 1.5px solid #111; padding: 3px 6px; background: #f9fafb; }
@media print { body { padding: 0; } .casy { border-width: 1.5px; page-break-inside: avoid; break-inside: avoid; } .no-print { display: none !important; } }
</style>
</head>
<body>
<div class="casy">
  <div class="casy-head">
    ${d.logo ? `<img class="casy-logo" src="${esc(d.logo)}" alt="Logo école" />` : `<div class="casy-logo-ph">🏫</div>`}
    <div class="casy-school">
      <p class="casy-rep">RÉPUBLIQUE DE GUINÉE</p>
      <p class="casy-name">${esc(d.schoolName || 'COMPLEXE SCOLAIRE')}</p>
      <p class="casy-dev">Travail — Justice — Solidarité</p>
    </div>
    ${d.logo ? `<img class="casy-logo" src="${esc(d.logo)}" alt="" aria-hidden="true" />` : `<div class="casy-logo-ph">🏫</div>`}
    <div class="casy-photo">${d.photo ? `<img src="${esc(d.photo)}" alt="Photo élève" />` : 'PHOTO'}</div>
  </div>
  <div class="casy-band"><span>Année scolaire : ${esc(d.schoolYear)} &nbsp;•&nbsp; Tél : ${esc(d.schoolTels)} &nbsp;•&nbsp; Email : ${esc(d.schoolEmail)}</span><span class="right">Montant du jour : ${esc(d.montantJour)}</span></div>
  <div class="casy-line"><span>Reçu N° <span class="casy-num">${esc(d.numero)}</span></span><span>Réf. : ${esc(d.maskedRef)}</span><span class="casy-badge">ORIGINAL</span><span style="margin-left:auto">Montant : <strong>${esc(d.montantDigits)}</strong></span></div>
  <div class="casy-line"><span>Matricule : <span class="casy-mat">${esc(d.matricule)}</span></span><span>Prénoms et Nom : <strong>${esc(d.prenomsNom)}</strong></span><span>Sexe : ${esc(d.sexe)}</span><span>Tél : ${esc(d.telephone)}</span><span>Classe : <strong>${esc(d.classe)}</strong></span></div>
  <div class="casy-line"><span>Motif : <strong>${esc(d.motif)}</strong></span><span>Mode : ${esc(d.mode)}</span><span>En lettres : <em>${esc(d.montantLettres)}</em></span></div>
  <div class="casy-cols">
    <div class="casy-col"><h4>${esc(monthlyHeading)}</h4>${monthlyHtml}</div>
    <div class="casy-col"><h4>Paiement par tranche</h4>${tranchesHtml}</div>
  </div>
  <div class="casy-line"><span>Annuel : <strong>${esc(d.annuel)}</strong></span><span>Prochain paiement : <strong>${esc(d.prochainPaiement)}</strong></span></div>
  <div class="casy-foot-grid">
    <div class="casy-left">
      <div>Fait le ${esc(d.dateLettres)}.</div>
      <div class="casy-barcode"><div class="val">${esc(d.barcodeValue)}</div><div class="note">QR visible à l'écran</div></div>
      <div>Service Comptabilité — Caissier : <strong>${esc(d.caissier)}</strong></div>
      <div class="casy-sign">
        <div class="box">Le Caissier<div class="line">${esc(d.caissier)}</div></div>
        <div class="box">Cachet / Tampon<div class="casy-stamp">${d.cachet ? `<img src="${esc(d.cachet)}" alt="Cachet" />` : '—'}</div></div>
        <div class="box">Le Payeur<div class="line"></div></div>
      </div>
    </div>
    <div class="casy-totals">
      <div class="row pre"><span>Inscription / Préalable</span><span>${esc(d.totaux.inscription)}</span></div>
      <div class="row"><span>Coût Annuel</span><span>${esc(d.totaux.coutAnnuel)}</span></div>
      <div class="row"><span>Rabais</span><span>${esc(d.totaux.rabais)}</span></div>
      <div class="row net"><span>Net à Payer</span><span>${esc(d.totaux.net)}</span></div>
      <div class="row"><span>Total Payé</span><span>${esc(d.totaux.totalPaye)}</span></div>
      <div class="row solde"><span>Solde</span><span>${esc(d.totaux.solde)}</span></div>
    </div>
  </div>
  <div class="casy-emo">Via application E-School — Document généré le ${esc(d.dateJJMMAAAA)} — Reçu original, toute reproduction doit être signalée.</div>
</div>
<button class="no-print" onclick="window.print()" style="margin:12px auto;display:block;background:#c00000;color:#fff;border:none;border-radius:4px;padding:8px 18px;font-weight:700;cursor:pointer">🖨️ Imprimer ce reçu</button>
</body>
</html>`
}

/** Ouvre la fenêtre d'impression CASY avec repli téléchargement HTML si pop-up bloquée. */
export function openCasyPrintWindow(html: string, downloadName: string): boolean {
  try {
    const w = window.open('', '_blank', 'width=900,height=700,scrollbars=yes,resizable=yes')
    if (w) {
      w.document.write(html)
      w.document.close()
      const fire = (): void => {
        try {
          w.focus()
          w.print()
        } catch {
          /* impression optionnelle */
        }
      }
      w.onload = () => window.setTimeout(fire, 450)
      window.setTimeout(() => {
        if (!w.closed) {
          try {
            w.focus()
          } catch {
            /* focus optionnel */
          }
        }
      }, 1100)
      return true
    }
  } catch {
    /* repli ci-dessous */
  }
  try {
    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = downloadName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
    return false
  } catch {
    return false
  }
}
