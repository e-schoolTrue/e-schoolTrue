<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { format } from 'date-fns'
import type { FormInstance, FormRules } from 'element-plus'
import { Icon } from '@iconify/vue'
import type { UserRole } from '@/types/user'
import { ROLE_OPTIONS, roleLabel, roleTagType } from '@/constants/userOptions'
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
 * Vrai si l'erreur signale une session expirée / interdite côté backend
 * (backend null après restart Electron, droits insuffisants).
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
// Types locaux (forme renvoyée par users:list)
// ---------------------------------------------------------------------------
interface UserItem {
  id: number
  username: string
  displayName: string | null
  role: UserRole
  isActive: boolean
  lastLoginAt?: string | null
  createdAt?: string | null
  securityQuestion?: string | null
  securityAnswer?: string | null
}

interface ListResponse {
  items: UserItem[]
  total: number
}

// ---------------------------------------------------------------------------
// État de la liste
// ---------------------------------------------------------------------------
const loading = ref(false)
const submitting = ref(false)
const users = ref<UserItem[]>([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const search = ref('')

// ---------------------------------------------------------------------------
// Dialogues
// ---------------------------------------------------------------------------
const createDialogVisible = ref(false)
const editDialogVisible = ref(false)
const resetDialogVisible = ref(false)
const editingUser = ref<UserItem | null>(null)

const createFormRef = ref<FormInstance>()
const editFormRef = ref<FormInstance>()
const resetFormRef = ref<FormInstance>()

const createForm = reactive({
  username: '',
  password: '',
  displayName: '',
  role: 'professor' as UserRole,
  securityQuestion: '',
  securityAnswer: '',
})

const editForm = reactive({
  displayName: '',
  role: 'professor' as UserRole,
})

const resetForm = reactive({
  newPassword: '',
  confirmPassword: '',
})

// ---------------------------------------------------------------------------
// Règles de validation (style LoginView)
// ---------------------------------------------------------------------------
const createRules: FormRules = {
  username: [
    { required: true, message: "Nom d'utilisateur requis", trigger: 'blur' },
    { min: 3, message: 'Minimum 3 caractères', trigger: 'blur' },
  ],
  password: [
    { required: true, message: 'Mot de passe requis', trigger: 'blur' },
    { min: 6, message: 'Minimum 6 caractères', trigger: 'blur' },
  ],
  role: [{ required: true, message: 'Rôle requis', trigger: 'change' }],
}

const editRules: FormRules = {
  role: [{ required: true, message: 'Rôle requis', trigger: 'change' }],
}

const validateConfirmPassword = (
  _rule: unknown,
  value: string,
  callback: (error?: Error) => void
) => {
  if (!value) {
    callback(new Error('La confirmation est requise'))
  } else if (value !== resetForm.newPassword) {
    callback(new Error('Les mots de passe ne correspondent pas'))
  } else {
    callback()
  }
}

const resetRules: FormRules = {
  newPassword: [
    { required: true, message: 'Nouveau mot de passe requis', trigger: 'blur' },
    { min: 6, message: 'Minimum 6 caractères', trigger: 'blur' },
  ],
  confirmPassword: [
    { required: true, message: 'Confirmation requise', trigger: 'blur' },
    { validator: validateConfirmPassword, trigger: 'blur' },
  ],
}

// ---------------------------------------------------------------------------
// Chargement
// ---------------------------------------------------------------------------
async function loadUsers() {
  loading.value = true
  try {
    const result = await window.ipcRenderer.invoke('users:list', {
      page: page.value,
      pageSize: pageSize.value,
      search: search.value.trim(),
    })
    if (result?.success === false) {
      throw new Error(result.message || result.error || 'Erreur lors du chargement des utilisateurs')
    }
    const data = (result?.data ?? { items: [], total: 0 }) as ListResponse
    users.value = Array.isArray(data) ? data : data.items ?? []
    total.value = Array.isArray(data) ? data.length : data.total ?? 0
  } catch (error) {
    if (isSessionExpired(error)) {
      await handleSessionExpired()
      return
    }
    ElMessage.error(error instanceof Error ? error.message : 'Erreur lors du chargement des utilisateurs')
    console.error('Erreur lors du chargement des utilisateurs:', error)
  } finally {
    loading.value = false
  }
}

function handlePageChange(p: number) {
  page.value = p
  loadUsers()
}

function handlePageSizeChange(size: number) {
  pageSize.value = size
  page.value = 1
  loadUsers()
}

function handleSearch() {
  page.value = 1
  loadUsers()
}

// ---------------------------------------------------------------------------
// Création
// ---------------------------------------------------------------------------
function openCreateDialog() {
  createForm.username = ''
  createForm.password = ''
  createForm.displayName = ''
  createForm.role = 'professor'
  createForm.securityQuestion = ''
  createForm.securityAnswer = ''
  createDialogVisible.value = true
}

async function handleCreate() {
  if (!createFormRef.value) return
  const valid = await createFormRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const payload: Record<string, unknown> = {
      username: createForm.username.trim(),
      password: createForm.password,
      displayName: createForm.displayName.trim() || null,
      role: createForm.role,
    }
    if (createForm.securityQuestion.trim()) {
      payload.securityQuestion = createForm.securityQuestion.trim()
      payload.securityAnswer = createForm.securityAnswer.trim()
    }
    const result = await window.ipcRenderer.invoke('users:create', payload)
    if (result?.success === false) {
      throw new Error(result.message || result.error || "Échec de la création de l'utilisateur")
    }
    ElMessage.success('Utilisateur créé avec succès')
    createDialogVisible.value = false
    await loadUsers()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Échec de la création de l'utilisateur")
  } finally {
    submitting.value = false
  }
}

// ---------------------------------------------------------------------------
// Modification
// ---------------------------------------------------------------------------
function openEditDialog(user: UserItem) {
  editingUser.value = user
  editForm.displayName = user.displayName ?? ''
  editForm.role = user.role
  editDialogVisible.value = true
}

async function handleEdit() {
  if (!editFormRef.value || !editingUser.value) return
  const valid = await editFormRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const result = await window.ipcRenderer.invoke('users:update', {
      id: editingUser.value.id,
      displayName: editForm.displayName.trim() || null,
      role: editForm.role,
    })
    if (result?.success === false) {
      throw new Error(result.message || result.error || "Échec de la mise à jour de l'utilisateur")
    }
    ElMessage.success('Utilisateur mis à jour avec succès')
    editDialogVisible.value = false
    await loadUsers()
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "Échec de la mise à jour de l'utilisateur")
  } finally {
    submitting.value = false
  }
}

