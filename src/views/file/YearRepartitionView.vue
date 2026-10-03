<template>
  <div class="year-repartition-container">
    <div class="container-content">
      <el-alert
        v-if="hasLegacy"
        type="warning"
        show-icon
        :closable="false"
        class="legacy-banner"
      >
        <template #title>Base legacy : année unique sans niveau</template>
        <template #default>
          <span>{{ legacyLabel }} — ventilez-la vers les 3 niveaux pour activer les régimes indépendants (trimestres / semestres).</span>
          <el-button type="warning" plain size="small" class="migrate-btn" @click="showMigration = true">
            Ventiler l'année unique vers 3 niveaux
          </el-button>
        </template>
      </el-alert>

      <el-tabs v-model="activeTab" class="level-tabs">
        <el-tab-pane label="Tous" name="ALL" />
        <el-tab-pane name="PRESCOLAIRE">
          <template #label>
            Préscolaire
            <el-tag size="small" type="success" effect="plain" class="tab-badge">Trimestres</el-tag>
            <el-badge :value="counts.PRESCOLAIRE" :hidden="counts.PRESCOLAIRE === 0" class="tab-count" />
          </template>
        </el-tab-pane>
        <el-tab-pane name="PRIMAIRE">
          <template #label>
            Primaire
            <el-tag size="small" type="success" effect="plain" class="tab-badge">Trimestres</el-tag>
            <el-badge :value="counts.PRIMAIRE" :hidden="counts.PRIMAIRE === 0" class="tab-count" />
          </template>
        </el-tab-pane>
        <el-tab-pane name="SECONDAIRE">
          <template #label>
            Secondaire
            <el-tag size="small" type="warning" effect="plain" class="tab-badge">Semestres</el-tag>
            <el-badge :value="counts.SECONDAIRE" :hidden="counts.SECONDAIRE === 0" class="tab-count" />
          </template>
        </el-tab-pane>
      </el-tabs>

      <div class="actions-row">
        <el-button type="primary" @click="openCreateModal(createLevel)" class="create-btn" :disabled="writeLocked">
          {{ createLabel }}
        </el-button>
        <el-button type="success" @click="openCloneDialog" :disabled="writeLocked || !previousYear">
          Créer {{ nextYearLabel ?? 'N' }} à partir de {{ previousYear?.schoolYear ?? 'N-1' }}
        </el-button>
      </div>

      <el-table :data="filteredYears" class="repartition-table" row-key="id">
        <el-table-column prop="schoolYear" label="Année Scolaire" />
        <el-table-column label="Niveau" width="150">
          <template #default="scope">
            <el-tag v-if="rowLevel(scope.row)" :type="rowLevel(scope.row) === 'SECONDAIRE' ? 'warning' : 'success'" effect="plain">
              {{ rowLevel(scope.row) }}
            </el-tag>
            <el-tag v-else type="info" effect="plain">Legacy</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Type">
          <template #default="scope">
            <el-tag :type="scope.row.periodConfigurations.length === 2 ? 'warning' : 'success'" effect="plain" size="small">
              {{ getPeriodType(scope.row.periodConfigurations) }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Périodes">
          <template #default="scope">
            <div v-for="period in scope.row.periodConfigurations" :key="period.name">
              {{ period.name }}: {{ formatDate(period.start) }} - {{ formatDate(period.end) }}
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Statut" width="120">
          <template #default="scope">
            <el-tag v-if="scope.row.status === 'closed'" type="danger">Clôturée</el-tag>
            <el-tag v-else-if="scope.row.isCurrent" type="success">En cours</el-tag>
            <el-tag v-else type="info">Active</el-tag>
            <div v-if="!scope.row.isCurrent && scope.row.status !== 'closed'" class="set-current">
              <el-tooltip content="Année clôturée — action interdite" :disabled="scope.row.status !== 'closed'">
                <el-button
                  type="primary"
                  link
                  :disabled="isRowClosed(scope.row) || writeLocked"
                  @click="setCurrentYear(scope.row)"
                >
                  Définir
                </el-button>
              </el-tooltip>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="230">
          <template #default="scope">
            <el-tooltip content="Année clôturée — modification interdite" :disabled="!isRowClosed(scope.row)">
              <el-button size="small" :disabled="isRowClosed(scope.row)" @click="editRepartition(scope.row)">
                Modifier
              </el-button>
            </el-tooltip>
            <el-tooltip content="Année clôturée — suppression interdite" :disabled="!isRowClosed(scope.row)">
              <el-button size="small" type="danger" :disabled="isRowClosed(scope.row)" @click="deleteRepartition(scope.row)">
                Supprimer
              </el-button>
            </el-tooltip>
            <template v-if="isAdmin">
              <el-button
                v-if="scope.row.status !== 'closed'"
                size="small"
                type="warning"
                @click="closeYear(scope.row)"
              >
                Clôturer
              </el-button>
              <el-button
                v-else
                size="small"
                type="success"
                @click="reopenYear(scope.row)"
              >
                Réouvrir
              </el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>

      <el-dialog
        v-model="showModal"
        :title="modalTitle"
        class="modal-dialog"
        :destroy-on-close="true"
        :close-on-click-modal="false"
      >
        <YearRepartitionForm
          v-if="showModal"
          :key="`${createLevel ?? 'ALL'}-${currentRepartition?.id ?? 'new'}`"
          :initial-data="currentRepartition"
          :level="createLevel"
          @submit="handleSubmit"
          @cancel="showModal = false"
        />
      </el-dialog>

      <YearLevelMigrationDialog
        v-model="showMigration"
        :legacy-years="legacyYears"
        :existing="yearRepartitions"
        @done="fetchYearRepartitions"
      />

      <el-dialog
        v-model="showCloneDialog"
        title="Créer l'année N à partir de N-1"
        :close-on-click-modal="false"
        width="520px"
      >
        <p class="clone-source">
          Source : <strong>{{ previousYear?.schoolYear }}</strong>
          → Cible : <strong>{{ nextYearLabel }}</strong>
        </p>
        <el-checkbox v-model="cloneOptions.copyPayment">Copier la configuration des paiements</el-checkbox>
        <el-checkbox v-model="cloneOptions.copyTranches">Copier les tranches</el-checkbox>
        <el-checkbox v-model="cloneOptions.copyGrading">Copier la notation</el-checkbox>
        <el-checkbox v-model="cloneOptions.copyFeeItems">Copier les frais (fee items)</el-checkbox>
        <div v-if="clonePreview" class="clone-preview">
          <el-divider content-position="left">Aperçu</el-divider>
          <p>Paiements : {{ clonePreview.paymentConfigs ?? '–' }} · Tranches : {{ clonePreview.tranches ?? '–' }} · Notation : {{ clonePreview.gradingConfigs ?? '–' }} · Frais : {{ clonePreview.feeItems ?? '–' }}</p>
          <el-alert
            v-if="isPreviewEmpty"
            title="Source vide : rien à copier — le clonage créera l'année cible sans configurations."
            type="warning"
            :closable="false"
            show-icon
          />
        </div>
        <el-alert
          v-if="clonePreview === null && previewLoading"
          title="Chargement de l'aperçu…"
          type="info"
          :closable="false"
          show-icon
        />
        <template #footer>
          <el-button @click="showCloneDialog = false">Annuler</el-button>
          <el-button type="primary" :loading="cloning" @click="confirmClone">Cloner</el-button>
        </template>
      </el-dialog>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import YearRepartitionForm from "@/components/schoolYear/YearRepartionForm.vue";
import YearLevelMigrationDialog from "@/components/schoolYear/YearLevelMigrationDialog.vue";
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
    YearRepartition,
    PeriodConfiguration,
    YearRepartitionResponse,
    YearRepartitionCreateInput,
    YearRepartitionUpdateInput,
    YearCloneOptions,
    YearClonePreview,
    YEAR_CLOSED_CODE,
    type SchoolLevel,
} from '@/types/year';
import { normalizeLevel } from '@/types/schoolLevel';
import { useUserStore } from '@/stores/userStore';
import { useYearStore } from '@/stores/yearStore';
import { handleYearClosedError, isYearClosedError } from '@/composables/useYearGuard';

