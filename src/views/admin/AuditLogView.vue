<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { format } from 'date-fns'
import { Icon } from '@iconify/vue'
import type { UserRole } from '@/types/user'
import { roleLabel, roleTagType } from '@/constants/userOptions'
import { useUserStore } from '@/stores/userStore'

const router = (() => {
  try {
    return useRouter()
  } catch {
    return null
  }
})()
const userStore = (() => {
  try {
    return useUserStore()
  } catch {
    return null
  }
})()

/**
 * Vrai si l'erreur signale une session expirée / interdite côté backend.
 */
function isSessionExpired(error: unknown): boolean {
  const raw = error instanceof Error ? error.message : String((error as { message?: unknown })?.message ?? error)
  return raw.includes('UNAUTHENTICATED') || raw.includes('FORBIDDEN')
}

/** Purge la session locale et redirige vers /login (best-effort en test/dev). */
async function handleSessionExpired(): Promise<void> {
  ElMessage.warning('Session expirée, reconnectez-vous')
  try {
    userStore?.clear()
  } catch {
    /* ignore : store indisponible (test) */
  }
  try {
    localStorage.removeItem('user')
    sessionStorage.removeItem('user')
  } catch {
    /* ignore : stockage indisponible */
  }
  try {
    await router?.replace('/login')?.catch(() => {})
  } catch {
    /* ignore : router indisponible (test) */
  }
}

// ---------------------------------------------------------------------------
// Types locaux (forme renvoyée par audit:list)
// ---------------------------------------------------------------------------
interface AuditEntry {
  id: number
  actorUserId?: number | null
  actorUsername?: string | null
  actorDisplayName?: string | null
  actorRole?: UserRole | null
  action?: string
  targetEntity?: string | null
  targetId?: number | string | null
  summary?: string | null
  createdAt?: string | null
  timestamp?: string | null
  details?: unknown
  diff?: unknown
  metadata?: unknown
  changes?: unknown
  // Formes imbriquées possibles (selon le backend)
  user?: { id: number; username?: string; displayName?: string | null; role?: UserRole } | null
  actor?: { id: number; username?: string; displayName?: string | null; role?: UserRole } | null
  entity?: { id?: number | string; type?: string; name?: string | null } | null
}

interface ListResponse {
  items: AuditEntry[]
  total: number
}

// ---------------------------------------------------------------------------
// Libellés français (filtres + affichage)
// ---------------------------------------------------------------------------
const ACTION_LABELS: Record<string, string> = {
  create: 'Création',
  update: 'Modification',
  delete: 'Suppression',
  login: 'Connexion',
  logout: 'Déconnexion',
  password_reset: 'Réinitialisation mot de passe',
  status_change: 'Changement de statut',
  system: 'Système',
}

const ACTION_TAG_TYPES: Record<string, 'success' | 'warning' | 'danger' | 'primary' | 'info'> = {
  create: 'success',
  update: 'warning',
  delete: 'danger',
  login: 'primary',
  logout: 'info',
  password_reset: 'warning',
  status_change: 'info',
  system: 'info',
}

const ENTITY_LABELS: Record<string, string> = {
  Student: 'Élève',
  Professor: 'Professeur',
  Payment: 'Paiement',
  User: 'Utilisateur',
  Course: 'Matière',
  Grade: 'Niveau',
  Absence: 'Absence',
  Homework: 'Devoir',
  Vacation: 'Congé',
  School: 'École',
  GradeEntry: 'Notes',
  DocumentContent: 'Document',
}

// ---------------------------------------------------------------------------
// État
// ---------------------------------------------------------------------------
const loading = ref(false)
const items = ref<AuditEntry[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)

const loadingUsers = ref(false)
const userOptions = ref<{ id: number; username: string; displayName: string | null }[]>([])

const filters = reactive({
  actorUserId: null as number | null,
  action: '',
  targetEntity: '',
  dateRange: null as [string, string] | null,
})

// ---------------------------------------------------------------------------
// Chargement du journal
// ---------------------------------------------------------------------------
function buildFilters(): Record<string, unknown> {
  const payload: Record<string, unknown> = {}
  if (filters.actorUserId) payload.actorUserId = filters.actorUserId
  if (filters.action) payload.action = filters.action
  if (filters.targetEntity) payload.targetEntity = filters.targetEntity
  if (filters.dateRange && filters.dateRange[0] && filters.dateRange[1]) {
    // La base SQLite stocke les dates au format local 'YYYY-MM-DD HH:mm:ss'
    // et le backend compare via des chaînes : on envoie donc les valeurs
    // brutes du picker (value-format identique), et on repousse la borne
    // haute à 23:59:59 pour inclure tout le dernier jour sélectionné.
    payload.from = filters.dateRange[0]
    payload.to = `${filters.dateRange[1].slice(0, 10)} 23:59:59`
  }
  return payload
}

