<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import type { SyncHistory } from '@/types/sync'; // On utilise le type SyncHistory
import { format, formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

// --- Props ---
const props = defineProps<{
  history: SyncHistory[];
  loading?: boolean;
}>();

// --- Computed Properties ---
// Trie l'historique par date de début, la plus récente en premier.
const sortedHistory = computed(() => {
  if (!props.history || !Array.isArray(props.history)) return [];
  return [...props.history].sort((a, b) => 
    new Date(b.sync_started_at).getTime() - new Date(a.sync_started_at).getTime()
  );
});

// --- Fonctions Utilitaires ---

// Retourne une icône et une couleur basées sur le statut de la synchronisation
const getStatusInfo = (status: SyncHistory['status']) => {
  switch (status) {
    case 'success':
      return { icon: 'mdi:check-circle', color: '#67C23A', text: 'Succès' };
    case 'partial_success':
      return { icon: 'mdi:alert-circle', color: '#E6A23C', text: 'Partiel' };
    case 'failed':
      return { icon: 'mdi:close-circle', color: '#F56C6C', text: 'Échec' };
    case 'in_progress':
      return { icon: 'mdi:sync', color: '#409EFF', text: 'En cours...' };
    case 'skipped':
        return { icon: 'mdi:skip-next-circle', color: '#909399', text: 'Ignoré' };
    default:
      return { icon: 'mdi:help-circle', color: '#909399', text: 'Inconnu' };
  }
};

// Retourne une icône basée sur la direction de la synchronisation
const getDirectionIcon = (direction: SyncHistory['direction']) => {
  switch (direction) {
    case 'local_to_cloud': return 'mdi:cloud-upload';
    case 'cloud_to_local': return 'mdi:cloud-download';
    case 'bidirectional': return 'mdi:cloud-sync';
    default: return 'mdi:arrow-decision';
  }
};

// Formate une date en une chaîne lisible (ex: 18 juin 2025 à 00:40)
const formatFullDate = (dateString: string | undefined) => {
  if (!dateString) return 'N/A';
  try {
    return format(new Date(dateString), "d MMMM yyyy 'à' HH:mm:ss", { locale: fr });
  } catch {
    return 'Date invalide';
  }
};

// Formate une date en une chaîne relative (ex: "il y a 5 minutes")
const getTimeAgo = (dateString: string | undefined) => {
  if (!dateString) return '';
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: fr });
  } catch {
    return '';
  }
};
</script>

<template>
  <div class="sync-history">
    <div class="history-header">
      <h3>
        <Icon icon="mdi:history" class="mr-2" />
        Journal des Synchronisations
      </h3>
    </div>

    <el-table
      :data="sortedHistory"
      style="width: 100%"
      v-loading="loading"
      row-key="id"
      :tree-props="{ children: 'details' }"
    >
      <!-- Colonne d'expansion pour les détails -->
      <el-table-column type="expand">
        <template #default="{ row }">
          <div class="sync-details">
            <p><strong>ID de la session :</strong> {{ row.id }}</p>
            <p v-if="row.tables_processed?.length">
              <strong>Tables traitées :</strong> 
              <el-tag v-for="table in row.tables_processed" :key="table" size="small" class="mr-1">
                {{ table }}
              </el-tag>
            </p>
            <p v-if="row.error_message">
              <strong>Message d'erreur :</strong>
              <el-alert :title="row.error_message" type="error" :closable="false" show-icon />
            </p>
          </div>
        </template>
      </el-table-column>

      <!-- Statut de la synchronisation -->
      <el-table-column label="Statut" width="140">
        <template #default="{ row }">
          <el-tag :color="getStatusInfo(row.status).color" effect="dark" style="color: white; border-color: transparent;">
            <div class="status-cell">
              <Icon :icon="getStatusInfo(row.status).icon" />
              <span>{{ getStatusInfo(row.status).text }}</span>
            </div>
          </el-tag>
        </template>
      </el-table-column>

      <!-- Détails de la synchronisation (date, durée) -->
      <el-table-column label="Détails de la session">
        <template #default="{ row }">
          <div class="date-info">
            <strong>{{ formatFullDate(row.sync_started_at) }}</strong>
            <small class="text-muted">{{ getTimeAgo(row.sync_started_at) }}</small>
          </div>
        </template>
      </el-table-column>

      <!-- Données échangées (montées, descendues, conflits) -->
      <el-table-column label="Données échangées" width="250">
        <template #default="{ row }">
          <div class="data-exchange">
            <div class="data-item" title="Données envoyées au cloud">
              <Icon icon="mdi:arrow-up-bold-box" class="up" />
              <span>{{ row.records_synced_up || 0 }}</span>
            </div>
            <div class="data-item" title="Données reçues du cloud">
              <Icon icon="mdi:arrow-down-bold-box" class="down" />
              <span>{{ row.records_synced_down || 0 }}</span>
            </div>
            <div class="data-item" title="Conflits résolus">
              <Icon icon="mdi:alert-box" class="conflict" />
              <span>{{ row.conflict_count || 0 }}</span>
            </div>
            <div class="data-item" title="Direction">
              <Icon :icon="getDirectionIcon(row.direction)" class="direction" />
            </div>
          </div>
        </template>
      </el-table-column>
    </el-table>

    <!-- État vide -->
    <div v-if="!sortedHistory.length && !loading" class="empty-state">
      <Icon icon="mdi:cloud-sync-outline" width="48" class="mb-2" />
      <p>Aucune synchronisation n'a encore été effectuée.</p>
      <p><small>Connectez-vous et lancez une synchronisation pour voir l'historique ici.</small></p>
    </div>
  </div>
</template>

<style scoped>
.sync-history {
  background-color: white;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.1);
}
.history-header {
  margin-bottom: 20px;
}
.history-header h3 {
  display: flex;
  align-items: center;
  margin: 0;
  font-size: 18px;
  color: #409EFF;
}
.status-cell {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: bold;
}
.date-info {
  display: flex;
  flex-direction: column;
}
.text-muted {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}
.data-exchange {
  display: flex;
  align-items: center;
  gap: 16px;
}
.data-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 14px;
  color: #606266;
}
.data-item .iconify {
  font-size: 20px;
}
.data-item .up { color: #67C23A; }
.data-item .down { color: #409EFF; }
.data-item .conflict { color: #E6A23C; }
.data-item .direction { color: #909399; }

.sync-details {
  background-color: #fafafa;
  padding: 16px;
  border-radius: 4px;
  margin: 0 8px;
}
.sync-details p {
  margin: 0 0 8px 0;
  font-size: 14px;
}
.sync-details strong {
  margin-right: 8px;
  color: #303133;
}
.empty-state {
  text-align: center;
  padding: 40px;
  color: #909399;
}
.mr-1 { margin-right: 4px; }
.mr-2 { margin-right: 8px; }
.mb-2 { margin-bottom: 8px; }
</style>