const userStore = useUserStore();
const yearStore = useYearStore();
const isAdmin = computed(() => userStore.hasRole('admin'));
/** Écran d'écriture : verrouillé si l'année active est clôturée. */
const writeLocked = computed(() => yearStore.isClosed);

type LevelTab = 'ALL' | SchoolLevel;
const activeTab = ref<LevelTab>('ALL');
const showMigration = ref(false);

const yearRepartitions = ref<YearRepartitionResponse[]>([]);
const showModal = ref(false);
const currentRepartition = ref<YearRepartition | null>(null);
/** Niveau de création = onglet courant (ALL → PRIMAIRE par défaut). */
const createLevel = computed<SchoolLevel>(() => (activeTab.value === 'ALL' ? 'PRIMAIRE' : activeTab.value));
const createLabel = computed(() =>
  activeTab.value === 'ALL'
    ? 'Créer une Répartition Annuelle'
    : `Créer la répartition ${activeTab.value} (${activeTab.value === 'SECONDAIRE' ? '2 semestres' : '3 trimestres'})`,
);

const rowLevel = (row: YearRepartitionResponse): SchoolLevel | null =>
  normalizeLevel((row as { level?: unknown }).level);

/** Compteurs par onglet (legacy exclu des 3 niveaux). */
const counts = computed<Record<SchoolLevel, number>>(() => ({
  PRESCOLAIRE: yearRepartitions.value.filter((y) => rowLevel(y) === 'PRESCOLAIRE').length,
  PRIMAIRE: yearRepartitions.value.filter((y) => rowLevel(y) === 'PRIMAIRE').length,
  SECONDAIRE: yearRepartitions.value.filter((y) => rowLevel(y) === 'SECONDAIRE').length,
}));

