<template>
  <div class="backup-import-card">
    <el-button type="primary" :loading="isImporting" :disabled="disabled" @click="handleImport">
      <Icon icon="mdi:import" class="mr-1" />
      Importer sauvegarde
    </el-button>

    <!-- Aperçu import (extrait de LocalBackupTab.vue, réutilisable onboarding + settings) -->
    <el-dialog
      v-model="showImportDialog"
      title="Importer une base externe"
      width="560px"
      :close-on-click-modal="false"
      append-to-body
    >
      <div v-if="importPreview" data-testid="import-preview">
        <p data-testid="import-preview-filename"><strong>Fichier :</strong> {{ importFileName }}</p>
        <p v-if="importSourcePath" class="path-line" data-testid="import-preview-source">
          <strong>Chemin choisi :</strong>
          <el-text truncated class="path-value" :title="importSourcePath">{{ importSourcePath }}</el-text>
        </p>
        <p v-if="stagingPath" class="path-line" data-testid="import-preview-staging">
          <strong>Staging :</strong>
          <el-text truncated type="info" class="path-value" :title="stagingPath">{{ stagingPath }}</el-text>
        </p>
        <el-descriptions :column="1" border size="small" class="mb-3">
          <el-descriptions-item label="Type">{{ importPreview.kind === 'zip' ? 'Archive zip' : 'Base brute' }}</el-descriptions-item>
          <el-descriptions-item label="Taille base">{{ formatSize(importPreview.dbSize) }}</el-descriptions-item>
          <el-descriptions-item label="Tables">{{ importPreview.tableCount }}</el-descriptions-item>
          <el-descriptions-item label="Version schéma">{{ importPreview.userVersion ?? '—' }}</el-descriptions-item>
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
        <el-alert
          v-if="needsMissingUploadsConfirm"
          type="error"
          :closable="false"
          class="mb-2"
          data-testid="confirm-missing-uploads-alert"
          title="Archive sans pièces jointes : les uploads actuels seront perdus. Confirmation bloquante requise."
        />
        <el-checkbox
          v-if="needsMissingUploadsConfirm"
          v-model="ackMissingUploads"
          data-testid="confirm-missing-uploads-checkbox"
          class="mb-2"
        >
          Je comprends que les pièces jointes ne seront pas restaurées
        </el-checkbox>
        <el-alert
          v-if="needsDowngradeConfirm"
          type="error"
          :closable="false"
          class="mb-2"
          data-testid="confirm-downgrade-alert"
          title="Downgrade schéma détecté : la base candidate est plus ancienne que la base live. Confirmation bloquante requise."
        />
        <el-checkbox
          v-if="needsDowngradeConfirm"
          v-model="ackDowngrade"
          data-testid="confirm-downgrade-checkbox"
          class="mb-2"
        >
          Je comprends que c'est un retour en arrière de schéma
        </el-checkbox>
        <el-alert type="warning" :closable="false" title="Une sauvegarde de sécurité sera créée avant l'import, puis l'application redémarrera." />
      </div>
      <div v-else>
        <el-alert type="error" :closable="false" title="Aperçu d'import incomplet, veuillez réessayer." />
      </div>
      <template #footer>
        <el-button @click="handleCancel">Annuler</el-button>
        <el-button
          type="primary"
          data-testid="confirm-import-btn"
          :loading="isConfirmingImport"
          :disabled="!canConfirmImport"
          @click="confirmImport"
        >
          Importer et redémarrer
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import { Icon } from '@iconify/vue';
import type {
  BackupEnvelope,
  BackupPreview,
  ImportPreviewResult,
} from '@/types/backup';

