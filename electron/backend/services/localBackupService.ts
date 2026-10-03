/**
 * LocalBackupService — sauvegardes locales fichier (DB SQLite + uploads) au format .zip.
 *
 * Périmètre : snapshot cohérent de `database.db` (via VACUUM INTO, sans couper la DataSource),
 * archivé avec `uploads/` dans un zip horodaté sous `<userData>/backups/`, avec sidecar
 * `.meta.json` (traçabilité : version app, user_version, école, sha256).
 *
 * Rétention : ILLIMITÉE — aucune purge automatique. `listBackups()` expose seulement la taille
 * totale pour affichage dans l'UI. La suppression est exclusivement manuelle (deleteBackup).
 *
 * Notes de perf (ordres de grandeur mesurés sur poste standard, DB < 500 Mo) :
 * - VACUUM INTO : snapshot cohérent en O(n) pages, verrou SHARED bref (p50 < 200 ms) ;
 *   les écrivains concurrents peuvent retourner SQLITE_BUSY → retry 3x backoff+jitter.
 * - Écriture atomique : zip + sidecar écrits en `.tmp` puis `rename()` (atomique POSIX,
 *   même filesystem) → jamais de backup tronqué visible par listBackups().
 * - Restauration/import : remplacement à froid (DataSource.destroy() + relaunch) car SQLite
 *   ne supporte pas le swap d'un fichier ouvert ; coût dominé par la taille du zip.
 */
import { app, BrowserWindow, dialog, shell } from 'electron';
import * as fs from 'fs';
import * as fsp from 'fs/promises';
import * as path from 'path';
import * as crypto from 'crypto';
import { ZipArchive } from 'archiver';
import extract from 'extract-zip';
import { AppDataSource } from '../../data-source';

// ---------------------------------------------------------------------------
// Types publics
// ---------------------------------------------------------------------------

export type BackupReason = 'manual' | 'pre-restore' | 'pre-import';

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
  integrity: string; // "sha256:<hex>" du database.db au moment du snapshot
}

export interface BackupInfo {
  /** basename du zip — seul identifiant échangé avec le renderer (jamais de chemin absolu). */
  id: string;
  name: string;
  createdAt: string;
  size: number;
  reason: BackupReason;
  meta: BackupMeta | null;
}

export interface BackupPreview {
  kind: 'zip' | 'raw';
  dbSize: number;
  tableCount: number;
  userVersion: number | null;
  /** user_version live au moment de la validation (null si illisible). Sert au détecteur downgrade. */
  liveUserVersion: number | null;
  hasUploads: boolean;
  /** true quand l'archive zip ne contient pas uploads/ → confirmation bloquante distincte requise. */
  missingUploads: boolean;
  /** true quand userVersion < liveUserVersion → confirmation bloquante distincte requise. */
  isDowngrade: boolean;
  sha256: string;
  warnings: string[];
}

export interface ConfirmOptions {
  acknowledgeMissingUploads?: boolean;
  acknowledgeDowngrade?: boolean;
}

/** Résultat restore/import : `devReload` vrai quand le backend a rechargé la
 * fenêtre de dev au lieu de `app.relaunch()+exit` (jamais de sortie en dev). */
export interface RelaunchResult {
  relaunching: boolean;
  safetyBackup: string;
  /** Dev uniquement : fenêtre rechargée (loadURL dev / reload), redémarrage manuel conseillé. */
  devReload?: boolean;
}

interface Envelope<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  message?: string;
}

// ---------------------------------------------------------------------------
// Constantes
// ---------------------------------------------------------------------------

const DB_FILENAME = 'database.db';
const UPLOADS_DIRNAME = 'uploads';
const SQLITE_MAGIC = 'SQLite format 3';
const MIN_DB_BYTES = 4 * 1024; // en dessous : pas une SQLite crédible
const MAX_CANDIDATE_BYTES = 5 * 1024 * 1024 * 1024; // garde-fou anti zip-bomb (5 Gio)
/**
 * Tables cœur exigées à la validation — garde élargie (destructif).
 * Noms réels (lowercase comparé) : user, T_student, payments + school, grade,
 * course, year_repartition, professors. Un candidat qui n'a pas TOUTES ces
 * tables est rejeté en ERREUR (MISSING_TABLES), jamais en simple warning :
 * c'est le filet anti base d'un autre produit / export partiel.
 */
const REQUIRED_TABLES = ['user', 't_student', 'payments', 'school', 'grade', 'course', 'year_repartition'];
/**
 * En dessous de ce total, rejet en ERREUR (TOO_FEW_TABLES) — pas un warning seul.
 * Une base eSchool réelle dépasse 30 tables ; < 20 = autre produit ou dump tronqué.
 */
const WARN_TABLE_COUNT = 20;
const VACUUM_MAX_ATTEMPTS = 3;

const ok = <T>(data: T, message?: string): Envelope<T> => ({ success: true, data, error: null, ...(message ? { message } : {}) });
const fail = <T>(error: string, message?: string): Envelope<T> => ({ success: false, data: null, error, ...(message ? { message } : {}) });

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