const legacyYears = computed(() => yearRepartitions.value.filter((y) => rowLevel(y) == null));
const hasLegacy = computed(() => legacyYears.value.length > 0);
const legacyLabel = computed(() =>
  legacyYears.value.map((y) => y.schoolYear).join(', '),
);

const filteredYears = computed(() =>
  activeTab.value === 'ALL'
    ? [...yearRepartitions.value].sort((a, b) => a.schoolYear.localeCompare(b.schoolYear))
    : yearRepartitions.value
        .filter((y) => rowLevel(y) === activeTab.value)
        .sort((a, b) => a.schoolYear.localeCompare(b.schoolYear)),
);

/** Clone N à partir de N-1 (plan V3). */
const showCloneDialog = ref(false);
const cloning = ref(false);
const previewLoading = ref(false);
const clonePreview = ref<YearClonePreview | null>(null);
const cloneOptions = ref<YearCloneOptions>({
  copyPayment: true,
  copyTranches: true,
  copyGrading: true,
  copyFeeItems: true,
});

const sortedYears = computed(() =>
  [...yearRepartitions.value].sort((a, b) => a.schoolYear.localeCompare(b.schoolYear)),
);
/** Année source du clonage : la plus récente (N-1 une fois N créée). */
const previousYear = computed(() => sortedYears.value[sortedYears.value.length - 1] ?? null);
const nextYearLabel = computed(() => {
  if (!previousYear.value) return null;
  const m = /^(\d{4})-(\d{4})$/.exec(previousYear.value.schoolYear.trim());
  if (!m) return null;
  return `${Number(m[1]) + 1}-${Number(m[2]) + 1}`;
});

const isRowClosed = (row: YearRepartitionResponse) => row.status === 'closed';

const modalTitle = computed(() =>
  currentRepartition.value
    ? "Modifier la Répartition Annuelle"
    : `Créer une Répartition Annuelle — ${createLevel.value}`
);

const formatDate = (date: string | Date | null) => {
  if (!date) return '';
  return format(new Date(date), 'dd/MM/yyyy', { locale: fr });
};

const getPeriodType = (periods: PeriodConfiguration[]) => {
  return periods.length === 2 ? 'Semestre' : 'Trimestre';
};

