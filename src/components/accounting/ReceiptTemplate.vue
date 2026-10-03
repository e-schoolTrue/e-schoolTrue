<template>
  <div id="receipt-print-zone" class="casy">
    <!-- Header : double logo + République Guinée + école + logo droite + photo élève -->
    <div class="casy__head">
      <img v-if="logo" :src="logo" alt="Logo école" class="casy__logo" />
      <div v-else class="casy__logo-ph" aria-hidden="true">🏫</div>
      <div class="casy__school">
        <p class="casy__rep">RÉPUBLIQUE DE GUINÉE</p>
        <h2 class="casy__name">{{ schoolName || 'COMPLEXE SCOLAIRE' }}</h2>
        <p class="casy__dev">Travail — Justice — Solidarité</p>
      </div>
      <img v-if="logo" :src="logo" alt="" aria-hidden="true" class="casy__logo" />
      <div v-else class="casy__logo-ph" aria-hidden="true">🏫</div>
      <div class="casy__photo">
        <img v-if="photo" :src="photo" alt="Photo élève" />
        <span v-else>PHOTO</span>
      </div>
    </div>

    <!-- Bande : année rouge + tels + email + montant du jour -->
    <div class="casy__band">
      <span>Année scolaire : {{ schoolYear || '—' }} &nbsp;•&nbsp; Tél : {{ tels || schoolPhone || '—' }} &nbsp;•&nbsp; Email : {{ email || schoolEmail || '—' }}</span>
      <span class="casy__band-right">Montant du jour : {{ montantJourTxt }}</span>
    </div>

    <!-- Ligne Reçu N° rouge + masqué + badge Original + montant -->
    <div class="casy__line">
      <span>Reçu N° <span class="casy__num">{{ numero }}</span></span>
      <span v-if="transactionRef">Réf. : {{ masked }}</span>
      <span class="casy__badge">ORIGINAL</span>
      <span class="casy__spacer" />
      <span>Montant : <strong>{{ formatted }}</strong></span>
    </div>

    <!-- Ligne élève : matricule rouge + noms + sexe + tél + classe -->
    <div class="casy__line">
      <span>Matricule : <span class="casy__mat">{{ matricule || '—' }}</span></span>
      <span>Prénoms et Nom : <strong>{{ prenomsNom }}</strong></span>
      <span>Sexe : {{ sexe || '—' }}</span>
      <span>Tél : {{ telephone || '—' }}</span>
      <span>Classe : <strong>{{ classe || '—' }}</strong></span>
    </div>
    <div class="casy__line casy__line--soft">
      <span>Motif : <strong>{{ motif || '—' }}</strong></span>
      <span>Mode : {{ modeGuinee }}</span>
      <span class="casy__letters">En lettres : <em>{{ lettres || '—' }}</em></span>
    </div>

    <!-- 2 colonnes bordées côte-à-côte -->
    <div class="casy__cols">
      <div class="casy__col">
        <h4>{{ monthlyTitle }}</h4>
        <div v-for="g in monthGroups" :key="g.label" class="casy__group">
          <p class="casy__group-label">{{ g.label }}</p>
          <div v-for="m in g.rows" :key="m.mois" class="casy__month" :class="{ 'is-paid': m.paye }">
            <span class="casy__check">{{ m.paye ? '✓' : '' }}</span>
            <span class="casy__mname">{{ m.mois }}</span>
            <span class="casy__mamount">{{ fmtAmount(m.montant) }}</span>
          </div>
        </div>
      </div>
      <div class="casy__col">
        <h4>Paiement par tranche</h4>
        <div v-for="t in tranchesList" :key="t.nom" class="casy__tranche" :class="{ 'is-paid': t.paye, 'is-partial': !t.paye && t.statut === 'Partiel' }">
          <span class="casy__check">{{ t.paye ? '✓' : '' }}</span>
          <span class="casy__tname">{{ t.nom }}</span>
          <span class="casy__tamount">{{ fmtAmount(t.montant) }}</span>
        </div>
        <p v-if="!tranchesList.length" class="casy__empty">—</p>
      </div>
    </div>

    <!-- Annuel + prochain paiement -->
    <div class="casy__line">
      <span>Annuel : <strong>{{ annuelTxt }}</strong></span>
      <span>Prochain paiement : <strong>{{ prochainPaiement || '—' }}</strong></span>
    </div>

    <!-- Footer : date lettres + barcode + comptabilité + totaux + cachet + signature -->
    <div class="casy__foot">
      <div class="casy__left">
        <p class="casy__date">Fait le {{ dateLettres }}.</p>
        <div class="casy__barcode">
          <QrcodeVue v-if="barcodeValue" :value="barcodeValue" :size="48" level="H" />
          <div v-else class="casy__barcode-ph">—</div>
          <p class="casy__barcode-val">{{ barcodeValue || numero || '—' }}</p>
        </div>
        <p>Service Comptabilité — Caissier : <strong>{{ caissier || '—' }}</strong></p>
        <div class="casy__sign">
          <div class="casy__signbox"><p>Le Caissier</p><div class="casy__sigline">{{ caissier || '' }}</div></div>
          <div class="casy__signbox">
            <p>Cachet / Tampon</p>
            <div class="casy__stamp"><img v-if="cachet" :src="cachet" alt="Cachet" /><span v-else>—</span></div>
          </div>
          <div class="casy__signbox"><p>Le Payeur</p><div class="casy__sigline"></div></div>
        </div>
      </div>
      <div class="casy__totals">
        <div class="casy__trow pre"><span>Inscription / Préalable</span><span>{{ totauxTxt.inscription }}</span></div>
        <div class="casy__trow"><span>Coût Annuel</span><span>{{ totauxTxt.coutAnnuel }}</span></div>
        <div class="casy__trow"><span>Rabais</span><span>{{ totauxTxt.rabais }}</span></div>
        <div class="casy__trow net"><span>Net à Payer</span><span>{{ totauxTxt.net }}</span></div>
        <div class="casy__trow"><span>Total Payé</span><span>{{ totauxTxt.totalPaye }}</span></div>
        <div class="casy__trow solde"><span>Solde</span><span>{{ totauxTxt.solde }}</span></div>
      </div>
    </div>

    <div class="casy__emo">Via application E-School — Reçu original du {{ dateJJMMAAAA }}.</div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import QrcodeVue from 'qrcode.vue'
