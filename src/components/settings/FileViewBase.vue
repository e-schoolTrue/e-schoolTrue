<template>
  <v-container fluid class="file-view-base">
    <v-row>
      <!-- Contenu principal -->
      <v-col :cols="12" :md="9">
        <v-card class="main-content">
          <!-- En-tête -->
          <v-card-title class="d-flex align-center justify-space-between">
            <div class="d-flex align-center">
              <v-icon :icon="icon" class="mr-2" />
              {{ title }}
            </div>
            <div class="header-actions">
              <slot name="header-actions" />
            </div>
          </v-card-title>

          <!-- Alerte -->
          <slot name="header" />

          <!-- Contenu principal -->
          <v-card-text>
            <slot />
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Barre latérale -->
      <v-col :cols="12" :md="3">
        <slot name="sidebar" />
      </v-col>
    </v-row>
  </v-container>
</template>

<script setup lang="ts">
defineProps<{
  title: string;
  icon?: string;
}>();
</script>

<style scoped>
.file-view-base {
  height: 100%;
  padding: 20px;
  background-color: #f5f7fa;
}

.main-content {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.main-content :deep(.v-card-title) {
  padding: 16px 20px;
  border-bottom: 1px solid #e0e0e0;
}

.main-content :deep(.v-card-text) {
  flex: 1;
  padding: 20px;
  overflow-y: auto;
}

.header-actions {
  display: flex;
  gap: 8px;
}

/* Styles responsifs */
@media (max-width: 960px) {
  .file-view-base {
    padding: 10px;
  }

  .main-content :deep(.v-card-title) {
    padding: 12px 16px;
  }

  .main-content :deep(.v-card-text) {
    padding: 16px;
  }
}

@media (max-width: 600px) {
  .file-view-base {
    padding: 8px;
  }

  .main-content :deep(.v-card-title) {
    padding: 10px;
    flex-direction: column;
    align-items: flex-start !important;
    gap: 8px;
  }

  .header-actions {
    width: 100%;
    justify-content: flex-end;
  }
}
</style> 