const closeModal = () => {
  showModal.value = false;
  currentRepartition.value = null;
};

const openCreateModal = (level?: SchoolLevel) => {
  if (level) activeTab.value = level;
  currentRepartition.value = null;
  showModal.value = true;
};

const editRepartition = (repartition: YearRepartitionResponse) => {
  // Convertir les dates string en Date pour le formulaire
  const convertedRepartition: YearRepartition = {
    id: repartition.id,
    schoolYear: repartition.schoolYear,
    level: rowLevel(repartition),
    periodConfigurations: repartition.periodConfigurations.map(period => ({
      name: period.name,
      start: period.start,
      end: period.end
    })),
    isCurrent: repartition.isCurrent
  };

  currentRepartition.value = convertedRepartition;
  showModal.value = true;
};

const deleteRepartition = async (repartition: YearRepartitionResponse) => {
  try {
    await ElMessageBox.confirm(
      'Êtes-vous sûr de vouloir supprimer cette répartition ?',
      'Confirmation',
      {
        confirmButtonText: 'Oui',
        cancelButtonText: 'Non',
        type: 'warning'
      }
    );

    if (repartition.id) {
      const result = await window.ipcRenderer.invoke("yearRepartition:delete", repartition.id);
      if (result.success) {
        ElMessage.success("Répartition supprimée avec succès");
        await fetchYearRepartitions();
      } else {
        throw new Error(result.message || "Échec de la suppression");
      }
    }
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error(error instanceof Error ? error.message : "Une erreur est survenue");
    }
  }
};

const handleSubmit = async (data: YearRepartitionCreateInput | YearRepartitionUpdateInput) => {
  try {
    // Vérifier si c'est une mise à jour (l'ID est présent dans les données)
    const isUpdate = 'id' in data && data.id !== undefined;

    // Préparer les données en formatant correctement les dates (+ niveau 3-voies)
    const level = (data as { level?: SchoolLevel | null }).level ?? createLevel.value;
    const formattedData = {
      ...data,
      level,
      periodConfigurations: data.periodConfigurations?.map(period => ({
        name: period.name,
        start: period.start ? new Date(period.start).toISOString() : null,
        end: period.end ? new Date(period.end).toISOString() : null
      })) || []
    };

    let result;

    if (isUpdate) {
      // S'assurer que l'ID est correctement extrait avant de l'envoyer
      const id = (data as any).id;
      // Envoi explicite de l'ID et des données séparément
      result = await window.ipcRenderer.invoke("yearRepartition:update", {
        id,
        data: formattedData
      });
    } else {
      result = await window.ipcRenderer.invoke("yearRepartition:create", formattedData);
    }

    if (!result.success) {
      throw new Error(result.message || (isUpdate ? "Échec de la mise à jour" : "Échec de la création"));
    }

    await fetchYearRepartitions();
    closeModal();
    ElMessage.success("Opération réussie");
  } catch (error) {
    handleYearClosedError(error);
    if (!isYearClosedError(error)) {
      ElMessage.error(error instanceof Error ? error.message : "Échec de l'opération");
    }
    console.error(error);
  }
};