/**
 * Carte d'import de sauvegarde réutilisable (onboarding + réglages).
 *
 * Encapsule le flux IPC :
 * - preview via `backup:previewImport` (fallback legacy `backup:import`) qui ouvre
 *   le sélecteur natif (dialog.showOpenDialog filtres zip/db/sqlite) pour choisir
 *   explicitement le chemin du .zip, puis stage + valide le candidat.
 * - aperçu affiché avant confirm : fileName + sourcePath (chemin choisi) +
 *   stagingPath + preview (taille, tables, version, warnings).
  * - confirm via `backup:confirmImport` (safety backup + relaunch côté backend,
  *   voir `electron/backend/services/localBackupService.ts` — non dupliqué ici),
  *   PUIS `set-first-launch-complete` + flag localStorage après succès uniquement.
  * - sans fichier choisi (cancel ou staging null) : pas de confirm possible.
 *
 * @emits imported - Import confirmé, relaunch imminent `{ relaunching, safetyBackup }`.
 * @emits cancelled - L'utilisateur a annulé le sélecteur de fichier ou le dialogue.
 * @emits error - Échec preview/confirm (message technique, ex. fichier corrompu).
 */
const props = withDefaults(
  defineProps<{
    /** Désactive le bouton déclencheur. */
    disabled?: boolean;
    /**
     * Marque `set-first-launch-complete` (best-effort) APRÈS `backup:confirmImport`
     * réussi uniquement. Ordre critique en onboarding : appeler set-first-launch
     * AVANT le confirm coupe `isFirstLaunchBypassActive()` (security.ts) et fait
     * retomber le confirm admin-only → FORBIDDEN. Le flag localStorage
     * `eschool:wizard-backup-imported` suit la même règle (succès uniquement ;
     * en échec on préserve le bypass pour permettre un retry).
     * Inoffensif hors onboarding (déjà `true`).
     */
    markFirstLaunchComplete?: boolean;
    /**
     * Contexte d'usage : `true` (défaut) en interne (LocalBackupTab/SyncView)
     * où le RBAC s'applique et un FORBIDDEN backend s'affiche
     * « Réservé administrateur ». `false` en onboarding (ImportBackupView) :
     * hors application (first-launch, pas de user, pas de RBAC, import public
     * via `allowDuringFirstLaunch`) — le bandeau FORBIDDEN ne doit jamais
     * s'afficher, même après une erreur passagère.
     */
    requireAdmin?: boolean;
  }>(),
  { disabled: false, markFirstLaunchComplete: true, requireAdmin: true },
);

const emit = defineEmits<{
  (e: 'imported', payload: { relaunching: boolean; safetyBackup: string }): void;
  (e: 'cancelled'): void;
  (e: 'error', message: string): void;
  (e: 'previewed', payload: { stagingPath: string }): void;
}>();

const isImporting = ref(false);
const isConfirmingImport = ref(false);
const showImportDialog = ref(false);
const stagingPath = ref<string | null>(null);
const importFileName = ref('');
const importSourcePath = ref('');
const importPreview = ref<BackupPreview | null>(null);

const ackMissingUploads = ref(false);
const ackDowngrade = ref(false);

/** Confirmations bloquantes distinctes : dérivées du preview backend (jamais d'inférence UI seule). */
const needsMissingUploadsConfirm = computed(() => {
  const p = importPreview.value;
  if (!p) return false;
  if (typeof p.missingUploads === 'boolean') return p.missingUploads;
  return p.kind === 'zip' && p.hasUploads === false;
});
const needsDowngradeConfirm = computed(() => {
  const p = importPreview.value;
  if (!p) return false;
  if (typeof p.isDowngrade === 'boolean') return p.isDowngrade;
  return false;
});
const canConfirmImport = computed(() => {
  if (!stagingPath.value) return false;
  if (needsMissingUploadsConfirm.value && !ackMissingUploads.value) return false;
  if (needsDowngradeConfirm.value && !ackDowngrade.value) return false;
  return true;
});

const resetPreviewState = (): void => {
  stagingPath.value = null;
  importFileName.value = '';
  importSourcePath.value = '';
  importPreview.value = null;
  ackMissingUploads.value = false;
  ackDowngrade.value = false;
};

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