// ---------------------------------------------------------------------------
// Activation / désactivation
// ---------------------------------------------------------------------------
function isLastAdminError(error: unknown): boolean {
  const message = String(error instanceof Error ? error.message : error)
  return message.includes('LAST_ADMIN')
}

async function handleToggleActive(user: UserItem) {
  submitting.value = true
  try {
    const result = await window.ipcRenderer.invoke('users:setActive', {
      id: user.id,
      isActive: !user.isActive,
    })
    if (result?.success === false) {
      throw new Error(result.message || result.error || 'Erreur lors de la mise à jour du statut')
    }
    ElMessage.success(user.isActive ? 'Compte désactivé' : 'Compte activé')
    await loadUsers()
  } catch (error) {
    if (isLastAdminError(error)) {
      // Refus métier : l'utilisateur est le dernier administrateur actif.
      ElMessageBox.alert(
        'Impossible de désactiver ce compte : au moins un administrateur actif doit subsister.',
        'Opération refusée',
        { confirmButtonText: 'OK', type: 'warning' }
      )
    } else {
      ElMessage.error(error instanceof Error ? error.message : 'Erreur lors de la mise à jour du statut')
    }
  } finally {
    submitting.value = false
  }
}

// ---------------------------------------------------------------------------
// Réinitialisation du mot de passe
// ---------------------------------------------------------------------------
function openResetDialog(user: UserItem) {
  editingUser.value = user
  resetForm.newPassword = ''
  resetForm.confirmPassword = ''
  resetDialogVisible.value = true
}