const fetchYearRepartitions = async () => {
  try {
    const result = await window.ipcRenderer.invoke("yearRepartition:getAll");
    if (result.success) {
      yearRepartitions.value = result.data;
      yearStore.list = result.data;
    } else {
      throw new Error(result.message || "Échec de la récupération des répartitions");
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Impossible de récupérer les répartitions");
    console.error(error);
  }
};

/** Clôture (admin) : `yearRepartition:close`, fallback `year:close`. */
const closeYear = async (repartition: YearRepartitionResponse) => {
  try {
    await ElMessageBox.confirm(
      `Clôturer l'année ${repartition.schoolYear} ? Elle passera en lecture seule.`,
      'Clôturer',
      { confirmButtonText: 'Clôturer', cancelButtonText: 'Annuler', type: 'warning' },
    );
    const res = await invokeYearClose('close', repartition.id);
    if (res?.success === false) throw new Error(res.message || 'Échec de la clôture');
    ElMessage.success(`Année ${repartition.schoolYear} clôturée`);
    await fetchYearRepartitions();
  } catch (error) {
    if (error === 'cancel') return;
    handleYearClosedError(error);
    ElMessage.error(error instanceof Error ? error.message : 'Échec de la clôture');
  }
};

/** Réouverture (admin) : `yearRepartition:reopen`, fallback `year:reopen`. */
const reopenYear = async (repartition: YearRepartitionResponse) => {
  try {
    await ElMessageBox.confirm(
      `Réouvrir l'année ${repartition.schoolYear} ? L'écriture sera de nouveau autorisée.`,
      'Réouvrir',
      { confirmButtonText: 'Réouvrir', cancelButtonText: 'Annuler', type: 'warning' },
    );
    const res = await invokeYearClose('reopen', repartition.id);
    if (res?.success === false) throw new Error(res.message || 'Échec de la réouverture');
    ElMessage.success(`Année ${repartition.schoolYear} réouverte`);
    await fetchYearRepartitions();
  } catch (error) {
    if (error === 'cancel') return;
    ElMessage.error(error instanceof Error ? error.message : 'Échec de la réouverture');
  }
};

async function invokeYearClose(
  action: 'close' | 'reopen',
  id: number,
): Promise<{ success?: boolean; message?: string } | null> {
  const channels = action === 'close'
    ? ['yearRepartition:close', 'year:close']
    : ['yearRepartition:reopen', 'year:reopen'];
  let last: unknown = null;
  for (const ch of channels) {
    try {
      return (await window.ipcRenderer.invoke(ch, id)) as { success?: boolean; message?: string };
    } catch (err) {
      last = err;
      continue;
    }
  }
  throw last instanceof Error ? last : new Error(`Canal ${action} indisponible côté backend`);
}

/**
 * Normalise l'aperçu clone : le backend renvoie la forme plate du contrat
 * `YearClonePreview` ({ paymentConfigs, tranches, gradingConfigs, feeItems })
 * + `counts` snake_case détaillé ; les anciens backends renvoyaient
 * `{ counts: {...} }` seul (aperçu vide "–"). Les deux formes sont acceptées.
 */
function normalizePreview(data: unknown): YearClonePreview | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<YearClonePreview> & {
    counts?: Partial<Record<'payment_configs' | 'payment_annual_config' | 'tranches' | 'grading_config' | 'fee_items', number>>;
  };
  const pick = (v: unknown): number | undefined =>
    typeof v === 'number' && Number.isFinite(v) ? v : undefined;
  const paymentConfigs = pick(d.paymentConfigs) ?? pick(d.counts?.payment_configs);
  const tranches = pick(d.tranches) ?? pick(d.counts?.tranches) ?? pick(d.counts?.payment_annual_config);
  const gradingConfigs = pick(d.gradingConfigs) ?? pick(d.counts?.grading_config);
  const feeItems = pick(d.feeItems) ?? pick(d.counts?.fee_items);
  if (paymentConfigs == null && tranches == null && gradingConfigs == null && feeItems == null) return null;
  return {
    paymentConfigs: paymentConfigs ?? 0,
    tranches: tranches ?? 0,
    gradingConfigs: gradingConfigs ?? 0,
    feeItems: feeItems ?? 0,
  };
}

/** Garde : aperçu entièrement à zéro = source vide (message explicite, pas d'échec aveugle). */
const isPreviewEmpty = computed(() =>
  !!clonePreview.value &&
  (clonePreview.value.paymentConfigs ?? 0) === 0 &&
  (clonePreview.value.tranches ?? 0) === 0 &&
  (clonePreview.value.gradingConfigs ?? 0) === 0 &&
  (clonePreview.value.feeItems ?? 0) === 0,
);

/**
 * B2 : ouvre le dialogue de clonage N ← N-1.
 * Aperçu best-effort (`yearRepartition:clone-preview` → alias V3) ; backend actuel
 * sans preview = dialogue reste utilisable, aperçu proprement désactivé (pas d'erreur).
 */