import { useCurrency } from '@/composables/useCurrency'
import { buildCasyMonthlyGrid, dateEnLettres, formatJJMMAAAA, maskRef, type PaymentImputationOrder } from '@/utils/receiptCasy'
import { labelModeGuinee } from '@/composables/useReceipt'
import { normalizeImputationOrder } from '@/composables/useImputationOrder'
import type { CasyMonthlyRow, CasyTrancheRow, CasyTotaux } from '@/utils/receiptCasy'

const props = defineProps<{
  schoolName: string
  schoolAddress: string
  schoolPhone: string
  schoolEmail?: string
  schoolYear?: string
  logo?: string
  numero: string
  /** Référence transaction Orange Money / MTN — distincte du N° reçu. */
  transactionRef?: string
  date: string
  /** Compat historique : `eleve` = élève (pour le compte de). */
  eleve?: string
  /** Payeur (Reçu de). Si absent, utilise `eleve`. */
  recuDe?: string
  /** Élève bénéficiaire. Si absent, utilise `eleve`. */
  pourLeCompteDe?: string
  matricule: string
  classe: string
  motif: string
  montant: number
  lettres: string
  mode: string
  caissier?: string
  /* Maquette CASY — tous optionnels (repli `—` / décoché). */
  sexe?: string
  telephone?: string
  photo?: string
  prenoms?: string
  nom?: string
  monthlyGrid?: CasyMonthlyRow[]
  tranches?: CasyTrancheRow[]
  annuel?: number
  prochainPaiement?: string
  totaux?: Partial<CasyTotaux>
  montantJour?: number
  barcodeValue?: string
  ecoleTels?: string
  ecoleEmail?: string
  cachet?: string
  /** Même ordre que `buildCasyMonthlyGrid` — figé au paiement sinon live/défaut. */
  imputationOrder?: PaymentImputationOrder
}>()

const { formatCurrency } = useCurrency()
const formatted = computed(() => safeFmt(props.montant))
const montantJourTxt = computed(() => safeFmt(props.montantJour ?? props.montant))
const annuelTxt = computed(() => safeFmt(props.annuel ?? props.totaux?.coutAnnuel ?? 0))

function safeFmt(n: unknown): string {
  try {
    return formatCurrency(Number(n ?? 0))
  } catch {
    return String(n ?? '—')
  }
}
function fmtAmount(n: unknown): string {
  return safeFmt(n)
}

