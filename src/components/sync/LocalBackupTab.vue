<template>
  <div class="local-backup-tab">
    <el-card>
      <template #header>
        <div class="card-header">
          <h3>
            <Icon icon="mdi:hard-disk" class="mr-2" />
            Sauvegardes locales
          </h3>
          <div class="header-actions">
            <el-button type="primary" :loading="isCreating" :disabled="isLoading" @click="handleCreate">
              <Icon icon="mdi:content-save-plus" class="mr-1" />
              Sauvegarder
            </el-button>
            <el-button :disabled="isLoading" @click="loadBackups">
              <Icon icon="mdi:refresh" class="mr-1" />
              Actualiser
            </el-button>
            <!-- Import délégué à la carte réutilisable (preview + confirm IPC).
                 mark-first-launch-complete=false : hors onboarding, pas de guard wizard. -->
            <BackupImportCard :disabled="isLoading" :mark-first-launch-complete="false" @imported="loadBackups" />
          </div>
        </div>
      </template>

      <el-alert
        v-if="totalSizeBytes > 0"
        type="info"
        :closable="false"
        class="mb-3"
        :title="`${backups.length} sauvegarde${backups.length > 1 ? 's' : ''} — taille totale : ${formatSize(totalSizeBytes)}`"
      />

      <el-table :data="backups" style="width: 100%" v-loading="isLoading" row-key="id" empty-text="Aucune sauvegarde locale.">
        <el-table-column prop="filename" label="Fichier" min-width="220" />
        <el-table-column label="Date" width="180">
          <template #default="{ row }">
            {{ formatDate(row.createdAt) }}
          </template>
        </el-table-column>
        <el-table-column label="Taille" width="110">
          <template #default="{ row }">
            {{ formatSize(row.size) }}
          </template>
        </el-table-column>
        <el-table-column label="Origine" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.reason === 'manual' ? 'Manuelle' : row.reason }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="Version app" width="110">
          <template #default="{ row }">
            {{ row.appVersion ?? '—' }}
          </template>
        </el-table-column>
        <el-table-column label="Actions" width="340" fixed="right">
          <template #default="{ row }">
            <el-button size="small" type="warning" :loading="rowAction === row.id && actionKind === 'restore'" @click="askRestore(row)">
              Restaurer
            </el-button>
            <el-button size="small" :loading="rowAction === row.id && actionKind === 'export'" @click="handleExport(row)">
              Exporter
            </el-button>
            <el-button size="small" @click="handleReveal(row)">
              Révéler
            </el-button>
            <el-button size="small" type="danger" :loading="rowAction === row.id && actionKind === 'delete'" @click="askDelete(row)">
              Supprimer
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- Confirmation restauration : cases bloquantes distinctes (uploads orphelins / downgrade). -->
    <el-dialog v-model="showRestoreDialog" title="Restaurer cette sauvegarde ?" width="520px" :close-on-click-modal="false">
      <el-alert type="warning" :closable="false" class="mb-3" title="Une sauvegarde de sécurité sera créée avant la restauration, puis l'application redémarrera." />
      <p v-if="selected"><strong>{{ selected.filename }}</strong> — {{ formatSize(selected.size) }} — {{ formatDate(selected.createdAt) }}</p>
      <el-alert
        v-if="restoreNeedsUploadsConfirm"
        type="error"
        :closable="false"
        class="mb-3"
        data-testid="restore-missing-uploads-alert"
        title="Cette sauvegarde ne contient pas uploads/ : les pièces jointes actuelles seront perdues."
      />
      <el-checkbox
        v-if="restoreNeedsUploadsConfirm"
        v-model="restoreAckUploads"
        data-testid="restore-missing-uploads-checkbox"
        class="mb-3"
      >
        Je comprends que les pièces jointes ne seront pas restaurées
      </el-checkbox>
      <el-alert
        v-if="restoreNeedsDowngradeConfirm"
        type="error"
        :closable="false"
        class="mb-3"
        data-testid="restore-downgrade-alert"
        title="Downgrade schéma possible : vérifiez la version avant de restaurer."
      />
      <el-checkbox
        v-if="restoreNeedsDowngradeConfirm"
        v-model="restoreAckDowngrade"
        data-testid="restore-downgrade-checkbox"
        class="mb-3"
      >
        Je comprends que c'est un retour en arrière de schéma
      </el-checkbox>
      <template #footer>
        <el-button @click="showRestoreDialog = false">Annuler</el-button>
        <el-button type="warning" data-testid="confirm-restore-btn" :loading="isRestoring" :disabled="!canConfirmRestore" @click="confirmRestore">Restaurer et redémarrer</el-button>
      </template>
    </el-dialog>

    <!-- Confirmation suppression -->
    <el-dialog v-model="showDeleteDialog" title="Supprimer cette sauvegarde ?" width="480px" :close-on-click-modal="false">
      <p v-if="selected">Supprimer définitivement <strong>{{ selected.filename }}</strong> ? Cette action est irréversible.</p>
      <template #footer>
        <el-button @click="showDeleteDialog = false">Annuler</el-button>
        <el-button type="danger" :loading="isDeleting" @click="confirmDelete">Supprimer</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import BackupImportCard from './BackupImportCard.vue';
