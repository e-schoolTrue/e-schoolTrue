<template>
  <div class="notes-config">
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <h2>Configuration des Notes</h2>
        </div>
      </template>

      <!-- Contenu de la configuration -->
      <div class="config-content">
        <!-- Votre contenu de configuration ici -->
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
// Votre logique de configuration ici
</script>

<style scoped>
.notes-config {
  padding: 20px;
}

.config-card {
  max-width: 800px;
  margin: 0 auto;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
