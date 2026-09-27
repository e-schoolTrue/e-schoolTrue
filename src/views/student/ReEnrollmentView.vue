<template>
  <div class="re-enrollment">
    <el-alert
      v-if="writeLocked"
      :title="`Année ${targetYearLabel} clôturée — réinscription en lecture seule`"
      type="warning"
      :closable="false"
      show-icon
      class="closed-banner"
    />

    <el-card class="filters-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>Réinscriptions — {{ sourceYear }} → {{ targetYear }}</span>
          <div class="header-actions">
            <el-button type="danger" :icon="Document" :loading="loadingPdf" @click="exportToPdf">
              Exporter PDF
            </el-button>
            <el-button type="success" :icon="Download" :loading="loadingExcel" @click="exportToExcel">
              Exporter Excel
            </el-button>
            <el-button type="primary" :icon="Refresh" :loading="loading" @click="loadCandidates">
              Actualiser
            </el-button>
          </div>
        </div>
      </template>
      <el-row :gutter="12" align="middle">
        <!-- Années : AUCUNE UI de sélection — source = N-1 et cible = année du
             `YearSwitcher` du menu, calculées en interne. Affichage texte simple.
             Workflow inter-années légitime (réinscription), PAS un switch de session. -->
        <el-col :xs="24" :sm="8" :md="5">
          <span class="year-flow-text">{{ filters.sourceYear }} → {{ filters.targetYear }}</span>
        </el-col>
        <el-col :xs="24" :sm="8" :md="5">
          <el-select v-model="filters.gradeId" placeholder="Classe" clearable @change="loadCandidates">
            <el-option v-for="g in grades" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="8" :md="4">
          <el-select v-model="filters.decision" placeholder="Décision" @change="applyClientFilters">
            <el-option label="Toutes" value="all" />
            <el-option label="Admis" value="Admis" />
            <el-option label="Ajourné" value="Ajourné" />
          </el-select>
        </el-col>
        <el-col :xs="24" :sm="8" :md="5">
          <el-input
            v-model="filters.search"
            placeholder="Rechercher un élève…"
            clearable
            @input="applyClientFilters"
          >
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
        </el-col>
      </el-row>
    </el-card>

    <el-card class="table-card" shadow="hover">
      <template #header>
        <div class="card-header">
          <span>{{ filtered.length }} candidat(s)</span>
          <el-button
            type="warning"
            :disabled="selected.length === 0 || writeLocked"
            :loading="batchLoading"
            @click="batchReEnroll"
          >
            Réinscrire la sélection ({{ selected.length }})
          </el-button>
        </div>
      </template>
      <el-table
        v-loading="loading"
        :data="filtered"
        border
        stripe
        row-key="id"
        empty-text="Aucun candidat — choisissez l'année source et la classe"
        style="width: 100%"
        @selection-change="selected = $event"
      >
        <el-table-column type="selection" width="45" :selectable="(row: Candidate) => !row.alreadyReEnrolled" />
        <el-table-column label="Élève" min-width="200">
          <template #default="{ row }">
            <div class="student-cell">
              <strong>{{ row.firstname }} {{ row.lastname }}</strong>
              <span class="muted">{{ row.matricule }} · {{ row.sourceGradeName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Moy." width="80" align="center" prop="average">
          <template #default="{ row }">{{ row.average == null ? '—' : row.average.toFixed(2) }}</template>
        </el-table-column>
        <el-table-column label="Décision" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="row.decision === 'Admis' ? 'success' : 'danger'" size="small">
              {{ row.decision }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Classe cible" min-width="170">
          <template #default="{ row }">
            <el-select v-model="row.targetGradeId" size="small" :disabled="row.alreadyReEnrolled || writeLocked">
              <el-option v-for="g in grades" :key="g.id" :label="g.name" :value="g.id" />
            </el-select>
          </template>
        </el-table-column>
        <el-table-column label="Frais" width="110" align="center">
          <template #default="{ row }">
            <el-tag :type="feeTagType(row.feeStatus)" size="small">{{ feeLabel(row.feeStatus) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Statut" width="120" align="center">
          <template #default="{ row }">
            <el-tag v-if="row.alreadyReEnrolled" type="info" size="small">Réinscrit</el-tag>
            <el-tag v-else type="warning" size="small">À réinscrire</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="200" fixed="right" align="center">
          <template #default="{ row }">
            <el-button
              type="primary"
              size="small"
              :disabled="row.alreadyReEnrolled || writeLocked"
              @click="reEnroll(row)"
            >
              Réinscrire
            </el-button>
            <el-button size="small" @click="viewStudent(row)">Voir</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { Document, Download, Refresh, Search } from '@element-plus/icons-vue';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { useYearStore } from '@/stores/yearStore';
import { warnIfClosed, isYearClosedError, handleYearClosedError } from '@/composables/useYearGuard';
import { YEAR_CLOSED_CODE } from '@/types/year';
import type { YearRepartitionResponse } from '@/types/year';

type FeeStatus = 'paid' | 'partial' | 'unpaid' | 'unknown';

interface GradeLike {
  id: number;
  name: string;
  order?: number;
  /** Chaînage serveur (`grade.nextGradeId`) — prioritaire sur `order + 1` (m5). */
  nextGradeId?: number | null;
}

interface Candidate {
  id: number;
  firstname: string;
  lastname: string;
  matricule: string;
  sourceGradeId: number;
  sourceGradeName: string;
  average: number | null;
  decision: 'Admis' | 'Ajourné';
  targetGradeId: number;
  feeStatus: FeeStatus;
  alreadyReEnrolled: boolean;
}

interface Filters {
  sourceYear: string;
  targetYear: string;
  gradeId?: number;
  decision: 'all' | 'Admis' | 'Ajourné';
  search: string;
}

const router = useRouter();
const yearStore = useYearStore();

const loading = ref(false);
const batchLoading = ref(false);
const loadingExcel = ref(false);
const loadingPdf = ref(false);
const years = ref<YearRepartitionResponse[]>([]);
const grades = ref<GradeLike[]>([]);
/** Candidats chargés (source de vérité) — les filtres client s'appliquent dans `filtered`. */
const allCandidates = ref<Candidate[]>([]);
const selected = ref<Candidate[]>([]);

const filters = ref<Filters>({ sourceYear: '', targetYear: '', gradeId: undefined, decision: 'all', search: '' });

const sourceYear = computed(() => filters.value.sourceYear);
const targetYear = computed(() => filters.value.targetYear || yearStore.currentSchoolYear);
const targetYearLabel = computed(() => filters.value.targetYear || 'cible');
const writeLocked = computed(() => {
  const target = years.value.find((y) => y.schoolYear === filters.value.targetYear);
  return target?.status === 'closed' || (target == null && yearStore.isClosed);
});

/** Filtres client (décision + recherche) — sans perte : `allCandidates` intact. */
const filtered = computed(() => {
  const q = filters.value.search.trim().toLowerCase();
  return allCandidates.value
    .filter((c) => (filters.value.decision === 'all' ? true : c.decision === filters.value.decision))
    .filter((c) => (q ? `${c.firstname} ${c.lastname} ${c.matricule}`.toLowerCase().includes(q) : true));
});

function orderedGrades(): GradeLike[] {
  return [...grades.value].sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id));
}

/**
 * Classe cible par défaut (m5) : `nextGradeId` serveur d'abord, repli `order + 1`.
 * Maintien (Ajourné) = même classe. Le backend (`resolveNextGrade`) applique
 * la même priorité si `gradeId` est omis — on pré-remplit ici pour l'UX.
 */
function defaultTargetGrade(sourceGradeId: number, decision: 'Admis' | 'Ajourné'): number {
  if (decision !== 'Admis') return sourceGradeId;
  const source = grades.value.find((g) => g.id === sourceGradeId);
  if (source?.nextGradeId != null && grades.value.some((g) => g.id === source.nextGradeId)) {
    return source.nextGradeId;
  }
  const ordered = orderedGrades();
  const idx = ordered.findIndex((g) => g.id === sourceGradeId);
  if (idx >= 0 && idx < ordered.length - 1) return ordered[idx + 1].id;
  return sourceGradeId;
}

function feeLabel(s: FeeStatus): string {
  return s === 'paid' ? 'Soldé' : s === 'partial' ? 'Partiel' : s === 'unpaid' ? 'Impayé' : '—';
}

function feeTagType(s: FeeStatus): 'success' | 'warning' | 'danger' | 'info' {
  return s === 'paid' ? 'success' : s === 'partial' ? 'warning' : s === 'unpaid' ? 'danger' : 'info';
}

function normalizeDecision(raw: unknown, average: number | null): 'Admis' | 'Ajourné' {
  const s = String(raw ?? '').toLowerCase();
  if (s.includes('admis')) return 'Admis';
  if (s.includes('ajourn') || s.includes('redoubl') || s.includes('exclu') || s.includes('refus')) return 'Ajourné';
  return average != null && average >= 10 ? 'Admis' : 'Ajourné';
}

async function loadReferentials(): Promise<void> {
  // Verrou : cible = année du menu (`YearSwitcher`), source = N-1. Aucune UI de sélection.
  const list = await yearStore.fetchList().catch(() => yearStore.list);
  const sorted = [...list].sort((a, b) => a.schoolYear.localeCompare(b.schoolYear));
  years.value = sorted;
  const loginYear =
    yearStore.currentSchoolYear ||
    sorted.find((y) => y.isCurrent)?.schoolYear ||
    sorted[sorted.length - 1]?.schoolYear ||
    '';
  filters.value.targetYear = loginYear;
  const targetIdx = sorted.findIndex((y) => y.schoolYear === loginYear);
  filters.value.sourceYear =
    (targetIdx > 0 ? sorted[targetIdx - 1]?.schoolYear : sorted[sorted.length - 2]?.schoolYear) ??
    sorted[0]?.schoolYear ??
    '';
  // Classes : `grade:all` puis repli `grade:getAllGrades` (AnnualPVView).
  for (const ch of ['grade:all', 'grade:getAllGrades']) {
    try {
      const res = await window.ipcRenderer.invoke(ch);
      const data = (res as { success?: boolean; data?: GradeLike[] })?.data ?? res;
      if (Array.isArray(data) && data.length > 0) {
        grades.value = (data as GradeLike[]).map((g) => ({
          id: g.id,
          name: g.name,
          order: g.order,
          nextGradeId: (g as { nextGradeId?: number | null }).nextGradeId ?? null,
        }));
        break;
      }
    } catch {
      continue;
    }
  }
}

function periodsFor(yearLabel: string): string[] {
  const entry = years.value.find((y) => y.schoolYear === yearLabel);
  const names = entry?.periodConfigurations?.map((p) => p.name).filter(Boolean) ?? [];
  return names.length > 0 ? (names as string[]) : ['Trimestre 1', 'Trimestre 2', 'Trimestre 3'];
}

async function loadCandidates(): Promise<void> {
  if (!filters.value.sourceYear) {
    await loadReferentials();
  }
  if (!filters.value.sourceYear) {
    ElMessage.warning('Aucune année source disponible');
    return;
  }
  loading.value = true;
  try {
    // 1. Élèves de l'année source (filtre serveur + repli client, le backend ignore `schoolYear`).
    const studentsRes = await window.ipcRenderer.invoke('student:all', {
      page: 1,
      pageSize: 5000,
      filters: { grade: filters.value.gradeId, schoolYear: filters.value.sourceYear },
    });
    const rawStudents: Array<{
      id: number; firstname: string; lastname: string; matricule?: string;
      schoolYear?: string; grade?: { id: number; name: string } | null;
    }> = Array.isArray(studentsRes?.data)
      ? studentsRes.data
      : (studentsRes?.data?.students ?? []);
    const sourceStudents = rawStudents.filter((s) => (s.schoolYear || '') === filters.value.sourceYear);

    // 2. Élèves déjà présents en année cible — m5 : clé `studentId|schoolYear`,
    // jamais `matricule|nom` (collisions homonymes, matricules réassignés).
    const targetIds = new Set<number>();
    try {
      const targetRes = await window.ipcRenderer.invoke('student:all', {
        page: 1,
        pageSize: 5000,
        filters: { schoolYear: filters.value.targetYear },
      });
      const rawTarget: typeof rawStudents = Array.isArray(targetRes?.data)
        ? targetRes.data
        : (targetRes?.data?.students ?? []);
      for (const s of rawTarget) {
        if ((s.schoolYear || '') === filters.value.targetYear) targetIds.add(s.id);
      }
    } catch {
      /* année cible illisible : on s'appuie sur les paiements cibles */
    }

    // 3. Moyennes + décisions annuelles par classe concernée.
    const gradeIds = filters.value.gradeId
      ? [filters.value.gradeId]
      : [...new Set(sourceStudents.map((s) => s.grade?.id).filter((v): v is number => v != null))];
    const rankByStudent = new Map<number, { average: number | null; decision: unknown }>();
    await Promise.all(
      gradeIds.map(async (gid) => {
        try {
          const res = await window.ipcRenderer.invoke('gradeEntry:getAnnualRankings', {
            gradeId: gid,
            schoolYear: filters.value.sourceYear,
            periods: periodsFor(filters.value.sourceYear),
          });
          const rows: Array<{ studentId: number; annualAverage?: number; finalDecision?: unknown }> =
            res?.data ?? [];
          for (const r of rows) {
            rankByStudent.set(r.studentId, { average: r.annualAverage ?? null, decision: r.finalDecision });
          }
        } catch {
          /* classe sans PV : moyennes inconnues */
        }
      }),
    );

    // 4. Paiements → statut frais SCOPPÉ année cible (m5) + déjà réinscrit.
    // m5 : pas de `Promise.all` unbounded (N+1) — pool de 6, pas de canal
    // batch paiement côté backend (`payment:getByStudent` uniquement).
    const targetYear = filters.value.targetYear;
    const feeByStudent = new Map<number, { feeStatus: FeeStatus; paidTargetYear: boolean }>();
    const queue = [...sourceStudents];
    const workers = Array.from({ length: Math.min(6, Math.max(1, queue.length)) }, async () => {
      while (queue.length > 0) {
        const s = queue.shift();
        if (!s) break;
        try {
          const payRes = await window.ipcRenderer.invoke('payment:getByStudent', s.id);
          const data = payRes?.data as {
            totalDue?: number; totalPaid?: number; totalRemaining?: number;
            payments?: Array<{ schoolYear?: string; amount?: number }>;
          } | null;
          const pays = Array.isArray(data?.payments) ? data.payments : [];
          const targetPays = pays.filter((p) => (p.schoolYear || '') === targetYear);
          if (targetPays.length === 0) {
            // Aucun paiement année cible : impayé cible (pas "unknown" global).
            feeByStudent.set(s.id, { feeStatus: pays.length > 0 ? 'unpaid' : 'unknown', paidTargetYear: false });
            continue;
          }
          // Scoppé cible uniquement : on n'utilise JAMAIS les totaux globaux.
          const targetPaid = targetPays.reduce((a, p) => a + Number(p.amount ?? 0), 0);
          let feeStatus: FeeStatus;
          if (targetPaid <= 0) {
            feeStatus = 'unpaid';
          } else {
            const due = Number(data?.totalDue ?? 0);
            const paid = Number(data?.totalPaid ?? 0);
            // Si les totaux portent sur la seule année cible, on peut conclure "soldé".
            const scoped = pays.length === targetPays.length && due > 0;
            const remaining = scoped ? Math.max(0, due - paid) : NaN;
            feeStatus = scoped && remaining <= 0 ? 'paid' : 'partial';
          }
          feeByStudent.set(s.id, { feeStatus, paidTargetYear: true });
        } catch {
          feeByStudent.set(s.id, { feeStatus: 'unknown', paidTargetYear: false });
        }
      }
    });
    await Promise.all(workers);
    // Index cible par `studentId|schoolYear` (m5) pour un test `already` sans collision.
    const targetYearKeys = new Set([...targetIds].map((id) => studentYearKey(id, targetYear)));
    const built: Candidate[] = sourceStudents.map((s) => {
      const rank = rankByStudent.get(s.id);
      const decision = normalizeDecision(rank?.decision, rank?.average ?? null);
      const fee = feeByStudent.get(s.id) ?? { feeStatus: 'unknown' as FeeStatus, paidTargetYear: false };
      const sourceGradeId = s.grade?.id ?? 0;
      return {
        id: s.id,
        firstname: s.firstname,
        lastname: s.lastname,
        matricule: s.matricule || '',
        sourceGradeId,
        sourceGradeName: s.grade?.name ?? '—',
        average: rank?.average ?? null,
        decision,
        targetGradeId: defaultTargetGrade(sourceGradeId, decision),
        feeStatus: fee.feeStatus,
        alreadyReEnrolled: targetYearKeys.has(studentYearKey(s.id, targetYear)) || fee.paidTargetYear,
      } satisfies Candidate;
    });
    allCandidates.value = built;
  } catch (error) {
    console.error('Erreur chargement candidats réinscription :', error);
    ElMessage.error('Erreur lors du chargement des candidats');
  } finally {
    loading.value = false;
  }
}

/** Clé idempotente m5 : `studentId|schoolYear` (utilisée pour `alreadyReEnrolled`). */
const studentYearKey = (studentId: number, schoolYear: string): string =>
  `${studentId}|${(schoolYear || '').trim()}`;

/** Les filtres client sont réactifs via `filtered` — rien à recalculer ici. */
function applyClientFilters(): void {
  selected.value = selected.value.filter((s) => filtered.value.includes(s));
}

/**
 * B1 : réinscription via `student:reEnroll` (canonique backend), payload bilingue
 * `{ studentId, schoolYear|targetSchoolYear, gradeId|targetGradeId }` pour rester
 * compatible avec l'intitulé `{studentId,targetGradeId,targetSchoolYear}` tout en
 * satisfaisant le backend (`schoolYear`, `gradeId`).
 * Gère `already:true` (idempotent, succès silencieux) + `YEAR_CLOSED`.
 */
async function invokeReEnroll(row: Candidate): Promise<{ ok: boolean; already: boolean }> {
  const payload = {
    studentId: row.id,
    schoolYear: filters.value.targetYear,
    targetSchoolYear: filters.value.targetYear,
    gradeId: row.targetGradeId,
    targetGradeId: row.targetGradeId,
  };
  const res = await window.ipcRenderer.invoke('student:reEnroll', payload);
  if (res?.success === false) {
    const msg = String(res.message || res.error || '');
    const code = String((res as { code?: string }).code || '');
    if (res.data && (res.data as { already?: boolean }).already === true) return { ok: true, already: true };
    if (msg.includes(YEAR_CLOSED_CODE) || code.includes(YEAR_CLOSED_CODE)) {
      throw new Error(YEAR_CLOSED_CODE);
    }
    throw new Error(res.message || res.error || 'Échec de la réinscription');
  }
  const already = Boolean(res?.data && (res.data as { already?: boolean }).already);
  return { ok: true, already };
}

async function reEnroll(row: Candidate): Promise<void> {
  if (row.alreadyReEnrolled || writeLocked.value) return;
  try {
    const { already } = await invokeReEnroll(row);
    ElMessage.success(
      already
        ? `${row.firstname} ${row.lastname} déjà réinscrit(e) en ${filters.value.targetYear}`
        : `${row.firstname} ${row.lastname} réinscrit(e) en ${filters.value.targetYear}`,
    );
    await loadCandidates();
  } catch (error) {
    console.error('Réinscription impossible :', error);
    handleYearClosedError(error);
    if (!isYearClosedError(error)) {
      ElMessage.error(error instanceof Error ? error.message : 'Échec de la réinscription');
    }
  }
}

async function batchReEnroll(): Promise<void> {
  const todo = selected.value.filter((r) => !r.alreadyReEnrolled);
  if (todo.length === 0 || writeLocked.value) return;
  batchLoading.value = true;
  try {
    // B1 : `student:reEnrollBatch` d'abord (lot serveur, frais idempotents),
    // repli boucle `student:reEnroll` si classes cibles hétérogènes ou canal absent.
    const sameGrade = todo.every((r) => r.targetGradeId === todo[0].targetGradeId);
    let ok = 0;
    let alreadyCount = 0;
    let batched = false;
    if (sameGrade) {
      try {
        const res = await window.ipcRenderer.invoke('student:reEnrollBatch', {
          studentIds: todo.map((r) => r.id),
          schoolYear: filters.value.targetYear,
          targetSchoolYear: filters.value.targetYear,
          gradeId: todo[0].targetGradeId,
          targetGradeId: todo[0].targetGradeId,
        });
        if (res?.success === false) {
          const msg = String(res.message || res.error || '');
          if (msg.includes(YEAR_CLOSED_CODE)) throw new Error(YEAR_CLOSED_CODE);
          throw new Error(res.message || res.error || 'Échec du lot');
        }
        const rows = Array.isArray(res?.data) ? (res.data as Array<{ already?: boolean }>) : [];
        alreadyCount = rows.filter((r) => r?.already === true).length;
        ok = rows.length > 0 ? rows.length : todo.length;
        batched = true;
      } catch (batchErr) {
        handleYearClosedError(batchErr);
        if (isYearClosedError(batchErr)) throw batchErr;
        // Repli boucle individuelle ci-dessous.
      }
    }
    if (!batched) {
      for (const row of todo) {
        try {
          const r = await invokeReEnroll(row);
          ok += 1;
          if (r.already) alreadyCount += 1;
        } catch (err) {
          handleYearClosedError(err);
          if (isYearClosedError(err)) throw err;
          /* on continue le lot, bilan à la fin */
        }
      }
    }
    const suffix = alreadyCount > 0 ? ` (dont ${alreadyCount} déjà réinscrit(s))` : '';
    ElMessage.success(`${ok}/${todo.length} réinscription(s) effectuée(s)${suffix}`);
    await loadCandidates();
    selected.value = [];
  } catch (error) {
    handleYearClosedError(error);
    if (!isYearClosedError(error)) {
      ElMessage.error(error instanceof Error ? error.message : 'Échec des réinscriptions en lot');
    }
  } finally {
    batchLoading.value = false;
  }
}

function viewStudent(row: Candidate): void {
  void router.push({ name: 'StudentDetails', params: { id: String(row.id) } });
}

function exportRows() {
  return filtered.value.map((c) => ({
    Matricule: c.matricule,
    Nom: c.lastname,
    Prénom: c.firstname,
    'Classe N-1': c.sourceGradeName,
    'Moyenne annuelle': c.average ?? '—',
    Décision: c.decision,
    'Classe cible': grades.value.find((g) => g.id === c.targetGradeId)?.name ?? '',
    Frais: feeLabel(c.feeStatus),
    Statut: c.alreadyReEnrolled ? 'Réinscrit' : 'À réinscrire',
  }));
}

/** Export Excel — même pattern que `PaymentManagementView:642-725`. */
async function exportToExcel(): Promise<void> {
  if (filtered.value.length === 0) {
    ElMessage.warning('Aucune donnée à exporter pour les filtres actuels.');
    return;
  }
  loadingExcel.value = true;
  try {
    const worksheet = XLSX.utils.json_to_sheet(exportRows());
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Réinscriptions');
    XLSX.writeFile(workbook, `reinscriptions_${filters.value.sourceYear}_${filters.value.targetYear}.xlsx`);
  } catch (error) {
    console.error("Erreur lors de l'export Excel:", error);
    ElMessage.error("Une erreur est survenue lors de l'exportation.");
  } finally {
    loadingExcel.value = false;
  }
}

/** Export PDF — jsPDF + autotable (pattern `PaymentManagementView:exportToPdf`). */
async function exportToPdf(): Promise<void> {
  if (filtered.value.length === 0) {
    ElMessage.warning('Aucune donnée à exporter pour les filtres actuels.');
    return;
  }
  loadingPdf.value = true;
  try {
    const doc = new jsPDF({ orientation: 'landscape' });
    doc.setFontSize(14);
    doc.text(`Réinscriptions — ${filters.value.sourceYear} → ${filters.value.targetYear}`, 14, 14);
    autoTable(doc, {
      startY: 20,
      head: [['Matricule', 'Nom', 'Prénom', 'Classe N-1', 'Moy.', 'Décision', 'Classe cible', 'Frais', 'Statut']],
      body: filtered.value.map((c) => [
        c.matricule,
        c.lastname,
        c.firstname,
        c.sourceGradeName,
        c.average == null ? '—' : c.average.toFixed(2),
        c.decision,
        grades.value.find((g) => g.id === c.targetGradeId)?.name ?? '',
        feeLabel(c.feeStatus),
        c.alreadyReEnrolled ? 'Réinscrit' : 'À réinscrire',
      ]),
    });
    doc.save(`reinscriptions_${filters.value.sourceYear}_${filters.value.targetYear}.pdf`);
  } catch (error) {
    console.error("Erreur lors de l'export PDF:", error);
    ElMessage.error("Une erreur est survenue lors de l'exportation PDF.");
  } finally {
    loadingPdf.value = false;
  }
}

onMounted(async () => {
  warnIfClosed('la réinscription');
  await loadReferentials();
  await loadCandidates();
});
</script>

<style scoped>
.re-enrollment {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
}
.closed-banner {
  width: 100%;
}
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.year-flow-text {
  font-weight: 600;
  color: var(--el-text-color-regular);
  white-space: nowrap;
}
.student-cell {
  display: flex;
  flex-direction: column;
}
.muted {
  color: #909399;
  font-size: 12px;
}
</style>
