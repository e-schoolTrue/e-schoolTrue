<template>
  <wizard-view-base>
    <template #title>
      Restaurer une sauvegarde existante (optionnel)
    </template>

    <div class="import-backup-step">
      <el-alert
        type="info"
        :closable="false"
        class="mb-3"
        title="Si vous disposez déjà d'une sauvegarde eSchool (.zip), vous pouvez la restaurer maintenant. Sinon, continuez sans import."
        description="1) Cliquez sur « Importer sauvegarde » puis choisissez explicitement le fichier .zip sur votre disque. 2) Vérifiez le chemin, la taille, les tables, la version et les avertissements affichés, puis confirmez : une sauvegarde de sécurité est créée avant remplacement + redémarrage."
        show-icon
      />
      <el-alert
        v-if="importError"
        type="error"
        :closable="true"
        class="mb-3"
        :title="importError"
        @close="importError = ''"
      />
      <div class="import-actions">
        <!-- Flux preview (backup:previewImport) + confirm (backup:confirmImport,
             safety backup + relaunch backend) encapsulé dans la carte réutilisable.
             Aucun appel backup tant que l'utilisateur ne clique pas (skip = zéro IPC).
             Hors application (first-launch, pas de user, pas de RBAC, import public
             via allowDuringFirstLaunch) : requireAdmin=false, le bandeau
             FORBIDDEN « Réservé administrateur » ne doit jamais s'afficher,
             même après une erreur passagère. -->
        <BackupImportCard
          :require-admin="false"
          @imported="handleImported"
          @cancelled="handleCancelled"
          @error="handleImportError"
          @previewed="handlePreviewed"
        />
        <el-text type="info" size="small">
          L'import crée une sauvegarde de sécurité puis redémarre l'application.
        </el-text>
      </div>
    </div>

    <template #actions>
      <el-button type="info" class="action-button" @click="goBack">
        Retourner
      </el-button>
      <!-- Skip : aucun appel IPC backup, on avance vers GeneralInfo -->
      <el-button type="primary" plain class="action-button" @click="skipWithoutImport">
        Continuer sans import
      </el-button>
    </template>
  </wizard-view-base>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import WizardViewBase from './WizardViewBase.vue';
import BackupImportCard from '@/components/sync/BackupImportCard.vue';

const emit = defineEmits(['configuration-saved', 'go-back']);
const router = useRouter();
const importError = ref('');

/**
 * Guard anti-boucle : après un import + relaunch réussi, la base restaurée
 * n'est plus en first-launch → on sort du wizard vers /.
 * (BackupImportCard marque set-first-launch-complete APRÈS backup:confirmImport réussi ; ce guard est le second filet côté vue.)
 */
onMounted(async () => {
  try {
    if (window.ipcRenderer) {
      const response = await window.ipcRenderer.invoke('is-first-launch');
      if (response?.success === false) return; // fail-open : laisse le wizard affiché
      if (response?.data === false) {
        router.replace('/');
      }
    }
  } catch {
    /* Contexte non-Electron ou IPC indisponible : wizard inchangé */
  }
});

/** Import confirmé → le backend relance l'app ; aucune navigation (le relaunch prend le relais). */
const handleImported = (): void => {
  importError.value = '';
};

const handleCancelled = (): void => {
  importError.value = '';
};

/**
 * Preview réussi (stagingPath présent) : nettoie toute erreur résiduelle. Après un aperçu valide, aucune alerte rouge ne doit persister
 * dans le wizard (le dialogue affiche déjà taille/tables/version).
 */
const handlePreviewed = (): void => {
  importError.value = '';
};

/**
 * Échec preview/confirm : on affiche l'erreur backend réelle en inline
 * (ex. `Échec de l'import : STAGING_EXPIRED …`, `SAFETY_BACKUP_FAILED`,
 * `SHA_MISMATCH`, `NEED_CONFIRM_*`), y compris un éventuel FORBIDDEN /
 * UNAUTHENTICATED — diagnostic du confirm refusé (bypass coupé, RBAC).
 * Plus aucun filtrage « refus temporaire ».
 * L'utilisateur peut réessayer ou skipper.
 */
const handleImportError = (message: string): void => {
  importError.value = message;
};

/** Skip explicite : zéro appel IPC backup, passage à l'étape suivante. */
const skipWithoutImport = (): void => {
  importError.value = '';
  emit('configuration-saved', { skipped: true });
};

const goBack = (): void => {
  emit('go-back');
};
</script>

<style scoped>
.import-backup-step {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-width: 640px;
  margin: 0 auto;
  padding: 12px 0;
}
.import-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 10px;
}
.mb-3 { margin-bottom: 12px; }
.action-button {
  min-width: 160px;
}
</style>
