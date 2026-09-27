<template>
  <!-- data-testid = garde-fou : un seul host doit exister (monté dans App.vue) -->
  <div data-testid="accounting-guard-host">
    <AccountingPasswordDialog
      :model-value="guardDialogVisible"
      mode="verify"
      :fresh="guardDialogFresh"
      @update:model-value="onDialogUpdate"
      @success="resolveGuardDialog"
      @cancelled="onCancelled"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * Hôte global unique du dialogue de garde comptable.
 * À monter une seule fois (App.vue) : `useAccountingGuard().ensureUnlock()`
 * pilote `guardDialogVisible` et résout la promesse d'attente.
 *
 * @remarks
 * P0 — overlay restait `display:none` malgré `guardDialogVisible=true` :
 * - `:model-value` + `@update:model-value` explicites (pas de `v-model`
 *   sur la `ref` partagée importée : assigne `.value` sans ambiguïté
 *   de compilation et survit à une double évaluation du module Vite).
 * - Fermeture externe (X / ESC Element Plus) traitée comme annulation
 *   via `onDialogUpdate(false)` → `rejectGuardDialog`, sinon la promesse
 *   `ensureUnlock()` pendait indéfiniment.
 * - Garde-fou dev : avertit si 2 hosts sont montés (2× `display:none`
 *   / courses sur la même `ref` partagée).
 */
import { nextTick, onMounted } from 'vue'
import AccountingPasswordDialog from '@/components/accounting/AccountingPasswordDialog.vue'
import {
  guardDialogFresh,
  guardDialogVisible,
  hasPendingGuardDialog,
  rejectGuardDialog,
  resolveGuardDialog,
} from '@/composables/useAccountingGuard'

async function onDialogUpdate(v: boolean): Promise<void> {
  guardDialogVisible.value = v
  if (v) return
  // Le dialogue émet `update:model-value=false` PUIS `success`/`cancelled`
  // dans le même tick : on diffère d'un tick pour laisser le vrai
  // verdict (resolve/reject) régler `current` avant de conclure à une
  // fermeture externe (X / ESC → aucun @success/@cancelled).
  await nextTick()
  if (hasPendingGuardDialog()) {
    rejectGuardDialog(new Error('Saisie annulée — mot de passe comptable requis.'))
  }
}

function onCancelled(): void {
  rejectGuardDialog(new Error('Saisie annulée — mot de passe comptable requis.'))
}

onMounted(() => {
  if (import.meta.env.DEV && typeof document !== 'undefined') {
    const hosts = document.querySelectorAll('[data-testid="accounting-guard-host"]')
    if (hosts.length > 1) {
      console.warn(
        `[AccountingGuardHost] ${hosts.length} instances montées — une seule attendue (App.vue).`,
      )
    }
  }
})
</script>