const tels = computed(() => props.ecoleTels || props.schoolPhone || '—')
const email = computed(() => props.ecoleEmail || props.schoolEmail || '—')
const masked = computed(() => maskRef(props.transactionRef ?? ''))
const barcodeValue = computed(() => String(props.barcodeValue || props.numero || ''))
const prenomsNom = computed(() => {
  const full = `${props.prenoms ?? ''} ${props.nom ?? ''}`.trim()
  if (full) return full
  return props.pourLeCompteDe || props.eleve || '—'
})

const orderNorm = computed(() => normalizeImputationOrder(props.imputationOrder))
const monthlyList = computed<CasyMonthlyRow[]>(() => {
  if (props.monthlyGrid?.length) return props.monthlyGrid
  const annuel = Number(props.annuel ?? props.totaux?.coutAnnuel ?? 0)
  return buildCasyMonthlyGrid(annuel, 0, undefined, orderNorm.value)
})
const monthlyTitle = computed(() =>
  orderNorm.value === 'FIRST_FIRST'
    ? 'Paiement mensuel — Octobre à Juin'
    : `Paiement mensuel — ${monthlyList.value.map((m) => m.mois.slice(0, 3)).join(' / ')}`,
)
const monthGroups = computed(() => {
  // Groupes dynamiques par tranches de 3 dans l'ordre d'imputation (reflète la config).
  const groups: Array<{ label: string; rows: CasyMonthlyRow[] }> = []
  for (let i = 0; i < monthlyList.value.length; i += 3) {
    const rows = monthlyList.value.slice(i, i + 3)
    groups.push({ label: rows.map((m) => m.mois.slice(0, 3)).join(' / '), rows })
  }
  return groups
})
const tranchesList = computed<CasyTrancheRow[]>(() => {
  if (props.tranches?.length) return props.tranches
  const annuel = Number(props.annuel ?? props.totaux?.coutAnnuel ?? 0)
  const base = Math.floor(annuel / 3)
  const names = ['Première Tranche', 'Deuxième Tranche', 'Troisième Tranche']
  const amounts = [base, base, annuel - base * 2]
  return names.map((nom, i) => ({ nom, montant: amounts[i] }))
})
const totauxTxt = computed(() => ({
  inscription: safeFmt(props.totaux?.inscription ?? 0),
  coutAnnuel: safeFmt(props.totaux?.coutAnnuel ?? props.annuel ?? 0),
  rabais: safeFmt(props.totaux?.rabais ?? 0),
  net: safeFmt(props.totaux?.net ?? props.montant ?? 0),
  totalPaye: safeFmt(props.totaux?.totalPaye ?? props.montant ?? 0),
  solde: safeFmt(props.totaux?.solde ?? 0),
}))

const dateJJMMAAAA = computed(() => formatJJMMAAAA(props.date))
const dateLettres = computed(() => dateEnLettres(props.date))

/** Modes Guinée centralisés (voir useReceipt.labelModeGuinee). */
const modeGuinee = computed(() => labelModeGuinee(props.mode))
</script>

