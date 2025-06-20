<script setup lang="ts">
import { ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
// On importe le type SyncConfig harmonisé
import type { SyncConfig } from '../../types/sync';

// --- Props & Emits ---
const props = defineProps<{
  config: SyncConfig;
}>();

const emit = defineEmits<{
  (e: 'update', config: SyncConfig): void;
}>();

// --- État Local ---
// On initialise l'état local avec les props reçues
const localConfig = ref<SyncConfig>({ ...props.config });

// --- Options pour le formulaire ---
const intervalOptions = [
  { label: 'Toutes les 15 minutes', value: 15 },
  { label: 'Toutes les 30 minutes', value: 30 },
  { label: 'Toutes les heures', value: 60 },
  { label: 'Toutes les 4 heures', value: 240 },
  { label: 'Toutes les 24 heures', value: 1440 },
];

// --- Méthodes ---

// Émet l'événement 'update' chaque fois qu'une valeur du formulaire change
const handleChange = () => {
  emit('update', { ...localConfig.value });
};

// Met à jour l'état local si les props parentes changent (par exemple, après un rechargement)
watch(() => props.config, (newConfig) => {
  localConfig.value = { ...newConfig };
}, { deep: true });
</script>

<template>
  <div class="sync-settings">
    <el-form :model="localConfig" label-position="top">
      
      <!-- Option principale pour activer/désactiver la synchro automatique -->
      <el-form-item label="Synchronisation automatique au démarrage">
        <el-switch
          v-model="localConfig.autoSyncOnConnect"
          @change="handleChange"
          active-text="Activée"
          inactive-text="Désactivée"
        />
        <el-tooltip
          content="Si activé, une synchronisation sera tentée chaque fois que vous vous connectez au cloud."
          placement="top"
        >
          <Icon icon="mdi:help-circle-outline" class="ml-2 help-icon" />
        </el-tooltip>
      </el-form-item>

      <!-- Intervalle de synchronisation périodique -->
      <el-form-item label="Intervalle de synchronisation en arrière-plan">
        <el-select
          v-model="localConfig.syncIntervalMinutes"
          :disabled="!localConfig.autoSyncOnConnect"
          placeholder="Jamais"
          clearable
          @change="handleChange"
        >
          <el-option
            v-for="option in intervalOptions"
            :key="option.value"
            :label="option.label"
            :value="option.value"
          />
        </el-select>
         <el-tooltip
          content="Si une valeur est choisie, l'application tentera de se synchroniser périodiquement en arrière-plan."
          placement="top"
        >
          <Icon icon="mdi:help-circle-outline" class="ml-2 help-icon" />
        </el-tooltip>
      </el-form-item>
      
      <!-- Option de notification utilisateur -->
      <el-form-item label="Demander une confirmation avant la synchronisation">
        <el-switch
          v-model="localConfig.notifyBeforeSync"
          @change="handleChange"
          active-text="Oui"
          inactive-text="Non"
        />
        <el-tooltip
          content="Si activé, une boîte de dialogue demandera votre accord avant de lancer une synchronisation automatique."
          placement="top"
        >
          <Icon icon="mdi:help-circle-outline" class="ml-2 help-icon" />
        </el-tooltip>
      </el-form-item>
      
    </el-form>
  </div>
</template>

<style scoped>
.sync-settings {
  /* On peut enlever le padding si le parent en a déjà */
}

.help-icon {
  color: #909399;
  cursor: pointer;
  font-size: 16px;
}

.ml-2 {
  margin-left: 8px;
}

:deep(.el-form-item) {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  margin-bottom: 22px;
}
:deep(.el-form-item__label) {
  margin-bottom: 4px;
}
:deep(.el-form-item__content) {
  display: flex;
  align-items: center;
  width: 100%;
}
:deep(.el-select) {
  width: 100%;
}
</style>