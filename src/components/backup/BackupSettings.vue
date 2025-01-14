<script setup lang="ts">
import { ref, watch } from 'vue';
import { Icon } from '@iconify/vue';
import type { BackupConfig } from '@/types/backup';

const props = defineProps<{
  config: BackupConfig;
}>();

const emit = defineEmits<{
  (e: 'update', config: BackupConfig): void;
}>();

const localConfig = ref<BackupConfig>({ ...props.config });

const frequencyOptions = [
  { label: 'Quotidienne', value: 'daily' },
  { label: 'Hebdomadaire', value: 'weekly' },
  { label: 'Mensuelle', value: 'monthly' },
];

const handleChange = () => {
  emit('update', { ...localConfig.value });
};

watch(() => props.config, (newConfig) => {
  localConfig.value = { ...newConfig };
}, { deep: true });
</script>

<template>
  <div class="backup-settings">
    <el-form :model="localConfig" label-position="top">
      <!-- Paramètres généraux -->
      <div class="settings-section">
        <h3>
          <Icon icon="mdi:cog-outline" class="mr-2" />
          Paramètres généraux
        </h3>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Sauvegarde automatique">
              <el-switch
                v-model="localConfig.autoBackup"
                @change="handleChange"
              />
            </el-form-item>
          </el-col>
          
          <el-col :span="12">
            <el-form-item label="Fréquence">
              <el-select
                v-model="localConfig.frequency"
                :disabled="!localConfig.autoBackup"
                @change="handleChange"
              >
                <el-option
                  v-for="option in frequencyOptions"
                  :key="option.value"
                  :label="option.label"
                  :value="option.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Heure de sauvegarde">
              <el-time-select
                v-model="localConfig.backupTime"
                :disabled="!localConfig.autoBackup"
                start="00:00"
                step="00:30"
                end="23:30"
                placeholder="Choisir une heure"
                @change="handleChange"
              />
            </el-form-item>
          </el-col>
          
          <el-col :span="12">
            <el-form-item label="Nombre maximum de sauvegardes">
              <el-input-number
                v-model="localConfig.maxBackups"
                :min="1"
                :max="20"
                @change="handleChange"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </div>

      <!-- Options avancées -->
      <div class="settings-section">
        <h3>
          <Icon icon="mdi:tune" class="mr-2" />
          Options avancées
        </h3>
        
        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Inclure les fichiers">
              <el-switch
                v-model="localConfig.includeFiles"
                @change="handleChange"
              />
            </el-form-item>
          </el-col>
          
          <el-col :span="12">
            <el-form-item label="Utiliser Supabase">
              <el-switch
                v-model="localConfig.useSupabase"
                @change="handleChange"
              />
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="20">
          <el-col :span="12">
            <el-form-item label="Notifier avant la sauvegarde">
              <el-switch
                v-model="localConfig.notifyBeforeBackup"
                @change="handleChange"
              />
            </el-form-item>
          </el-col>
          
          <el-col :span="12">
            <el-form-item label="Durée de rétention (jours)">
              <el-input-number
                v-model="localConfig.retentionDays"
                :min="1"
                :max="365"
                @change="handleChange"
              />
            </el-form-item>
          </el-col>
        </el-row>
      </div>
    </el-form>
  </div>
</template>

<style scoped>
.backup-settings {
  padding: 20px;
}

.settings-section {
  background-color: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 20px;
}

.settings-section h3 {
  display: flex;
  align-items: center;
  margin-top: 0;
  margin-bottom: 20px;
  color: #409EFF;
  font-size: 18px;
}

.mr-2 {
  margin-right: 8px;
}

:deep(.el-form-item) {
  margin-bottom: 20px;
}

:deep(.el-select),
:deep(.el-input-number) {
  width: 100%;
}
</style> 