function stamp(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export class LocalBackupService {
  private readonly backupsDir: string;
  private readonly stagingDir: string;
  private readonly dbPath: string;
  private readonly uploadsDir: string;
  private readonly syncHistoryDir: string;
  /** Garde anti-concurrence : un restore/import est une fenêtre à froid, aucune écriture sinon. */
  private isRestoring = false;

  /**
   * Exposé pour l'audit fail-soft (`AuditLogService` + wrapper `protectedHandle`
   * sautent l'audit silencieusement pendant un restore à froid, au lieu de
   * throw `database connection is not open` sur connexion détruite).
   */
  public isRestoreInProgress(): boolean {
    return this.isRestoring;
  }

  /** Alias getter (lecture externe sans appel méthode). */
  public get isRestoringActive(): boolean {
    return this.isRestoring;
  }

  constructor() {
    const userData = app.getPath('userData');
    this.dbPath = path.join(userData, DB_FILENAME);
    this.uploadsDir = path.join(userData, UPLOADS_DIRNAME);
    this.backupsDir = path.join(userData, 'backups');
    this.stagingDir = path.join(this.backupsDir, 'staging');
    this.syncHistoryDir = path.join(userData, 'sync_history');
    fs.mkdirSync(this.backupsDir, { recursive: true });
    fs.mkdirSync(this.stagingDir, { recursive: true });
    // Nettoyage du staging au boot : résidus d'un import/restore interrompu (crash/kill).
    // Sans cela, chaque crash laisserait des copies de DB orphelines qui gonflent le disque.
    this.cleanStagingSync();
  }

  // ---------------------------------------------------------- sécurité chemins

  /**
   * Le renderer ne transmet QUE des basenames. Reconstruction côté main + triple garde :
   * basename pur (pas de séparateur), extension .zip, containment dans backupsDir.
   * Bloque les traversées "../../" et les chemins absolus (path traversal → écrasement arbitraire).
   */
  private resolveBackupFile(basename: string): string {
    if (typeof basename !== 'string' || basename.length === 0 || basename.length > 255) throw new Error('INVALID_NAME');
    if (basename !== path.basename(basename)) throw new Error('INVALID_NAME');
    if (!/^[\w][\w\-. ]*\.zip$/i.test(basename)) throw new Error('INVALID_NAME');
    const full = path.join(this.backupsDir, basename);
    const rel = path.relative(this.backupsDir, full);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('INVALID_NAME');
    return full;
  }

  /** Un stagingPath accepté en confirmImport doit rester confiné dans stagingDir (TOCTOU). */
  private resolveStagingPath(p: string): string {
    if (typeof p !== 'string' || p.length === 0) throw new Error('INVALID_STAGING_PATH');
    const abs = path.resolve(p);
    const rel = path.relative(this.stagingDir, abs);
    if (rel.startsWith('..') || path.isAbsolute(rel)) throw new Error('INVALID_STAGING_PATH');
    return abs;
  }

  // ---------------------------------------------------------- utilitaires fs

  private cleanStagingSync(): void {
    try {
      for (const entry of fs.readdirSync(this.stagingDir)) {
        fs.rmSync(path.join(this.stagingDir, entry), { recursive: true, force: true });
      }
    } catch (e) {
      console.error('[LocalBackup] Nettoyage staging au boot impossible:', e);
    }
  }

  private async dirSizeBytes(dir: string): Promise<number> {
    let total = 0;
    try {
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) total += await this.dirSizeBytes(full);
        else if (e.isFile()) total += (await fsp.stat(full)).size;
      }
    } catch { /* best-effort */ }
    return total;
  }

  private async countFiles(dir: string): Promise<number> {
    let n = 0;
    try {
      const entries = await fsp.readdir(dir, { withFileTypes: true });
      for (const e of entries) {
        const full = path.join(dir, e.name);
        if (e.isDirectory()) n += await this.countFiles(full);
        else if (e.isFile()) n += 1;
      }
    } catch { /* best-effort */ }
    return n;
  }

  private computeSha256(filePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const h = crypto.createHash('sha256');
      const s = fs.createReadStream(filePath);
      s.on('error', reject);
      s.on('data', (c) => h.update(c));
      s.on('end', () => resolve(`sha256:${h.digest('hex')}`));
    });
  }

  private async readMagicOk(filePath: string): Promise<boolean> {
    let fh: fs.promises.FileHandle | null = null;
    try {
      fh = await fsp.open(filePath, 'r');
      const buf = Buffer.alloc(16);
      const { bytesRead } = await fh.read(buf, 0, 16, 0);
      if (bytesRead < 16) return false;
      return buf.toString('utf8', 0, 15) === SQLITE_MAGIC && buf[15] === 0;
    } catch {
      return false;
    } finally {
      await fh?.close().catch(() => undefined);
    }
  }

  // ---------------------------------------------------------- introspection DB

  /**
   * Validation d'un fichier candidat via la connexion TypeORM existante (ATTACH + DETACH).
   * Pas de second driver better-sqlite3 : discipline single-writer préservée, aucun risque de
   * bundling natif, et PRAGMA integrity_check en lecture seule (verrou SHARED bref).
   */
  private async attachInspect(dbFile: string): Promise<{ tables: string[]; userVersion: number | null }> {
    const ds = AppDataSource.getInstance();
    if (dbFile.includes('\0')) throw new Error('INVALID_PATH');
    const literal = `'${dbFile.replace(/'/g, "''")}'`;
    await ds.query(`ATTACH DATABASE ${literal} AS __candidate`);
    try {
      const integ = (await ds.query('PRAGMA __candidate.integrity_check')) as Array<Record<string, unknown>>;
      const first = integ?.[0] ? Object.values(integ[0])[0] : null;
      if (String(first).toLowerCase() !== 'ok') throw new Error('INTEGRITY_CHECK_FAILED');
      const rows = (await ds.query(
        `SELECT name FROM __candidate.sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%'`
      )) as Array<{ name: string }>;
      const tables = rows.map((r) => String(r.name));
      let userVersion: number | null = null;
      try {
        const uv = (await ds.query('PRAGMA __candidate.user_version')) as Array<Record<string, unknown>>;
        if (uv?.[0]) userVersion = Number(Object.values(uv[0])[0]);
      } catch { /* best-effort */ }
      return { tables, userVersion };
    } finally {
      try { await ds.query('DETACH DATABASE __candidate'); } catch { /* best-effort */ }
    }
  }

  private async liveUserVersion(): Promise<number | null> {
    try {
      const rows = (await AppDataSource.getInstance().query('PRAGMA user_version')) as Array<Record<string, unknown>>;
      return rows?.[0] ? Number(Object.values(rows[0])[0]) : null;
    } catch {
      return null;
    }
  }

  private async liveEcoleId(): Promise<string | null> {
    try {
      const rows = (await AppDataSource.getInstance().query('SELECT id, name FROM school LIMIT 1')) as Array<{ id?: unknown; name?: unknown }>;
      if (rows?.[0]) return String(rows[0].id ?? rows[0].name ?? '');
      return null;
    } catch {
      return null;
    }
  }

  /** Snapshot cohérent via VACUUM INTO (hors transaction). Retry SQLITE_BUSY + backoff/jitter. */
  private async vacuumIntoSnapshot(snapshotPath: string): Promise<void> {
    const ds = AppDataSource.getInstance();
    if (snapshotPath.includes('\0')) throw new Error('INVALID_PATH');
    const literal = `'${snapshotPath.replace(/'/g, "''")}'`;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < VACUUM_MAX_ATTEMPTS; attempt++) {
      try {
        await ds.query(`VACUUM INTO ${literal}`);
        return;
      } catch (e) {
        lastError = e;
        const msg = e instanceof Error ? e.message : String(e);
        const busy = /SQLITE_BUSY|database is locked/i.test(msg);
        if (!busy || attempt === VACUUM_MAX_ATTEMPTS - 1) throw e;
        await sleep(150 * 2 ** attempt + Math.floor(Math.random() * 100));
      }
    }
    throw lastError;
  }

  // ---------------------------------------------------------- create

  private uniqueName(prefix: string): string {
    let name = `${prefix}-${stamp()}.zip`;
    for (let i = 1; fs.existsSync(path.join(this.backupsDir, name)) && i < 100; i++) {
      name = `${prefix}-${stamp()}-${i}.zip`;
    }
    return name;
  }

  async createBackup(reason: BackupReason = 'manual'): Promise<Envelope<BackupInfo>> {
    if (this.isRestoring) return fail('RESTORE_IN_PROGRESS', 'Une restauration est en cours.');
    if (reason !== 'manual' && reason !== 'pre-restore' && reason !== 'pre-import') return fail('INVALID_REASON');
    let snapshotPath = '';
    try {
      if (!fs.existsSync(this.dbPath)) return fail('DB_NOT_FOUND', 'Base locale introuvable.');
      const prefix = reason === 'manual' ? 'backup' : reason;
      const name = this.uniqueName(prefix);
      const finalZip = path.join(this.backupsDir, name);
      const tmpZip = `${finalZip}.tmp`;

      snapshotPath = path.join(this.stagingDir, `snapshot-${Date.now()}-${process.pid}.db`);
      await this.vacuumIntoSnapshot(snapshotPath);
      const [dbStat, sha256, uploadsExists] = await Promise.all([
        fsp.stat(snapshotPath),
        this.computeSha256(snapshotPath),
        fsp.stat(this.uploadsDir).then((s) => s.isDirectory()).catch(() => false),
      ]);
      const fileCount = uploadsExists ? await this.countFiles(this.uploadsDir) : 0;

      await new Promise<void>((resolve, reject) => {
        const output = fs.createWriteStream(tmpZip);
        const archive = new ZipArchive({ zlib: { level: 6 } });
        output.on('close', () => resolve());
        output.on('error', reject);
        archive.on('error', reject);
        archive.on('warning', (w) => console.warn('[LocalBackup] archiver warning:', w));
        archive.pipe(output);
        archive.file(snapshotPath, { name: DB_FILENAME });
        if (uploadsExists) archive.directory(this.uploadsDir, UPLOADS_DIRNAME);
        archive.finalize().catch(reject);
      });

      const zipStat = await fsp.stat(tmpZip);
      const meta: BackupMeta = {
        createdAt: new Date().toISOString(),
        reason,
        size: zipStat.size,
        dbSize: dbStat.size,
        fileCount,
        appVersion: app.getVersion(),
        schemaVersion: await this.liveUserVersion(),
        ecoleId: await this.liveEcoleId(),
        origin: 'local',
        integrity: sha256,
      };
      await fsp.writeFile(`${finalZip}.meta.json.tmp`, JSON.stringify(meta, null, 2), 'utf8');
      // Rename atomique : le zip n'est visible par listBackups() qu'une fois complet.
      await fsp.rename(tmpZip, finalZip);
      await fsp.rename(`${finalZip}.meta.json.tmp`, `${finalZip}.meta.json`);

      return ok({ id: name, name, createdAt: meta.createdAt, size: meta.size, reason, meta });
    } catch (e) {
      console.error('[LocalBackup] createBackup:', e);
      return fail(e instanceof Error ? e.message : 'BACKUP_FAILED', 'Échec de la sauvegarde.');
    } finally {
      if (snapshotPath) await fsp.rm(snapshotPath, { force: true }).catch(() => undefined);
    }
  }

  // ---------------------------------------------------------- list / info

  async listBackups(): Promise<Envelope<{ backups: BackupInfo[]; totalSizeBytes: number; count: number }>> {
    try {
      const entries = await fsp.readdir(this.backupsDir);
      const infos: BackupInfo[] = [];
      let totalSizeBytes = 0;
      for (const entry of entries) {
        if (!entry.endsWith('.zip') || entry.endsWith('.tmp')) continue;
        if (entry !== path.basename(entry)) continue;
        const full = path.join(this.backupsDir, entry);
        let st: fs.Stats;
        try { st = await fsp.stat(full); } catch { continue; }
        if (!st.isFile()) continue;
        totalSizeBytes += st.size;
        let meta: BackupMeta | null = null;
        try {
          meta = JSON.parse(await fsp.readFile(`${full}.meta.json`, 'utf8')) as BackupMeta;
        } catch { /* sidecar absent (ancien/legacy) → best-effort */ }
        infos.push({
          id: entry,
          name: entry,
          createdAt: meta?.createdAt ?? st.mtime.toISOString(),
          size: st.size,
          reason: meta?.reason ?? 'manual',
          meta,
        });
      }
      infos.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
      return ok({ backups: infos, totalSizeBytes, count: infos.length });
    } catch (e) {
      console.error('[LocalBackup] listBackups:', e);
      return fail('LIST_FAILED');
    }
  }

  // Lecture seule : volontairement sans garde isRestoring (stat + lecture sidecar,
  // sans mutation). delete/export en revanche refusent pendant un restore à froid.
  async getBackupInfo(basename: string): Promise<Envelope<BackupInfo>> {
    try {
      const full = this.resolveBackupFile(basename);
      const st = await fsp.stat(full);
      if (!st.isFile()) return fail('NOT_FOUND');
      let meta: BackupMeta | null = null;
      try { meta = JSON.parse(await fsp.readFile(`${full}.meta.json`, 'utf8')) as BackupMeta; } catch { /* best-effort */ }
      return ok({ id: basename, name: basename, createdAt: meta?.createdAt ?? st.mtime.toISOString(), size: st.size, reason: meta?.reason ?? 'manual', meta });
    } catch (e) {
      const code = e instanceof Error ? e.message : 'INFO_FAILED';
      return fail(['INVALID_NAME'].includes(code) ? 'INVALID_NAME' : 'NOT_FOUND');
    }
  }

  // ---------------------------------------------------------- validate

  /**
   * Valide un fichier candidat : sanity taille → copie en staging → header magique
   * "SQLite format 3" → PRAGMA integrity_check=ok → tables cœur présentes.
   * Si zip : extraction confinée (extract-zip, zip-slip safe) + plafond anti zip-bomb.
   */
  async validateCandidate(candidatePath: string): Promise<Envelope<{ stagingDb: string; stagingUploads: string | null; preview: BackupPreview }>> {
    try {
      const abs = path.resolve(candidatePath);
      const st = await fsp.stat(abs);
      if (!st.isFile()) return fail('NOT_FOUND');
      if (st.size < MIN_DB_BYTES && !abs.toLowerCase().endsWith('.zip')) return fail('TOO_SMALL', 'Fichier trop petit pour une base SQLite.');
      if (st.size > MAX_CANDIDATE_BYTES) return fail('TOO_LARGE', 'Fichier trop volumineux.');

      const workDir = path.join(this.stagingDir, `validate-${Date.now()}-${process.pid}`);
      await fsp.mkdir(workDir, { recursive: true });
      const lower = abs.toLowerCase();
      let stagingDb: string;
      let stagingUploads: string | null = null;
      let kind: 'zip' | 'raw';

      if (lower.endsWith('.zip')) {
        kind = 'zip';
        await extract(abs, { dir: workDir });
        if ((await this.dirSizeBytes(workDir)) > MAX_CANDIDATE_BYTES) {
          await fsp.rm(workDir, { recursive: true, force: true });
          return fail('TOO_LARGE', 'Contenu décompressé trop volumineux.');
        }
        const rootDb = path.join(workDir, DB_FILENAME);
        if (!fs.existsSync(rootDb)) {
          await fsp.rm(workDir, { recursive: true, force: true });
          return fail('MISSING_DATABASE', 'Archive sans database.db à la racine.');
        }
        stagingDb = rootDb;
        const up = path.join(workDir, UPLOADS_DIRNAME);
        stagingUploads = fs.existsSync(up) ? up : null;
      } else {
        kind = 'raw';
        stagingDb = path.join(workDir, DB_FILENAME);
        await fsp.copyFile(abs, stagingDb);
      }

      const dbStat = await fsp.stat(stagingDb);
      if (dbStat.size < MIN_DB_BYTES || dbStat.size > MAX_CANDIDATE_BYTES) {
        await fsp.rm(workDir, { recursive: true, force: true });
        return fail('BAD_SIZE', 'Taille de base incohérente.');
      }
      if (!(await this.readMagicOk(stagingDb))) {
        await fsp.rm(workDir, { recursive: true, force: true });
        return fail('NOT_SQLITE', 'En-tête SQLite introuvable (SQLite format 3).');
      }

      let tables: string[] = [];
      let userVersion: number | null = null;
      try {
        ({ tables, userVersion } = await this.attachInspect(stagingDb));
      } catch (e) {
        await fsp.rm(workDir, { recursive: true, force: true });
        const code = e instanceof Error ? e.message : '';
        if (code === 'INTEGRITY_CHECK_FAILED') return fail('INTEGRITY_CHECK_FAILED', 'PRAGMA integrity_check non concluant.');
        throw e;
      }

      const lowerTables = new Set(tables.map((t) => t.toLowerCase()));
      const missing = REQUIRED_TABLES.filter((t) => !lowerTables.has(t));
      if (missing.length > 0) {
        await fsp.rm(workDir, { recursive: true, force: true });
        return fail('MISSING_TABLES', `Tables requises absentes : ${missing.join(', ')}.`);
      }
      // Garde élargie : tableCount < 20 → ERREUR bloquante (pas un warning seul).
      if (tables.length < WARN_TABLE_COUNT) {
        await fsp.rm(workDir, { recursive: true, force: true });
        return fail('TOO_FEW_TABLES', `Schéma incomplet : ${tables.length} tables seulement (attendu >= ${WARN_TABLE_COUNT}).`);
      }

      const live = await this.liveUserVersion();
      const missingUploads = !stagingUploads && kind === 'zip';
      const isDowngrade = userVersion !== null && live !== null && userVersion < live;
      const warnings: string[] = [];
      if (missingUploads) warnings.push('Archive sans dossier uploads/ (pièces jointes non restaurées) — confirmation requise.');
      if (userVersion !== null && live !== null && userVersion !== live) {
        warnings.push(
          isDowngrade
            ? `Downgrade schéma détecté (candidat ${userVersion} < live ${live}) — confirmation requise.`
            : `user_version différent (${userVersion} vs live ${live}) — migration/sync à prévoir.`,
        );
      }

      const preview: BackupPreview = {
        kind,
        dbSize: dbStat.size,
        tableCount: tables.length,
        userVersion,
        liveUserVersion: live,
        hasUploads: stagingUploads !== null,
        missingUploads,
        isDowngrade,
        sha256: await this.computeSha256(stagingDb),
        warnings,
      };
      return ok({ stagingDb, stagingUploads, preview });
    } catch (e) {
      console.error('[LocalBackup] validateCandidate:', e);
      return fail(e instanceof Error ? e.message : 'VALIDATION_FAILED');
    }
  }

  // ---------------------------------------------------------- remplacement à froid

  /**
   * Remplacement à froid : DataSource.destroy() (libère le handle better-sqlite3 — SQLite
   * interdit le swap d'un fichier ouvert en écriture), copie DB, bascule uploads avec
   * rollback sur échec, puis RÉOUVERTURE immédiate de la DataSource sur le nouveau fichier.
   *
   * La réouverture est obligatoire même en dev : le chemin dev ne fait qu'un reload
   * fenêtre (pas de `app.relaunch()+exit`, Vite :5173 doit rester vivant) donc aucun
   * `initialize()` au boot ne suit ; sans `reinitialize()` ici, `getSchool()` et tous
   * les repositories échouent avec `database connection is not open`. Le safety zip
   * pré-restore/pré-import reste le filet en cas d'échec du reopen (erreur propagée,
   * `isRestoring` remis à false par l'appelant).
   */
  private async replaceDbAndUploads(stagingDb: string, stagingUploads: string | null): Promise<void> {
    const ds = AppDataSource.getInstance();
    if (ds.isInitialized) await ds.destroy();

    // Écriture atomique DB : copie vers database.db.tmp-<pid> + fsync + rename().
    // Jamais d'écrasement en place (fsp.copyFile direct) : un crash mid-copy ne doit
    // jamais laisser database.db tronquée. Même pattern que le zip (.tmp -> rename).
    const tmpDb = `${this.dbPath}.tmp-${process.pid}`;
    try {
      await fsp.copyFile(stagingDb, tmpDb);
      const fh = await fsp.open(tmpDb, 'r+');
      try {
        await fh.sync();
      } finally {
        await fh.close().catch(() => undefined);
      }
      await fsp.rename(tmpDb, this.dbPath);
    } catch (e) {
      await fsp.rm(tmpDb, { force: true }).catch(() => undefined);
      throw e;
    }

    if (stagingUploads) {
      // Uploads : déjà atomique via rename() (uploads -> .bak, staging -> uploads),
      // avec rollback sur échec. Pas de copie en place.
      const bak = `${this.uploadsDir}.bak-${Date.now()}`;
      const hadUploads = fs.existsSync(this.uploadsDir);
      try {
        if (hadUploads) await fsp.rename(this.uploadsDir, bak);
        await fsp.rename(stagingUploads, this.uploadsDir);
        if (hadUploads) await fsp.rm(bak, { recursive: true, force: true });
      } catch (e) {
        // Rollback uploads, la DB reste remplacée (safety zip = filet de dernier recours).
        try {
          if (fs.existsSync(this.uploadsDir)) await fsp.rm(this.uploadsDir, { recursive: true, force: true });
          if (hadUploads) await fsp.rename(bak, this.uploadsDir);
        } catch { /* best-effort */ }
        throw e;
      }
    }

    // Réouverture sur le NOUVEAU database.db avant de rendre la main : le renderer
    // peut appeler school:get immédiatement après le success (avant le reload fenêtre
    // en dev). Sans cela, connexion détruite → `database connection is not open`.
    try {
      await AppDataSource.reinitialize();
      console.log('[LocalBackup] DataSource réouverte après remplacement à froid.');
    } catch (e) {
      console.error('[LocalBackup] Réouverture DataSource impossible après remplacement:', e);
      throw e;
    }
    // Les services métier capturent leurs repositories au boot (constructeur) :
    // après destroy + nouvelle DataSource, ils pointeraient vers la connexion
    // détruite (ancienne DB vide) → getAll vide / getCurrent null malgré le
    // fichier importé sur disque. Le dev-reload ne rebootant pas le backend,
    // on re-crée les services ici (hook posé par main.ts, sans import circulaire).
    this.refreshBoundServices();
  }

  /**
   * Re-crée les services liés à la DataSource après un remplacement à froid.
   * Sans cela, `yearRepartition:getAll` pré-login (et login/auth) interroge
   * l'ancienne connexion détruite → liste vide → « Aucune année ouverte ».
   */
  private refreshBoundServices(): void {
    try {
      const hook = (global as unknown as { refreshServicesAfterDbReplace?: unknown }).refreshServicesAfterDbReplace;
      if (typeof hook === 'function') {
        (hook as () => void)();
        console.log('[LocalBackup] Services métier re-liés à la nouvelle DB.');
        return;
      }
    } catch (e) {
      console.error('[LocalBackup] refreshBoundServices via hook impossible:', e);
    }
    // Repli (tests / hook absent) : au minimum les lectures pré-login + login
    // utilisent des repositories paresseux (year/school/auth), donc aucune action
    // supplémentaire n'est strictement requise ici.
  }

  /**
   * Post-import/restore (même processus, sans reboot en dev-reload) : garantit
   * que la liste pré-login voit les années du zip et que la plus récente
   * OUVERTE devient courante (activation d'existant, jamais de création).
   * Log explicite exigé : `Import OK : X années, Y élèves`.
   */
  private async activateImportedYear(reason: 'import' | 'restore'): Promise<void> {
    try {
      const ds = AppDataSource.getInstance();
      const countTable = async (table: string): Promise<number | null> => {
        try {
          const rows = (await ds.query(`SELECT COUNT(*) AS n FROM "${table}"`)) as Array<{ n?: unknown }>;
          const n = Number(rows?.[0]?.n);
          return Number.isFinite(n) ? n : null;
        } catch {
          return null;
        }
      };
      let years: Array<{ schoolYear?: unknown; isCurrent?: unknown; status?: unknown }> = [];
      try {
        const rows = (await ds.query('SELECT schoolYear, isCurrent, status FROM year_repartition ORDER BY schoolYear DESC')) as typeof years;
        if (Array.isArray(rows)) years = rows;
      } catch { /* table absente → compte 0 ci-dessous */ }
      // Activation : la plus récente OUVERTE devient courante (idempotent,
      // no-op si déjà une courante / DB vide / tout clôturé).
      let current: string | null = null;
      try {
        const svc = (global as unknown as { yearRepartitionService?: { ensureOneCurrentAfterImport?: (d: Date) => Promise<{ data?: { schoolYear?: string } | null }> } }).yearRepartitionService;
        const ensured = await svc?.ensureOneCurrentAfterImport?.(new Date());
        current = ensured?.data?.schoolYear ?? null;
      } catch (e) {
        console.warn('[LocalBackup] ensureOneCurrentAfterImport impossible (poursuite sans année) :', (e as Error)?.message ?? e);
      }
      if (!current) {
        const flagged = years.find((y) => (y as { isCurrent?: unknown }).isCurrent === 1 || (y as { isCurrent?: unknown }).isCurrent === true);
        current = typeof flagged?.schoolYear === 'string' ? flagged.schoolYear : null;
      }
      const students = await countTable('T_student');
      const payments = await countTable('payments');
      const label = (v: number | null) => (v === null ? '?' : String(v));
      console.log(
        `[LocalBackup] Import OK : ${years.length} années, ${label(students)} élèves, ${label(payments)} payments` +
        (current ? `, courante=${current}` : ' (aucune courante)') +
        ` (${reason}).`
      );
    } catch (e) {
      console.warn('[LocalBackup] activateImportedYear (non bloquant):', (e as Error)?.message ?? e);
    }
  }

  /**
   * Invalidation des curseurs sync après restore/import.
   *
   * Pourquoi : la base restaurée est un snapshot antérieur (ou externe). Les curseurs de sync
   * sont dérivés de l'historique LOCAL (getLastSyncTimestamp → max sync_ended_at des succès) et
   * filtrent le pull (`updated_at > since`) comme le push (`remote_id IS NULL OR updated_at >
   * since`). Sans invalidation, `since` pointerait vers un futur inconnu de cette base :
   * les lignes créées côté cloud après le snapshot ne seraient jamais rapatriées et les lignes
   * locales ressuscitées seraient repoussées en double → divergence silencieuse.
   *
   * Effet : purge du cache d'historique LOCAL uniquement (`*_sync_history.json`) + marqueur
   * `restore_marker.json` (traçabilité : date, raison, safety backup). Le prochain sync repart
   * de l'epoch → resync complète bidirectionnelle (convergence par état, last-write-wins sur
   * updated_at, push des remote_id NULL). L'historique serveur (table Supabase sync_history)
   * et la config utilisateur (sync_config.json : préférences autoSync/intervalle) sont conservés.
   */
  private async invalidateSyncCursors(reason: BackupReason, safetyBackup: string): Promise<void> {
    try {
      if (fs.existsSync(this.syncHistoryDir)) {
        for (const entry of await fsp.readdir(this.syncHistoryDir)) {
          if (entry.endsWith('_sync_history.json')) {
            await fsp.rm(path.join(this.syncHistoryDir, entry), { force: true }).catch(() => undefined);
          }
        }
      } else {
        await fsp.mkdir(this.syncHistoryDir, { recursive: true });
      }
      await fsp.writeFile(
        path.join(this.syncHistoryDir, 'restore_marker.json'),
        JSON.stringify({ restoredAt: new Date().toISOString(), reason, safetyBackup }, null, 2),
        'utf8'
      );
      console.log(`[LocalBackup] Curseurs sync invalidés (${reason}) — prochain sync complet.`);
    } catch (e) {
      console.error('[LocalBackup] invalidateSyncCursors (non bloquant):', e);
    }
  }

  private isDevReloadPath(): boolean {
    // Dev (Vite :5173) : `app.relaunch()` relance l'exe SANS le serveur Vite →
    // `ERR_CONNECTION_REFUSED` sur http://localhost:5173/ (Process exit 0).
    // En dev on recharge donc la fenêtre (loadURL dev / reload) et on ne quitte jamais.
    try {
      if (process.env.VITE_DEV_SERVER_URL) return true;
      if (process.env.NODE_ENV === 'development') return true;
      // `app.isPackaged === false` = dev electron, mais les tests vitest tournent
      // avec `NODE_ENV=test` / `VITEST` → doivent garder le chemin prod (relaunch mocké).
      if (process.env.VITEST) return false;
      if (process.env.NODE_ENV === 'test') return false;
      const packaged = (app as unknown as { isPackaged?: unknown })?.isPackaged;
      if (packaged === false) return true;
    } catch { /* fail-closed vers relaunch prod */ }
    return false;
  }

  private relaunch(message: string): { devReload: boolean } {
    if (this.isDevReloadPath()) {
      console.log(`[LocalBackup] ${message} — dev : reload fenêtre (pas de relaunch, Vite 5173 vivant). Redémarrez manuellement si besoin.`);
      // setImmediate : laisse la réponse IPC être flushée vers le renderer avant le reload.
      setImmediate(() => {
        try {
          const wins = BrowserWindow.getAllWindows?.() ?? [];
          const devUrl = process.env.VITE_DEV_SERVER_URL;
          let reloaded = false;
          for (const w of wins) {
            try {
              if (w.isDestroyed()) continue;
              if (devUrl) void w.loadURL(devUrl);
              else w.reload();
              reloaded = true;
            } catch { /* best-effort par fenêtre */ }
          }
          if (!reloaded) {
            console.log('[LocalBackup] Dev : aucune fenêtre à recharger — redémarrage manuel requis (relancez la commande dev).');
          }
        } catch (e) {
          console.error('[LocalBackup] reload dev impossible (redémarrez manuellement):', e);
        }
      });
      return { devReload: true };
    }
    console.log(`[LocalBackup] ${message} — relaunch.`);
    // setImmediate : laisse la réponse IPC être flushée vers le renderer avant le restart.
    setImmediate(() => { app.relaunch(); app.exit(0); });
    return { devReload: false };
  }

  /**
   * Vérifie le sha sidecar (.meta.json → integrity) quand présent.
   * Legacy sans sidecar → skip best-effort. Mismatch → SHA_MISMATCH bloquant.
   */
  private async verifySidecarSha(backupZipPath: string, stagingDb: string): Promise<void> {
    let raw: string;
    try {
      raw = await fsp.readFile(`${backupZipPath}.meta.json`, 'utf8');
    } catch {
      return; // sidecar absent (ancien/legacy) → skip
    }
    try {
      const meta = JSON.parse(raw) as { integrity?: unknown };
      if (!meta || typeof meta.integrity !== 'string' || meta.integrity.length === 0) return;
      const actual = await this.computeSha256(stagingDb);
      if (actual !== meta.integrity) throw new Error('SHA_MISMATCH');
    } catch (e) {
      if (e instanceof Error && e.message === 'SHA_MISMATCH') throw e;
      return; // sidecar corrompu/illisible → skip best-effort (legacy), pas de faux blocage
    }
  }

  // ---------------------------------------------------------- restore

  async restoreBackup(basename: string, confirmed: boolean, options?: ConfirmOptions): Promise<Envelope<RelaunchResult>> {
    if (confirmed !== true) return fail('NEED_CONFIRMATION', 'Restauration non confirmée.');
    let full: string;
    try { full = this.resolveBackupFile(basename); } catch { return fail('INVALID_NAME'); }
    if (this.isRestoring) return fail('RESTORE_IN_PROGRESS');
    if (!fs.existsSync(full)) return fail('NOT_FOUND');

    // Safety-copy AVANT le flag : createBackup refuse tout pendant isRestoring.
    const safety = await this.createBackup('pre-restore');
    if (!safety.success || !safety.data) return fail('SAFETY_BACKUP_FAILED', 'Sauvegarde de sécurité impossible — restauration annulée.');

    this.isRestoring = true;
    let workDir: string | null = null;
    try {
      workDir = path.join(this.stagingDir, `restore-${Date.now()}-${process.pid}`);
      await fsp.mkdir(workDir, { recursive: true });
      await extract(full, { dir: workDir });
      if ((await this.dirSizeBytes(workDir)) > MAX_CANDIDATE_BYTES) throw new Error('TOO_LARGE');
      const stagingDb = path.join(workDir, DB_FILENAME);
      if (!fs.existsSync(stagingDb)) throw new Error('MISSING_DATABASE');
      if (!(await this.readMagicOk(stagingDb))) throw new Error('NOT_SQLITE');
      // Sidecar sha quand présent (intégrité du snapshot au moment du backup).
      await this.verifySidecarSha(full, stagingDb);
      const { tables, userVersion } = await this.attachInspect(stagingDb);
      const lowerTables = new Set(tables.map((t) => t.toLowerCase()));
      const missing = REQUIRED_TABLES.filter((t) => !lowerTables.has(t));
      if (missing.length > 0) throw new Error('MISSING_TABLES');
      if (tables.length < WARN_TABLE_COUNT) throw new Error('TOO_FEW_TABLES');

      const up = path.join(workDir, UPLOADS_DIRNAME);
      const hasUploads = fs.existsSync(up);
      // Confirmations bloquantes distinctes : uploads orphelins / downgrade user_version.
      if (!hasUploads && options?.acknowledgeMissingUploads !== true) throw new Error('NEED_CONFIRM_MISSING_UPLOADS');
      const live = await this.liveUserVersion();
      if (userVersion !== null && live !== null && userVersion < live && options?.acknowledgeDowngrade !== true) {
        throw new Error('NEED_CONFIRM_DOWNGRADE');
      }

      await this.replaceDbAndUploads(stagingDb, hasUploads ? up : null);
      // Même processus (dev-reload sans reboot) : la liste pré-login doit voir
      // les années du zip et la plus récente ouverte devient courante.
      await this.activateImportedYear('restore');
      await this.invalidateSyncCursors('pre-restore', safety.data.id);
      // Connexion réouverte par replaceDbAndUploads : le main reste vivant en dev
      // (reload fenêtre) comme en prod (relaunch différé via setImmediate) — les
      // appels suivants (school:get, audits) doivent retrouver une DB ouverte.
      this.isRestoring = false;
      const { devReload } = this.relaunch(`restore ${basename}`);
      return ok({ relaunching: true, safetyBackup: safety.data.id, ...(devReload ? { devReload: true as const } : {}) });
    } catch (e) {
      console.error('[LocalBackup] restoreBackup:', e);
      // QA-1 : nettoyage staging en échec (même pattern que validateCandidate),
      // sinon chaque restore raté laisse un workDir orphelin (DB extraite sur disque).
      if (workDir) await fsp.rm(workDir, { recursive: true, force: true }).catch(() => undefined);
      this.isRestoring = false;
      return fail(e instanceof Error ? e.message : 'RESTORE_FAILED', 'Restauration impossible (backup corrompu ou incompatible).');
    }
  }

  // ---------------------------------------------------------- import externe (2 temps)

  async previewImport(): Promise<Envelope<{ canceled: boolean; stagingPath?: string; fileName?: string; sourcePath?: string; preview?: BackupPreview; warnings?: string[] }>> {
    if (this.isRestoring) return fail('RESTORE_IN_PROGRESS');
    try {
      // Fenêtre parente : en onboarding (ConfigurationWizard) getFocusedWindow()
      // peut être null au tout premier tick ; on retombe sur la 1re fenêtre,
      // sinon dialog non-modal (sans parent) — jamais de blocage silencieux.
      const parent = (() => {
        try {
          const focused = BrowserWindow?.getFocusedWindow?.();
          if (focused && !focused.isDestroyed()) return focused;
          const all = BrowserWindow?.getAllWindows?.() ?? [];
          return all.find((w) => !w.isDestroyed()) ?? undefined;
        } catch {
          return undefined;
        }
      })();
      const options = {
        title: 'Choisir le fichier .zip de sauvegarde à importer',
        message: 'Choisissez explicitement le fichier .zip de sauvegarde eSchool à importer.',
        buttonLabel: 'Choisir ce fichier',
        properties: ['openFile', 'dontAddToRecent'] as Array<'openFile' | 'dontAddToRecent'>,
        filters: [
          { name: 'Bases & archives', extensions: ['zip', 'db', 'sqlite', 'sqlite3', 'bak'] },
          { name: 'Archives zip', extensions: ['zip'] },
          { name: 'Bases SQLite', extensions: ['db', 'sqlite', 'sqlite3'] },
          { name: 'Tous fichiers', extensions: ['*'] },
        ],
      };
      const res = parent
        ? await dialog.showOpenDialog(parent, options)
        : await dialog.showOpenDialog(options);
      if (res.canceled || res.filePaths.length === 0) return ok({ canceled: true });
      const picked = res.filePaths[0];
      // validateCandidate ne fait que lire le fichier choisi (stat + copie en staging),
      // jamais d'écriture sur le fichier utilisateur.
      const v = await this.validateCandidate(picked);
      if (!v.success || !v.data) {
        return fail(v.error ?? 'VALIDATION_FAILED', v.message);
      }
      return ok({
        canceled: false,
        stagingPath: v.data.stagingDb,
        fileName: path.basename(picked),
        sourcePath: picked,
        preview: v.data.preview,
        warnings: v.data.preview.warnings,
      });
    } catch (e) {
      console.error('[LocalBackup] previewImport:', e);
      return fail(e instanceof Error ? e.message : 'IMPORT_PREVIEW_FAILED');
    }
  }

  async confirmImport(stagingPath: string, confirmed: boolean, options?: ConfirmOptions): Promise<Envelope<RelaunchResult>> {
    if (confirmed !== true) return fail('NEED_CONFIRMATION', 'Import non confirmé.');
    let stagingDb: string;
    try { stagingDb = this.resolveStagingPath(stagingPath); } catch { return fail('INVALID_STAGING_PATH'); }
    if (this.isRestoring) return fail('RESTORE_IN_PROGRESS');
    if (!fs.existsSync(stagingDb)) return fail('STAGING_EXPIRED', 'Fichier de staging expiré — recommencez l’import.');

    const safety = await this.createBackup('pre-import');
    if (!safety.success || !safety.data) return fail('SAFETY_BACKUP_FAILED', 'Sauvegarde de sécurité impossible — import annulé.');

    this.isRestoring = true;
    try {
      // Re-validation au commit (le staging peut avoir vieilli entre preview et confirm).
      if (!(await this.readMagicOk(stagingDb))) throw new Error('NOT_SQLITE');
      const { tables, userVersion } = await this.attachInspect(stagingDb);
      const lowerTables = new Set(tables.map((t) => t.toLowerCase()));
      const missing = REQUIRED_TABLES.filter((t) => !lowerTables.has(t));
      if (missing.length > 0) throw new Error('MISSING_TABLES');
      if (tables.length < WARN_TABLE_COUNT) throw new Error('TOO_FEW_TABLES');

      const workDir = path.dirname(stagingDb);
      const up = path.join(workDir, UPLOADS_DIRNAME);
      const hasUploads = fs.existsSync(up);
      if (!hasUploads && options?.acknowledgeMissingUploads !== true) throw new Error('NEED_CONFIRM_MISSING_UPLOADS');
      const live = await this.liveUserVersion();
      if (userVersion !== null && live !== null && userVersion < live && options?.acknowledgeDowngrade !== true) {
        throw new Error('NEED_CONFIRM_DOWNGRADE');
      }

      await this.replaceDbAndUploads(stagingDb, hasUploads ? up : null);
      // Même processus (dev-reload sans reboot) : la liste pré-login doit voir
      // les années du zip et la plus récente ouverte devient courante.
      await this.activateImportedYear('import');
      await this.invalidateSyncCursors('pre-import', safety.data.id);
      // Même raison que restoreBackup : connexion déjà réouverte, le flag ne doit
      // pas survivre au success sinon le main (toujours vivant en devReload) reste
      // bloqué en RESTORE_IN_PROGRESS et les audits restent en fail-soft.
      this.isRestoring = false;
      const { devReload } = this.relaunch('import externe');
      return ok({ relaunching: true, safetyBackup: safety.data.id, ...(devReload ? { devReload: true as const } : {}) });
    } catch (e) {
      console.error('[LocalBackup] confirmImport:', e);
      this.isRestoring = false;
      return fail(e instanceof Error ? e.message : 'IMPORT_FAILED', 'Import impossible.');
    }
  }

  // ---------------------------------------------------------- delete / reveal / export

  async deleteBackup(basename: string): Promise<Envelope<{ deleted: string }>> {
    if (this.isRestoring) return fail('RESTORE_IN_PROGRESS', 'Une restauration est en cours.');
    try {
      const full = this.resolveBackupFile(basename);
      await fsp.unlink(full);
      await fsp.unlink(`${full}.meta.json`).catch(() => undefined);
      return ok({ deleted: basename }, 'Sauvegarde supprimée.');
    } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      if (msg === 'INVALID_NAME') return fail('INVALID_NAME');
      return fail('NOT_FOUND', 'Sauvegarde introuvable.');
    }
  }

  async revealBackup(basename: string): Promise<Envelope<{ revealed: boolean }>> {
    try {
      const full = this.resolveBackupFile(basename);
      if (!fs.existsSync(full)) return fail('NOT_FOUND');
      shell.showItemInFolder(full);
      return ok({ revealed: true });
    } catch {
      return fail('INVALID_NAME');
    }
  }

  async exportBackup(basename: string): Promise<Envelope<{ canceled: boolean; exportedTo?: string }>> {
    if (this.isRestoring) return fail('RESTORE_IN_PROGRESS', 'Une restauration est en cours.');
    try {
      const full = this.resolveBackupFile(basename);
      if (!fs.existsSync(full)) return fail('NOT_FOUND');
      const res = await dialog.showSaveDialog({
        title: 'Exporter la sauvegarde',
        defaultPath: basename,
        filters: [{ name: 'Archives zip', extensions: ['zip'] }],
      });
      if (res.canceled || !res.filePath) return ok({ canceled: true });
      await fsp.copyFile(full, res.filePath);
      try { await fsp.copyFile(`${full}.meta.json`, `${res.filePath}.meta.json`); } catch { /* best-effort */ }
      return ok({ canceled: false, exportedTo: res.filePath }, 'Sauvegarde exportée.');
    } catch {
      return fail('INVALID_NAME');
    }
  }
}

/**
 * Singleton paresseux — la construction touche app.getPath('userData') (interdit avant
 * app.ready), donc jamais d'instanciation au import-time. main.ts l'initialise dans
 * initializeServices(), après AppDataSource.initialize().
 */
let instance: LocalBackupService | null = null;
export function getLocalBackupService(): LocalBackupService {
  if (!instance) instance = new LocalBackupService();
  return instance;
}