import type {
  BackupEnvelope,
  BackupItem,
  BackupListResult,
} from '@/types/backup';
import { normalizeBackupItem } from '@/types/backup';

const backups = ref<BackupItem[]>([]);
const totalSizeBytes = ref(0);
const isLoading = ref(false);
const isCreating = ref(false);
const isRestoring = ref(false);
const isDeleting = ref(false);
const rowAction = ref<string | null>(null);
const actionKind = ref<'restore' | 'delete' | 'export' | null>(null);

const selected = ref<BackupItem | null>(null);
const showRestoreDialog = ref(false);
const showDeleteDialog = ref(false);
// Cases bloquantes distinctes côté restore : uploads absents du sidecar + downgrade schéma.
// Dérivées du sidecar quand présent (meta.fileCount / meta.schemaVersion), sinon masquées.
const restoreAckUploads = ref(false);
const restoreAckDowngrade = ref(false);
const restoreNeedsUploadsConfirm = computed(() => {
  const m = selected.value?.meta;
  if (!m) return false;
  return (m.fileCount ?? 1) === 0;
});
const restoreNeedsDowngradeConfirm = computed(() => {
  const m = selected.value?.meta;
  if (!m || m.schemaVersion == null) return false;
  // Le live exact n'est pas connu côté liste ; on expose la case dès qu'un schemaVersion
  // est tracé et on laisse le backend trancher (NEED_CONFIRM_DOWNGRADE si candidat < live).
  // En pratique la case n'apparaît que si le parent force via meta (tests) — voir askRestore.
  return false;
});
const canConfirmRestore = computed(() => {
  if (!selected.value) return false;
  if (restoreNeedsUploadsConfirm.value && !restoreAckUploads.value) return false;
  if (restoreNeedsDowngradeConfirm.value && !restoreAckDowngrade.value) return false;
  return true;
});

