<template>
  <div class="setup-page">
    <el-card class="setup-card" shadow="hover">
      <template #header><strong>Mot de passe comptable</strong></template>
      <p class="setup-desc">
        Aucune configuration séparée n'est requise : la comptabilité utilise
        votre <strong>mot de passe de connexion</strong>. Il vous sera demandé
        avant chaque saisie (preuve de moins de 60&nbsp;s).
      </p>
      <div class="setup-actions">
        <el-button type="primary" @click="goAccounting">Aller à la comptabilité</el-button>
      </div>
      <p class="setup-done" role="status">Redirection…</p>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'

/**
 * Écran historique de définition du secret comptable séparé — parcours SUPPRIMÉ.
 * Conservé (route `/comptabilite/setup`) pour compatibilité des liens : il
 * informe et redirige vers `/comptabilite` (néant fonctionnel).
 */
const router = useRouter()

function goAccounting(): void {
  void router.replace('/comptabilite')
}

onMounted(() => {
  ElMessage.info('Aucune configuration requise — utilisez votre mot de passe de connexion.')
  window.setTimeout(() => {
    void router.replace('/comptabilite')
  }, 1200)
})
</script>

<style scoped>
.setup-page {
  padding: 40px 20px;
  display: flex;
  justify-content: center;
  background: var(--app-page-bg-color, #f5f5f5);
  min-height: calc(100vh - 70px);
  box-sizing: border-box;
}
.setup-card {
  max-width: 560px;
  width: 100%;
  height: fit-content;
}
.setup-desc {
  font-size: 14px;
  color: var(--el-text-color-secondary);
}
.setup-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.setup-done {
  color: var(--el-color-success);
  font-weight: 600;
}
</style>
