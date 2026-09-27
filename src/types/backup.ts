/**
 * Types frontend pour les sauvegardes locales (fichier .zip : database.db + uploads/).
 * Contrats IPC (electron/events.ts + LocalBackupService) :
 * - backup:list -> Envelope<{ backups: BackupItem[]; totalSizeBytes: number; count: number }>
 * - backup:create -> Envelope<BackupItem>
 * - backup:info <basename> -> Envelope<BackupItem>
 * - backup:restore <basename, confirmed> -> Envelope<{ relaunching: boolean; safetyBackup: string }>
 * - backup:import / backup:previewImport -> Envelope<ImportPreviewResult>
 * - backup:confirmImport <stagingPath, confirmed> -> Envelope<{ relaunching: boolean; safetyBackup: string }>
 * - backup:delete <basename> -> Envelope<{ deleted: string }>
 * - backup:reveal <basename> -> Envelope<{ revealed: boolean }>
 * - backup:exportTo <basename> -> Envelope<{ canceled: boolean; exportedTo?: string }>
 *
 * Le renderer ne transmet que des basenames (jamais de chemin absolu).
 */

export type BackupReason = 'manual' | 'pre-restore' | 'pre-import';

/** Sidecar .meta.json écrit par LocalBackupService. */
export interface BackupMeta {
  createdAt: string;
  reason: BackupReason;
  size: number;
  dbSize: number;
  fileCount: number;
  appVersion: string;
  schemaVersion: number | null;
  ecoleId: string | null;
  origin: 'local';
  /** "sha256:<hex>" du database.db au moment du snapshot. */
  integrity: string;
}

/**
 * Une sauvegarde listée par le backend.
 * `id` = basename du zip (seul identifiant échangé avec le renderer).
 * `filename` est un alias de `name` pour compatibilité.
 */
export interface BackupItem {
  id: string;
  name: string;
  /** Alias de `name` (compatibilité avec le contrat initial). */
  filename: string;
  createdAt: string;
  size: number;
  reason: BackupReason;
  meta: BackupMeta | null;
  /** Raccourcis aplatis (optionnels, dérivés de `meta`). */
  origin: 'local';
  appVersion: string | null;
  integrity: string | null;
}

/** Résultat de backup:list (champ `data`). */
export interface BackupListResult {
  backups: BackupItem[];
  totalSizeBytes: number;
  count: number;
}

/** Aperçu d'un fichier candidat à l'import (validation staging). */
export interface BackupPreview {
  kind: 'zip' | 'raw';
  dbSize: number;
  tableCount: number;
  userVersion: number | null;
  hasUploads: boolean;
  sha256: string;
  warnings: string[];
}

/** Résultat de backup:import / backup:previewImport (champ `data`). */
export interface ImportPreviewResult {
  canceled: boolean;
  stagingPath?: string;
  fileName?: string;
  preview?: BackupPreview;
  warnings?: string[];
}

/** Enveloppe standard retournée par les handlers IPC backup:*. */
export interface BackupEnvelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  message?: string;
}

/** Normalise un BackupInfo brut (backend) vers BackupItem (frontend). */
export function normalizeBackupItem(raw: {
  id: string;
  name: string;
  createdAt: string;
  size: number;
  reason: BackupReason;
  meta: BackupMeta | null;
}): BackupItem {
  return {
    id: raw.id,
    name: raw.name,
    filename: raw.name,
    createdAt: raw.createdAt,
    size: raw.size,
    reason: raw.reason,
    meta: raw.meta,
    origin: 'local',
    appVersion: raw.meta?.appVersion ?? null,
    integrity: raw.meta?.integrity ?? null,
  };
}