<style scoped>
/* Demi-page A4 : contenu condensé pour tenir sur ~135-140mm de hauteur. */
.casy {
  background: #fff;
  border: 1.5px solid #111;
  border-radius: 5px;
  color: #1f2937;
  font-size: 10px;
  line-height: 1.25;
  max-width: 780px;
  margin: 0 auto;
  page-break-inside: avoid;
  break-inside: avoid;
}
.casy__head { display: flex; align-items: center; gap: 6px; padding: 4px 8px; border-bottom: 1.5px solid #111; }
.casy__logo { width: 40px; height: 40px; object-fit: contain; border: 1px solid #ddd; border-radius: 5px; padding: 2px; background: #fff; }
.casy__logo-ph { width: 40px; height: 40px; border: 1px dashed #999; border-radius: 5px; display: flex; align-items: center; justify-content: center; font-size: 16px; }
.casy__school { flex: 1; text-align: center; }
.casy__rep { margin: 0; font-size: 9px; font-weight: 700; letter-spacing: .4px; }
.casy__name { margin: 0; font-size: 13px; text-transform: uppercase; }
.casy__dev { margin: 0; font-size: 8.5px; font-style: italic; color: #444; }
.casy__photo { width: 48px; height: 56px; border: 1.5px solid #111; border-radius: 4px; object-fit: cover; background: #f3f4f6; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #6b7280; overflow: hidden; font-size: 9px; }
.casy__photo img { width: 100%; height: 100%; object-fit: cover; }
.casy__band { display: flex; justify-content: space-between; align-items: center; gap: 6px; background: #c00000; color: #fff; padding: 3px 8px; font-size: 9px; font-weight: 600; flex-wrap: wrap; }
.casy__band-right { background: #fff; color: #c00000; border-radius: 4px; padding: 1px 8px; font-weight: 800; white-space: nowrap; }
.casy__line { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: center; padding: 3px 8px; border-bottom: 1px solid #111; }
.casy__line--soft { border-bottom: 1.5px solid #111; }
.casy__num { color: #c00000; font-weight: 800; font-size: 12px; }
.casy__badge { background: #111; color: #fff; font-size: 8.5px; font-weight: 800; border-radius: 3px; padding: 1px 6px; letter-spacing: .5px; }
.casy__mat { color: #c00000; font-weight: 800; }
.casy__spacer { flex: 1; }
.casy__letters { flex-basis: 100%; }
.casy__cols { display: grid; grid-template-columns: 1fr 1fr; border-bottom: 1.5px solid #111; }
.casy__col { padding: 4px 6px; }
.casy__col + .casy__col { border-left: 1.5px solid #111; }
.casy__col h4 { margin: 0 0 3px; font-size: 10px; text-align: center; text-transform: uppercase; border-bottom: 1px solid #111; padding-bottom: 2px; }
.casy__group-label { font-size: 8.5px; font-weight: 700; color: #555; margin: 2px 0; }
.casy__month, .casy__tranche { display: flex; align-items: center; gap: 4px; border: 1px solid #9ca3af; border-radius: 3px; padding: 1px 4px; margin-bottom: 2px; background: #fff; }
.casy__month.is-paid, .casy__tranche.is-paid { background: #e8f5e9; border-color: #16a34a; }
.casy__tranche.is-partial { background: #fff8e1; border-color: #d97706; }
.casy__check { width: 12px; height: 12px; border: 1.5px solid #111; border-radius: 2px; display: inline-flex; align-items: center; justify-content: center; font-size: 9px; font-weight: 800; color: #16a34a; flex: none; }
.casy__mname, .casy__tname { flex: 1; font-weight: 600; }
.casy__mamount, .casy__tamount { font-variant-numeric: tabular-nums; }
.casy__empty { color: #6b7280; text-align: center; }
.casy__foot { display: grid; grid-template-columns: 1fr 200px; }
.casy__left { padding: 4px 8px; }
.casy__date { margin: 0 0 3px; }
.casy__barcode { display: inline-block; border: 1px solid #111; padding: 2px 6px; text-align: center; margin: 2px 0 3px; }
.casy__barcode-val { font-family: monospace; font-weight: 700; letter-spacing: 1px; margin: 1px 0 0; font-size: 10px; }
.casy__barcode-ph { width: 48px; height: 48px; display: flex; align-items: center; justify-content: center; color: #6b7280; }
.casy__sign { display: flex; gap: 8px; margin-top: 4px; }
.casy__signbox { flex: 1; text-align: center; font-size: 9.5px; }
.casy__signbox p { margin: 0; }
.casy__sigline { border-top: 1px solid #111; margin-top: 22px; padding-top: 2px; min-height: 14px; }
.casy__stamp { border: 1.5px dashed #6b7280; border-radius: 6px; min-height: 36px; display: flex; align-items: center; justify-content: center; color: #6b7280; margin-top: 4px; overflow: hidden; }
.casy__stamp img { max-width: 100%; max-height: 40px; object-fit: contain; }
.casy__totals { border-left: 1.5px solid #111; padding: 4px 6px; }
.casy__trow { display: flex; justify-content: space-between; gap: 8px; padding: 1px 0; }
.casy__trow.pre { color: #1a56db; font-weight: 700; }
.casy__trow.net, .casy__trow.solde { font-weight: 800; border-top: 1px solid #111; margin-top: 1px; padding-top: 2px; }
.casy__emo { text-align: center; font-size: 8px; color: #444; border-top: 1.5px solid #111; padding: 3px 6px; background: #f9fafb; }

@media print {
  .casy { border-width: 1.5px; page-break-inside: avoid; break-inside: avoid; }
}
/* Reçu légal : 2 colonnes conservées même en étroit (pas de passage 1fr qui allonge/coupe). */
</style>

<style>
@page {
  size: A4;
  margin: 8mm;
}
@media print {
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
</style>
