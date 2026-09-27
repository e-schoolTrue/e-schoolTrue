<template>
  <div class="year-repartition-container">
    <div class="container-content">
      <el-alert
        v-if="activeClosedLabel"
        :title="`Année ${activeClosedLabel} clôturée — lecture seule`"
        type="warning"
        :closable="false"
        show-icon
        class="closed-banner"
      />
      <div class="actions-row">
        <el-button type="primary" @click="openCreateModal" class="create-btn" :disabled="writeLocked">
          Créer une Répartition Annuelle
        </el-button>
        <el-button type="success" @click="openCloneDialog" :disabled="writeLocked || !previousYear">
          Créer {{ nextYearLabel ?? 'N' }} à partir de {{ previousYear?.schoolYear ?? 'N-1' }}
        </el-button>
      </div>

      <el-table :data="yearRepartitions" class="repartition-table" row-key="id">
        <el-table-column prop="schoolYear" label="Année Scolaire" />
        <el-table-column label="Type">
          <template #default="scope">
            {{ getPeriodType(scope.row.periodConfigurations) }}
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
          :initial-data="currentRepartition"
          @submit="handleSubmit"
          @cancel="showModal = false"
        />
      </el-dialog>

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
          <p>Paiements : {{ clonePreview.paymentConfigs }} · Tranches : {{ clonePreview.tranches }} · Notation : {{ clonePreview.gradingConfigs }} · Frais : {{ clonePreview.feeItems }}</p>
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
import { ref, computed, onMounted } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import YearRepartitionForm from "@/components/schoolYear/YearRepartionForm.vue";
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
} from '@/types/year';
import { useUserStore } from '@/stores/userStore';
import { useYearStore } from '@/stores/yearStore';
import { handleYearClosedError, isYearClosedError, warnIfClosed } from '@/composables/useYearGuard';

const userStore = useUserStore();
const yearStore = useYearStore();
const isAdmin = computed(() => userStore.hasRole('admin'));
/** Écran d'écriture : verrouillé si l'année active est clôturée. */
const writeLocked = computed(() => yearStore.isClosed);
const activeClosedLabel = computed(() => yearStore.isClosed ? yearStore.currentSchoolYear : '');

const yearRepartitions = ref<YearRepartitionResponse[]>([]);
const showModal = ref(false);
const currentRepartition = ref<YearRepartition | null>(null);

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
    : "Créer une Répartition Annuelle"
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

const openCreateModal = () => {
  currentRepartition.value = null;
  showModal.value = true;
};

const editRepartition = (repartition: YearRepartitionResponse) => {
  // Convertir les dates string en Date pour le formulaire
  const convertedRepartition: YearRepartition = {
    id: repartition.id,
    schoolYear: repartition.schoolYear,
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
    console.log(`Mode: ${isUpdate ? 'Mise à jour' : 'Création'}, ID: ${isUpdate ? data.id : 'N/A'}`);
    
    // Préparer les données en formatant correctement les dates
    const formattedData = {
      ...data,
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
      console.log("Mode mise à jour - ID:", id);
      console.log("Données à envoyer:", JSON.stringify({
        id,
        data: formattedData
      }, null, 2));
      
      // Envoi explicite de l'ID et des données séparément
      result = await window.ipcRenderer.invoke("yearRepartition:update", {
        id,
        data: formattedData
      });
      
      console.log("Résultat de la mise à jour:", JSON.stringify(result, null, 2));
    } else {
      console.log("Mode création - Données:", JSON.stringify(formattedData, null, 2));
      result = await window.ipcRenderer.invoke("yearRepartition:create", formattedData);
      console.log("Résultat de la création:", JSON.stringify(result, null, 2));
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
          clonePreview.value = res.data as YearClonePreview;
          break;
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
 * `{ schoolYear }` (configs-only), l'alias V3 peut renvoyer l'année complète.
 */
function normalizeCloneResult(data: unknown, fallbackYear: string): YearRepartitionResponse | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as Partial<YearRepartitionResponse> & { schoolYear?: string };
  if ((d as { id?: number }).id != null) return d as YearRepartitionResponse;
  const schoolYear = typeof d.schoolYear === 'string' && d.schoolYear ? d.schoolYear : fallbackYear;
  return {
    id: -1,
    schoolYear,
    periodConfigurations: [],
    isCurrent: false,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  } as unknown as YearRepartitionResponse;
}

/**
 * B2 : exécute le clonage `yearRepartition:clone` (canonique backend
 * `cloneYearConfigs({ fromId, newSchoolYear, ...options })`), fallback `year:clone`.
 * Puis pré-remplit le formulaire (noms N-1, dates +1 an).
 */
const confirmClone = async () => {
  if (!previousYear.value || !nextYearLabel.value) return;
  cloning.value = true;
  try {
    // Payload bilingue : `fromId`+`newSchoolYear` (backend) + `sourceId` (alias V3).
    const payload = {
      fromId: previousYear.value.id,
      sourceId: previousYear.value.id,
      newSchoolYear: nextYearLabel.value,
      ...cloneOptions.value,
    };
    let cloned: YearRepartitionResponse | null = null;
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
          lastError = new Error(res.message || res.error || 'Échec du clonage');
          continue;
        }
        cloned = normalizeCloneResult(res?.data, nextYearLabel.value);
        lastError = null;
        break;
      } catch (err) {
        handleYearClosedError(err);
        if (isYearClosedError(err)) return;
        lastError = err;
        continue;
      }
    }
    if (!cloned && lastError) {
      // Backend sans clone : repli création manuelle pré-remplie (config copiée serveur si dispo).
      throw lastError;
    }
    await fetchYearRepartitions();
    // Pré-remplit le formulaire : noms repris de N-1, dates décalées d'un an (éditables).
    const source = previousYear.value;
    const clonedId = cloned?.id != null && cloned.id > 0 ? cloned.id : undefined;
    currentRepartition.value = {
      ...(clonedId != null ? { id: clonedId } : {}),
      schoolYear: cloned?.schoolYear ?? nextYearLabel.value ?? '',
      periodConfigurations: (cloned?.periodConfigurations?.length
        ? cloned.periodConfigurations
        : source.periodConfigurations
      ).map((p) => ({
        name: p.name,
        start: shiftOneYear(p.start),
        end: shiftOneYear(p.end),
      })),
    };
    showCloneDialog.value = false;
    showModal.value = true;
    ElMessage.success(
      clonedId
        ? 'Année clonée — vérifiez puis enregistrez'
        : 'Configurations clonées — vérifiez puis enregistrez',
    );
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Échec du clonage');
  } finally {
    cloning.value = false;
  }
};

/** Décale une date d'un an (pré-remplissage N, champs restant éditables/vidables). */
function shiftOneYear(date: string | Date | null | undefined): string | Date {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return '';
  d.setFullYear(d.getFullYear() + 1);
  return d.toISOString();
}

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

    console.log(`Tentative de définition de l'année courante avec ID: ${repartition.id}`);
    
    try {
      const result = await window.ipcRenderer.invoke(
        "yearRepartition:setCurrent", 
        repartition.id
      );
      
      console.log("Résultat de yearRepartition:setCurrent:", JSON.stringify(result, null, 2));

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
onMounted(() => {
  warnIfClosed('la gestion des répartitions');
});
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

.closed-banner {
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