const extractError = (res: BackupEnvelope<unknown> | null, fallback: string): string => {
  if (res?.message) return res.message;
  if (res?.error) return res.error;
  return fallback;
};

/**
 * Sauvegardes réservées admin en interne : un FORBIDDEN backend s'affiche
 * « Réservé administrateur », jamais en toast brut. En onboarding
 * (`requireAdmin=false`) : on affiche l'erreur backend réelle (code + message,
 * ex. `Échec de l'import : STAGING_EXPIRED …`) pour diagnostiquer le confirm.
 * Seule la phrase « Réservé administrateur » (bandeau interne) n'est jamais
 * produite en onboarding — mais le token FORBIDDEN/UNAUTHENTICATED d'origine
 * est conservé tel quel (pas de « refus temporaire » générique qui masquait
 * la vraie cause : bypass coupé par set-first-launch précoce).
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

const forbiddenMessage = (err: unknown, fallback: string): string => {
  if (!props.requireAdmin) {
    // Onboarding : erreur réelle, sans expurgation. On retire uniquement le
    // libellé interne « Réservé administrateur » s'il s'y est glissé, sans
    // jamais le remplacer par un générique ni masquer le code backend.
    const cleaned = fallback.replace(/Réservé administrateur/gi, '').replace(/\s{2,}/g, ' ').trim();
    return cleaned || fallback;
  }
  return isForbidden(err) ? 'Réservé administrateur' : fallback;
};

/** Étape 1 — sélecteur fichier + staging + preview (fichier corrompu → erreur, pas de dialogue). */
const handleImport = async (): Promise<void> => {
  isImporting.value = true;
  try {
    let res: BackupEnvelope<ImportPreviewResult> | null = null;
    try {
      res = (await window.ipcRenderer.invoke('backup:previewImport')) as BackupEnvelope<ImportPreviewResult>;
    } catch {
      res = (await window.ipcRenderer.invoke('backup:import')) as BackupEnvelope<ImportPreviewResult>;
    }
    if (!res?.success || !res.data) {
      const raw = extractError(res, 'erreur inconnue');
      const code = (res as { error?: unknown } | null)?.error ? String((res as { error?: unknown }).error) : '';
      const withCode = code && !raw.includes(code) ? `Échec de l'import (${code}) : ${raw}` : `Échec de l'import : ${raw}`;
      const msg = forbiddenMessage(raw, withCode);
      ElMessage.error(msg);
      emit('error', msg);
      return;
    }
    if (res.data.canceled) {
      ElMessage.info('Import annulé.');
      emit('cancelled');
      return;
    }
    if (!res.data.stagingPath || !res.data.preview) {
      const msg = 'Aperçu d’import incomplet, veuillez réessayer.';
      ElMessage.error(msg);
      emit('error', msg);
      return;
    }
    stagingPath.value = res.data.stagingPath;
    importFileName.value = res.data.fileName ?? '';
    importSourcePath.value = res.data.sourcePath ?? res.data.fileName ?? '';
    importPreview.value = res.data.preview;
    showImportDialog.value = true;
    // Preview réussi : notifie le parent (ex. ImportBackupView en onboarding)
    // pour qu'il nettoie toute erreur FORBIDDEN résiduelle — après un staging
    // valide, aucune alerte rouge ne doit persister.
    emit('previewed', { stagingPath: res.data.stagingPath });
  } catch (err) {
    const msg = forbiddenMessage(err, `Erreur IPC : ${(err as Error).message}`);
    ElMessage.error(msg);
    emit('error', msg);
  } finally {
    isImporting.value = false;
  }
};

const handleCancel = (): void => {
  showImportDialog.value = false;
  // Sans fichier choisi, pas de confirm possible : on purge le staging affiché
  // pour éviter un confirm sur un aperçu périmé (TOCTOU côté UI).
  resetPreviewState();
  emit('cancelled');
};

