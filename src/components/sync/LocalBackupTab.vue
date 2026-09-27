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
            <el-button :loading="isImporting" :disabled="isLoading" @click="handleImport">
              <Icon icon="mdi:import" class="mr-1" />
              Importer
            </el-button>
            <el-button :disabled="isLoading" @click="loadBackups">
              <Icon icon="mdi:refresh" class="mr-1" />
              Actualiser
            </el-button>
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

    <!-- Confirmation restauration -->
    <el-dialog v-model="showRestoreDialog" title="Restaurer cette sauvegarde ?" width="520px" :close-on-click-modal="false">
      <el-alert type="warning" :closable="false" class="mb-3" title="Une sauvegarde de sécurité sera créée avant la restauration, puis l'application redémarrera." />
      <p v-if="selected"><strong>{{ selected.filename }}</strong> — {{ formatSize(selected.size) }} — {{ formatDate(selected.createdAt) }}</p>
      <template #footer>
        <el-button @click="showRestoreDialog = false">Annuler</el-button>
        <el-button type="warning" :loading="isRestoring" @click="confirmRestore">Restaurer et redémarrer</el-button>
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

    <!-- Aperçu import -->
    <el-dialog v-model="showImportDialog" title="Importer une base externe" width="560px" :close-on-click-modal="false">
      <div v-if="importPreview">
        <p><strong>Fichier :</strong> {{ importFileName }}</p>
        <el-descriptions :column="1" border size="small" class="mb-3">
          <el-descriptions-item label="Type">{{ importPreview.kind === 'zip' ? 'Archive zip' : 'Base brute' }}</el-descriptions-item>
          <el-descriptions-item label="Taille base">{{ formatSize(importPreview.dbSize) }}</el-descriptions-item>
          <el-descriptions-item label="Tables">{{ importPreview.tableCount }}</el-descriptions-item>
          <el-descriptions-item label="Pièces jointes">{{ importPreview.hasUploads ? 'Oui' : 'Non' }}</el-descriptions-item>
          <el-descriptions-item label="Empreinte">{{ importPreview.sha256 }}</el-descriptions-item>
        </el-descriptions>
        <el-alert
          v-for="(w, i) in importPreview.warnings"
          :key="i"
          type="warning"
          :closable="false"
          class="mb-2"
          :title="w"
        />
        <el-alert type="warning" :closable="false" title="Une sauvegarde de sécurité sera créée avant l'import, puis l'application redémarrera." />
      </div>
      <template #footer>
        <el-button @click="showImportDialog = false">Annuler</el-button>
        <el-button type="primary" :loading="isConfirmingImport" :disabled="!stagingPath" @click="confirmImport">
          Importer et redémarrer
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import type {
  BackupEnvelope,
  BackupItem,
  BackupListResult,
  BackupPreview,
  ImportPreviewResult,
} from '@/types/backup';
import { normalizeBackupItem } from '@/types/backup';

const backups = ref<BackupItem[]>([]);
const totalSizeBytes = ref(0);
const isLoading = ref(false);
const isCreating = ref(false);
const isImporting = ref(false);
const isRestoring = ref(false);
const isDeleting = ref(false);
const isConfirmingImport = ref(false);
const rowAction = ref<string | null>(null);
const actionKind = ref<'restore' | 'delete' | 'export' | null>(null);

const selected = ref<BackupItem | null>(null);
const showRestoreDialog = ref(false);
const showDeleteDialog = ref(false);
const showImportDialog = ref(false);
const stagingPath = ref<string | null>(null);
const importFileName = ref('');
const importPreview = ref<BackupPreview | null>(null);

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
      ElMessage.error(`Impossible de charger les sauvegardes : ${extractError(res, 'erreur inconnue')}`);
    }
  } catch (err) {
    backups.value = [];
    totalSizeBytes.value = 0;
    ElMessage.error(`Erreur IPC : ${(err as Error).message}`);
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
      ElMessage.error(`Échec de la sauvegarde : ${extractError(res, 'erreur inconnue')}`);
    }
  } catch (err) {
    ElMessage.error(`Erreur IPC : ${(err as Error).message}`);
  } finally {
    isCreating.value = false;
  }
};

const askRestore = (row: BackupItem): void => {
  selected.value = row;
  showRestoreDialog.value = true;
};

const confirmRestore = async (): Promise<void> => {
  if (!selected.value) return;
  isRestoring.value = true;
  rowAction.value = selected.value.id;
  actionKind.value = 'restore';
  try {
    const res = (await window.ipcRenderer.invoke('backup:restore', selected.value.id, true)) as BackupEnvelope<{
      relaunching: boolean;
      safetyBackup: string;
    }>;
    if (res?.success) {
      ElMessage.success('Restauration lancée, redémarrage de l’application…');
      showRestoreDialog.value = false;
    } else {
      ElMessage.error(`Échec de la restauration : ${extractError(res, 'erreur inconnue')}`);
    }
  } catch (err) {
    ElMessage.error(`Erreur IPC : ${(err as Error).message}`);
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
      ElMessage.error(`Échec de la suppression : ${extractError(res, 'erreur inconnue')}`);
    }
  } catch (err) {
    ElMessage.error(`Erreur IPC : ${(err as Error).message}`);
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
      ElMessage.error(`Impossible d’afficher le fichier : ${extractError(res, 'erreur inconnue')}`);
    }
  } catch (err) {
    ElMessage.error(`Erreur IPC : ${(err as Error).message}`);
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
      ElMessage.error(`Échec de l’export : ${extractError(res, 'erreur inconnue')}`);
    }
  } catch (err) {
    ElMessage.error(`Erreur IPC : ${(err as Error).message}`);
  } finally {
    rowAction.value = null;
    actionKind.value = null;
  }
};

const handleImport = async (): Promise<void> => {
  isImporting.value = true;
  try {
    let res: BackupEnvelope<ImportPreviewResult> | null = null;
    try {
      res = (await window.ipcRenderer.invoke('backup:import')) as BackupEnvelope<ImportPreviewResult>;
    } catch {
      res = (await window.ipcRenderer.invoke('backup:previewImport')) as BackupEnvelope<ImportPreviewResult>;
    }
    if (!res?.success || !res.data) {
      ElMessage.error(`Échec de l’import : ${extractError(res, 'erreur inconnue')}`);
      return;
    }
    if (res.data.canceled) {
      ElMessage.info('Import annulé.');
      return;
    }
    if (!res.data.stagingPath || !res.data.preview) {
      ElMessage.error('Aperçu d’import incomplet, veuillez réessayer.');
      return;
    }
    stagingPath.value = res.data.stagingPath;
    importFileName.value = res.data.fileName ?? '';
    importPreview.value = res.data.preview;
    showImportDialog.value = true;
  } catch (err) {
    ElMessage.error(`Erreur IPC : ${(err as Error).message}`);
  } finally {
    isImporting.value = false;
  }
};

const confirmImport = async (): Promise<void> => {
  if (!stagingPath.value) return;
  isConfirmingImport.value = true;
  try {
    const res = (await window.ipcRenderer.invoke('backup:confirmImport', stagingPath.value, true)) as BackupEnvelope<{
      relaunching: boolean;
      safetyBackup: string;
    }>;
    if (res?.success) {
      ElMessage.success('Import lancé, redémarrage de l’application…');
      showImportDialog.value = false;
    } else {
      ElMessage.error(`Échec de l’import : ${extractError(res, 'erreur inconnue')}`);
    }
  } catch (err) {
    ElMessage.error(`Erreur IPC : ${(err as Error).message}`);
  } finally {
    isConfirmingImport.value = false;
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
