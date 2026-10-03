import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import * as XLSX from 'xlsx'
import { useAccountingStore } from '@/stores/accountingStore'
import { useCurrency } from '@/composables/useCurrency'
import { strictInvoke } from '@/utils/ipc'
import { amountInWordsFR } from '@/utils/amountInWordsFR'

export interface ArrearFilters {
  classe: string
  statut: string
  montantMin: number | null
  retardMin: number | null
  recherche: string
}

export interface RelanceContext {
  firstname: string
  lastname?: string
  parent?: string
  classe?: string
  reste: number
  echeance?: string
  schoolYear?: string
  schoolName?: string
}

let schoolCache: { name: string; year: string } | null = null
async function loadSchoolCache(): Promise<{ name: string; year: string }> {
  if (schoolCache) return schoolCache
  try {
    const s = await strictInvoke<Record<string, unknown>>('school:get', {})
    const d = (s ?? {}) as Record<string, unknown>
    let year = String((d.schoolYear as string) ?? '')
    try {
      const yr = await strictInvoke<{ schoolYear?: string }>('year:getCurrent', {}, { silent: true }).catch(() => null)
      if ((yr as { schoolYear?: string } | null)?.schoolYear) year = String((yr as { schoolYear?: string }).schoolYear)
    } catch { /* optionnel */ }
    schoolCache = { name: String((d.name as string) ?? ''), year }
  } catch { schoolCache = { name: '', year: '' } }
  return schoolCache as { name: string; year: string }
}

/** Normalise un numéro guinéen vers +224 (sans le + pour wa.me). Retourne '' si invalide. */
export function normalizeGuineePhone(phone: string | undefined): string {
  if (!phone) return ''
  let digits = String(phone).replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('00224')) digits = digits.slice(2)
  if (digits.startsWith('224') && digits.length > 12) digits = digits.slice(-12)
  if (digits.startsWith('224') && digits.length === 12) {
    return /^224[67]\d{8}$/.test(digits) ? digits : ''
  }
  if (digits.length === 9 && /^[67]\d{8}$/.test(digits)) return `224${digits}`
  if (digits.length === 8 && /^[67]\d{7}$/.test(digits)) return `224${digits}`
  if (digits.startsWith('0') && digits.length === 10 && /^[0][67]\d{8}$/.test(digits)) return `224${digits.slice(1)}`
  return ''
}

/** Vrai si le numéro est un mobile guinéen +224 valide (9 chiffres, 6/7…). */
export function isValidGuineePhone(phone: string | undefined): boolean {
  return normalizeGuineePhone(phone) !== ''
}

/** Premier numéro non vide : élève → tuteur (famille). Trim + fallback. */
export function pickDisplayPhone(...candidates: Array<string | undefined>): string {
  for (const c of candidates) {
    const v = String(c ?? '').trim()
    if (v) return v
  }
  return ''
}

/** JJ/MM/AAAA depuis ISO ou JJ/MM/AAAA, sinon '—'. */
export function formatEcheanceJJMMAAAA(v: unknown): string {
  const s = String(v ?? '').trim()
  if (!s || s === '—') return '—'
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) return s
  const dt = new Date(s)
  if (Number.isNaN(dt.getTime())) return '—'
  return dt.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

/**
 * Filtres + relances + export des impayés.
 * Relance WhatsApp via `wa.me`, SMS via `sms:` — sans dépendance backend.
 * Message poli FR : parent, classe, montant chiffres + lettres, année, école.
 */
/** Cache module : la liste des classes est canonique (grade:all), chargée une fois. */
let gradeNamesCache: string[] | null = null
let gradeNamesPromise: Promise<string[]> | null = null

/**
 * Noms des classes depuis la source canonique `grade:all`
 * (tolérant : tableau brut | {data} | {grades}).
 * Jamais vide à tort : repli sur les classes des impayés si le canal échoue.
 */
export async function loadGradeNames(fallback: string[] = []): Promise<string[]> {
  if (gradeNamesCache) return gradeNamesCache
  if (!gradeNamesPromise) {
    gradeNamesPromise = (async () => {
      try {
        const raw = await strictInvoke<unknown>('grade:all')
        const list: Array<{ name?: unknown }> = Array.isArray(raw)
          ? raw as Array<{ name?: unknown }>
          : ((raw as { data?: unknown })?.data as Array<{ name?: unknown }>)
            ?? ((raw as { grades?: unknown })?.grades as Array<{ name?: unknown }>)
            ?? []
        const names = [...new Set(
          list.map((g) => String(g?.name ?? '').trim()).filter(Boolean)
        )].sort((a, b) => a.localeCompare(b, 'fr'))
        gradeNamesCache = names.length ? names : [...fallback]
      } catch {
        gradeNamesCache = [...fallback]
      }
      return gradeNamesCache as string[]
    })()
  }
  return gradeNamesPromise
}