async function loadAudit() {
  loading.value = true
  try {
    const result = await window.ipcRenderer.invoke('audit:list', {
      page: page.value,
      pageSize: pageSize.value,
      filters: buildFilters(),
    })
    if (result?.success === false) {
      throw new Error(result.message || result.error || 'Erreur lors du chargement du journal')
    }
    const data = (result?.data ?? { items: [], total: 0 }) as ListResponse
    items.value = Array.isArray(data) ? data : data.items ?? []
    total.value = Array.isArray(data) ? data.length : data.total ?? 0
  } catch (error) {
    if (isSessionExpired(error)) {
      await handleSessionExpired()
      return
    }
    ElMessage.error(error instanceof Error ? error.message : 'Erreur lors du chargement du journal')
    console.error('Erreur lors du chargement du journal:', error)
  } finally {
    loading.value = false
  }
}

function handlePageChange(p: number) {
  page.value = p
  loadAudit()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  loadAudit()
}

function applyFilters() {
  page.value = 1
  loadAudit()
}

function resetFilters() {
  filters.actorUserId = null
  filters.action = ''
  filters.targetEntity = ''
  filters.dateRange = null
  page.value = 1
  loadAudit()
}

// ---------------------------------------------------------------------------
// Options utilisateurs pour le filtre (users:list)
// ---------------------------------------------------------------------------
async function loadUserOptions() {
  loadingUsers.value = true
  try {
    const result = await window.ipcRenderer.invoke('users:list', {
      page: 1,
      pageSize: 1000,
      search: '',
    })
    if (result?.success === false) {
      if (isSessionExpired(result?.message ?? result?.error)) {
        await handleSessionExpired()
      }
      return
    }
    const data = result?.data ?? { items: [] }
    const list = (Array.isArray(data) ? data : data.items ?? []) as Array<{
      id: number
      username: string
      displayName?: string | null
    }>
    userOptions.value = list.map((u) => ({
      id: u.id,
      username: u.username,
      displayName: u.displayName ?? null,
    }))
  } catch (error) {
    if (isSessionExpired(error)) {
      await handleSessionExpired()
    }
    // Sinon silencieux : le filtre reste vide si le chargement des utilisateurs échoue
  } finally {
    loadingUsers.value = false
  }
}

// ---------------------------------------------------------------------------
// Formatage / affichage (tolérant aux formes renvoyées par le backend)
// ---------------------------------------------------------------------------
function entryActorName(row: AuditEntry): string {
  return (
    row.actorUsername ??
    row.actor?.username ??
    row.user?.username ??
    row.actorDisplayName ??
    row.actor?.displayName ??
    'Utilisateur inconnu'
  )
}

function entryActorRole(row: AuditEntry): UserRole | null {
  return row.actorRole ?? row.actor?.role ?? row.user?.role ?? null
}

function entryAction(row: AuditEntry): string {
  return row.action ?? '—'
}

function entryEntity(row: AuditEntry): string {
  if (row.targetEntity) return row.targetEntity
  return row.entity?.type ?? row.entity?.name ?? '—'
}

function entryCreatedAt(row: AuditEntry): string {
  const value = row.createdAt ?? row.timestamp
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'dd/MM/yyyy HH:mm:ss')
}

function entrySummary(row: AuditEntry): string {
  return row.summary ?? '—'
}

function entryDetails(row: AuditEntry): unknown {
  return row.details ?? row.diff ?? row.metadata ?? row.changes ?? null
}

function prettyDetails(row: AuditEntry): string {
  const details = entryDetails(row)
  if (details === null || details === undefined) return 'Aucun détail'
  try {
    return JSON.stringify(details, null, 2)
  } catch {
    return String(details)
  }
}

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action
}

function actionTagType(action: string): 'success' | 'warning' | 'danger' | 'primary' | 'info' {
  return ACTION_TAG_TYPES[action] ?? 'info'
}

function entityLabel(entity: string): string {
  return ENTITY_LABELS[entity] ?? entity
}