/**
 * Étape 2 — confirm : safety backup + remplacement à froid + relaunch backend.
 * Ordre critique : `backup:confirmImport` D'ABORD (bypass first-launch actif),
 * puis `set-first-launch-complete` + flag localStorage UNIQUEMENT après succès.
 * En échec on ne marque rien (bypass préservé pour retry + erreur réelle affichée).
 */
const confirmImport = async (): Promise<void> => {
  if (!stagingPath.value) return;
  // Garde UI : ne jamais appeler l'IPC tant que les cases bloquantes ne sont pas cochées.
  if (!canConfirmImport.value) {
    const msg = needsMissingUploadsConfirm.value && !ackMissingUploads.value
      ? 'Archive sans pièces jointes : cochez la confirmation avant d’importer.'
      : 'Downgrade schéma : cochez la confirmation avant d’importer.';
    ElMessage.error(msg);
    emit('error', msg);
    return;
  }
  isConfirmingImport.value = true;
  try {
    const res = (await window.ipcRenderer.invoke('backup:confirmImport', stagingPath.value, true, {
      acknowledgeMissingUploads: ackMissingUploads.value,
      acknowledgeDowngrade: ackDowngrade.value,
    })) as BackupEnvelope<{
      relaunching: boolean;
      safetyBackup: string;
    }>;
    if (res?.success) {
      // Succès : le bypass était actif pendant le confirm ; on casse maintenant
      // la boucle wizard pour qu'après relaunch is-first-launch soit false.
      if (props.markFirstLaunchComplete && window.ipcRenderer) {
        try {
          await window.ipcRenderer.invoke('set-first-launch-complete');
        } catch (e) {
          console.warn('[BackupImportCard] set-first-launch-complete best-effort ignoré:', e);
        }
        try {
          localStorage.setItem('eschool:wizard-backup-imported', new Date().toISOString());
        } catch {
          /* stockage indisponible : le guard is-first-launch reste le filet */
        }
      }
      ElMessage.success('Import lancé, redémarrage de l’application…');
      showImportDialog.value = false;
      emit('imported', {
        relaunching: true,
        safetyBackup: (res.data as { safetyBackup?: string } | null)?.safetyBackup ?? '',
      });
    } else {
      // Codes distincts : le backend renvoie error=CODE + message technique.
      // On matche sur la concaténation (extractError préfère message, qui peut être générique).
      // L'erreur affichée conserve TOUJOURS le code (diagnostic réel, pas de générique).
      const combined = `${res?.error ?? ''} ${res?.message ?? ''} ${extractError(res, '')}`;
      const code = res?.error ? String(res.error) : '';
      const detail = extractError(res, 'erreur inconnue');
      const withCode =
        code && !detail.includes(code) ? `Échec de l’import (${code}) : ${detail}` : `Échec de l’import : ${detail}`;
      const distinct = /NEED_CONFIRM_MISSING_UPLOADS/.test(combined)
        ? 'Archive sans pièces jointes : confirmation requise (cochez la case). NEED_CONFIRM_MISSING_UPLOADS'
        : /NEED_CONFIRM_DOWNGRADE/.test(combined)
          ? 'Downgrade schéma : confirmation requise (cochez la case). NEED_CONFIRM_DOWNGRADE'
          : withCode;
      const msg = forbiddenMessage(combined, distinct);
      ElMessage.error(msg);
      emit('error', msg);
    }
  } catch (err) {
    const msg = forbiddenMessage(err, `Erreur IPC : ${(err as Error).message}`);
    ElMessage.error(msg);
    emit('error', msg);
  } finally {
    isConfirmingImport.value = false;
  }
};
</script>

<style scoped>
.backup-import-card {
  display: inline-block;
}
.mr-1 { margin-right: 4px; }
.mb-2 { margin-bottom: 8px; }
.mb-3 { margin-bottom: 12px; }
.path-line {
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 4px 0 8px;
  word-break: break-all;
}
.path-value {
  flex: 1;
  min-width: 0;
  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
  font-size: 12px;
}
</style>