async function handleResetPassword() {
  if (!resetFormRef.value || !editingUser.value) return
  const valid = await resetFormRef.value.validate().catch(() => false)
  if (!valid) return

  submitting.value = true
  try {
    const result = await window.ipcRenderer.invoke('users:resetPassword', {
      id: editingUser.value.id,
      newPassword: resetForm.newPassword,
    })
    if (result?.success === false) {
      throw new Error(result.message || result.error || 'Échec de la réinitialisation du mot de passe')
    }
    ElMessage.success('Mot de passe réinitialisé avec succès')
    resetDialogVisible.value = false
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : 'Échec de la réinitialisation du mot de passe')
  } finally {
    submitting.value = false
  }
}

// ---------------------------------------------------------------------------
// Formatage
// ---------------------------------------------------------------------------
function formatDate(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return format(date, 'dd/MM/yyyy HH:mm')
}

onMounted(loadUsers)
</script>

<template>
  <div class="admin-view">
    <el-space direction="vertical" fill="fill" size="large" style="width: 100%">
      <!-- En-tête -->
      <div class="view-header">
        <el-space size="large">
          <Icon width="28" icon="mdi:account-cog" color="var(--el-color-primary)" />
          <el-text type="primary" class="title-text">Gestion des utilisateurs</el-text>
        </el-space>
      </div>

      <!-- Barre d'outils -->
      <div class="toolbar">
        <el-input
          v-model="search"
          placeholder="Rechercher par nom d'utilisateur ou nom affiché"
          clearable
          class="search-input"
          @keyup.enter="handleSearch"
          @clear="handleSearch"
        >
          <template #prefix>
            <Icon icon="mdi:magnify" />
          </template>
        </el-input>
        <el-button type="primary" @click="handleSearch">Rechercher</el-button>
        <el-button type="success" @click="openCreateDialog">
          <template #icon><Icon icon="mdi:account-plus" /></template>
          Créer un utilisateur
        </el-button>
      </div>

      <!-- Tableau -->
      <el-card shadow="never">
        <el-table
          :data="users"
          v-loading="loading"
          border
          stripe
          empty-text="Aucun utilisateur trouvé"
        >
          <el-table-column prop="username" label="Nom d'utilisateur" min-width="170" />
          <el-table-column label="Nom affiché" min-width="170">
            <template #default="scope">{{ scope.row.displayName || '—' }}</template>
          </el-table-column>
          <el-table-column label="Rôle" width="150">
            <template #default="scope">
              <el-tag :type="roleTagType(scope.row.role)" disable-transitions>
                {{ roleLabel(scope.row.role) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Statut" width="110">
            <template #default="scope">
              <el-tag :type="scope.row.isActive ? 'success' : 'info'" disable-transitions>
                {{ scope.row.isActive ? 'Actif' : 'Inactif' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="Dernière connexion" width="165">
            <template #default="scope">{{ formatDate(scope.row.lastLoginAt) }}</template>
          </el-table-column>
          <el-table-column label="Créé le" width="165">
            <template #default="scope">{{ formatDate(scope.row.createdAt) }}</template>
          </el-table-column>
          <el-table-column label="Actions" width="300" fixed="right">
            <template #default="scope">
              <el-space wrap>
                <el-button size="small" type="primary" @click="openEditDialog(scope.row)">
                  Modifier
                </el-button>
                <el-button size="small" type="warning" @click="openResetDialog(scope.row)">
                  Réinitialiser
                </el-button>
                <el-popconfirm
                  :title="scope.row.isActive ? 'Désactiver ce compte ?' : 'Activer ce compte ?'"
                  confirm-button-text="Oui"
                  cancel-button-text="Annuler"
                  width="220"
                  @confirm="handleToggleActive(scope.row)"
                >
                  <template #reference>
                    <el-button size="small" :type="scope.row.isActive ? 'danger' : 'success'">
                      {{ scope.row.isActive ? 'Désactiver' : 'Activer' }}
                    </el-button>
                  </template>
                </el-popconfirm>
              </el-space>
            </template>
          </el-table-column>
        </el-table>

        <div class="pagination-row">
          <el-pagination
            :current-page="page"
            :page-size="pageSize"
            :total="total"
            :page-sizes="[10, 20, 50]"
            layout="total, sizes, prev, pager, next"
            background
            @current-change="handlePageChange"
            @size-change="handlePageSizeChange"
          />
        </div>
      </el-card>
    </el-space>

    <!-- Dialogue : création -->
    <el-dialog
      v-model="createDialogVisible"
      title="Créer un utilisateur"
      width="480px"
      destroy-on-close
    >
      <el-form ref="createFormRef" :model="createForm" :rules="createRules" label-width="160px">
        <el-form-item label="Nom d'utilisateur" prop="username">
          <el-input v-model="createForm.username" placeholder="Nom d'utilisateur" :disabled="submitting" />
        </el-form-item>
        <el-form-item label="Mot de passe" prop="password">
          <el-input
            v-model="createForm.password"
            type="password"
            show-password
            placeholder="Mot de passe"
            :disabled="submitting"
          />
        </el-form-item>
        <el-form-item label="Nom affiché" prop="displayName">
          <el-input v-model="createForm.displayName" placeholder="Nom affiché" :disabled="submitting" />
        </el-form-item>
        <el-form-item label="Rôle" prop="role">
          <el-select v-model="createForm.role" style="width: 100%" :disabled="submitting">
            <el-option
              v-for="opt in ROLE_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="Question de sécurité" prop="securityQuestion">
          <el-input
            v-model="createForm.securityQuestion"
            placeholder="Optionnel"
            :disabled="submitting"
          />
        </el-form-item>
        <el-form-item label="Réponse" prop="securityAnswer">
          <el-input
            v-model="createForm.securityAnswer"
            placeholder="Optionnel"
            :disabled="submitting"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="submitting" @click="createDialogVisible = false">Annuler</el-button>
        <el-button type="primary" :loading="submitting" @click="handleCreate">Créer</el-button>
      </template>
    </el-dialog>

    <!-- Dialogue : modification -->
    <el-dialog
      v-model="editDialogVisible"
      :title="`Modifier ${editingUser?.username ?? ''}`"
      width="480px"
      destroy-on-close
    >
      <el-form ref="editFormRef" :model="editForm" :rules="editRules" label-width="160px">
        <el-form-item label="Nom affiché" prop="displayName">
          <el-input v-model="editForm.displayName" placeholder="Nom affiché" :disabled="submitting" />
        </el-form-item>
        <el-form-item label="Rôle" prop="role">
          <el-select v-model="editForm.role" style="width: 100%" :disabled="submitting">
            <el-option
              v-for="opt in ROLE_OPTIONS"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="submitting" @click="editDialogVisible = false">Annuler</el-button>
        <el-button type="primary" :loading="submitting" @click="handleEdit">Enregistrer</el-button>
      </template>
    </el-dialog>

    <!-- Dialogue : réinitialisation du mot de passe -->
    <el-dialog
      v-model="resetDialogVisible"
      :title="`Réinitialiser le mot de passe de ${editingUser?.username ?? ''}`"
      width="480px"
      destroy-on-close
    >
      <el-form ref="resetFormRef" :model="resetForm" :rules="resetRules" label-width="160px">
        <el-form-item label="Nouveau mot de passe" prop="newPassword">
          <el-input
            v-model="resetForm.newPassword"
            type="password"
            show-password
            placeholder="Nouveau mot de passe"
            :disabled="submitting"
          />
        </el-form-item>
        <el-form-item label="Confirmation" prop="confirmPassword">
          <el-input
            v-model="resetForm.confirmPassword"
            type="password"
            show-password
            placeholder="Confirmer le mot de passe"
            :disabled="submitting"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button :disabled="submitting" @click="resetDialogVisible = false">Annuler</el-button>
        <el-button type="danger" :loading="submitting" @click="handleResetPassword">
          Réinitialiser
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.admin-view {
  padding: 1rem;
  max-width: 1280px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.view-header {
  display: flex;
  align-items: center;
  justify-content: center;
}

.title-text {
  font-size: 20px;
  font-weight: 600;
}

.toolbar {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
  justify-content: center;
}

.search-input {
  width: 340px;
  max-width: 100%;
}

.pagination-row {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}

:deep(.el-card__body) {
  width: 100%;
  box-sizing: border-box;
}
</style>