<template>
  <el-dialog
    ref="dialogRef"
    :model-value="modelValue"
    title="Déverrouiller la comptabilité"
    width="440px"
    align-center
    :close-on-click-modal="false"
    :close-on-press-escape="true"
    :append-to-body="true"
    :teleported="true"
    :lock-scroll="true"
    :z-index="10000"
    custom-class="accounting-guard-dialog"
    data-testid="accounting-unlock-dialog"
    @update:model-value="onVisibilityChange"
    @close="purgeSecrets"
    @opened="focusSecret"
  >
    <p v-if="fresh" class="apd-hint">
      Confirmation récente requise (moins de 60&nbsp;s) pour cette opération sensible.
    </p>
    <p class="apd-hint">
      Saisissez votre <strong>mot de passe de connexion</strong> pour autoriser cette opération comptable.
    </p>

    <el-alert
      v-if="lockedMs > 0"
      type="error"
      show-icon
      :closable="false"
      :title="`Vérification verrouillée — réessayez dans ${formatDelay(lockedMs)}`"
      class="apd-alert"
    />
    <el-alert
      v-else-if="attemptsLeft !== null && attemptsLeft <= 2"
      type="warning"
      show-icon
      :closable="false"
      :title="`Attention : ${attemptsLeft} tentative(s) restante(s) avant verrouillage`"
      class="apd-alert"
    />

    <el-form label-width="150px" @submit.prevent="submit">
      <el-form-item label="Mot de passe">
        <el-input
          ref="secretInput"
          v-model="secret"
          type="password"
          show-password
          autocomplete="current-password"
          data-testid="accounting-unlock-input"
          placeholder="Mot de passe de connexion"
          @keyup.enter="submit"
        />
      </el-form-item>
    </el-form>

    <p v-if="errorMsg" class="apd-error" role="alert">{{ errorMsg }}</p>

    <template #footer>
      <el-button :disabled="loading" @click="cancel">Annuler</el-button>
      <el-button type="primary" :loading="loading" :disabled="submitDisabled" @click="submit">
        Déverrouiller
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { strictInvoke } from '@/utils/ipc'

/**
 * Dialogue de vérification comptable — mode verify seul.
 *
 * @remarks
 * - Vérifie UNIQUEMENT le mot de passe de connexion de l'utilisateur courant
 *   (`comptabilite:verifyPassword`). Plus de définition/modification de secret
 *   séparé (les anciens modes `set`/`change` ont été supprimés).
 * - Le secret vit uniquement dans une `ref` locale, purgée à la
 *   fermeture (`purgeSecrets`) — jamais Pinia, jamais localStorage,
 *   jamais loggé.
 * - Affiche les tentatives restantes et le délai de verrouillage
 *   lus via `comptabilite:status` (aucun hash/secret exposé).
 */
export type AccountingDialogMode = 'verify'

interface AccountingStatus {
  isSet: boolean
  unlocked: boolean
  fresh: boolean
  locked: boolean
  retryAfterMs: number
  failedAttempts: number
}

const props = withDefaults(
  defineProps<{ modelValue: boolean; mode?: AccountingDialogMode; fresh?: boolean }>(),
  { mode: 'verify', fresh: false },
)
const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'success'): void
  (e: 'cancelled'): void
}>()

const MAX_ATTEMPTS = 5

const secret = ref('')
const loading = ref(false)
const errorMsg = ref('')
const attemptsLeft = ref<number | null>(null)
const lockedMs = ref(0)
const secretInput = ref<{ focus?: () => void } | null>(null)
const dialogRef = ref<unknown>(null)

/**
 * Focus auto sur le champ mot de passe à l'ouverture (UX clavier + a11y).
 *
 * @remarks
 * Element Plus monte le contenu du dialogue en `teleport` vers `body` :
 * `secretInput.focus()` seul peut rater la peinture (surtout avec
 * `destroy-on-close` — supprimé ici pour cette raison). On passe par
 * `nextTick` + fallback `querySelector` dans le dialogue téléporté.
 */
function focusSecret(): void {
  void nextTick(() => {
    try {
      secretInput.value?.focus?.()
    } catch {
      /* focus best-effort */
    }
    // Fallback : le dialogue est téléporté dans body, on cible l'input réel.
    try {
      const root = (dialogRef.value as { dialogContentRef?: HTMLElement } | null)?.dialogContentRef
        ?? document.querySelector('[data-testid="accounting-unlock-dialog"]')
      const input = (root instanceof HTMLElement ? root : document)
        .querySelector<HTMLInputElement>('input[type="password"]')
      input?.focus?.({ preventScroll: true })
    } catch {
      /* focus best-effort */
    }
  })
}

const submitDisabled = computed(() => {
  if (loading.value || lockedMs.value > 0) return true
  return secret.value.length === 0
})

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      purgeSecrets()
      errorMsg.value = ''
      void refreshStatus()
    }
  },
)

/** Remet à zéro le secret local (jamais persisté ailleurs). */
function purgeSecrets(): void {
  secret.value = ''
}

function onVisibilityChange(v: boolean): void {
  if (!v) purgeSecrets()
  emit('update:modelValue', v)
}

function cancel(): void {
  purgeSecrets()
  emit('update:modelValue', false)
  emit('cancelled')
}

function formatDelay(ms: number): string {
  const s = Math.ceil(ms / 1000)
  const m = Math.floor(s / 60)
  const r = s % 60
  return m > 0 ? `${m} min ${String(r).padStart(2, '0')} s` : `${r} s`
}

/** Relit le statut sûr (tentatives restantes / verrouillé jusqu'à). */
async function refreshStatus(): Promise<void> {
  try {
    const st = await strictInvoke<AccountingStatus>('comptabilite:status')
    attemptsLeft.value = Math.max(0, MAX_ATTEMPTS - Number(st?.failedAttempts ?? 0))
    lockedMs.value = Number(st?.retryAfterMs ?? 0)
  } catch {
    attemptsLeft.value = null
    lockedMs.value = 0
  }
}

async function submit(): Promise<void> {
  if (submitDisabled.value) return
  loading.value = true
  errorMsg.value = ''
  try {
    await strictInvoke('comptabilite:verifyPassword', secret.value)
    purgeSecrets()
    emit('update:modelValue', false)
    emit('success')
  } catch (err) {
    errorMsg.value = err instanceof Error ? err.message : 'Échec — réessayez.'
    await refreshStatus()
  } finally {
    // Purge systématique même en échec : aucun secret ne survit au dialogue.
    secret.value = ''
    loading.value = false
  }
}
</script>

<style scoped>
.apd-hint {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}
.apd-alert {
  margin-bottom: 12px;
}
.apd-error {
  margin: 4px 0 0;
  font-size: 13px;
  color: var(--el-color-danger);
}
</style>