onMounted(() => {
  loadAudit()
  loadUserOptions()
})
</script>

<template>
  <div class="admin-view">
    <el-space direction="vertical" fill="fill" size="large" style="width: 100%">
      <!-- En-tête -->
      <div class="view-header">
        <el-space size="large">
          <Icon width="28" icon="mdi:clipboard-text-clock" color="var(--el-color-primary)" />
          <el-text type="primary" class="title-text">Journal d'activité</el-text>
        </el-space>
      </div>

      <!-- Barre de filtres -->
      <el-card shadow="never" class="audit-filters-card">
        <el-form inline class="filters-bar" @submit.prevent>
          <el-form-item label="Utilisateur" class="filter-field">
            <el-select
              v-model="filters.actorUserId"
              placeholder="Tous les utilisateurs"
              clearable
              filterable
              :loading="loadingUsers"
              class="filter-control"
            >
              <el-option
                v-for="u in userOptions"
                :key="u.id"
                :label="u.displayName ? `${u.username} (${u.displayName})` : u.username"
                :value="u.id"
              />
            </el-select>
          </el-form-item>

          <el-form-item label="Action" class="filter-field">
            <el-select
              v-model="filters.action"
              placeholder="Toutes les actions"
              clearable
              class="filter-control"
            >
              <el-option v-for="(label, value) in ACTION_LABELS" :key="value" :label="label" :value="value" />
            </el-select>
          </el-form-item>

          <el-form-item label="Entité" class="filter-field">
            <el-select
              v-model="filters.targetEntity"
              placeholder="Toutes les entités"
              clearable
              filterable
              allow-create
              default-first-option
              class="filter-control"
            >
              <el-option v-for="(label, value) in ENTITY_LABELS" :key="value" :label="label" :value="value" />
            </el-select>
          </el-form-item>

          <el-form-item label="Période" class="filter-field filter-field--date">
            <el-date-picker
              v-model="filters.dateRange"
              type="daterange"
              range-separator="→"
              start-placeholder="Début"
              end-placeholder="Fin"
              value-format="YYYY-MM-DD HH:mm:ss"
              class="filter-control filter-control--date"
            />
          </el-form-item>

          <el-form-item class="filter-actions">
            <div class="filter-actions__inner">
              <el-button type="primary" @click="applyFilters">
                <template #icon><Icon icon="mdi:filter-variant" /></template>
                Filtrer
              </el-button>
              <el-button @click="resetFilters">
                <template #icon><Icon icon="mdi:refresh" /></template>
                Réinitialiser
              </el-button>
            </div>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- Tableau -->
      <el-card shadow="never" class="audit-table-card">
        <div class="audit-table-wrapper">
          <el-table :data="items" v-loading="loading" border stripe class="audit-table">
          <el-table-column type="expand" width="46">
            <template #default="scope">
              <div class="details-panel">
                <el-text size="small" type="info" class="details-title">
                  Détails / modifications
                </el-text>
                <pre class="details-json">{{ prettyDetails(scope.row) }}</pre>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="Date / heure" width="175">
            <template #default="scope">{{ entryCreatedAt(scope.row) }}</template>
          </el-table-column>
          <el-table-column label="Utilisateur" min-width="180">
            <template #default="scope">
              <el-space direction="vertical" alignment="start" size="2">
                <span>{{ entryActorName(scope.row) }}</span>
                <el-tag
                  v-if="entryActorRole(scope.row)"
                  :type="roleTagType(entryActorRole(scope.row))"
                  size="small"
                  disable-transitions
                >
                  {{ roleLabel(entryActorRole(scope.row)) }}
                </el-tag>
              </el-space>
            </template>
          </el-table-column>
          <el-table-column label="Action" width="210">
            <template #default="scope">
              <el-tag :type="actionTagType(entryAction(scope.row))" disable-transitions>
                {{ actionLabel(entryAction(scope.row)) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Entité" width="150">
            <template #default="scope">{{ entityLabel(entryEntity(scope.row)) }}</template>
          </el-table-column>
          <el-table-column label="Détail" min-width="240" show-overflow-tooltip>
            <template #default="scope">
              <span class="detail-clamp">{{ entrySummary(scope.row) }}</span>
            </template>
          </el-table-column>
          <template #empty>
            <el-empty description="Aucune activité trouvée pour ces filtres" />
          </template>
        </el-table>
        </div>

        <div class="pagination-row">
          <el-pagination
            :current-page="page"
            :page-size="pageSize"
            :total="total"
            :page-sizes="[20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            background
            @current-change="handlePageChange"
            @size-change="handlePageSizeChange"
          />
        </div>
      </el-card>
    </el-space>
  </div>
</template>

<style scoped>
/* Pilote Journal uniquement : correction locale anti-dépassement.
 * Aucun changement global (style.css / App.vue / HomeView non touchés).
 * La page ne doit jamais créer de scroll horizontal : seul
 * .audit-table-wrapper peut scroller en X, et details-json en interne.
 */
.admin-view {
  padding: 1rem;
  margin: 0 auto;
  width: 100%;
  max-width: min(1280px, 100%);
  box-sizing: border-box;
  min-width: 0;
  overflow-x: clip;
}

/* el-space vertical Stretch : empêcher qu'il force une largeur intrinsèque */
.admin-view :deep(.el-space--vertical) {
  max-width: 100%;
  min-width: 0;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: center;
  flex-wrap: wrap;
  gap: 8px;
  max-width: 100%;
  min-width: 0;
}

.title-text {
  font-size: 20px;
  font-weight: 600;
  overflow-wrap: anywhere;
}

/* Cartes : contenir sans dépasser, laisser le wrapper interne scroller */
.audit-filters-card,
.audit-table-card {
  max-width: 100%;
  min-width: 0;
}

.admin-view :deep(.el-card__body) {
  min-width: 0;
  max-width: 100%;
  box-sizing: border-box;
}

/* 1. Filtres fluides et wrappés */
.filters-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  justify-content: flex-start;
  align-items: flex-end;
  min-width: 0;
  max-width: 100%;
}

.filters-bar :deep(.el-form-item) {
  margin-right: 0;
  margin-bottom: 0;
  min-width: 0;
}

.filter-field {
  flex: 1 1 200px;
  min-width: 0;
  max-width: 100%;
}

.filter-field--date {
  flex: 1 1 260px;
}

.filter-control {
  width: 100%;
  max-width: 100%;
  min-width: 0;
}

.filters-bar :deep(.el-select),
.filters-bar :deep(.el-date-editor.el-input__wrapper),
.filters-bar :deep(.el-date-editor) {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  box-sizing: border-box;
}

.filter-actions {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
  margin-left: auto;
}

.filter-actions__inner {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  max-width: 100%;
}

/* 2. Tableau : scroll interne uniquement */
.audit-table-wrapper {
  width: 100%;
  max-width: 100%;
  min-width: 0;
  overflow-x: auto;
  overflow-y: auto;
  max-height: min(60vh, 640px);
  -webkit-overflow-scrolling: touch;
  overscroll-behavior-x: contain;
}

.audit-table {
  width: 100%;
  /* Somme colonnes fixes ~1000px : en dessous, scroll interne au wrapper,
   * jamais scroll horizontal de la page (admin-view est en overflow-x: clip). */
  min-width: 720px;
}

/* Sticky header pertinent car wrapper scrolle en Y */
.audit-table-wrapper :deep(.el-table__header-wrapper) {
  position: sticky;
  top: 0;
  z-index: 3;
}

.audit-table-wrapper :deep(.el-table__body-wrapper) {
  max-width: 100%;
}

/* Colonne Détail tronquée 1-2 lignes, tooltip conservé via show-overflow-tooltip */
.detail-clamp {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  overflow-wrap: anywhere;
  line-height: 1.4;
  max-height: calc(1.4em * 2);
}

/* 3. Pagination wrappable et centrée */
.pagination-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 12px;
  margin-top: 16px;
  max-width: 100%;
  min-width: 0;
}

.pagination-row :deep(.el-pagination) {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  align-items: center;
  gap: 8px 12px;
  max-width: 100%;
  min-width: 0;
}

.details-panel {
  padding: 8px 16px;
  min-width: 0;
  max-width: 100%;
}

.details-title {
  display: block;
  margin-bottom: 6px;
}

.details-json {
  background: #f5f7fa;
  border-radius: 6px;
  padding: 10px 12px;
  margin: 0;
  font-size: 12px;
  line-height: 1.5;
  overflow: auto;
  max-height: 320px;
  max-width: 100%;
  box-sizing: border-box;
  white-space: pre-wrap;
  word-break: break-word;
  overflow-wrap: anywhere;
}
</style>