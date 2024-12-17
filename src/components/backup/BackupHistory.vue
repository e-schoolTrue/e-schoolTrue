<script setup lang="ts">
import { computed } from 'vue';
import { Icon } from '@iconify/vue';
import type { BackupHistory } from '@/types/backup';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const props = defineProps<{
  history: BackupHistory[];
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'restore', id: string): void;
  (e: 'delete', id: string): void;
  (e: 'download', backup: BackupHistory): void;
}>();

const sortedHistory = computed(() => {
  return [...props.history].sort((a, b) => 
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
});

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'success':
      return 'mdi:check-circle';
    case 'error':
      return 'mdi:alert-circle';
    case 'pending':
      return 'mdi:clock-outline';
    default:
      return 'mdi:help-circle';
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'success':
      return '#67C23A';
    case 'error':
      return '#F56C6C';
    case 'pending':
      return '#E6A23C';
    default:
      return '#909399';
  }
};

const formatSize = (bytes: number) => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const getTimeAgo = (date: string) => {
  return formatDistanceToNow(new Date(date), { addSuffix: true, locale: fr });
};
</script>

<template>
  <div class="backup-history">
    <div class="history-header">
      <h3>
        <Icon icon="mdi:history" class="mr-2" />
        Historique des sauvegardes
      </h3>
    </div>

    <el-table
      :data="sortedHistory"
      style="width: 100%"
      v-loading="loading"
    >
      <el-table-column label="Statut" width="100">
        <template #default="{ row }">
          <el-tooltip
            :content="row.status"
            placement="top"
          >
            <div class="status-indicator">
              <Icon 
                :icon="getStatusIcon(row.status)"
                :style="{ color: getStatusColor(row.status) }"
                width="20"
              />
            </div>
          </el-tooltip>
        </template>
      </el-table-column>

      <el-table-column label="Type" width="120">
        <template #default="{ row }">
          <el-tag :type="row.type === 'local' ? 'info' : 'success'">
            <Icon 
              :icon="row.type === 'local' ? 'mdi:folder' : 'mdi:cloud'"
              class="mr-2"
            />
            {{ row.type === 'local' ? 'Local' : 'Cloud' }}
          </el-tag>
        </template>
      </el-table-column>

      <el-table-column prop="name" label="Nom" />

      <el-table-column label="Taille" width="120">
        <template #default="{ row }">
          {{ formatSize(row.size) }}
        </template>
      </el-table-column>

      <el-table-column label="Date" width="200">
        <template #default="{ row }">
          <div class="date-info">
            <span>{{ new Date(row.createdAt).toLocaleString() }}</span>
            <small class="text-muted">{{ getTimeAgo(row.createdAt) }}</small>
          </div>
        </template>
      </el-table-column>

      <el-table-column label="Actions" width="200" align="right">
        <template #default="{ row }">
          <el-button-group>
            <el-button
              type="primary"
              size="small"
              @click="emit('restore', row.id)"
              :disabled="row.status === 'pending'"
            >
              <Icon icon="mdi:restore" />
            </el-button>

            <el-button
              type="success"
              size="small"
              @click="emit('download', row)"
              :disabled="row.status === 'pending'"
            >
              <Icon icon="mdi:download" />
            </el-button>

            <el-button
              type="danger"
              size="small"
              @click="emit('delete', row.id)"
              :disabled="row.status === 'pending'"
            >
              <Icon icon="mdi:delete" />
            </el-button>
          </el-button-group>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="!sortedHistory.length" class="empty-state">
      <Icon icon="mdi:database-off" width="48" class="mb-2" />
      <p>Aucune sauvegarde disponible</p>
    </div>
  </div>
</template>

<style scoped>
.backup-history {
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

.status-indicator {
  display: flex;
  align-items: center;
  justify-content: center;
}

.date-info {
  display: flex;
  flex-direction: column;
}

.text-muted {
  color: #909399;
  font-size: 12px;
}

.empty-state {
  text-align: center;
  padding: 40px;
  color: #909399;
}

.mr-2 {
  margin-right: 8px;
}

.mb-2 {
  margin-bottom: 8px;
}

:deep(.el-button-group) {
  display: flex;
  gap: 4px;
}
</style> 