const openCloneDialog = async () => {
  if (!previousYear.value || !nextYearLabel.value) {
    ElMessage.warning('Aucune année source à cloner');
    return;
  }
  showCloneDialog.value = true;
  clonePreview.value = null;
  previewLoading.value = true;
  try {
    const channels = ['yearRepartition:clone-preview', 'year:clone-preview', 'year:clonePreview'];
    for (const ch of channels) {
      try {
        const res = await window.ipcRenderer.invoke(ch, {
          fromId: previousYear.value.id,
          sourceId: previousYear.value.id,
          newSchoolYear: nextYearLabel.value,
        });
        if (res?.success && res.data) {
          const norm = normalizePreview(res.data);
          if (norm) {
            clonePreview.value = norm;
            break;
          }
          // Succès sans compteurs exploitables : on garde la recherche sur le canal suivant.
          continue;
        }
      } catch {
        continue;
      }
    }
    // Aucun canal preview : désactivé proprement (le clonage reste disponible).
  } finally {
    previewLoading.value = false;
  }
};

/**
 * Normalise le retour clone : le backend `cloneYearConfigs` renvoie
 * `{ id, schoolYear, periodConfigurations, counts, skipped, emptySource, ...flat }`
 * (année cible déjà créée, transactionnelle), l'alias V3 peut renvoyer
 * l'année complète. Retourne `null` si inexploitable.
 */
function normalizeCloneResult(data: unknown, fallbackYear: string): YearRepartitionResponse | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<YearRepartitionResponse> & { schoolYear?: string };
  const id = (d as { id?: number }).id;
  if (typeof id === 'number' && id > 0) return d as YearRepartitionResponse;
  // Ancien backend `{ schoolYear }` seul : année créée côté serveur mais id perdu —
  // on ne fabrique PLUS de stub id:-1 (il provoquait un doublon à l'enregistrement
  // manuel). On signale l'année par son libellé, sans rouvrir le formulaire.
  if (typeof d.schoolYear === 'string' && d.schoolYear) {
    return {
      id: -1,
      schoolYear: d.schoolYear,
      periodConfigurations: Array.isArray(d.periodConfigurations) ? d.periodConfigurations : [],
      isCurrent: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    } as unknown as YearRepartitionResponse;
  }
  void fallbackYear;
  return null;
}

/**
 * B2 : exécute le clonage `yearRepartition:clone` (canonique backend
 * `cloneYearConfigs({ fromId, newSchoolYear, ...options })`), fallback `year:clone`.
 * Le backend crée déjà l'année cible (transactionnel) : en succès on rafraîchit
 * la liste et on affiche le bilan explicite — on ne rouvre PAS le formulaire
 * de création (qui produirait DUPLICATE_SCHOOL_YEAR).
 */