export function useArrears() {
  const store = useAccountingStore()
  const filters = ref<ArrearFilters>({ classe: '', statut: '', montantMin: null, retardMin: null, recherche: '' })
  const gradeNames = ref<string[]>(gradeNamesCache ?? [])

  // Source canonique dès la création (idempotent via cache module).
  void loadGradeNames().then((names) => { gradeNames.value = names })

  // Les options du filtre Classe viennent des classes existantes (grade:all),
  // PAS des impayés : sinon les classes sans impayé sont invisibles.
  // Repli : classes des impayés si grade:all encore vide/échoué.
  const classes = computed(() => gradeNames.value.length
    ? gradeNames.value
    : [...new Set(store.arrears.map((a) => a.classe))])

  const filtered = computed(() => {
    const f = filters.value
    return store.arrears.filter((a) => {
      if (f.classe && a.classe !== f.classe) return false
      if (f.statut && a.statut !== f.statut) return false
      if (f.montantMin != null && a.reste < f.montantMin) return false
      if (f.retardMin != null && a.joursRetard < f.retardMin) return false
      if (f.recherche) {
        const q = f.recherche.toLowerCase().trim()
        const hay = `${a.firstname} ${a.lastname} ${a.matricule}`.toLowerCase()
        if (!hay.includes(q)) return false
      }
      return true
    })
  })

  const totalReste = computed(() => filtered.value.reduce((s, a) => s + a.reste, 0))

  function relanceMessage(firstname: string, reste: number): string {
    const { formatMoney } = useCurrency();
    return `Bonjour, rappel : solde restant de ${formatMoney(reste)} pour ${firstname}. Merci de régulariser auprès de la comptabilité.`
  }

  /** Message poli FR complet : parent / classe / montant + lettres / année / école. */
  function relanceMessageGuinee(ctx: RelanceContext, school?: { name: string; year: string }): string {
    const { formatMoney, currencyCode } = useCurrency()
    const lettres = amountInWordsFR(Number(ctx.reste ?? 0), currencyCode.value)
    const eleve = `${ctx.firstname ?? ''} ${ctx.lastname ?? ''}`.trim() || ctx.firstname
    const parent = ctx.parent ? `M./Mme ${ctx.parent}` : 'Cher parent'
    const classe = ctx.classe ? ` (classe de ${ctx.classe})` : ''
    const echeance = ctx.echeance && ctx.echeance !== '—' ? `, échéance ${ctx.echeance}` : ''
    const annee = ctx.schoolYear || school?.year ? `, année scolaire ${ctx.schoolYear || school?.year}` : ''
    const ecole = ctx.schoolName || school?.name ? ` — ${ctx.schoolName || school?.name}` : ''
    return `Bonjour ${parent}, nous vous rappelons aimablement que le solde restant de l'élève ${eleve}${classe} s'élève à ${formatMoney(Number(ctx.reste ?? 0))} (${lettres})${echeance}${annee}${ecole}. Merci de bien vouloir régulariser auprès de la comptabilité. Cordialement.`
  }

  async function buildGuineeMessage(ctx: RelanceContext): Promise<string> {
    const school = await loadSchoolCache()
    return relanceMessageGuinee(ctx, school)
  }

  async function openWhatsApp(phone: string | undefined, firstname: string, reste: number): Promise<void> {
    const num = normalizeGuineePhone(phone)
    if (!num) {
      ElMessage.warning('Numéro de téléphone manquant')
      return
    }
    const msg = await buildGuineeMessage({ firstname, reste })
    window.open(`https://wa.me/${num}?text=${encodeURIComponent(msg)}`, '_blank')
  }

  async function openSms(phone: string | undefined, firstname: string, reste: number): Promise<void> {
    const num = normalizeGuineePhone(phone)
    if (!num) {
      ElMessage.warning('Numéro de téléphone manquant')
      return
    }
    const msg = await buildGuineeMessage({ firstname, reste })
    window.location.href = `sms:+${num}?body=${encodeURIComponent(msg)}`
  }

  function exportExcel(): void {
    const { currencyCode } = useCurrency()
    const rows = filtered.value.map((a) => ({
      Matricule: a.matricule,
      Nom: a.lastname,
      Prénom: a.firstname,
      Classe: a.classe,
      Téléphone: a.phone ? `+${normalizeGuineePhone(a.phone)}` : '',
      'Échéance': (a as unknown as { echeance?: string }).echeance ?? '—',
      [`Total dû (${currencyCode.value})`]: a.totalDu,
      [`Total payé (${currencyCode.value})`]: a.totalPaye,
      [`Reste (${currencyCode.value})`]: a.reste,
      'Jours de retard': a.joursRetard,
      Statut: a.statut === 'partiel' ? 'Partiel' : 'Non payé',
    }))
    if (!rows.length) {
      ElMessage.warning('Aucun impayé à exporter')
      return
    }
    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Impayés')
    XLSX.writeFile(wb, `impayes_${new Date().toISOString().slice(0, 10)}.xlsx`)
    ElMessage.success('Export Excel réussi')
  }

  return { store, filters, classes, gradeNames, loadGradeNames, filtered, totalReste, openWhatsApp, openSms, exportExcel, relanceMessage, relanceMessageGuinee, buildGuineeMessage, normalizeGuineePhone, isValidGuineePhone, pickDisplayPhone, formatEcheanceJJMMAAAA }
}