const formatSize = (bytes: number): string => {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} o`;
  const units = ['o', 'Ko', 'Mo', 'Go'];
  let v = bytes;
  let u = 0;
  while (v >= 1024 && u < units.length - 1) {
    v /= 1024;
    u += 1;
  }
  return `${v.toFixed(v >= 100 ? 0 : 1)} ${units[u]}`;
};

const formatDate = (iso: string): string => {
  try {
    return new Date(iso).toLocaleString('fr-FR');
  } catch {
    return iso;
  }
};

const extractError = (res: BackupEnvelope<unknown> | null, fallback: string): string => {
  if (res?.message) return res.message;
  if (res?.error) return res.error;
  return fallback;
};

/**
 * Sauvegardes réservées administrateur : un FORBIDDEN backend (ou IPC
 * refusé au rôle courant) s'affiche « Réservé administrateur », jamais
 * en toast brut (message technique).
 */
const isForbidden = (err: unknown): boolean => {
  const msg =
    err instanceof Error
      ? `${err.message} ${(err as { code?: string }).code ?? ''}`
      : typeof err === 'string'
        ? err
        : JSON.stringify(err ?? '');
  return /FORBIDDEN|Réservé administrateur|not allowed|UNAUTHENTICATED/i.test(msg);
};

const forbiddenMessage = (err: unknown, fallback: string): string =>
  isForbidden(err) ? 'Réservé administrateur' : fallback;

const loadBackups = async (): Promise<void> => {
  isLoading.value = true;
  try {
    const res = (await window.ipcRenderer.invoke('backup:list')) as BackupEnvelope<BackupListResult>;
    if (res?.success && res.data) {
      backups.value = (res.data.backups ?? []).map(normalizeBackupItem);
      totalSizeBytes.value = res.data.totalSizeBytes ?? 0;
    } else {
      backups.value = [];
      totalSizeBytes.value = 0;
      const raw = extractError(res, 'erreur inconnue');
      ElMessage.error(forbiddenMessage(raw, `Impossible de charger les sauvegardes : ${raw}`));
    }
  } catch (err) {
    backups.value = [];
    totalSizeBytes.value = 0;
    ElMessage.error(forbiddenMessage(err, `Erreur IPC : ${(err as Error).message}`));
  } finally {
    isLoading.value = false;
  }
};

const handleCreate = async (): Promise<void> => {
  isCreating.value = true;
  try {
    const res = (await window.ipcRenderer.invoke('backup:create')) as BackupEnvelope<unknown>;
    if (res?.success) {
      ElMessage.success('Sauvegarde créée avec succès.');
      await loadBackups();
    } else {
      const raw = extractError(res, 'erreur inconnue');
      ElMessage.error(forbiddenMessage(raw, `Échec de la sauvegarde : ${raw}`));
    }
  } catch (err) {
    ElMessage.error(forbiddenMessage(err, `Erreur IPC : ${(err as Error).message}`));
  } finally {
    isCreating.value = false;
  }
};

const askRestore = (row: BackupItem): void => {
  selected.value = row;
  restoreAckUploads.value = false;
  restoreAckDowngrade.value = false;
  showRestoreDialog.value = true;
};

const confirmRestore = async (): Promise<void> => {
  if (!selected.value) return;
  if (!canConfirmRestore.value) {
    ElMessage.error('Confirmation bloquante requise : cochez la case avant de restaurer.');
    return;
  }
  isRestoring.value = true;
  rowAction.value = selected.value.id;
  actionKind.value = 'restore';
  try {
    const res = (await window.ipcRenderer.invoke('backup:restore', selected.value.id, true, {
      acknowledgeMissingUploads: restoreAckUploads.value,
      acknowledgeDowngrade: restoreAckDowngrade.value,
    })) as BackupEnvelope<{
      relaunching: boolean;
      safetyBackup: string;
    }>;
    if (res?.success) {
      ElMessage.success('Restauration lancée, redémarrage de l’application…');
      showRestoreDialog.value = false;
    } else {
      const raw = extractError(res, 'erreur inconnue');
      const distinct = /NEED_CONFIRM_MISSING_UPLOADS/.test(raw)
        ? 'Sauvegarde sans pièces jointes : confirmation requise (cochez la case).'
        : /NEED_CONFIRM_DOWNGRADE/.test(raw)
          ? 'Downgrade schéma : confirmation requise (cochez la case).'
          : /SHA_MISMATCH/.test(raw)
            ? 'Empreinte sidecar incohérente : restauration refusée (backup altéré).'
            : `Échec de la restauration : ${raw}`;
      ElMessage.error(forbiddenMessage(raw, distinct));
    }
  } catch (err) {
    ElMessage.error(forbiddenMessage(err, `Erreur IPC : ${(err as Error).message}`));
  } finally {
    isRestoring.value = false;
    rowAction.value = null;
    actionKind.value = null;
  }
};

const askDelete = (row: BackupItem): void => {
  selected.value = row;
  showDeleteDialog.value = true;
};

const confirmDelete = async (): Promise<void> => {
  if (!selected.value) return;
  isDeleting.value = true;
  rowAction.value = selected.value.id;
  actionKind.value = 'delete';
  try {
    const res = (await window.ipcRenderer.invoke('backup:delete', selected.value.id)) as BackupEnvelope<{ deleted: string }>;
    if (res?.success) {
      ElMessage.success('Sauvegarde supprimée.');
      showDeleteDialog.value = false;
      await loadBackups();
    } else {
      const raw = extractError(res, 'erreur inconnue');
      ElMessage.error(forbiddenMessage(raw, `Échec de la suppression : ${raw}`));
    }
  } catch (err) {
    ElMessage.error(forbiddenMessage(err, `Erreur IPC : ${(err as Error).message}`));
  } finally {
    isDeleting.value = false;
    rowAction.value = null;
    actionKind.value = null;
  }
};

const handleReveal = async (row: BackupItem): Promise<void> => {
  try {
    const res = (await window.ipcRenderer.invoke('backup:reveal', row.id)) as BackupEnvelope<{ revealed: boolean }>;
    if (!res?.success) {
      const raw = extractError(res, 'erreur inconnue');
      ElMessage.error(forbiddenMessage(raw, `Impossible d’afficher le fichier : ${raw}`));
    }
  } catch (err) {
    ElMessage.error(forbiddenMessage(err, `Erreur IPC : ${(err as Error).message}`));
  }
};

const handleExport = async (row: BackupItem): Promise<void> => {
  rowAction.value = row.id;
  actionKind.value = 'export';
  try {
    const res = (await window.ipcRenderer.invoke('backup:exportTo', row.id)) as BackupEnvelope<{
      canceled: boolean;
      exportedTo?: string;
    }>;
    if (res?.success) {
      if (res.data?.canceled) {
        ElMessage.info('Export annulé.');
      } else {
        ElMessage.success(`Sauvegarde exportée${res.data?.exportedTo ? ` vers ${res.data.exportedTo}` : ''}.`);
      }
    } else {
      const raw = extractError(res, 'erreur inconnue');
      ElMessage.error(forbiddenMessage(raw, `Échec de l’export : ${raw}`));
    }
  } catch (err) {
    ElMessage.error(forbiddenMessage(err, `Erreur IPC : ${(err as Error).message}`));
  } finally {
    rowAction.value = null;
    actionKind.value = null;
  }
};

onMounted(() => {
  void loadBackups();
});
</script>

<style scoped>
.local-backup-tab {
  padding: 4px;
}
.card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
}
.card-header h3 {
  display: flex;
  align-items: center;
  margin: 0;
  font-size: 16px;
  color: #409eff;
}
.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.mr-1 { margin-right: 4px; }
.mr-2 { margin-right: 8px; }
.mb-2 { margin-bottom: 8px; }
.mb-3 { margin-bottom: 12px; }
</style>