const confirmClone = async () => {
  if (!previousYear.value || !nextYearLabel.value) return;
  const sourceLabel = previousYear.value.schoolYear;
  const targetLabel = nextYearLabel.value;
  cloning.value = true;
  try {
    // Payload bilingue : `fromId`+`newSchoolYear` (backend) + `sourceId` (alias V3).
    const payload = {
      fromId: previousYear.value.id,
      sourceId: previousYear.value.id,
      newSchoolYear: targetLabel,
      ...cloneOptions.value,
    };
    let ok = false;
    let okMessage = '';
    let okEmptySource = false;
    let lastError: unknown = null;
    for (const ch of ['yearRepartition:clone', 'year:clone']) {
      try {
        const res = await window.ipcRenderer.invoke(ch, payload);
        if (res?.success === false) {
          const msg = String(res.message || res.error || '');
          if (msg.includes(YEAR_CLOSED_CODE)) {
            ElMessage.error('Année clôturée — clonage refusé (lecture seule).');
            return;
          }
          // Message explicite backend (Échec du clone A → B : <détail>) préservé tel quel.
          lastError = new Error(msg || 'Échec du clonage');
          continue;
        }
        if (res?.success && res?.data) {
          const norm = normalizeCloneResult(res.data, targetLabel);
          okMessage = String(res.message || `Configurations clonées vers ${targetLabel}`);
          okEmptySource = (res.data as { emptySource?: boolean })?.emptySource === true
            || (res as { error?: string })?.error === 'EMPTY_SOURCE';
          ok = !!norm || /clonée/i.test(okMessage);
          if (!norm && !ok) {
            lastError = new Error(okMessage || 'Réponse de clonage inexploitable');
            continue;
          }
          lastError = null;
          break;
        }
        lastError = new Error('Réponse de clonage vide');
        continue;
      } catch (err) {
        handleYearClosedError(err);
        if (isYearClosedError(err)) return;
        lastError = err;
        continue;
      }
    }
    if (!ok) {
      const detail = lastError instanceof Error ? lastError.message : 'Échec du clonage';
      throw new Error(`Échec du clone ${sourceLabel} → ${targetLabel} : ${detail}`);
    }
    await fetchYearRepartitions();
    showCloneDialog.value = false;
    if (okEmptySource) {
      ElMessage.warning(okMessage);
    } else {
      ElMessage.success(okMessage);
    }
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'Échec du clonage';
    ElMessage.error(detail.startsWith('Échec du clone') ? detail : `Échec du clone ${sourceLabel} → ${targetLabel} : ${detail}`);
  } finally {
    cloning.value = false;
  }
};



const setCurrentYear = async (repartition: YearRepartitionResponse) => {
  // Gouvernance admin : définit l'année courante côté serveur.
  // N'est PAS un switch de session utilisateur (plus de sélecteur en header) :
  // on synchronise le store local pour rester cohérent, la session suivante
  // repartira de toute façon sur l'année choisie au login / `init`.
  try {
    await ElMessageBox.confirm(
      `Êtes-vous sûr de vouloir définir ${repartition.schoolYear} comme année scolaire en cours ?`,
      'Confirmation',
      {
        confirmButtonText: 'Oui',
        cancelButtonText: 'Non',
        type: 'warning'
      }
    );


    try {
      const result = await window.ipcRenderer.invoke(
        "yearRepartition:setCurrent",
        repartition.id
      );


      if (result.success) {
        ElMessage.success("Année scolaire en cours mise à jour avec succès");
        // Synchronise le store global (header + guard).
        try {
          await yearStore.setActiveYear(repartition.id);
        } catch {
          await yearStore.init(null).catch(() => undefined);
        }
      } else {
        console.error("Erreur de définition de l'année courante:", result.error || result.message);
        ElMessage.error(`Erreur: ${result.error || result.message}`);
      }

      // Rafraîchir la liste dans tous les cas pour refléter l'état actuel
      await fetchYearRepartitions();

    } catch (apiError) {
      console.error("Exception lors de l'appel à yearRepartition:setCurrent:", apiError);
      ElMessage.error("Une erreur technique est survenue lors de la définition de l'année scolaire en cours");
      // Essayer quand même de rafraîchir la liste
      await fetchYearRepartitions();
    }
  } catch (error) {
    if (error !== 'cancel') {
      console.error("Erreur dans le processus setCurrentYear:", error);
      ElMessage.error(
        error instanceof Error ? error.message : "Une erreur est survenue"
      );
    }
  }
};

fetchYearRepartitions();
</script>

<style scoped>
.year-repartition-container {
  max-width: 64rem;
  margin: 0 auto;
  padding: 1.5rem;
}

.container-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1rem;
}

.legacy-banner {
  width: 100%;
}

.migrate-btn {
  margin-left: 12px;
}

.level-tabs {
  width: 100%;
}

.tab-badge {
  margin-left: 6px;
}

.tab-count {
  margin-left: 4px;
}

.create-btn {
  width: 100%;
  max-width: 28rem;
}

.actions-row {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  justify-content: center;
  width: 100%;
}

.set-current {
  margin-top: 4px;
}

.clone-source {
  margin-bottom: 12px;
}

.clone-preview {
  margin-top: 8px;
}

.repartition-table {
  width: 100%;
}

.modal-dialog {
  text-align: center;
}
</style>
